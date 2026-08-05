# Migração de alunos da Ensinio → Peritos Academy

Importa os alunos da Ensinio a partir de `migracao/migracao_peritos_academy_FINAL.xlsx`
(766 linhas, 718 e-mails únicos).

## Ordem de execução

```bash
# 0. a migração de banco precisa estar aplicada (ver abaixo)

# 1. o catálogo produto→curso ainda bate com o banco e com o arquivo?
node scripts/migration/validarCatalogo.mjs

# 2. a matriz de acesso funciona? (cria e apaga usuários descartáveis)
node scripts/migration/testarMatrizAcesso.mjs

# 3. o que a importação FARIA (não escreve nada)
node scripts/migration/importarAlunos.mjs

# 4. ensaio com 3 alunos de verdade, pra conferir no banco antes do lote todo
node scripts/migration/importarAlunos.mjs --limite=3 --executar

# 5. o lote completo
node scripts/migration/importarAlunos.mjs --executar
```

**Antes do passo 5, faça backup do banco** (Supabase → Database → Backups, ou
`pg_dump`). A importação é idempotente e não apaga nada, mas criar ~400 contas
de autenticação não é algo que se desfaça com um clique.

### Migração de banco (passo 0)

Duas migrações, nesta ordem:

1. `supabase/migrations/20260805_migracao_alunos_entitlements.sql`
2. `supabase/migrations/20260805_criar_perfil_suprime_boas_vindas_migrado.sql`

Podem ser aplicadas por aqui, sem abrir o SQL Editor — há um runner via
Management API (usa `SUPABASE_ACCESS_TOKEN`, roda como `postgres`):

```bash
node scripts/migration/sql.mjs --arquivo=supabase/migrations/<arquivo>.sql
node scripts/migration/sql.mjs "select 1;"     # query solta
```

O importador se recusa a rodar se a primeira não tiver sido aplicada.

## Flags

| Flag | Efeito |
|---|---|
| *(nenhuma)* | **dry-run** — imprime o plano e gera o CSV, sem escrever no banco |
| `--executar` | grava de verdade |
| `--limite=N` | processa só os N primeiros alunos (ensaio) |
| `--arquivo=caminho` | usa outro XLSX |
| `--hoje=YYYY-MM-DD` | fixa a data de corte da vigência (default: hoje em Brasília) |

## O que o importador faz

Para cada aluno com **pelo menos um produto vigente**:

1. cria o usuário no Auth (senha aleatória de 32 bytes, nunca impressa nem
   enviada) ou reaproveita o existente, se o e-mail já estiver cadastrado;
2. atualiza `perfis` (nome, telefone, `migrado_de`, `migrado_em`);
3. cria uma linha em `acessos_conteudo` por produto vigente — mais as exceções
   em `acessos_excecoes` e a concessão de biblioteca, quando a regra pedir;
4. registra a linha em `migracao_alunos`.

Produtos **vencidos** e alunos **sem nenhum produto vigente** entram só em
`migracao_alunos` com `importado = false` e o motivo — nenhum usuário nem
acesso é criado para eles.

### Recorte da importação (decisão de produto)

As datas de validade do arquivo vão de 2025-05-15 a 2027-08-04. Contra
2026-08-05, **344 das 507 concessões com data já estavam vencidas**, o que
deixaria **315 dos 718 alunos sem acesso a nada** — inclusive os 264 de
"Revisão do saldo da conta PASEP", cuja validade mais recente é 2026-07-21.

Ficou decidido **importar somente os 403 alunos com acesso vigente**. Os 315
restantes não viram usuário: ficam registrados em `migracao_alunos`
(`importado = false`) e no CSV de cada execução, prontos para uma decisão
comercial posterior (reativar, oferecer desconto, arquivar).

Números esperados no dry-run, com corte em 2026-08-05:

```
alunos a importar ............... 403
alunos ignorados (tudo vencido) . 315
concessões de acesso ............ 612
  escopo total .................. 378
  escopo curso .................. 42
  escopo biblioteca ............. 192
  vitalícias .................... 406
  com prazo ..................... 206
```

## Idempotência

`migracao_alunos` é o livro-caixa: a chave única
`(lower(email), plano_origem, data_vencimento)` garante que rodar duas vezes
não duplica usuário, concessão nem histórico — linhas já registradas são
puladas e contadas como tal. (No arquivo atual não há nenhuma linha duplicada,
e nenhum aluno com o mesmo produto em duas validades — verificado.)

## E-mails

**Nenhum e-mail é disparado pela importação.** O trigger `ao_criar_usuario` em
`auth.users` (função `criar_perfil`) chama `/api/internal/email-evento` para
todo usuário novo, o que enviaria as boas-vindas padrão para os ~400 alunos.

O corte está em **dois** lugares:

1. **`criar_perfil` (banco)** — se o usuário nasce com `migrado_de` no
   metadata, a função retorna antes do `net.http_post`. É o corte que vale.
2. **`/api/internal/email-evento` (rota)** — recusa `boas_vindas` para quem tem
   `migrado_de`, lido de `auth.users`. Segunda linha de defesa.

> ### Incidente registrado
> No ensaio de 3 alunos, **3 e-mails de boas-vindas reais foram enviados**
> (Celso, Jonas, Milton). Motivo: o corte existia só na rota, e a URL chamada
> pelo trigger é a de **produção** — código local e não deployado não protege
> nada. Foi daí que veio o corte no banco, que não depende de deploy.
>
> Lição para qualquer trigger que chame a aplicação por `pg_net`: o que roda é
> a versão publicada, não a do checkout.

> Se mexer no `user_metadata` do importador, **não remova `migrado_de`** — é o
> que segura o e-mail. Ele é lido de `auth.users` (não de `perfis.migrado_de`)
> porque o perfil só é atualizado pelo importador DEPOIS da criação do usuário.

Verificação (cria dois usuários descartáveis, um com a flag e um sem, e compara
`email_enviados`): o teste está descrito no relatório da migração.

A comunicação de migração é enviada à parte, com texto próprio, apontando para
**`/primeiro-acesso`**.

## Primeiro acesso do aluno migrado

O aluno tem conta, mas nunca teve senha (a da importação é aleatória e ninguém
a conhece). Em `/primeiro-acesso` ele informa o e-mail e recebe o link para
definir a senha, caindo no `/redefinir-senha` que já existia.

A página existe em vez de um link pronto no e-mail porque link de recuperação
do Supabase expira, e uma campanha para 400 pessoas é lida ao longo de dias —
link pronto geraria uma fila de "meu link não funciona". Aqui o link nasce no
momento em que o aluno decide entrar.

Por isso `/primeiro-acesso` e `/redefinir-senha` entraram na lista de rotas
neutras do `middleware.ts`: sem isso, ligar o modo manutenção durante a
importação transformaria a campanha inteira numa página de manutenção.

No primeiro login o aluno vê uma vez o cartão de boas-vindas
(`components/BoasVindasMigrado.tsx`), que explica que a conta foi transferida e
avisa que o **progresso de aulas começa do zero** — só o acesso ao conteúdo
veio junto.

## Relatórios

Cada execução grava em `migracao/logs/`:

- `importacao_{dryrun|exec}_<timestamp>.log` — o mesmo texto do terminal;
- `importacao_{dryrun|exec}_<timestamp>.csv` — uma linha por linha do arquivo,
  com `situacao` (`importado` / `nao_importado`) e o motivo.

## Arquivos

| Arquivo | Papel |
|---|---|
| `lerXlsx.mjs` | leitor de XLSX sem dependência externa (o arquivo usa `inlineStr` e tem uma só planilha) |
| `catalogo.mjs` | os 13 produtos → regra de acesso, exceções e slugs de curso |
| `planejar.mjs` | XLSX → plano de importação (lógica pura, sem banco) |
| `importarAlunos.mjs` | aplica o plano |
| `validarCatalogo.mjs` | confere o catálogo contra o banco e contra o arquivo |
| `testarMatrizAcesso.mjs` | testa a matriz com usuários descartáveis (28 asserções) |
| `sql.mjs` | roda SQL via Management API (migrações e consultas avulsas) |

O dry-run e a execução chamam **o mesmo** `planejar()`, então não existe a
possibilidade de o dry-run mostrar uma coisa e a execução fazer outra.

## Pontos de atenção herdados do mapeamento

Registrados aqui porque são interpretações, não fatos do arquivo:

- **"MasterClass"** (exceção do Black Friday) não é um curso: é a **trilha**
  `masterclass-exclusivas-da-peritos-academy`, e a exceção é da trilha inteira
  (confirmado pelo dono do produto). Fica gravada como referência à trilha, não
  expandida nos cursos que ela tem hoje — então curso novo publicado dentro da
  MasterClass já nasce excluído para os 112 alunos do Black Friday, sem script
  de correção. Hoje a trilha tem 1 curso (*Dominando os cálculos revisionais do
  Banco do Brasil*).
  - O vínculo curso→trilha é lido das tabelas base
    (`etapa_missoes → etapas → trilhas`) e **não** da view `curso_trilha`:
    aquela view é `DISTINCT ON (curso_id)` e devolve no máximo uma trilha por
    curso, então um curso que estivesse na MasterClass e também em outra trilha
    poderia não aparecer como MasterClass ali — e a exceção furaria.
- **"Planilhas Jornada de Trabalho"** → *Planilha Automática de Cartão Ponto*
  (`planilha-automatica-de-apuracao-de-jornada`). Confirmado pelo dono do
  produto.
- **"Biblioteca de Planilhas"** não é curso: é a Biblioteca, controlada por
  `perfis.acesso_biblioteca` e agora também por concessão de escopo
  `biblioteca` (que, diferente da flag, expira).

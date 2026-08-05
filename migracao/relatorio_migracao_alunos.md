# Relatório — Migração de alunos da Ensinio

**Executado em** 2026-08-05 · **Data de corte da vigência** 2026-08-05
**Arquivo de origem** `migracao_peritos_academy_FINAL.xlsx` (766 linhas, 718 e-mails únicos, 13 produtos)
**Ferramental** `scripts/migration/` (runbook em `scripts/migration/README.md`)

## Resultado

| | |
|---|---|
| Linhas lidas | 766 |
| Linhas com erro de leitura | **0** |
| Alunos importados | **403** |
| Alunos não importados (tudo vencido) | **315** |
| Concessões de acesso criadas | **612** |
| Falhas | **0** |

Conferido no banco após a execução — todos os números batem com o dry-run:

```
alunos_migrados      403
concessoes           612   (total 378 · curso 42 · biblioteca 192)
vitalicias           406
com_prazo            206
exc_curso            784   (= 112 alunos Black Friday × 7 cursos)
exc_trilha           112   (= 112 alunos × 1 trilha "MasterClass")
hist_importado       420
hist_nao_importado   346   (420 + 346 = 766 linhas do arquivo)
```

### Produtos importados (vigentes)

| Produto | Alunos | Acesso | Vencimento |
|---|--:|---|---|
| Membro Fundador Infinity | 128 | total + biblioteca | vitalício |
| Black Friday 2023 | 112 | total exceto 7 cursos + trilha MasterClass + biblioteca | vitalício |
| Desafio Viver de Perícia | 74 | total, sem biblioteca | até a validade |
| Assinatura Ultra | 45 | total + biblioteca | até a validade |
| PJE Calc e Liquidação de Sentença | 42 | só o curso PJE Calc | até a validade |
| Grupo Antigo Infinity | 19 | total + biblioteca | vitalício |

### Produtos não importados (vencidos antes de 2026-08-05)

| Produto | Linhas |
|---|--:|
| Revisão do saldo da conta PASEP | 259 |
| Planilha Super Endividamento | 30 |
| Modelos de e-mails que vendem milhões | 14 |
| Assinatura Ultra | 11 |
| Assinatura Pro | 7 |
| Planilha RMC e RCC | 4 |
| Assinatura Premium | 2 |
| Peritos Academy Experience | 1 |

**Por que foram deixados de fora:** as validades do arquivo vão de 2025-05-15 a
2027-08-04. Contra 2026-08-05, 344 das 507 concessões com data já estavam
vencidas — importá-las criaria 315 contas que o aluno abriria e não veria nada.
Os 264 do PASEP venceram todos (o mais recente em 2026-07-21).

Eles **não têm usuário criado**. Ficam em `migracao_alunos` com
`importado = false` e o motivo, e no CSV de cada execução — prontos para uma
decisão comercial (reativar, oferecer desconto, arquivar). Para listar:

```sql
select email, nome_completo, plano_origem, data_vencimento, valor_pago_origem
from migracao_alunos
where not importado
order by data_vencimento desc;
```

## Verificação da matriz de acesso

`scripts/migration/testarMatrizAcesso.mjs` — **28 asserções, 0 falhas**, com
usuários descartáveis criados e apagados na própria execução. Cobre acesso total
vitalício, total com exceções de curso, exceção de trilha inteira, acesso de um
curso só, concessão vencida (incluindo empurrar a data para ontem/amanhã e ver o
gate virar junto), aluno sem concessão, e a RLS de material de aula **com sessão
real do aluno** (service role ignora RLS e daria falso positivo).

Conferido também contra alunos reais já importados, um de cada produto:

| Produto (amostra) | curso livre | PJE Calc | MasterClass | PASEP | biblioteca |
|---|:-:|:-:|:-:|:-:|:-:|
| Membro Fundador Infinity | ✅ | ✅ | ✅ | ✅ | ✅ |
| Grupo Antigo Infinity | ✅ | ✅ | ✅ | ✅ | ✅ |
| Assinatura Ultra | ✅ | ✅ | ✅ | ✅ | ✅ |
| Black Friday 2023 | ✅ | ❌ | ❌ | ✅ | ❌ |
| Desafio Viver de Perícia | ✅ | ✅ | ✅ | ✅ | ❌ |
| PJE Calc (avulso) | ❌ | ✅ | ❌ | ❌ | ❌ |

## 🔴 Incidente: 3 e-mails de boas-vindas enviados por engano

No ensaio com 3 alunos, **3 e-mails reais de boas-vindas foram disparados**:

- `milperadv@yahoo.com.br` (MILTON)
- `jonas.direito@yahoo.com.br` (Jonas)
- `celsojosebecker@gmail.com` (Celso)

**Causa:** o trigger `ao_criar_usuario` (função `criar_perfil`) faz
`net.http_post` para `/api/internal/email-evento` a cada usuário novo, e a URL
é fixa, apontando para **produção**. A supressão que eu havia escrito estava só
no route handler do checkout local — código não deployado não protege nada.

**Correção:** o corte passou para o banco
(`20260805_criar_perfil_suprime_boas_vindas_migrado.sql`): `criar_perfil`
retorna antes do `net.http_post` quando o usuário nasce com `migrado_de` no
metadata. Não depende de deploy, não gasta requisição para receber um "não
envie" de volta, e funciona mesmo com a Vercel fora. O guard no route handler
continua como segunda linha de defesa.

**Verificação:** dois usuários descartáveis, um com a flag e um sem (controle) →
0 e-mails para o migrado, 1 para o normal. Ou seja, boas-vindas de cadastro
nativo continua funcionando. Durante a importação dos 400 alunos restantes,
**nenhum e-mail foi enviado** (conferido em `email_enviados`).

Os 3 e-mails não são recuperáveis. As linhas em `email_enviados` foram
**mantidas** de propósito: registram o fato e impedem um segundo envio pelo
dedupe. Se esses 3 alunos escreverem confusos, o contexto é este.

## Pendências e observações

- **Comunicação de migração não foi enviada** — é a próxima etapa, com texto
  próprio, apontando para `/primeiro-acesso`. Nenhum dos 403 sabe ainda que a
  conta existe (exceto os 3 do incidente).
- **Progresso de aulas não veio da Ensinio** — só o acesso ao conteúdo. O
  cartão de boas-vindas (`BoasVindasMigrado.tsx`) avisa isso ao aluno.
- **Nenhum aluno migrado tem linha em `assinaturas`** — o acesso vem só de
  `acessos_conteudo`. Isso é de propósito: não poluir MRR/relatórios do módulo
  Financeiro com receita que não existe. Quando um deles assinar de verdade pelo
  Asaas, a assinatura entra normal e soma.
- **206 concessões têm prazo** e vão expirar sozinhas (a mais próxima em
  2026-08-10, três alunos). O bloqueio é calculado na leitura, sem cron. Vale
  planejar a comunicação de renovação antes das ondas de vencimento.
- **`AssinaturaNecessaria` é genérica** — um aluno "Apenas PJE Calc" que clica
  num curso que não comprou vê "regularize sua assinatura", que não menciona
  que ele tem acesso a outra coisa. Melhoria de UX, não bug.
- **Se a trilha MasterClass ganhar cursos**, eles ficam automaticamente
  excluídos para os 112 alunos do Black Friday — a exceção é por referência à
  trilha, não uma lista congelada. É o comportamento desejado, mas convém
  saber ao publicar conteúdo novo lá.

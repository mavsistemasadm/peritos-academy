# Peritos Academy — Contexto do Projeto

## O que é
Plataforma de educação para peritos judiciais (perícia bancária, cálculos judiciais, contratos). Estrutura de trilhas → cursos → módulos → aulas, com quiz/avaliações, desafios periciais ("O Caso"), comunidade gamificada, agenda de eventos, perfil público do perito e certificados automáticos.

## Stack
- **Next.js 15** (App Router, React Server Components + Server Actions), TypeScript
- **Supabase** (PostgreSQL, RLS, RPCs security-definer, views, Storage)
- **Vídeo**: Panda Video (iframe embed, domínio `player-vz-a94806ca-13a.tv.pandavideo.com.br`)
- **IA**: Anthropic API (Claude Haiku `claude-haiku-4-5-20251001`) para feedback de correções e explicações
- **Gateway de pagamento**: Asaas (assinaturas — a integrar no admin)
- **Deploy**: Vercel, repo `github.com/mavsistemasadm/peritos-academy`, branch `main`
- **Endereço**: `https://evolua.peritosacademy.com.br` (domínio próprio desde 14/08/2026, apontado para o mesmo deploy que antes só respondia em `peritos-academy.vercel.app`). Ele mora em **`lib/site.ts`**, em `SITE_URL`, e mais em lugar nenhum — nem no HTML dos emails, nem em env. Ver "O endereço da plataforma" abaixo.
- **Ambiente**: Windows, VS Code, PowerShell

## O endereço da plataforma — 2026-08-14

**Regra permanente.** O endereço desta plataforma é `SITE_URL`, em `lib/site.ts`, e `SITE_HOST` é derivado dele. **Nenhum arquivo escreve o endereço à mão** — nem o HTML dos emails, nem tela de admin, nem `redirectTo` de Auth.

A plataforma nasceu em `peritos-academy.vercel.app` e ganhou domínio próprio em 14/08/2026: `https://evolua.peritosacademy.com.br`, apontado para o mesmo projeto da Vercel. O endereço do produto é o domínio; o `.vercel.app` é o host da hospedagem, e some no dia em que o deploy sair de lá.

Por que a constante existe: o endereço estava **copiado em 38 lugares**, 36 deles dentro do HTML dos 18 emails (boas-vindas, primeira semana, os 9 de subida de nível, certificado, curso concluído, resumo quinzenal, carta pessoal, os 2 de inatividade) e nos links de rodapé de `lib/email/enviar.ts`. Email não tem tela de erro: link para host que parou de responder não avisa ninguém — o aluno clica, não abre, e desiste calado. E endereço copiado em 38 lugares não é trocado em 38 no dia da mudança: é trocado em 30, e os outros 8 seguem apontando para o lugar velho sem nada acusando. É o mesmo defeito que o cartão do Nexus teve por meses apontando para a Ensinio.

⚠️ **Não lê env, de propósito.** `NEXT_PUBLIC_SITE_URL` era lida em `app/admin/usuarios/actions.ts` com o `.vercel.app` de fallback, e **nunca esteve definida em produção** (conferido em `vercel env ls` em 14/08/2026) — o fallback é que era o valor real. Env não definida em lugar nenhum é endereço que muda sem passar por revisão.

⚠️ **A constante do TS não alcança dois lugares. Os dois foram trocados em 14/08/2026, e um deploy sozinho não teria trocado nenhum:**

- **Os triggers do banco.** `criar_perfil`, `creditar_gamificacao`, `gam_trg_certificados` e `gam_verificar_progresso_curso` fazem `net.http_post` para `/api/internal/email-evento` com o endereço cravado dentro do corpo SQL — é assim que o Postgres avisa a aplicação, já que trigger não fala HTTPS. Trocado por `20260814_endereco_proprio_nos_triggers.sql`, gerado do `pg_get_functiondef` vivo de cada função (nunca redigitado), com a URL e só ela substituída. Isso não consertava nada quebrado hoje: consertava o dia em que o `.vercel.app` parasse de responder, e aquele dia não daria erro nenhum — o `net.http_post` é assíncrono e ninguém lê a resposta, então o sintoma seria o email não sair, sem log e sem alerta.
- **Auth do Supabase**: `site_url` e a allowlist de Redirect URLs, que estavam nos dois no `.vercel.app`. Isso **anulava o `redirectTo` do código**: o Supabase não aceita destino fora da allowlist, ele o troca em silêncio pelo Site URL. Ou seja, o link de redefinição de senha continuaria indo para o endereço velho por mais que `SITE_URL` mudasse. A allowlist ficou com **os dois** endereços — link já enviado num email antigo aponta para o `.vercel.app`, e tirá-lo da lista quebraria quem clicasse nele depois.

⚠️ Isso vale como regra, não como registro: **endereço nesta plataforma vive em três sistemas** — código (`lib/site.ts`), banco (corpo das funções) e config do Auth. Trocar só o primeiro passa em revisão, builda, deploya, e deixa dois terços do problema no ar.

## Acesso parcial: o comprador de curso avulso — 2026-08-14

**Regra permanente.** Seção que não é de um curso exige **acesso completo** —
assinatura Asaas vigente **ou** concessão de escopo `total`. Quem decide é
`verificarAcessoConteudo()` em `lib/acesso/verificar.ts`, e `carregarResumoAcesso()`
é a fonte única do que a pessoa tem.

⚠️ **Não use `tem_acesso_plataforma` para gatear página.** Aquela RPC é
*"assinatura ativa OU **qualquer** concessão vigente"* — comprar um curso avulso
abria Comunidade, Agenda e Desafios junto. Era decisão deliberada de 05/08, para
o migrado "Apenas PASEP" não ficar fora da Comunidade; foi revertida em 14/08 por
decisão comercial (quem tem de graça o que estamos vendendo não assina).

A checagem ficou no **TypeScript** e a RPC não mudou, de propósito: ela também é
lida por policies de RLS de material e de storage, e ainda é a resposta certa
para *"esta pessoa tem algum acesso na Academy?"* — que é o que o Nexus pergunta
em `lib/acesso/academy-db.ts` para decidir se o SSO entra. **As duas perguntas
divergiram e têm nomes parecidos: cuidado ao mexer numa achando que é a outra.**

### Onde tem portão, e onde não tinha nenhum

| Seção | Exige |
|---|---|
| `/curso/[slug]`, `/aula`, `/avaliacao` | aquele curso (`tem_acesso_curso`) |
| `/biblioteca` | escopo `biblioteca` ou a flag do perfil |
| Materiais de aula (RLS + bucket) | aquele curso |
| `/comunidade`, `/agenda`, `/desafios` | acesso completo |
| `/jornada`, `/jornada/[slug]` | acesso completo |
| `/anamnese`, `/meu-plano` (Rota do Perito) | acesso completo |
| `/gamificacao` | acesso completo |
| `/cursos` (catálogo) | só login — **de propósito**, ver o que existe é o que dá vontade de comprar |
| Curso com `restrito` | matrícula nominal — ver "Turma fechada" |
| Certificado | concluir o curso; não olha tipo de acesso |

As cinco linhas de Jornada, Rota do Perito e Gamificação **não tinham portão
nenhum** antes de 14/08 — bastava estar logado, para qualquer conta.

Medido antes de aplicar: 458 pessoas seguem com tudo, **41 passam a ver o
convite** — todas da migração da Ensinio, todas do PJE Calc avulso, nenhuma com
linha em `assinaturas`, e **nenhuma jamais entrou na plataforma** (zero login,
zero post). Perdem um acesso que nunca usaram.

⚠️ A tela de bloqueio (`AssinaturaNecessaria`) mostra **o que a pessoa tem** —
curso e prazo. Sem isso ela é indistinguível de um acesso quebrado para quem
pagou por alguma coisa, e é o que faz abrir chamado ou desistir achando que foi
enganado.

### A home continua vendendo a plataforma inteira, e isso é decisão

⚠️ **Não "conserte" isto.** A home do acesso parcial continua sendo o painel da
Jornada: o título diz "Sua jornada está pronta", os botões são "Começar agora" e
"Ver minha jornada", a barra mostra a Trilha de Formação, e o menu lista
Comunidade, Agenda e Desafios. **Tudo isso leva ao cadeado**, e é assim de
propósito — decisão comercial de 15/08/2026.

O raciocínio é o mesmo do cartão trancado no painel do Nexus, que também é
clicável: quem comprou um curso avulso é candidato a assinante, e deixá-lo
navegar dá o gostinho. Cartão morto ensina a ignorar aquele canto da tela; tela
apagada não gera desejo. É por isso que a tela de bloqueio (`AssinaturaNecessaria`)
foi feita para ser um bom momento de venda, e não um beco: ela diz o que a pessoa
TEM, com prazo, e convida.

**O que sai é o que ele não escolheu ver.** A distinção é essa, e não "mostrar ou
esconder a plataforma":

| | Fica | Sai |
|---|---|---|
| Ele clica e explora | ✅ | |
| Interrompe na porta | | ❌ |

Por isso saem a apresentação, o tour, o popup de novidades e o convite da Rota —
todos aparecem sem ele pedir, antes de ele ver qualquer coisa. E fica o resto da
navegação, que ele abre quando quiser.

### O login dele é o do NEXUS, não o daqui

A conta da Academy existe para o SSO achar e para carregar a concessão. Mas ele
entra pelo painel do Nexus em modo vitrine — é lá que a assinatura é vendida.
`/admin/acessos` chama `POST /api/integracoes/aluno-curso` no Nexus
(`NEXUS_INTEGRACAO_KEY`), que cria a conta com `plano_tier: 'academy_curso'` e
grava o `academy_user_id`. O convite de criação de senha é o **do Nexus**.

A chamada acontece **depois** de gravar a concessão: Nexus fora do ar não desfaz
o acesso ao curso, mas o erro volta para a tela — senão o operador fecha a janela
achando que terminou enquanto a pessoa ficou sem porta de entrada.

## ✅ Incidente produção — RESOLVIDO — 2026-07-13
`https://peritos-academy.vercel.app` retornava `500 MIDDLEWARE_INVOCATION_FAILED` em **todas** as rotas. Causa raiz era **dupla** — dois bugs empilhados, por isso nenhum fix isolado de código resolvia sozinho. Produção confirmada no ar (login, cursos e nav funcionando).

### Causa raiz
1. **Framework Preset errado no painel da Vercel** — configurado como "Other" em vez de "Next.js" desde a criação do projeto. Sem o preset certo, a Vercel buildava sem o pipeline do Next e empacotava o Edge middleware de forma genérica → bundle de 102,83KB com `[ReferenceError: __dirname is not defined]`. Fix: corrigir o Framework Preset no painel (Project Settings → Build & Development) → middleware voltou aos ~87,3KB sadios.
2. **Envs de produção com typo** — `NEXT_PUBLIC_SUPABASE_URL` e afins tinham valor grafado com "supbase" (faltando o segundo "a"). Só ficou visível depois do fix #1: quando o build sarou, o middleware passou a falhar com `"Your project's URL and Key are required to create a Supabase client!"`. Fix: as 3 envs apagadas e recriadas no painel copiando exatamente do `.env.local`.

### Lições (aplicar em incidentes futuros)
- **Erro que só acontece na Vercel e nunca reproduz local → conferir Framework Preset e Environment Variables no painel ANTES de bisectar código.** O painel da Vercel é parte do sistema, não é só "config", e não aparece em nenhum diff do git.
- **Bugs podem vir empilhados.** Corrigir a causa #1 e o sistema continuar quebrado (com um erro *diferente*) não é sinal de que o fix estava errado — pode só ter revelado o próximo bug. Não reverter um fix correto por causa disso.
- Worktrees precisam de `npm ci` próprio — `node_modules` herdado/copiado pode mascarar divergências de lockfile.
- `engines.node` pinado no `package.json` sempre (evita builds em versão de Node diferente da testada localmente).
- Preview URLs (`*.vercel.app` com hash) ficam atrás do SSO da Vercel e mascaram erros reais — validar sempre pelo domínio de produção alias ou por `vercel logs --json`.
- **Todo merge em `main` termina abrindo a URL de produção e navegando 2-3 páginas** antes de considerar o deploy encerrado.

### Ferramental usado (referência pra próximos incidentes)
- Vercel CLI (`vercel`) está instalado e autenticado (`mavsistemasadm`) — mas **cuidado ao rodar `vercel link`**: existe um projeto irmão `peritos-academy-2026` que o CLI pode linkar por engano (nome parecido); o projeto certo, que serve `peritos-academy.vercel.app`, é **`peritos-academy`** (`prj_Sdg7rd2hasTnlMpTNRQTPa87TTQH`).
- `vercel promote <url>` **não** promove o artefato exato — ele dispara um rebuild a partir do branch `main` conectado no Git. Se o fix está só localmente commitado (não empurrado pro `origin/main`), `promote` vai rebuildar o código **antigo**. Sempre dar `git push origin HEAD:main` antes de esperar que o deploy automático reflita um fix.
- URLs de deployment não-aliased (`*.vercel.app` com hash) ficam atrás do SSO da Vercel (redirect 302 pra `vercel.com/sso-api`) — isso **mascara** erros da aplicação real. Só o domínio de produção alias (`peritos-academy.vercel.app`) responde sem essa proteção; teste sempre por ali.
- `vercel logs <url> --json` é a forma confiável de pegar o erro real por trás de um request ID / `MIDDLEWARE_INVOCATION_FAILED`.

### Backlog técnico
- `@supabase/supabase-js` emite warning usando `process.version` no Edge Runtime — não-fatal hoje, monitorar em upgrades futuros de `@supabase/ssr`/`@supabase/supabase-js` ou do Next.js.

## ✅ Migração de conteúdo Ensinio → Peritos Academy — CONCLUÍDA — 2026-07-13
75 cursos, 178 módulos, 604 aulas, 408 materiais (218 aulas), 75 capas de curso e 180 thumbnails de aula importados e publicados em produção (`main`, deploy Vercel confirmado). Relatório completo em `migracao/relatorio_importacao.md` (pendências detalhadas, contagens, arquivos de suporte). Cursos ficam em rascunho (`publicado=false`) até revisão de conteúdo.

Achado importante desta sessão: a feature de upload real de materiais (`aula_materiais` — URL assinada, RLS por assinatura) só existia em código numa branch separada (`worktree-icones-sistema`), 14 commits à frente de `main`, que também continha um fix de incidente de produção não mergeado (Next 15.3.6→15.3.9, `engines.node`) e os módulos Financeiro/Usuários/Configurações inteiros. Fast-forward feito e testado (build + smoke test de download em produção via URL assinada, bytes conferidos). **Se aparecer código/schema documentado neste arquivo que não bate com o que está em `main`, suspeitar primeiro de uma branch/worktree desalinhada antes de assumir bug.**

### Pendências da migração (não bloqueiam nada, só não foram feitas)
- 3 materiais grandes (54–165MB) não couberam no teto do plano Supabase (~50MB) — arquivos originais em `migracao/materiais/`, path completo no relatório.
- ~~37 aulas com quiz na Ensinio precisam ser recriadas manualmente como `avaliacoes`~~ ✅ **resolvida em 2026-07-14** — as 37 avaliações (297 questões, 1132 alternativas) foram extraídas da API da Ensinio e recriadas via script (não manualmente), 100% conferidas contra o JSON bruto. Relatório completo em `migracao/relatorio_avaliacoes.md`. Ficam pra depois: calibragem de `peso`/`briefing`/`tema`/`nota_minima` (todas com os defaults do schema) e ajuste fino de posição entre aulas do módulo (a coluna `avaliacoes.ordem` não é lida por nenhuma tela hoje — módulo+posição originais da Ensinio ficam documentados no relatório pra quem for encaixar isso manualmente). Todas as 37 estão `publicado=false` (mesmo comportamento de `criarAvaliacao()` no admin).
- 6 aulas com vídeo fora do Panda (Vimeo/ensinio-stream) — lista em `migracao/videos_a_resolver.md`.

## Design System
- Carvão `#070908` (fundo), Creme `#F1F2DF` (texto), Verde `#20D9A6`, Ciano `#36DCD1`, Lima `#DDF784`
- Fonte Inter
- Cinza `#989E99`, Cinza-claro `#B9BFB8`
- CSS custom props: `--verde`, `--ciano`, `--lima`, `--carvao`, `--creme`, `--cinza`, `--cinza-claro`, `--linha`, `--linha-suave`, `--preto-elev`, `--r-card`, `--r-pill`, `--suave`, `--s-2` a `--s-7` (espaçamentos)
- Evitar fundos pretos "mortos"; usar degradês radiais sutis da marca

## Arquitetura de arquivos (padrão de página)
Sequência de build de cada página:
1. Migração SQL (rodar no Supabase SQL Editor)
2. Seed SQL (UUIDs fixos com `ON CONFLICT (id) DO UPDATE` — idempotente)
3. `lib/queries/[pagina].ts` — carrega dados
4. `app/[pagina]/actions.ts` — server actions, chamam `revalidatePath` após mutação
5. `components/[Pagina]Content.tsx` — componente client
6. `app/[pagina]/page.tsx` — server component, `export const dynamic = 'force-dynamic'` em páginas time-sensitive
7. CSS escopado por classe de página (`.pagina-[nome]`) appendado em `app/globals.css`

## Regras de CSS
- Todo CSS escopado sob uma classe raiz da página (ex.: `.pagina-perfil`, `.pagina-agenda`, `.pagina-bib-cursos`)
- `@keyframes` têm sufixo por página (são globais): ex. `certBounce`, `piscaAg`, `np-drop`
- A classe raiz DEVE estar no elemento wrapper ou os seletores não casam
- Definir custom properties antes de usar em animações
- ⚠️ **Nome de classe nunca pode parecer anúncio** — evitar `ad`, `ads`, `advert`,
  `banner`, `promo`, `sponsor` (ver "O painel admin invisível" abaixo)

## O painel admin invisível: o prefixo `ad-` — 2026-08-17

**Regra permanente.** O prefixo do painel admin é **`pnl-`** (painel). Ele era
`ad-` e não volta a ser. Classe que pareça anúncio é comida por bloqueador:
`ad-sidebar` e `ad-card` estão nas listas de filtro do uBlock/AdBlock/Brave, que
aplicam `display:none` neles no navegador do usuário.

O sintoma **não parece CSS, parece falta de permissão**, e foi assim que chegou:
um super admin real (o Lucas, papel concedido em 10/08) abria `/admin`, a página
dizia "Seus papéis: Super Admin" — servidor reconhecendo tudo — e o resto era
tela preta. Sem menu lateral (`.ad-sidebar`), sem cartão nenhum (`.ad-card`).
Sobrava só o `<h1>` e o `.ad-sub`, que não casam com filtro nenhum.

E a tela ficava torta de brinde: `.pnl-shell` é um grid `240px 1fr`; removida a
sidebar da árvore, o `<main>` escorrega para a coluna de 240px e o conteúdo
quebra em duas linhas dentro de uma faixa estreita.

⚠️ **Ninguém do lado do servidor consegue ver isso.** Não gera erro, não aparece
em log, `admin_usuarios` está certo, RLS está certa, o middleware libera. Só
reproduz em quem tem bloqueador — e o dono do produto não tinha, então para ele
o painel sempre funcionou. Foi preciso um print do outro lado para descobrir.

Ainda existem duas classes de risco parecido, não renomeadas por serem de baixo
alcance: `.np-banner-manutencao` (banner de manutenção, só admin vê) e
`.mp-tesouro-banner` (Meu Plano). Se alguém relatar "sumiu um pedaço da tela",
suspeitar disso antes de procurar bug de dado.

## Supabase — padrões críticos
- Cliente via `criarClienteServidor()` de `@/lib/supabase/server` (NUNCA `createClient` direto em queries — quebra o build por falta de env vars)
- Páginas públicas (sem login) precisam de policies RLS de leitura pública explícitas
- Migrações defensivas em tabelas pré-existentes: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `DROP POLICY IF EXISTS` antes de dropar colunas dependentes, check constraints `NOT VALID`
- RLS pode bloquear drop de coluna — dropar policy primeiro
- Lógica sensível (correção, gabarito) em RPCs security-definer; só colunas não-sensíveis expostas ao client via views
- Triggers que chamam funções precisam de `set search_path = public`
- Login usa password auth (não magic link) pra setar cookie de sessão
- `middleware.ts` deve refrescar sessões ativamente

## Correção com IA
- Claude Haiku, headers `x-api-key` + `anthropic-version: 2023-06-01`
- Prompt pede JSON sem markdown; limpar markdown com regex no client (remove #, **, travessões)
- Envia contexto do caso/questão pra IA gerar feedback personalizado; fallback pro parecer estático

## Certificados
- Cursos têm `emite_certificado` (bool) e `carga_horas` (numeric, preenchível no admin)
- Emissão automática: checagem via RPC `gam_curso_completo(usuario, curso)` (100% `aula_progresso.concluida=true` + todas `avaliacoes` do curso com `avaliacao_tentativas.aprovado=true`) — mesma função usada pelo motor de gamificação, ver seção Gamificação
- Número via RPC `nextval_certificado()` (sequência `seq_certificado_numero`), formato `PA-{ano}-{5dígitos}`
- Constraint `uq_cert_usuario_curso unique(usuario_id, curso_id)`
- Popup animado com confetes randômicos ao completar
- Lógica em `lib/certificados/gerar.ts` → `verificarEEmitirCertificado(supabase, userId, cursoId)`
- Auditoria retroativa (2026-07-13): checado se havia aluno com curso completo sem certificado emitido (bug do `aula_concluida` fantasma) — plataforma ainda pré-lançamento, `aula_progresso` está zerada, nenhum caso pendente

## Materiais complementares das aulas
`aula_materiais` já existia desde o Bloco 1, mas só como metadados com link colado à mão (`arquivo_url` sempre nulo no seed) — nunca teve upload de arquivo real. Migrado em 2026-07-13 pra suportar isso, motivado pela migração de conteúdo da Ensinio (aulas de lá têm anexos que precisam de casa aqui).
- Schema: `tipo` agora é `pdf|xlsx|docx|zip|outro` (antes só `pdf|xls` — havia um check constraint **não rastreado em migração nenhuma**, criado direto no SQL Editor; cuidado com isso ao mexer nessa tabela de novo). Colunas novas: `tamanho_bytes`, `criado_em`.
- `arquivo_url` guarda o **path dentro do bucket**, não uma URL pública — o bucket `materiais-aulas` é privado (só o nome é reaproveitado de antes; seria mais preciso chamar de `arquivo_path`, mas mantive o nome já usado pela spec/schema existente pra não quebrar nada por vaidade de nome).
- RLS da tabela apertada: antes era leitura pública (`qual = true`, inclusive anon via metadata); agora é `is_admin_papel(...,'conteudo') or tem_acesso_ativo(auth.uid())` — mesmo gate do conteúdo pago.
- Bucket privado `materiais-aulas` (20MB por arquivo): download só via **URL assinada** gerada no servidor (`baixarMaterialAula` em `app/curso/[slug]/aula/[aulaId]/actions.ts`), expira em 60s — mesmíssimo padrão de `app/biblioteca/actions.ts` com o bucket `planilhas`. Não precisa checar `tem_acesso_ativo` manualmente na action: tanto a leitura da linha em `aula_materiais` quanto o `createSignedUrl` no storage já são gateados pela RLS.
- Admin (`AdminCursoEditorContent.tsx` → `MateriaisBloco`): upload real de múltiplos arquivos por vez (`uploadMateriais`), renomear (`renomearMaterial`), reordenar (`moverMaterial`, mesmo padrão de `moverAula`), excluir (`excluirMaterial`, agora também remove o arquivo do storage, não só a linha).
- Aluno (`AulaContent.tsx`, aba "Materiais"): ícone por tipo via `Icones.tsx` (`IconeFileText` pdf/docx, `IconeBarChart` xlsx, `IconePaperclip` zip/outro — nada de ícone inline), clique gera o link assinado on-demand em vez de embutir uma URL na carga inicial da página (que expiraria).
- Testado de ponta a ponta via REST direto (upload como admin, signed URL + download com bytes idênticos como aluno com assinatura ativa, bloqueio confirmado tanto pra aluno sem assinatura quanto pra anon — 404 por RLS, não 403, o que é até melhor pra não vazar a existência do arquivo) — usuários descartáveis, tudo apagado ao final.
- **Ideia futura (não implementada de propósito)**: gatilho de gamificação `baixar_material` (XP por baixar um material) — deixar pra próxima sessão de calibragem de gatilhos, junto com os outros valores placeholder já registrados na seção Gamificação.

## Progressão sequencial de aulas — 2026-07-14
⚠️ **A trava de avaliação descrita aqui foi substituída em 21/08/2026** — ver
"A avaliação é um item da jornada" logo abaixo. O que continua valendo desta
seção: critérios de conclusão (70% de vídeo, materiais baixados), tracking do
Panda, trigger de escrita protegida e bypass de admin.

Aula N+1 só libera após aula N concluída, e "concluída" passou a ter critérios (antes era um clique livre). Chokepoint único: RPC `concluir_aula(p_aula_id)`, `security definer` (EXECUTE revogado de `anon`/`PUBLIC` nomeando os papéis — mesma pegadinha do `notificar()`, revoke de `PUBLIC` sozinho não bastou).

### Critérios de conclusão (todos avaliados dentro da RPC, nunca só no client)
- **Vídeo**: ≥70% de `aulas.duracao_seg` assistido (só se `aulas.video_url` não for nulo).
- **Materiais**: todos os `aula_materiais` com `arquivo_url` não nulo baixados (tabela nova `material_downloads`, ver abaixo). Aula sem vídeo/sem materiais não trava nesse critério (checado, não assumido).
- Aula sem nenhum dos dois: conclusão livre (só a trava sequencial abaixo ainda se aplica).

### Trava sequencial + avaliação de módulo (verificada DUAS vezes — página E RPC)
`avaliacoes.modulo_id` é nullable: `tipo='avaliacao'` tem `modulo_id` (quiz do módulo), `tipo='prova'` tem `modulo_id null` (prova final do curso, gated por `avaliacoes_prova_sem_modulo`). Regra aplicada: aula[i] só libera se aula[i-1] (mesmo curso, ordenada por `modulos.ordem` → `aulas.ordem`) estiver com `aula_progresso.concluida=true` e, se aula[i] cruza pra um módulo novo, todas as `avaliacoes` publicadas (`tipo='avaliacao'`) do módulo anterior tiverem `avaliacao_tentativas.aprovado=true` pro usuário. Provas de curso (`modulo_id null`) **não** travam navegação entre aulas (não há aula pra ancorar) — travam só a conclusão do curso/certificado, já coberto por `gam_curso_completo` (pré-existente, inalterado).
- **Página** (`lib/queries/aula.ts`, `getAula`/`primeiraAulaLiberada`): calcula `bloqueada` por aula e por item do trilho; `page.tsx` faz `redirect()` server-side pra última aula liberada (`?bloqueada=1`) se a aula pedida por URL estiver travada — cobre acesso direto por URL.
- **RPC `concluir_aula`**: repete a mesma checagem de sequência/avaliação antes de aceitar a conclusão. Necessário porque a página só impede *ver* uma aula travada — sem isso, uma aula sem vídeo/materiais (critério trivial) seria concluível via `supabase.rpc('concluir_aula', ...)` direto no console do navegador, pulando aulas nunca vistas. Descoberto e corrigido durante esta mesma sessão, antes de ir pra produção.
- **Admin**: bypass total (`is_admin_papel(uid)`, sem filtro de papel) — ignora critérios E sequência, mas a conclusão ainda passa pela RPC normalmente (ainda credita XP/gamificação, só pula a validação).

### Tracking do vídeo (Panda Video)
Sem SDK novo — só um listener `window.addEventListener('message', ...)` filtrando `event.data.message` com prefixo `panda_` (`panda_timeupdate`, `panda_pause`, `panda_ended`), que o player do Panda já emite por `postMessage` independente de usar a classe `PandaPlayer` deles. `AulaContent.tsx` soma só incrementos pequenos e positivos (`0 < delta < 2s`) entre dois `panda_timeupdate` como "assistido de verdade" — ignora saltos de seek pra frente (não dá pra arrastar a barra até 70%) sem penalizar replay. Persiste em `aula_progresso.segundos_assistidos` a cada ~10s (throttle) e imediatamente em pause/ended/saída da página (best-effort, cliente pode fechar a aba antes do flush).
- **Limitação aceita**: o tempo assistido vem do player no client, não é à prova de fraude por usuário técnico (poderia forjar `postMessage` via devtools). A validação dos 70% pra *concluir* é sempre no servidor (RPC lê `aula_progresso.segundos_assistidos`, não confia em nada que o client mande na hora de concluir) — mitiga forjar a conclusão, não mitiga forjar o número assistido em si. Aceitável pro produto (mesmo espírito da doc original da spec).

### Escrita protegida (trigger, não RLS)
`aula_progresso.concluida` tinha `default true` (vestígio do modelo antigo "linha existe = concluída") — mudado pra `default false`, já que agora a linha também existe pra progresso PARCIAL (`segundos_assistidos`). RLS de `aula_progresso` continua `ALL` pro dono da linha (client grava `segundos_assistidos` direto, sem RPC, mesmo padrão de sempre) — quem impede o client de forjar `concluida=true` é o trigger `trg_aula_progresso_proteger_conclusao` (`BEFORE INSERT OR UPDATE OF concluida`, mesmo padrão de `trg_gam_proteger_perfis` em Gamificação): reverte pro valor antigo a menos que `set_config('app.conclusao_validada','on',true)` esteja setado — só `concluir_aula()` seta essa flag. Testado explicitamente: `UPDATE aula_progresso SET concluida=true` direto (simulando bypass) foi revertido pelo trigger.
- Toda leitura de "aula concluída" no app **precisa** filtrar `.eq('concluida', true)` — existência de linha não significa mais concluída. Auditado em toda a base nesta sessão; único ponto que lia só a existência (`lib/queries/aula.ts`) foi corrigido.

### Tabelas/RPC novas
- `aula_progresso.segundos_assistidos` (integer, default 0).
- `material_downloads` (`usuario_id`, `material_id`, `baixado_em`, PK composta) — RLS só o dono. Escrito em `baixarMaterialAula` (`app/curso/[slug]/aula/[aulaId]/actions.ts`), depois de mintar a signed URL, upsert idempotente.
- `concluir_aula(p_aula_id)` → `jsonb` (`{ok:true}` ou `{ok:false, erro?, video_ok?, video_pct?, materiais_pendentes?, bloqueada_sequencia?}`), chamada via nova server action `concluirAula`.

### UI (`AulaContent.tsx`)
Checklist ao vivo acima das abas (some quando a aula não tem vídeo nem material, ou já está concluída) com item de vídeo (`X% de 70%`) e um item por material (`pendente`/`baixado ✓`). Botão "Marcar como concluída" fica `disabled` (nunca clicável-pra-ser-rejeitado) enquanto os critérios não batem, com `title` explicando o que falta em tom de mentor; ao clicar chama a RPC (não mais upsert direto). Trilho lateral mostra cadeado (`IconeLock`) nas aulas bloqueadas (`Link` com `onClick` que dá `preventDefault`, não esconde só visualmente — a página redireciona de qualquer forma se a URL for acessada direto). Botão "Próxima" vira um cadeado desabilitado até a aula atual ser marcada concluída.

### Testado (SQL direto via MCP, usuário descartável, tudo revertido ao final)
Curso real com 2 módulos (`desvendando-os-segredos-das-instituicoes-bancarias`) e uma avaliação de módulo publicada temporariamente pro teste (revertida a `publicado=false` depois): rejeição sem progresso, tentativa de bypass direto de `concluida=true` revertida pelo trigger, 70% de vídeo liberando o critério, download parcial (5 de 6 materiais) ainda bloqueando, conclusão completa creditando gamificação (`concluir_aula` + `iniciar_curso` no `gamificacao_extrato`), pulo de aula no meio do módulo bloqueado, módulo seguinte bloqueado até aprovar a avaliação e liberado depois de aprovar, bypass total de admin numa aula nunca vista. **Não testado**: fluxo real em navegador (login, clique, player do Panda de verdade) — verificação ficou no nível de banco/RPC + `npm run build`; recomendado um teste manual único em preview antes do próximo grande lançamento de conteúdo.

## A avaliação é um item da jornada — 2026-08-21

**Regra permanente.** A avaliação ocupa uma **posição na sequência do curso**, e
nada depois dela abre sem aprovação. Aula de correção ("Resolução Avaliação I",
"Prova corrigida", "Desafio corrigido") vem **sempre depois** da sua avaliação.

### O que estava errado, e como chegou

A avaliação só travava a passagem **para o módulo seguinte**. Dentro do módulo
ela não travava nada — e a aula de correção é quase sempre a última aula do
**próprio** módulo. Ou seja: **o vídeo com a resposta abria antes da pergunta.**

E mesmo essa trava frouxa não funcionava: `getAula` montava a lista plana com
`modulos.flatMap(m => m.aulas)`, e o `select` aninhado não traz `modulo_id` —
então `cruzouModulo` comparava `undefined !== undefined`, **sempre falso**. A
página nunca detectava virada de módulo. `primeiraAulaLiberada` e `curso.ts`
injetavam `modulo_id` na mão e acertavam; a terceira cópia, não.

Como isso chegou: uma aluna assistiu a aula "Resolução Avaliação I", achou que
tinha feito a avaliação (nome parecido, e ela nunca viu a prova), o auto-avanço
de 5s a empurrou para a aula seguinte — trancada —, ela assistiu 23 dos 25
minutos e só então levou "Conclua a avaliação do módulo anterior primeiro", **sem
link e sem nome**. A página da aula não tinha uma única menção a avaliações.
Eram 7 alunos no mesmo estado e **zero tentativas de avaliação na plataforma
inteira**.

### O modelo

- **`avaliacoes.posicao`** = quantas aulas do módulo vêm antes dela. `3` → entra
  depois das 3 primeiras e antes da 4ª. `null` = fim do módulo (default de
  avaliação nova). É contagem de aulas, e **não** valor de `aulas.ordem`, de
  propósito: reordenar aulas no admin não joga a avaliação para o meio do
  conteúdo. Editável em `/admin/avaliacoes/[id]` ("Posição no módulo").
- **`curso_sequencia(curso_id)`** — a ordem, em um lugar só: módulos → aulas e
  avaliações intercaladas. Prova sem módulo fecha o curso.
- **`progresso_pendencia(usuario, curso, item)`** — devolve o primeiro item
  anterior não cumprido, **nomeado e com id**. Interna (revoke de
  authenticated/anon, mesmo padrão de `notificar()`); a porta pública é
  `avaliacao_pendencia(avaliacao)`, que usa `auth.uid()`.
- **`lib/progresso/sequencia.ts`** — lê a ordem da RPC e deriva o estado de cada
  item. Página do curso, página da aula, RPC de conclusão e RPC de submissão
  passaram todas a ler daqui.

⚠️ **A trava vale dos dois lados.** `submeter_avaliacao` recusa prova fora de
ordem e a página da avaliação barra antes de o aluno responder. Sem isso, o link
direto da prova (público para quem tem o curso) abriria a avaliação de um curso
nunca assistido.

⚠️ **Item bloqueado não conta como concluído, mesmo com a linha gravada.**
Decisão do dono do produto: quem concluiu a correção antes da prova volta a
vê-la trancada. O progresso **não é apagado** — aprovando a prova, a aula
reaparece concluída e ninguém reassiste nada. Medido ao aplicar: 4 aulas, 4
alunos.

### Backfill das 37 avaliações

27 casaram sozinhas pela heurística "tantas aulas de correção quanto avaliações
→ 1-a-1 na ordem" (regex `resolu|corrigid|resolvid|gabarito`). 4 ficaram no fim
do módulo por não terem correção nenhuma (Desvendando mód. 2 e 4, Leitura mód.
3), que é o lugar certo. As 6 restantes são dois módulos com 3 avaliações e 1
única correção (Tabela de Atualização Monetária, Cheque Especial): posicionadas
à mão, acumuladas antes da correção/encerramento — nenhuma avaliação foi enfiada
no meio do conteúdo.

⚠️ Bug adjacente corrigido no caminho: `atualizarAvaliacao` gravava numa coluna
`avaliacoes.xp` que **não existe** desde que virou `peso` — salvar dados gerais
de avaliação no admin falhava inteiro, em silêncio, e `peso` nunca era salvo.

### Testado
11 asserções em SQL com usuários descartáveis (apagados no fim): prova trancada
antes das aulas, prova abrindo depois delas, correção trancada até a aprovação,
módulo seguinte nomeando a prova, nota abaixo da mínima não destravando,
aprovação destravando, `concluir_aula` recusando com o nome certo,
`submeter_avaliacao` recusando prova fora de ordem, e o retroativo (correção
concluída sem prova não serve de escada). **Não testado em navegador** — a
verificação ficou em banco/RPC + `npm run build`.

## Tour guiado + Guia da plataforma — 2026-07-15
Onboarding em duas peças: overlay com spotlight (8 passos) na primeira visita à home, e `/guia` (documentação viva, link no dropdown do avatar entre "Perfil público" e "Sair", ícone `IconeCompass` novo).

### Disparo e persistência
`perfis.tour_visto_em` (timestamptz, nullable) — `home.ts` expõe `mostrarTourInicial: !perfil.tour_visto_em`. `TourGuiado.tsx` (montado dentro de `HomeContent.tsx`) dispara sozinho ~1s depois de montar se `mostrarInicial` for true. "Pular tour" e concluir o passo 8 chamam a server action `marcarTourVisto()` (`app/actions.ts`) — só quando foi a exibição automática (`primeiraVisita`); "Refazer o tour guiado" na `/guia` é um link pra `/?tour=1`, que reroda o tour sem tocar `tour_visto_em` (`history.replaceState` remove o `?tour=1` da URL assim que lido, pra não reabrir num refresh).

### Spotlight sem lib externa
Alvos achados por seletor CSS (`data-tour="..."` novo em `NavPlataforma.tsx`/`AvisosGlobais.tsx`/`HomeContent.tsx`, ou um `id` já existente como `#jornada`/`#vitrine`) via `document.querySelector` — desacopla o motor do tour da árvore React desses componentes (`AvisosGlobais` nem é filho de `HomeContent`, é montado à parte no layout raiz). Passo com múltiplos seletores (passo 6, Comunidade+Agenda) calcula a união das `getBoundingClientRect()`. Alvo não encontrado (ex: `comunidadeAtiva=false` escondendo o link) → pula o passo sozinho, sem quebrar.
- **Retângulo do spotlight**: `box-shadow: 0 0 0 9999px` da cor do overlay + borda — cria o efeito de escurecer tudo ao redor sem precisar de um overlay full-screen separado com buraco recortado.
- **Scroll até o alvo**: se o elemento não estiver "dentro" (margem de 80px, ou `position:fixed` que já conta como sempre visível), chama `scrollIntoView` e só mede a posição depois que o scroll REALMENTE parou — detectado via polling em `requestAnimationFrame` comparando `getBoundingClientRect().top` entre frames (3 frames estáveis seguidos, só depois de confirmar que o elemento chegou a se mover). Um timeout fixo (testado inicialmente com 420ms) não é confiável pra distâncias de rolagem grandes — filtrado e corrigido nesta sessão depois de pegar o balão renderizando fora da viewport num teste real. Teto de segurança de 1500ms garante que o tour nunca trava esperando um scroll que não acontece.
- **Balão**: posição inicial estimada (baixo ou cima, o lado com mais espaço), corrigida depois com a altura REAL do elemento (`useLayoutEffect` + ref) pra nunca cortar conteúdo no topo/rodapé da viewport nem sobrepor o próprio spotlight — a estimativa de altura varia por passo (texto de tamanho diferente) e só a altura medida pós-render é confiável.
- **Mobile** (`≤640px`): balão vira bottom-sheet fixo (`!important` sobrescrevendo o `top`/`left` calculado por JS) — só a lógica de CSS muda, o spotlight funciona igual.
- **Teclado**: ESC pula, setas navegam. `prefers-reduced-motion`: sem pulso/transição (classe `.reduzido`).

### `/guia`
`lib/guia/conteudo.ts` (estático, 9 capítulos com texto aprovado) + `lib/queries/guia.ts` (só a parte dinâmica: email de suporte via `config_plataforma`, lista real dos 10 níveis com os PNGs reais de `public/niveis/` — mesmo mapa usado em `ConquistaToast.tsx`). Busca em tempo real client-side (`GuiaContent.tsx`) filtra por capítulo/seção com normalização de acento, auto-expande capítulos que baterem; deep-link por hash (`#certificados` etc.) abre e rola até o capítulo. Sidebar sticky com scroll-spy via `IntersectionObserver`.
- **Conteúdo ajustado à realidade do produto** (não é o texto genérico da spec original): comunidade não tem thread de comentários funcional ainda (só reações Útil/Salvar/Parabenizar e os 3 tipos de post), então o capítulo 5 não promete comentar. Certificados: **descoberto nesta sessão que `/certificado/[numero]` (link de "verificação pública") não existe como rota** — `PerfilContent`/`PeritoPublicoContent` já geram/copiam esse link, mas ele hoje dá 404; o capítulo 8 do guia por isso descreve só o que existe de fato (certificado automático, aba Certificados do perfil, botão de copiar link) sem prometer QR nem página de verificação funcionando. O QR que existe de verdade é o de `/perito/[slug]` (perfil público do perito), uma feature diferente.
- **Pendência encontrada, não corrigida agora** (fora do escopo desta tarefa): rota pública `/certificado/[numero]` nunca foi construída — o botão "Copiar link de verificação" em `PerfilContent.tsx` e o link em `PeritoPublicoContent.tsx` apontam pra uma página que não existe.

### Testado em navegador real (Chrome via extensão, não só banco/RPC desta vez)
Login real, tour completo passo a passo (8/8, incluindo o spotlight de união dos passos 6 e a rolagem longa do passo 4), persistência confirmada (skip grava `tour_visto_em`, reload não reabre, `?tour=1` reabre sem regravar), `/guia` com busca filtrando ao vivo e o grid de níveis com dado real. Três bugs achados e corrigidos no processo (todos no `TourGuiado.tsx`): timeout fixo de scroll insuficiente pra distâncias longas, detecção de "parou de rolar" disparando antes do scroll começar de fato, balão sem clamp de altura real podendo cortar conteúdo/sobrepor o spotlight em seções muito altas. Um typo de conteúdo ("credam" → "creditam") também corrigido depois de ver renderizado.
- **Achado de ambiente, não do código**: nesta sessão de teste, `scrollIntoView`/`scrollTo` programático não completava dentro do Chrome controlado pela extensão de automação (confirmado: scroll por roda do mouse real funcionava normal) — típico de automação via CDP interferindo em animação de scroll suave via `requestAnimationFrame`. O teto de segurança de 1500ms do tour já cobre esse caso (degrada sem travar); não afeta usuários reais.

## Auditoria de dados fabricados — página de Perfil — 2026-07-23
A página `/perfil` (e o motor de nível de `/perito/[slug]`) tinha escapado da limpeza global de mock. Achados e correções:
- **Foto de perfil não funcionava**: `uploadFoto()` subia pro bucket `planilhas` (privado) e chamava `getPublicUrl()` — URL pública não resolve pra bucket privado (só funciona pra `public:true`), então a imagem nunca renderizava depois do upload. Criado bucket dedicado `fotos-perfil` (`public:true`, igual a `capas`/`capas-cursos`), policies de leitura pública + escrita própria (`{uid}/foto.{ext}`). `PerfilContent.tsx` ganhou fallback `onError` pra inicial do nome se a URL falhar.
- **`perfil_atividades` e `perfil_estudo_dias` eram seed de um único usuário demo, nunca escritas pelo app** (mesmo problema que `CLAUDE.md` já documentava pro streak antigo, ver linha abaixo — só não tinha sido aplicado em `lib/queries/perfil.ts`). Ambas as tabelas foram esvaziadas (`delete from`, tabelas continuam existindo, sem leitor no código). `carregarPerfil()` reescrita: atividade recente vem de `gamificacao_extrato` + `gamificacao_gatilhos.descricao` (enriquecido com nome real de aula/curso pra `concluir_aula`/`concluir_curso`/`iniciar_curso`); heatmap/dias fortes/ritmo vêm de contagem real por dia no mesmo extrato; sequência/recorde vêm da RPC `registrar_acesso_diario()` (mesma fonte que a nav usa — antes o perfil recalculava por cima do heatmap falso e podia divergir do pill da nav); missões da jornada/etapa atual vêm de `carregarJornada()` (mesmo painel real da home); XP da semana e horas de estudo (total/semana) somam `gamificacao_extrato.pontos` e `aula_progresso` × `aulas.duracao_seg` reais. `iniciouRotulo` trocou a coluna órfã `perfis.iniciou_em` (nunca escrita) por `perfis.criado_em` (real, `default now()`).
- **`notificacoes` também tinha 4 linhas fabricadas** pro mesmo usuário (mesmo texto do `perfil_atividades` mock, incluindo os travessões — `tipo='evento'`/`tipo='jornada'` nem correspondem a nenhum trigger real do sistema documentado abaixo). Apagadas; a tabela é a fonte real do sino/toasts (`notificar()`), só não foi usada como fonte da atividade do perfil porque não carrega o valor de XP por evento.
- **`/perito/[slug]`** (`lib/queries/perito-publico.ts`): `nivel` usava a fórmula ad-hoc `Math.floor(xp/100)+1`, divergente do motor real de níveis (`gamificacao_niveis`/`gam_status_proximo_nivel`, requisitos compostos) — podia mostrar um nível diferente do perfil autenticado/nav pro mesmo usuário. Trocado pela RPC real (`gam_status_proximo_nivel(p_usuario)`, aceita uuid explícito, `EXECUTE` já concedido a `anon`). Campo `streak_dias` removido (lia `perfil.streak_dias`, coluna que não existe em `perfis` — sempre `undefined→0` — e nunca era renderizado no componente).
- Travessões: os únicos achados eram texto fabricado dentro das linhas das tabelas acima (não em componentes/JSX) — resolvidos junto com a limpeza de dados. Os `'—'` que sobram no código são fallback legítimo de campo vazio (padrão já usado em várias páginas admin), não texto de conteúdo.

## Migração de alunos da Ensinio + acesso por curso — 2026-08-05
718 alunos da Ensinio (766 linhas em `migracao/migracao_peritos_academy_FINAL.xlsx`, 13 produtos) traduzidos pra Peritos Academy. Ferramental em `scripts/migration/` — **runbook completo em `scripts/migration/README.md`**, ler antes de mexer.

### O que mudou na plataforma: acesso deixou de ser booleano
Até aqui `tem_acesso_ativo()` respondia uma coisa só — "tem assinatura Asaas vigente?" — e não recebia curso nenhum como argumento. A matriz da migração exige acesso parcial ("Apenas: Curso PASEP", "Tudo EXCETO: <9 itens>") e prazo por produto, nada disso expressável no modelo antigo (`assinaturas` não tem data de fim e tem índice único que limita a UMA linha não-cancelada por aluno).
- **`acessos_conteudo`** — uma linha por produto concedido. `escopo`: `total` (tudo, menos as exceções) · `curso` (só o `curso_id`) · `biblioteca`. Vigência: `vitalicio` **ou** `expira_em`, com check constraint garantindo exatamente um dos dois. `origem`: `migracao_ensinio`/`admin`/`assinatura`.
- **`acessos_excecoes`** — o "EXCETO". Alvo pode ser um **curso** (`curso_id`) ou uma **trilha inteira** (`trilha_slug`, FK em `trilhas.slug`), nunca os dois (check constraint). Guardar a REGRA e não a lista expandida é deliberado: curso novo publicado entra sozinho pra quem tem vitalício, em vez de congelar o catálogo na data da importação (a alternativa eram ~7.500 linhas e um script de correção a cada publicação).
- **`tem_acesso_curso(usuario, curso_id | curso_slug)`** — novo gate das 3 páginas de curso (`curso/[slug]`, `.../aula/[aulaId]`, `.../avaliacao/[avaliacaoId]`). Sobrecarga por slug existe porque `getAvaliacao()` devolve só slug, não uuid; nomes de parâmetro diferentes (`p_curso_id`/`p_curso_slug`) fazem o PostgREST resolver sem ambiguidade.
- **`tem_acesso_plataforma(usuario)`** — seções que não são por curso (Comunidade, Agenda, Desafios). `verificarAcessoConteudo()` passou a chamar esta. Sem ela, um aluno migrado "Apenas PASEP" não entraria na Comunidade, porque ele não tem linha em `assinaturas` alguma.
- **`tem_acesso_biblioteca(usuario)`** — `perfis.acesso_biblioteca` (concedida à mão, sem prazo, comportamento antigo preservado) **ou** concessão de escopo `biblioteca` vigente (essa expira). `lib/queries/biblioteca.ts` e `app/biblioteca/actions.ts` passaram a usar a RPC em vez de ler a coluna direto.
- **`tem_acesso_ativo()` ficou intocada** — mesmo corpo, mesmo significado. Tudo aqui é aditivo: apagar `acessos_conteudo` inteira devolveria a plataforma ao comportamento anterior. Quem paga pelo Asaas passa por `tem_acesso_curso` na primeira cláusula, antes de olhar concessão nenhuma.
- **Vencimento é calculado na leitura** (`vitalicio or expira_em >= current_date`) — não há cron, nada pra dessincronizar, e o acesso cai no instante exato. Mesmo princípio que `tem_acesso_ativo` já usava pro `dias_carencia`. Testado empurrando a data pra ontem/amanhã e conferindo o gate virar junto.
- **Policies de material viraram por curso** (`aula_materiais` e o bucket `materiais-aulas`). Antes chamavam `tem_acesso_ativo` — um aluno "Apenas PASEP" baixaria material de qualquer curso sabendo a URL, já que o gate de página só barra *ver* a aula. O bucket resolve `aula → modulo → curso` por `split_part(name,'/',1)`, porque o path de upload é `{aula_id}/{uuid}-{nome}`.

### ⚠️ `curso_trilha` é view `DISTINCT ON (curso_id)` — não usar pra checar pertencimento
A exceção "MasterClass" do Black Friday é da **trilha inteira**, não de um curso dela. O vínculo curso→trilha é lido das tabelas base (`etapa_missoes → etapas → trilhas`) e **nunca** da view `public.curso_trilha`: ela é `DISTINCT ON (em.curso_id)` e devolve no máximo UMA trilha por curso, então um curso em duas trilhas pode não aparecer na que interessa — e a exceção furaria silenciosamente.

### Recorte: só os 403 com acesso vigente
As validades do arquivo vão de 2025-05-15 a 2027-08-04. Contra 2026-08-05, **344 das 507 concessões com data já estavam vencidas**, o que deixaria **315 dos 718 alunos entrando numa conta vazia** — incluindo **todos os 264 do PASEP** (validade mais recente: 2026-07-21) e os 33 de Super Endividamento, 22 de E-mails, 4 de RMC. Decisão de produto: importar só os 403 vigentes. Os 315 ficam em `migracao_alunos` com `importado=false` + motivo, e no CSV de cada execução, pra decisão comercial posterior. **Nenhum usuário foi criado pra eles.**

### `migracao_alunos` — histórico e livro-caixa
Uma linha por (aluno × produto), inclusive os não importados. Guarda o dado de origem cru (valor pago, data da compra, validade, grupo, tipo de acesso). Índice único `(lower(email), plano_origem, coalesce(data_vencimento,'9999-12-31'))` é o que dá **idempotência**: rodar o importador de novo pula o que já existe em vez de duplicar. Só admin lê (tem valor pago). Nomes em português; equivalência com a spec: `migrado_em`=`migrated_at`, `plataforma_origem`=`source_platform`, `usuario_id`=`user_id`.

### 🔴 Incidente: 3 e-mails de boas-vindas enviados por engano
O ensaio de 3 alunos disparou 3 e-mails reais (Celso, Jonas, Milton). O trigger `ao_criar_usuario` (`criar_perfil`) faz `net.http_post` pra `/api/internal/email-evento` pra **todo** usuário novo, e a URL é **fixa, apontando pra produção** — o guard que eu tinha escrito estava no checkout local, não deployado, e portanto não protegia nada.
- **Lição geral (vale pra qualquer trigger com `pg_net`)**: o que roda é a versão publicada na Vercel, não a do working tree. Guard que precisa valer durante um script local tem que estar **no banco**.
- **Corte definitivo**: `criar_perfil` retorna antes do `net.http_post` quando `new.raw_user_meta_data ? 'migrado_de'`. Não depende de deploy, não gasta requisição, funciona com a Vercel fora. O guard na rota continua como segunda linha de defesa.
- Verificado com dois usuários descartáveis (um com a flag, um sem, de controle): 0 e-mails pro migrado, 1 pro normal — ou seja, boas-vindas de cadastro nativo continua funcionando.
- Os 3 e-mails não são recuperáveis. As linhas em `email_enviados` foram **mantidas** de propósito (registram o fato e impedem um segundo envio pelo dedupe).

### Fluxo do aluno migrado
Senha da importação é aleatória de 32 bytes e ninguém a conhece — nunca é impressa nem enviada. O aluno entra por **`/primeiro-acesso`**, informa o e-mail e recebe o link pra definir senha (cai no `/redefinir-senha` que já existia). É uma página, e não link pronto no e-mail da campanha, porque link de recuperação do Supabase expira e uma campanha pra 400 pessoas é lida ao longo de dias.
- `/primeiro-acesso` e `/redefinir-senha` entraram nas **rotas neutras do `middleware.ts`**: sem isso, ligar `modo_manutencao` durante a importação transformaria a campanha inteira numa página de manutenção (o `/redefinir-senha` já sofria desse problema antes, de graça).
- A resposta é a mesma pra e-mail cadastrado e não cadastrado — a página não pode virar um verificador de quem é aluno.
- `components/BoasVindasMigrado.tsx` (uma vez só, `perfis.boas_vindas_migrado_em`, mesmo padrão de `tour_visto_em`) avisa que a conta foi transferida e que o **progresso de aulas começa do zero** — só o acesso ao conteúdo veio junto.

### Ferramental (`scripts/migration/`)
`lerXlsx.mjs` lê XLSX sem dependência nova (o arquivo usa `inlineStr` numa planilha só; descompacta com `unzip` e parseia o XML). `catalogo.mjs` é o mapa produto→regra, **fora de `lib/`** de propósito: nada no app importa isso, o gate lê as linhas já gravadas. `planejar.mjs` transforma XLSX em plano (lógica pura, sem banco) e é chamado **igual** pelo dry-run e pela execução, então não há como divergirem. `validarCatalogo.mjs` confere o catálogo contra banco + arquivo. `testarMatrizAcesso.mjs` — 28 asserções com usuários descartáveis, incluindo RLS de material com **sessão real do aluno** (service role ignora RLS e daria falso positivo). **`sql.mjs` roda SQL via Management API** (`SUPABASE_ACCESS_TOKEN`, conecta como `postgres`) — migração deixou de ser necessariamente manual, dá pra aplicar daqui.
- Dry-run é o default; só grava com `--executar`. `--limite=N` pra ensaio, `--hoje=YYYY-MM-DD` pra fixar o corte de vigência e tornar o plano reproduzível.
- Conferência dupla contra o arquivo: os 13 produtos formam 13 triplas distintas `Produto :: Acesso :: Regra`, então a regra vem do nome do produto e a coluna descritiva "Acesso na Plataforma Nova" é usada só pra **abortar se divergir** — nunca parseada como entrada.
- `.gitignore` ganhou `env.local` (o padrão `.env*` **não** casa com esse nome, e o arquivo tem a service role key e os segredos de Resend/Anthropic/Panda/cron), `migracao/logs/` e o próprio XLSX (dado pessoal de 718 pessoas).

## Sugestões contextuais do MH Nexus — 2026-08-05
CTAs discretos e fecháveis dentro da Academy, pra aluno que ainda não assina o Nexus. Não é vitrine: cada copy parte de uma dor real do perito e pinta a sensação de resolver. Spec do dono do produto reproduzida literalmente nas copies.

### ⚠️ Escopo deliberado: NÃO existe integração com o Nexus
Sem login único, sem sync de assinatura, sem webhook. Decisão explícita do dono do produto ("fica pra depois"). O status é **flag manual** em `perfis.nexus_status` (`none`/`active`/`cancelled`), editável na ficha do aluno (`/admin/usuarios/[id]`, aba Visão geral) via RPC `adm_definir_nexus_status`. Quando a integração existir, é só passar a escrever nesse campo — nada mais no motor muda. A única referência a Nexus que existia antes disso era a frase "Acesso em breve também pelo Nexus" em `LoginContent.tsx:115`.
- `active` desliga TODAS as sugestões, em todo placement, imediatamente. `cancelled` faz voltarem, com o pool de copy de ex-assinante (tom de retomada, não de apresentação).

### Tabelas
- `nexus_cta_config` (singleton id=1) — `link_global` + override por app, 6 toggles (global + 5 placements), `max_sino_por_semana`, `dispensas_para_pausar`, `dias_pausa_dismissal`. Editável em `/admin/configuracoes` → aba "Sugestões do Nexus". Leitura pública (`using (true)`) porque a tela de bloqueio precisa dela; escrita só `super_admin`.
- `nexus_cta_copies` — 42 variações (36 `publico='novo'` + 6 `publico='ex'`), `chave` unique, seed idempotente com `on conflict (chave) do update`, então corrigir texto é reaplicar a migração. **O texto não é editável pelo admin de propósito** — é copy aprovada, versionada no seed.
- `nexus_cta_bloqueio` — copies da tela de conteúdo bloqueado, por `alvo` (slug do curso, `biblioteca`, ou `__padrao__`). Variam por CONTEÚDO, não por app, então tabela separada.
- `nexus_cta_interactions` — `exibida`/`clicada`/`dispensada`/`assinou` por aluno/app/placement/copy. É ao mesmo tempo a fonte das métricas E a memória da rotação. RLS: aluno insere e lê as próprias; admin lê tudo.

### Motor de seleção (`lib/nexus/servidor.ts`)
Ordem das checagens, a primeira que barrar encerra: config ligada → placement ligado → logado → **não é assinante ativo** → teto semanal (só sino) → apps pausados por dispensas ficam fora → não repete o app da vez anterior → variação que o aluno ainda não viu.
- **`escolherSugestaoNexus` NÃO registra a exibição.** Quem registra é o componente, quando de fato renderiza — o cliente ainda pode suprimir por já ter mostrado algo na sessão. Registrar no servidor inflaria as métricas e queimaria variações que o aluno nunca viu.
- Pool esgotado recomeça do zero em vez de parar de sugerir (a regra é "não repetir até esgotar", não "nunca repetir").
- `filaDeApps(contexto)` em `lib/nexus/index.ts` mapeia slug de curso/trilha → fila de apps por regex, e **sempre devolve a fila completa** (relevantes primeiro, resto depois) pra nunca ficar sem opção quando os preferidos estão pausados. A ORDEM das regras decide: `planilha-automatica-de-apuracao-de-jornada` casa a regra trabalhista (por "jornada") antes da de planilhas e vai pro MH Ponto — que é o resultado certo, mas é consequência da ordem, não coincidência.

### Placements (5)
1. **Aula** (`AulaContent`, aba Materiais) — variante `linha`, contexto = slug do curso.
2. **Conquista** (`ConquistaToast`) — variante `toast`, entra 5s depois da celebração e sai sozinho em 8s. `z-index` abaixo do toast de conquista, que celebra primeiro.
3. **Sino** (`AvisosGlobais`) — item comum no topo da lista, buscado **só quando o sino abre** (não pesa o carregamento de toda página). Teto de 1x/semana conferido no servidor.
4. **Perfil** (`PerfilContent`) — variante `perfil`, no fim da página. A spec pedia "abaixo das informações de plano", mas essa tela não tem bloco de plano (plano vive no admin financeiro), então foi pro fim do corpo.
5. **Conteúdo bloqueado** (`AssinaturaNecessaria` + a trava da `BibliotecaContent`) — não rotaciona, não é suprimido por sessão nem por dispensa; é informação sobre o que o aluno tentou abrir. As 3 páginas de curso passam `alvo={slug}` pra escolher a copy específica.
- Todo variante tem X. `1x por sessão por placement` via `sessionStorage`, marcado só quando vai renderizar de fato.
- **`AssinaturaNecessaria` virou async server component** (lê a copy no servidor). Se algum call site novo precisar dela como client component, isso quebra — passar a copy por prop nesse caso.

### Efeito colateral bom do acesso por curso
A tela de bloqueio deixou de ser rara: com acesso por curso (ver seção da migração Ensinio), um aluno "Apenas PJE Calc" bate nela navegando o catálogo. A mensagem antiga ("Sua conta não tem assinatura ativa, regularize") estava **errada** pra ele, que nunca teve assinatura pra regularizar. Agora a tela nomeia o conteúdo e explica o ecossistema.

### Testado
`scripts/migration/testarNexusCtas.mjs` — 29 asserções com usuários descartáveis: gating por status (incluindo pool `ex` pro ex-assinante), contexto→app nas 6 filas, rotação sem repetir app, pool sem repetir variação até esgotar, pausa após N dispensas (e que ainda sugere OUTRO app), teto semanal do sino sem afetar os outros placements, cada toggle do admin isoladamente, e resolução de link global vs override. A config é devolvida ao padrão no `finally`.

## Extensão de acesso: Desafio Viver de Perícia — 2026-08-05
Os 74 alunos migrados desse produto vinham com validade entre 2026-08-10 e 2026-08-25 — **73 deles perdiam acesso em menos de 15 dias** contados da importação, o que faria a comunicação de migração chegar junto com o bloqueio. Decisão comercial: estender todos até **2026-12-31**. A regra de acesso não mudou (escopo `total` sem biblioteca, "Tudo EXCETO: Biblioteca de Planilhas") — só a data.
- `migracao_alunos.data_vencimento` **não** foi alterada de propósito: é o registro histórico do que veio da Ensinio, e a validade original tem que continuar auditável. A vigência real mora em `acessos_conteudo`, e cada linha estendida guarda a data original na `observacao`.
- Migração usa `greatest(expira_em, '2026-12-31')` pra ser reaplicável sem encurtar ninguém.
- Depois disso, nada vence em menos de 30 dias (o próximo vencimento é 2026-09-25).

## Perfil público e `perfis.slug` — 2026-08-11
O menu do avatar tinha dois itens quebrados, os dois em silêncio.

- **"Perfil público" dava 404.** O link era `/perito/${slug ?? ''}`, que vira `/perito/` — rota que não casa com `/perito/[slug]`. E o slug só nascia dentro de `salvarPerfil`, ou seja, quando a pessoa abria o perfil e clicava em salvar: **432 dos 433 perfis estavam sem slug**, porque ninguém migrado fez isso. Praticamente toda a base clicava e via erro.
- **"Meus certificados" abria o topo do `/perfil`.** O item aponta para `/perfil#certificados` e a seção não tinha `id`. Sem âncora o navegador não tem onde parar, então a pessoa clicava em certificados e via a tela de dados do perfil.

O conserto tem três partes, e a terceira existe porque as duas primeiras a provocariam:

- `scripts/backfill-slugs-perfis.mjs` (simulação por padrão) gravou os 432 slugs que faltavam.
- `20260811_criar_perfil_gera_slug.sql` faz o trigger `criar_perfil` gravar o slug no nascimento — a conta que o SSO do Nexus cria não passa por `salvarPerfil` e continuaria nascendo sem endereço.
- **Unicidade não é extra.** `carregarPeritoPublico` busca com `.single()`, que ERRA com mais de uma linha: dois perfis com o mesmo slug derrubam a página pública **dos dois**, e nenhum descobre por quê. São 3 homônimos nesta base. Agora há `uq_perfis_slug` (índice único parcial) e desempate `-2`, `-3`… tanto no SQL (`slug_livre`) quanto no JS (`salvarPerfil`) — **as duas regras precisam concordar**, senão a primeira pessoa a salvar o perfil muda de endereço sozinha e quebra link já divulgado.
- O trigger insere com `exception when unique_violation` e sufixo aleatório: duas contas criadas no mesmo instante podem calcular o mesmo slug antes de qualquer uma gravar, e o cadastro não pode falhar por causa de um endereço público.

⚠️ O corte de boas-vindas por `migrado_de` continua idêntico dentro do trigger — conferido no `prosrc` depois de aplicar, e num ensaio com duas contas descartáveis homônimas (slugs `-1`/`-2`, zero e-mail para a migrada).

## "Escolhido para o seu momento" — a régua da vitrine — 2026-08-11
A seção não era fixa: ela **degradava**. Os cinco níveis da régua dependem de progresso, e o último preenchia o resto com "os cursos mais recentes" — a mesma lista para toda a base. Quem tinha pouco progresso caía quase inteiro nesse nível, ou seja, **o aluno novo recebia a vitrine mais genérica da plataforma**, que é o oposto do que a seção promete.

Quatro decisões:

- **O plano da anamnese entra em 2º lugar**, com o rótulo "Do seu plano". A plataforma faz a anamnese, o motor gera a rota (`plano_trilhas`) e ela aparece na mesma tela logo abaixo — e a vitrine ignorava isso por completo. Nenhuma prescrição é recalculada aqui: lê `getPlanoVivo()` e usa o `continuarHref` da estação `atual`, mesmo padrão de `meuPlano.ts`.
- **No máximo 2 vagas de continuidade**; a 3ª é sempre descoberta. Sem o teto, quem tem plano e cursos em andamento recebia três "continue de onde parou" e a seção virava lista de tarefas. O teto mora dentro de `tenta()`, por onde TODOS os níveis passam — é invariante por construção, não por disciplina de quem editar depois.
- **Quem não tem rota recebe um convite**, não enchimento (`conviteRota`). Medido em 11/08/2026: 4 linhas em `planos` (parte delas do mesmo usuário, em testes), então essa é a situação de quase toda a base.
- **O último nível deixou de ser global**: primeiro afinidade (trilhas em que a pessoa já encostou), depois rotação determinística por `semana + id do aluno`. Determinística de propósito — `Math.random()` daria um card diferente a cada F5 e a pessoa nunca reencontraria o que viu.

Conferido sobre os 73 cursos publicados: 6 alunos → 6 conjuntos diferentes, e o mesmo aluno gira a cada semana. Antes, os mesmos 3 para todos.

⚠️ Sem teste automatizado: o repositório não tem runner (só `lint` e `build`), e instalar um às pressas era decisão maior que o conserto. A regra do teto está centralizada em `tenta()` justamente para não depender de teste.

## O evento tem endereço próprio, e a live abre para quem não é aluno — 2026-08-25/26

**Regra permanente.** Todo evento tem `/evento/{slug}`, público, sem login. O
slug **nasce com o evento e não muda quando o título é editado**: o link já foi
colado em grupo de WhatsApp, e corrigir uma vírgula dias depois transformaria
toda mensagem enviada num 404 sem avisar ninguém. Para forçar endereço novo,
gravar `slug = null` — o trigger recalcula.

Antes disso existia `/agenda` e nada mais: não havia link para UM evento, e
`/agenda` exige acesso completo, então o convite batia no cadeado justamente
para quem é candidato a assinar.

### A live aberta
`eventos.aberto_ao_publico` (nasce desligada, opt-in por evento) libera
inscrição de quem não tem conta: nome e email, sem criar conta. Ela não vira
conta e não ganha acesso a nada — é o que permite divulgar em qualquer lugar.
O convidado é reconhecido depois por **cookie assinado** (`evt_{id}`, HMAC do
email), que é conveniência e não credencial: perder o cookie não perde a
inscrição.

⚠️ `jaInscritoComoConvidado` confere a inscrição **no banco**, não só o cookie:
o cookie sobrevive à linha ser removida, e a tela ofereceria o chat para quem a
action vai recusar.

### Transmissão e chat dentro da página
`link_transmissao` do YouTube (qualquer formato — `idDoYoutube` resolve) toca
embutido. O OBS e a chave de transmissão não mudam; muda onde se assiste.

`eventos.chat_modo`: `nenhum` · `youtube` · `proprio` (padrão). O do YouTube
**exige conta do Google para escrever**, e dentro de iframe esse login costuma
nem funcionar — o convidado lia e não falava, que numa live de conversão é o
pior resultado possível.

O chat próprio (`evento_mensagens`) é o **primeiro uso de Realtime deste
projeto** (a publicação `supabase_realtime` existia vazia). Assina INSERT e
UPDATE; o UPDATE é por causa da moderação, e `replica identity full` é o que
faz ele chegar com a linha inteira. Moderação **esconde, não apaga**.

⚠️ **Sem policy de INSERT, para ninguém.** A escrita passa por server action
com service role. E **o autor nunca manda o próprio nome** — vem do perfil ou
da inscrição; se viesse do cliente, qualquer um assinaria como o apresentador
no meio da live. Quem conduz (criador ou admin de agenda) fala sem se
inscrever, sem teto de vazão e fora da janela de tempo.

### Anúncio e visibilidade
Publicar um evento não avisava ninguém, e `visibilidade` **não filtrava nada**:
`/agenda` listava tudo para todos, e "Exclusivo · Turma X" era só texto.

Agora existe "Anunciar para os alunos" (botão, não automático na publicação:
`publicado` liga e desliga, e uma correção de vírgula viraria uma leva para 544
pessoas). `evento_audiencia` resolve `todos` e `curso`; `assinatura` resolve por
**chave de segmento** escolhida numa lista (`completo` 500 · `vitalicio` 328 ·
`com_prazo` 189 · `nexus` 94, medidos em 26/08). `turma` **recusa**: não é
conceito deste schema.

⚠️ "Assinante" **não é a tabela `assinaturas`** — ela tem uma linha, de
cortesia, porque o Asaas nunca foi ligado. É concessão de escopo `total`
vigente em `acessos_conteudo`, a mesma regra de `carregarResumoAcesso`.

⚠️ `perfis.nexus_status='active'` marca **44** pessoas e as concessões
`origem='nexus'` vigentes são **94**. A flag é manual e ficou para trás; o
segmento lê a concessão.

⚠️ `evento_audiencia` e `evento_visivel_para` divergem de propósito em `turma`:
**a tela mostra e o email não sai.** Errar para mais na tela custa um card;
errar para mais no email é irreversível.

### Emails e sino do evento
Seis momentos, todos em `lib/email/templates/evento.ts` no esqueleto dos
templates do Nexus: **anúncio · confirmação · véspera · manhã do dia · uma hora
antes · ao vivo**. As janelas são conta de tempo pura em
`lib/evento/janelas.ts` (32 asserções em `scripts/testarJanelasEvento.mts`),
fora do route porque **erram por uma hora sem dar erro nenhum**: o cron roda em
UTC, o evento é marcado em Brasília.

Os mesmos momentos vão para o sino do aluno, mais a confirmação de reserva
(trigger em `evento_reservas`). Nenhum é `celebracao`: toast de tela cheia
continua sendo só de conquista.

### Contatos
`contatos` (com `tags`) guarda quem se inscreveu numa live e não tem conta. A
linha de `evento_inscricoes` morre com o evento; esta é a única parte que, não
sendo gravada na hora, não tem como ser recuperada depois. `registrar_contato`
**soma tags e nunca apaga campo cheio com campo vazio**; `origem` só é gravada
no nascimento. ⚠️ A tag `nao-aluno` é fotografia da captura, não verdade
permanente — cruzar com `usuario_id` antes de usar em campanha.

## 🔴 Incidente: nenhuma avaliação da plataforma podia ser enviada — 2026-08-27

**Desde 12/07/2026, o botão "Emitir laudo" nunca funcionou para ninguém.** Zero
linhas em `avaliacao_tentativas` na plataforma inteira, com 37 avaliações
publicadas e 297 questões. Chegou como três relatos de alunas (casos 0403, 0424
e 0428, em três cursos diferentes) — não eram três bugs, era um só, e valia para
toda avaliação e toda prova.

**Causa:** a server action `submeter` era declarada **dentro** do componente em
`app/curso/[slug]/avaliacao/[avaliacaoId]/page.tsx`, com `"use server"` no corpo
da função. Nessa forma o Next **não leva junto as variáveis do escopo em volta**:
o flight serializava a ação com `"bound":null` e, no servidor,
`avaliacaoId is not defined` derrubava a chamada antes da RPC. Nada era gravado,
então nem rastro ficava.

⚠️ **O erro é invisível de fora.** Em produção o Next troca a mensagem por
"An error occurred in the Server Components render. The specific message is
omitted in production builds" — a mesma frase para qualquer falha de action. Foi
preciso reproduzir localmente (dev devolve a mensagem real) para ver o
`ReferenceError`.

**Correção:** a action mora em `actions.ts` próprio, no padrão do resto do
projeto, e o id chega por `submeterAvaliacao.bind(null, avaliacaoId)` — que o
Next serializa cifrado, então o cliente continua sem escolher qual avaliação
corrige. Regra que fica: **`"use server"` só no topo de um arquivo, nunca dentro
de um componente.** Era o único lugar do projeto que fazia isso.

⚠️ Dois defeitos que só apareceram porque este caminho nunca tinha rodado:

- O feedback por IA lia `sb.from("questoes")`, tabela **legada e vazia** (a real
  é `avaliacao_questoes`) — a Claude receberia "Quesito" no lugar do enunciado em
  todo erro corrigido.
- A correção com muitos erros leva **~13s** (uma chamada à Haiku por submissão),
  acima do teto padrão da Vercel. `export const maxDuration = 60` na rota. Sem
  isso o estouro derrubaria a resposta **depois** de a tentativa já estar
  gravada, que é o pior desfecho: o aluno vê erro e a nota fica lançada.

**Do lado do banco não havia nada errado** — a RPC `submeter_avaliacao` foi
exercitada por SQL direto e por PostgREST com JWT real de usuário descartável
(nota, XP, gabarito e gate de sequência corretos), e as tentativas de teste foram
apagadas.

## 🔴 Incidente: 624 emails gravados como enviados sem terem sido entregues — 2026-08-25

Entre 06/08 e 25/08 **nenhum email desta plataforma chegou a ninguém**. O painel
do Resend marcava "Failed" em tudo, e nada aqui dentro tinha como saber.

**Causa:** o domínio `peritosacademy.com.br` passou a recusar 100% dos envios,
com os três registros de DNS marcados como verificados e sem explicação pela
API. Medido no mesmo minuto, mesma chave, mesmo destinatário, mudando só o
remetente: `mhcalculos.com.br`, `nexuspericial.com.br` e `mkt.mhcalculos.com.br`
entregaram; `peritosacademy.com.br` falhou até para `delivered@resend.dev`.
Re-verificar não resolveu.

⚠️ **O envio sai de `mkt.peritosacademy.com.br`.** Subdomínio é identidade
separada, e é o padrão que a conta já usava nas outras duas marcas. Vale manter
mesmo depois de a raiz voltar: reputação de envio em massa fica longe do
domínio que também recebe email. O `replyTo` fica na raiz.

**Por que ficou invisível por três semanas:** a API do Resend responde 200 com
um id no ato e só descobre o problema depois, de forma assíncrona.
`enviarEmail()` olhava só o campo `error`, via 200 e gravava o dedupe. **E o
dedupe transformou a falha em permanente:** o índice único garantia que aqueles
emails nunca mais fossem tentados.

**Lição que vale para qualquer envio:** *"o provedor aceitou" nunca é "chegou".*
A linha agora diz `aceito` · `entregue` · `falhou`, as consultas de dedupe
ignoram `falhou` **e os índices únicos são parciais** (`where estado <>
'falhou'`) — meio conserto aqui seria pior que nenhum, porque a consulta
liberaria o envio e o INSERT estouraria depois de o email já ter saído.
`/api/webhooks/resend` é quem escreve o desfecho, e ele **recusa em voz alta**
sem `RESEND_WEBHOOK_SECRET`: a rota apaga marcação de dedupe, e aberta viraria
um botão público de "reenviar tudo".

⚠️ Marcar tudo como `falhou` **não reenvia nada**: os crons selecionam por
janela de tempo (48h do cadastro, 7 dias de inatividade) e essas janelas já
passaram. Quem reenvia é `scripts/reenviarApagao.mjs`, simulação por padrão.

⚠️ E **não eram 624, eram 99**. `primeira_semana`, `resumo_quinzenal` e
`inatividade` apodreceram — chegando hoje, cada um diz uma coisa falsa.
Reenviado só o que continua verdadeiro fora da data: `carta_pessoal` e
`curso_concluido`. 86 saíram; 13 ficaram presos no teto de uma celebração por
dia, que **não foi contornado de propósito**.

⚠️ **A chave do Resend é restrita por domínio.** A que estava no `env.local`
alcançava só `peritosacademy.com.br` e era a que falhava. Conferir o escopo
antes de culpar o código.

⚠️ **`env.local` e `.env.local` eram duas cópias do mesmo segredo e
divergiram** (o Next lê o segundo, os scripts leem o primeiro). Agora
`.env.local` é link simbólico para `env.local`.

## Turma fechada: o curso restrito — 2026-09-01

**Regra permanente.** `cursos.restrito` é o curso **publicado e mesmo assim
invisível** para quem não foi matriculado nominalmente. É a terceira posição
que faltava entre "publicado" (todo mundo vê) e "rascunho" (ninguém vê,
**inclusive quem pagou** — `buscarCurso` e `getAula` exigem `publicado=true`).

Nasceu da mentoria de 60 pessoas: não havia como ter um curso que aparecesse
no catálogo só para elas.

### A armadilha que isto desarma

⚠️ **"Pode abrir este curso" e "foi matriculado neste curso" não são a mesma
pergunta.** `tem_acesso_curso` responde a primeira, e é larga de propósito:
passa quem tem assinatura Asaas e passa quem tem concessão de escopo `total` —
**571 concessões totais vigentes numa base de 546 perfis**, medido em
01/09/2026. Construir turma fechada em cima dela daria uma turma de 571.

Por isso existe **`matriculado_no_curso(usuario, curso)`**, que só aceita a
linha nominal em `acessos_conteudo` (escopo `curso`, aquele curso, vigente).
Admin passa (`is_admin_papel` sem filtro de papel, mesmo bypass de
`concluir_aula`) — quem monta a mentoria precisa conferi-la antes de matricular
alguém. É a terceira dupla de nomes parecidos desta base, junto de
`tem_acesso_plataforma` × `tem_acesso_curso`: **cuidado ao mexer numa achando
que é a outra.**

### Uma regra só, aplicada por herança

O desvio mora **dentro de `tem_acesso_curso`**: curso restrito responde pela
regra estreita, curso normal responde exatamente como antes. Tudo que já
chamava a função apertou junto, sem uma linha a mais:

| Chamador | Efeito |
|---|---|
| `verificarAcessoCurso` (curso, aula, avaliação) | 404 para quem não é da turma |
| RLS de `aula_materiais` e do bucket | material da mentoria só para a turma |
| `evento_visivel_para` | o evento some da agenda dos outros |
| `evento_audiencia` | o email de anúncio não sai para os outros |

⚠️ **Escrever a regra de novo em qualquer um desses lugares é o erro a evitar.**
Duas cópias divergem no dia em que uma ganhar uma exceção que a outra não tem, e
o sintoma seria o email alcançando quem a tela esconde. As listagens
(`cursos-biblioteca`, vitrine da `home`, `jornada` nos dois pontos) perguntam ao
banco por **`cursos_restritos_visiveis()`** — uma chamada por página, não uma
por card — e filtram com `lib/acesso/restritos.ts`.

⚠️ **Assinatura não abre curso restrito, e isso é a decisão.** Turma fechada que
abre para quem assina não é turma fechada. Para vender a mentoria dentro do
plano, é só não marcá-la como restrita.

⚠️ **Curso restrito dá 404, nunca a tela de assinatura.** `AssinaturaNecessaria`
diria "assine para ter acesso", e assinar não abre turma fechada: seria vender
uma promessa que a plataforma não cumpre. Por isso `verificarAcessoCurso`
devolve `restrito` junto — o campo existe pela MENSAGEM, não pelo portão.

⚠️ **O anúncio do evento alcança a turma + os admins ativos** (2 em 01/09/2026),
porque o bypass de admin vale igual nos quatro chamadores. Uma turma de 60
aparece como 62 no contador de "Anunciar para os alunos". Preferi isso a fazer
`evento_audiencia` divergir de `evento_visivel_para` para poupar dois emails.

### Defeito antigo corrigido de carona

`tem_acesso_curso(<alguém com escopo total>, 'curso-que-nunca-existiu')`
respondia **`true`**. A cláusula do escopo `total` não menciona `p_curso_id` a
não ser dentro do `not exists` das exceções, então curso inexistente a tornava
simplesmente verdadeira. Nada explorava isso (as três páginas dão 404 antes de
perguntar, e a RLS sempre chega com o id vindo de um join), mas a sobrecarga por
slug transforma qualquer digitação errada nesse caso. Agora `null` é recusado na
primeira linha.

### Agenda: o "Curso vinculado" nunca restringiu nada sozinho

Quem filtra é o campo **Visibilidade**; `curso_id` com visibilidade "Todos"
manda o evento para a base inteira, e a tela não dizia isso. Dois campos
vizinhos, um parecendo implicar o outro. `AvisoVinculoCurso` agora avisa no
momento da escolha, com o botão que conserta, e explica o alcance real:
curso restrito nomeia a turma, curso normal avisa que inclui assinantes.

### Matricular turma em lote (`/admin/acessos` → "Matricular turma")

Cola a lista, um email por linha (vírgula e ponto e vírgula também), escolhe
curso e prazo, e recebe **uma linha de relatório por pessoa** — matriculado, já
tinha, sem conta aqui, não entrou —, com as pendências no topo. Teto de 300.

⚠️ **O lote NÃO cria conta e NÃO fala com o Nexus**, ao contrário do formulário
de uma pessoa. Criar conta em lote transforma dois erros de digitação em duas
contas fantasmas permanentes; e a conta do Nexus existe para o comprador de
curso avulso, que entra por lá — turma de mentoria já é aluna daqui. Gravação em
série de propósito: concorrente, sessenta escritas disputam a checagem de "já
tem" e gravam linha duplicada.

⚠️ **Nenhum email sai**, como em toda esta tela, desde os 3 e-mails de
boas-vindas disparados por engano no ensaio da migração.

`separarEmails` e as opções `permitirCriarConta` / `contaConhecida` moram no
núcleo (`lib/acessos/conceder.ts`), que continua sendo o dono único da regra —
o lote pula a BUSCA da conta (uma varredura do Auth para os N emails, não N
varreduras), nunca uma checagem.

### Testado
14 asserções em SQL com rollback: escopo total não abre restrito, matrícula
nominal abre, admin abre, total segue abrindo curso normal, curso inexistente
recusa, usuário nulo recusa, agenda mostra para o matriculado e esconde de quem
tem total, e o anúncio encolhe junto. Mais `cursos_restritos_visiveis` e
`tem_acesso_curso` pelo PostgREST com a chave anon (lista vazia e `false`), e
`npm run build`. **Não testado em navegador.**

⚠️ "Mentoria Peritos Academy" já está com `restrito = true`, ainda em rascunho e
com zero matriculados — publicar e colar a lista é o que falta.

## Tabelas principais
- `perfis` (usuário: nome, slug, bio, cidade, estado, telefone, email_publico, mostrar_tel, mostrar_email, perfil_publico, foto_url, xp, nivel, moedas, titulo, `status` ativo/suspenso/banido — ver seção Usuários; `tour_visto_em` timestamptz nullable — ver seção Tour guiado; `migrado_de`/`migrado_em`/`boas_vindas_migrado_em` — aluno importado em lote, ver seção Migração de alunos da Ensinio)
- `cursos` (com `restrito` — turma fechada, ver seção própria), `modulos`, `aulas`, `aula_progresso` (tem coluna `concluida` bool, default `false` desde 2026-07-14 — não existe tabela `aula_concluida`, nunca criar código que a referencie; toda leitura precisa filtrar `.eq('concluida', true)`, existência de linha não implica concluída, ver seção Progressão sequencial), `aula_anotacoes`, `material_downloads` (rastreio de download por aluno, ver Progressão sequencial)
- `trilhas`, `etapas`, `curso_trilha` (com trilha_nome, trilha_slug, etapa_nome)
- `avaliacoes`, `avaliacao_questoes`, `avaliacao_opcoes`, `avaliacao_tentativas`, `avaliacao_respostas` (+ views `_publicas`)
- `desafios`, `desafio_categorias`, `desafio_entregas` (nota_minima, arquivo_path)
- `certificados`, `perfil_insignias`, `perfil_estudo_dias`, `perfil_atividades`
- `eventos` (com `slug`, `aberto_ao_publico`, `chat_modo`), `evento_reservas`, `evento_inscricoes` (convidado sem conta), `evento_mensagens` (chat próprio, primeira tabela em Realtime) — ver "O evento tem endereço próprio", `comunidade_*` (feed/ranking, ver Bloco 2)
- `novidades`, `novidade_leituras` (avisos/banners institucionais — diferente de `notificacoes`, ver Sistema de Notificações)
- `notificacoes` (notificações pessoais/sino), `admin_usuarios` (papéis do admin)
- `config_gamificacao`, `gamificacao_gatilhos`, `gamificacao_niveis`, `gamificacao_extrato` (ledger de XP/moedas, ver seção Gamificação)
- `planos_assinatura`, `assinaturas`, `cobrancas`, `webhook_eventos`, `config_financeiro`, `financeiro_log_acoes` (ver seção Financeiro — **não confundir `planos_assinatura` com `planos`**, tabelas diferentes)
- `nexus_cta_config`, `nexus_cta_copies`, `nexus_cta_bloqueio`, `nexus_cta_interactions` (sugestões do MH Nexus — ver seção própria; `perfis.nexus_status` é flag manual, não há sync com o Nexus)
- `acessos_conteudo`, `acessos_excecoes` (concessões de acesso por curso/trilha/biblioteca com vigência — **o gate de conteúdo não é mais só `assinaturas`**, ver seção Migração de alunos da Ensinio), `migracao_alunos` (histórico da importação, uma linha por aluno × produto)
- `admin_log_acoes_usuario` (log unificado de ações administrativas sobre um aluno — suspender/reativar/banir/resetar senha/ajuste de gamificação/certificado manual, ver seção Usuários)
- `contatos` (base de contatos com tags, alimentada pelas lives), `email_convidados_enviados`, `email_optout_publico` (email para quem não tem conta)
- `config_plataforma` (registro único — identidade, contato, textos institucionais, comportamento, SEO; leitura pública `using (true)`, ver seção Configurações)
- Bucket Storage `planilhas` (privado, uploads de aluno/documentos), `capas` (público, imagens de capa), `capas-cursos` (público, capas horizontais/verticais de curso + thumbnails de aula — criado na migração Ensinio, ver seção da migração), `materiais-aulas` (privado, anexos de aula — ver seção Materiais complementares)
- Tabelas duplicadas/legadas — nunca usadas pelo app, não construir em cima: `posts`/`post_comentarios`/`post_reacoes` (substituídas por `comunidade_*`), `duvidas`/`duvida_respostas` (substituídas por `aula_duvidas`), `questoes`/`tentativas`/`materiais`/`progresso_aulas`, `planos` (feature dormente "meu plano de estudo" do aluno, sem leitura/escrita em código), `matriculas` (resquício de modelo antigo, sem leitura/escrita em código — o gate de acesso atual é por assinatura **ou** por concessão em `acessos_conteudo`, ver seções Financeiro e Migração de alunos da Ensinio)

## Sistema de ícones (dois níveis)
Toda a plataforma usa dois arquivos centrais em vez de SVGs inline espalhados pelos componentes.

- **`components/Icones.tsx`** — Nível 1, ícones de interface (navegação, ações, formulários, admin). `stroke="currentColor"`, `fill="none"`, traço 1.5px, `strokeLinecap`/`strokeLinejoin` round, viewBox 24x24, prop `size` (default 16). A cor vem do texto ao redor — não hardcodear cor.
- **`components/Emblemas.tsx`** — Nível 2, emblemas de gamificação/status (`FogoStreak`, `Moeda`, `XP`, `Certificado`, `InsigniaEtapa`, `SeloNivel`, `Trofeu`, `AoVivo`). Cores próprias fixas (fogo=sequência, dourado=moeda/XP, verde=conquista/ao vivo online, vermelho=ao vivo/transmissão, roxo=nível), gradientes com `useId()` pra não colidir quando o mesmo emblema renderiza várias vezes na página. Todo emblema aceita `variante: 'cor' | 'mono'` — mono renderiza o mesmo desenho em traço 1.5px `currentColor` sem gradiente, pra usar em contexto de navegação/lista (ex. "Meus certificados" no menu) em vez do dourado cheio (reservado pra contexto de conquista: popup, jornada, perfil).
- Regra de decisão: ação ou navegação → Nível 1; conquista ou status → Nível 2. Na dúvida, Nível 1.
- SVGs inline só sobrevivem quando são gauges/data-viz específicos de uma página (anéis de progresso em `AulaContent`, radar de competências em `PeritoPublicoContent`) — nunca ícone funcional solto.
- ⚠️ **Pendência**: `config_gamificacao.moeda_icone` é editável no admin (input de emoji em `AdminGamificacaoContent`) mas nada no app lê esse campo — os usos de `Moeda` no código são todos o emblema fixo do Nível 2, não o emoji configurado. Ligar `moeda_icone` aos usos de `Moeda` ou remover o campo do admin.

## Componentes-chave
- `NavPlataforma` — nav única, dropdown "Conteúdos" + menu avatar; prop `ativo` e tipo `Aba`
- `AulaContent` — player, trilho, marca conclusão via `aula_progresso`, dispara certificado
- `PerfilContent` — perfil editável com foto, heatmap de constância, certificados, insígnias
- `PeritoPublicoContent` — perfil público com radar de competências e score pericial

## Convenções de código
- Server actions retornam `{ ok: true/false, ... }` ou `{ gerado: bool, ... }`
- Optimistic UI em toggles da comunidade (reverte no erro)
- Durações de aula em `duracao_seg` (segundos)
- Slug gerado do nome: lowercase, sem acento, hífens

## PowerShell (ambiente do dev)
- Paths com colchetes quebram; usar `-LiteralPath`
- `Select-String -Recurse` não existe; usar `Get-ChildItem -Recurse -Include | Select-String`
- `.env.local` (gitignorado) não existe em checkouts/worktrees novos — `npm run dev` quebra com "Your project's URL and Key are required" até criar um com `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`. Pegar os valores via MCP (`get_project_url` + `get_publishable_keys`, projeto `abpbxvbmyogmsokboveu`) em vez de pedir pro usuário — é só a chave anon, segura de circular.

## Sistema de Notificações e Celebrações — Fase 1 (in-app) ✅ CONCLUÍDA — 2026-07-14
⚠️ **A spec original desta seção (catálogo multi-canal `notif_tipos`/`notif_fila_*`/`criar_notificacao()`) nunca chegou a ser construída** — era só documentação de intenção, sem lastro no banco. O que existe de fato hoje é mais simples, descrito abaixo. Se um canal extra (email/push/whatsapp) for necessário no futuro, o catálogo fica pra Fase 2 — não reintroduzir essas tabelas sem checar primeiro se ainda fazem sentido do jeito que foram desenhadas originalmente.

### Tabelas
- `notificacoes`: `usuario_id`, `tipo`, `prefixo`/`destaque`/`sufixo` (frase em 3 partes, `destaque` em negrito — usado tanto pelo sino quanto pelos toasts), `link_url`, `emblema` (chave textual do ícone — `trofeu`/`certificado`/`fogo_streak`/`xp`/`selo_nivel`, resolvida em TS, ver `AvisosGlobais.tsx`/`ConquistaToast.tsx`), `dados` (jsonb, payload estruturado pro toast — nível/nota/curso/streak, cada tipo com seu formato), `celebracao` (bool — `true` só nos 5 tipos que também viram toast; sino mostra todo mundo), `lida`, `criado_em`. Índice parcial `idx_notificacoes_celebracao (usuario_id, criado_em) WHERE celebracao` — mantém o polling do toast barato.
- `perfis.sons_conquista` (bool, default `true`) — preferência de som, editável em `/perfil` (mesmo bloco de toggles de `mostrar_tel` etc.).
- RLS de `notificacoes`: SELECT/UPDATE só a própria linha, igual antes. **Nenhuma policy de INSERT existe nem deve existir** — a única escrita é via `notificar()`.

### Chokepoint único: `notificar()`
Função `security definer`, assinatura `notificar(p_usuario, p_tipo, p_prefixo, p_destaque, p_sufixo, p_link_url?, p_emblema?, p_dados?, p_celebracao?)`. **`REVOKE EXECUTE ... FROM authenticated, anon`** logo após criada — só é chamável de dentro de outra função `SECURITY DEFINER` (que herda privilégio do dono ao executar), nunca via `supabase.rpc()` direto do navegador. Isso foi um retrabalho: a primeira tentativa só revogou de `PUBLIC`, mas o Supabase concede EXECUTE direto pra `authenticated`/`anon` via `alter default privileges` em toda função nova — revogar de `PUBLIC` sozinho não bastou, precisou nomear os papéis explicitamente. Confirmado via `has_function_privilege(...)` que só o dono (`postgres`) executa.

### Pontos de disparo (todos plugados nos gatilhos que já credam XP — nenhum gatilho novo de gamificação foi criado, nenhum valor de pontos foi alterado)
- **Subida de nível**: detectada dentro do próprio `creditar_gamificacao` (compara `perfis.nivel` antes/depois do crédito) — cobre qualquer gatilho que cause a subida, não só um específico.
- **Primeira aula concluída** (global, 1ª vez do usuário) e **módulo concluído**: `gam_trg_aula_progresso`.
- **Curso concluído**: `gam_verificar_progresso_curso` (guardado por checar se `creditar_gamificacao('concluir_curso',...)` de fato creditou — evita notificar de novo em toda re-checagem de progresso do curso já completo).
- **Certificado disponível** (sino só, sem toast — ver coordenação com popup abaixo): `gam_trg_certificados`.
- **Desafio enviado**: `gam_trg_desafio_entrega`.
- **Avaliação aprovada**: `submeter_avaliacao`.
- **Streak 7/30 dias**: dentro do próprio `gam_calcular_streak` (não em `login-diario.ts`/RPC exposta — expor isso ao cliente seria a mesma brecha de segurança do `notificar()` sem revoke). Função deixou de ser `STABLE` (agora pode escrever); dedupe por "já notificado hoje pra esse streak" evita duplicar a cada chamada do nav enquanto o streak não muda.
- **Comentário no seu post / dúvida respondida / marcado como melhor resposta**: `trg_notif_comunidade_comentarios`, `trg_notif_aula_duvida_resposta`, `trg_notif_comunidade_melhor_resposta` — triggers novos, só notificam (não creditam XP), notificam o dono do conteúdo (diferente de quem ganha XP pela ação).

Todos os 11 tipos testados de ponta a ponta via SQL direto com usuários descartáveis (inclusive um cenário de 3 conquistas simultâneas — nível + curso + primeira aula no mesmo INSERT — e o dedupe de streak chamando `gam_calcular_streak` 3x seguidas), dados apagados ao final.

### Sino (`AvisosGlobais.tsx`)
Já existia funcionando (leitura/marcar-lida), só faltava quem escrevesse — agora escreve. Ícones por tipo: celebração usa `Emblemas` variante `mono` (`Trofeu`/`Certificado`/`FogoStreak`/`XP`/`SeloNivel` — regra "conquista/status → Nível 2" já documentada), ação simples usa `Icones` Nível 1. Paginação: botão "Carregar mais" (`buscarMaisNotificacoes` em `app/avisos/actions.ts`), substituindo o `.limit(12)` fixo.

### Toasts (`components/ConquistaToast.tsx`)
5 tipos com identidade própria (nível — overlay full-screen com badge PNG de `public/niveis/`; avaliação aprovada — verde+dourado, `Trofeu`; curso concluído — capa do curso, `Certificado`; streak — `FogoStreak` pulsando + contador animado; primeira aula — `XP`). Montado em `app/layout.tsx` ao lado de `AvisosGlobais`.
- **Detecção: polling a cada 8s, não Realtime.** Decisão deliberada — Realtime exigiria configurar publicação/canal autenticado pela primeira vez no projeto (nenhum precedente pra copiar); o ganho de latência não importa pro caso de uso (celebração, não chat). Pausa em `document.hidden` (`visibilitychange`), retoma com checagem imediata ao voltar o foco.
- **Fila com prioridade** quando várias conquistas chegam juntas: `nivel_up > curso_concluido > avaliacao_aprovada > streak > primeira_aula`.
- **Coordenação com o popup de certificado** (`AulaContent.tsx`): flag `sessionStorage['cert-popup-aberto']` setada quando o popup de certificado (já existente, com confete) abre e limpa quando fecha; o toast de `curso_concluido` espera essa flag limpar (com teto de ~10s) antes de aparecer, pra não duplicar festa quando os dois coincidem.

### Sons (`lib/sons/`)
Sintetizados via Web Audio API (osciladores + ruído filtrado via `AudioBuffer`) — **sem nenhum arquivo de áudio**. `lib/sons/index.ts` expõe só `tocarSom(tipo)`; cada tipo tem seu arquivo (`nivel.ts`, `avaliacao.ts`, `curso.ts`, `streak.ts`, `primeiraAula.ts`) — trocar por arquivo de áudio no futuro é só reescrever o corpo desses arquivos, os call sites não mudam. Volume mestre 40%. `AudioContext` criado lazy, com listener de `pointerdown`/`keydown` pra tentar destravar autoplay cedo; qualquer falha (autoplay bloqueado, contexto indisponível) é engolida em silêncio — o toast visual nunca depende do som. Toggle "Sons de conquista" em `/perfil` (`perfis.sons_conquista`).

### Fora do escopo desta fase
Push/whatsapp (o catálogo `notif_tipos`/filas mencionado na spec antiga, se algum dia for necessário — emails já saíram na Fase 2, ver seção abaixo), calibragem dos textos/durações dos toasts, cron de lembretes de agenda/aniversário (pendência antiga, não relacionada a esta fase), notificação de "nova aula/avaliação publicada" (não pedida em nenhuma das duas fases).

## Emails (Fase 2) ✅ CONCLUÍDA — 2026-07-14
16 templates HTML aprovados (`docs/email-templates/*.html`, lidos e reproduzidos literalmente — nenhum HTML novo inventado, só placeholders parametrizados) viram emails de verdade via Resend, disparados nos mesmos pontos onde `notificar()` já roda (Fase 1). Os 4 templates de Asaas (`email_pagamento_confirmado.html`, `email_pagamento_falhou.html`, `email_renovacao_aviso.html`, `email_assinatura_cancelada.html`) **existem no repo mas não têm envio implementado** — ficam pra Fase 3, quando a integração Asaas real for ligada (ver seção Financeiro).

### Tabelas
- `email_enviados`: `usuario_id`, `tipo`, `ref_id` (**`text`, não `uuid`** — guarda tanto um `curso_id` quanto um `nivel_ordem`/data, a spec original pedia uuid mas dava exemplo de nível, que é inteiro), `assunto`, `criado_em`. Índice único `(usuario_id, tipo, coalesce(ref_id,'__geral__'))` — dedupe permanente por padrão; os crons recorrentes (inatividade, resumo quinzenal) contornam isso de propósito usando `ref_id = data de hoje`, porque cada ciclo desses pode legitimamente repetir depois do cooldown (ver RPCs abaixo). RLS: nenhuma policy pra `authenticated`/`anon` — só o service role escreve.
- `email_preferencias`: `usuario_id` (PK, FK `perfis`), `receber_emails` (default `true`). RLS: usuário só lê/atualiza a própria linha. Toggle "Receber emails" em `/perfil`, mesmo bloco do "Sons de conquista" (Fase 1) — mas como não é coluna de `perfis`, é salvo por uma action própria (`salvarPreferenciaEmail`) com toggle otimista instantâneo, não junto do form "Salvar dados gerais".
- `cursos.contexto_certificado` (text, nullable) — editável no admin na mesma tela do toggle `emite_certificado` (`AdminCursoEditorContent.tsx`). Quando vazio, o email de certificado usa a frase padrão do próprio template aprovado ("Cada uma dessas aulas exigiu tempo, atenção e a decisão de continuar quando dava vontade de parar. Você continuou. Até o fim.").

### Chokepoint de envio: `lib/email/enviar.ts`
`enviarEmail({usuarioId, tipo, refId?, assunto, html, remetente})` — único lugar que fala com o Resend. Checa `email_preferencias` (não envia se `receber_emails=false`), checa duplicata em `email_enviados`, checa o **limite diário de 1 email de celebração/jornada** (Parte 6 — prioridade `nivel_up > certificado > carta_pessoal > primeira_semana > resumo_quinzenal > inatividade_7 > inatividade_21`, só esses tipos competem por esse limite), injeta os links reais de rodapé (os templates aprovados têm só texto puro ali — "Preferências de email" vira link pra `/perfil`, "Cancelar inscrição" vira link assinado, ver token abaixo) e só então chama Resend + grava em `email_enviados`. Qualquer falha é silenciosa (`console.error`, nunca lança) — mesmo padrão de `lib/gamificacao/login-diario.ts`. Usa **service role** (`lib/supabase/servico.ts`, `criarClienteServico()`) — primeira vez que o projeto usa a service role key em código de aplicação (antes só existia pra scripts/MCP); justificado porque essa rota nunca é alcançada por uma sessão de usuário, só por triggers de banco (via `pg_net`) e crons já gateados por segredo compartilhado antes de qualquer linha desse código rodar.

### Remetente
- **Pessoal/celebração** (boas-vindas, carta pessoal, subida de nível, certificado, primeira semana, inatividade 7/21): `Marlos Henrique <marlos@peritosacademy.com.br>`, reply-to igual.
- **Automático** (resumo quinzenal): `Peritos Academy <noreply@peritosacademy.com.br>`, reply-to `marlos@peritosacademy.com.br`.

### Ponte trigger de banco → email: `pg_net` + `/api/internal/email-evento`
Subida de nível é detectada dentro de `creditar_gamificacao` (função SQL pura, chamada por vários triggers e por um upsert direto do client em `aula_progresso` — sem nenhum ponto TS único pra interceptar), e boas-vindas dispara do trigger `criar_perfil` em `auth.users`. Postgres não fala HTTPS sozinho pra chamar o Resend, então: extensão `pg_net` habilitada, e esses três pontos (`creditar_gamificacao` pra nível, `criar_perfil` pra boas-vindas, `gam_trg_certificados` pra certificado) disparam um `net.http_post` **assíncrono** (não bloqueia a transação) pra `https://peritos-academy.vercel.app/api/internal/email-evento` — que só então busca os dados de negócio (perfil, aulas, XP) e monta o email de verdade em TS. Os triggers de banco só mandam `{tipo, usuario_id, ref_id}`, nunca dado computado.
- **Certificado**: só dispara se `cursos.emite_certificado=true` **e** o curso tiver mais de 10 aulas (checado dentro do trigger antes do `net.http_post`).
- **Segredo da ponte**: `EMAIL_INTERNAL_SECRET`, guardado **criptografado no Supabase Vault** (`public.email_internal_secret()`, `EXECUTE` revogado de `authenticated`/`anon`) — não numa GUC em texto puro. Gerado inteiramente dentro do SQL da migração (`encode(gen_random_bytes(32),'hex')`), nunca digitado por mim nem aparece como literal em nenhum texto de migração; só foi lido uma vez (fora de uma migração) pra também configurar o mesmo valor como env var `EMAIL_INTERNAL_SECRET` na Vercel, que é o que a rota `/api/internal/email-evento` compara no header `Authorization`.

### Crons (`app/api/cron/*`, `vercel.json`, `0 10 * * *` = 7h Brasília)
Todas protegidas por `Authorization: Bearer $CRON_SECRET` (convenção automática do Vercel Cron — ele já manda esse header sozinho quando a env `CRON_SECRET` existe no projeto).
- `email-carta-pessoal`: `perfis.criado_em` entre 47h-49h atrás.
- `email-primeira-semana`: entre 6.5-7.5 dias atrás.
- `email-inatividade`: duas passagens numa rota só — 7 dias (janela 6.5-7.5d, cooldown 30d) e 21 dias (janela 20.5-21.5d, cooldown 60d). "Última atividade" = maior entre `gamificacao_extrato` e `aula_progresso.concluida_em`, via RPC nova `email_usuarios_inativos` (agregação em SQL, evita N+1 em TS pra cada usuário).
- `email-resumo-quinzenal`: candidatos vêm prontos da RPC nova `email_candidatos_resumo_quinzenal` (já filtra "15+ dias desde o último resumo" e "teve atividade no período"); o tom do texto (`{TITULO_VARIAVEL}`/`{PARAGRAFO_CONTEXTO}`/`{FRASE_DESTAQUE}`/`{PARAGRAFO_PROXIMO}`) varia conforme `aulas_periodo` (≥10 / ≥3 / <3), com override de celebração se `subiu_nivel` (proxy: `xp_total - xp_periodo < pontos_minimos` do nível atual — não existe histórico de nível por dia, então essa é a aproximação). Assunto sorteado entre 3 opções.
- Ambas as RPCs novas são `security definer`, `EXECUTE` revogado de `authenticated`/`anon` — só o service role dos crons chama.

### Link de cancelar inscrição
`lib/email/token.ts` — token = UUID do usuário assinado com HMAC-SHA256 (`CRON_SECRET` como chave, `crypto` nativo do Node — sem lib nova tipo `jsonwebtoken`/`jose`), sem expiração. `app/email/cancelar/page.tsx` — página pública (sem `NavPlataforma`, sem `verificarAcessoConteudo` de propósito), lê `?token=`, valida e faz upsert em `email_preferencias.receber_emails=false`. `middleware.ts` precisou de dois ajustes pra essa rota funcionar: `/email/cancelar` entrou na lista de rotas neutras (senão o gate de suspensão/manutenção redirecionaria o link do email antes dele fazer efeito), e **todo `/api/*` foi excluído do gate de manutenção/suspensão** — sem isso, `modo_manutencao=true` redirecionaria os crons e a rota interna de email pra uma página HTML em vez de responder JSON (bug que também afetava `/api/webhooks/asaas`, pré-existente, corrigido de graça no mesmo ajuste).

### Templates (`lib/email/templates/`)
Um arquivo por template, cada um retornando `{assunto, html}` com o HTML do arquivo aprovado copiado literalmente (interpolação real via template literal JS, não um sistema de geração por fórmula de cor — a cor do botão CTA, por exemplo, não segue um padrão único entre os 9 níveis, então cada nível guarda seus valores exatos conferidos contra o HTML aprovado). `nivelUp.ts` cobre os 9 templates de nível (2 a 10) numa função por nível + um dispatcher por `ordem`; nível 6 (botão `#083952`/borda cinza) e nível 10 (insígnia maior, botão gradiente, dados extras `{AVALIACOES_APROVADAS}`/`{DESAFIOS_ENTREGUES}`) tratados como exceções explícitas, exatamente como descrito na spec. Assuntos sem travessão, a maioria bem abaixo de 50 caracteres (o de certificado trunca o nome do curso se precisar, já que títulos de curso podem passar de 50 caracteres sozinhos).

### Fora do escopo desta fase
Envio real dos 4 templates de Asaas (Fase 3 — pagamento confirmado/falhou, renovação, cancelamento; plugar quando a integração Asaas real for ligada, ver seção Financeiro), catálogo `notif_tipos`/push/whatsapp (só relevante se um canal além de email/in-app for necessário), calibragem dos textos variáveis do resumo quinzenal com dado real de uso.

## Gamificação (módulo 16 do admin)
Motor de XP/moedas/níveis com gatilhos configuráveis. Fonte da verdade é um **ledger append-only** (`gamificacao_extrato`), não um contador incremental — todo crédito é uma linha nova, o saldo é a soma.

### Tabelas
- `config_gamificacao` (singleton, id=1) — switches (`gamificacao_ativa`, `gatilhos_ativos`, `ranking_ativo`, `loja_ativa` etc.) + nomenclatura de XP/moeda + texto explicativo
- `gamificacao_gatilhos` — catálogo (`codigo` pk, `pontos`, `moedas`, `limite_diario` nullable, `ativo`, `categoria`: comum/marco/quiz/especial)
- `gamificacao_niveis` — `nome`, `pontos_minimos` (unique), `selo_url`, `ordem`
- `gamificacao_extrato` — ledger: `usuario_id`, `gatilho_codigo`, `pontos`, `moedas`, `referencia_tipo`/`referencia_id` (idempotência — unique parcial quando `referencia_id` não é nulo)
- `perfis.data_nascimento` (nova, nullable) — pro gatilho `aniversario`, ainda sem agendamento (fase seguinte)

### RPC única: `creditar_gamificacao(usuario, codigo, referencia_tipo?, referencia_id?, pontos_override?, moedas_override?, pular_idempotencia?)`
Todo gatilho passa por aqui — nunca insere direto no extrato. Checa `config_gamificacao`, existência/ativo do gatilho, limite diário (fuso America/Sao_Paulo), idempotência por referência, insere, **recalcula xp_total/moedas_total somando o extrato inteiro** (sem batch) e sincroniza `perfis.xp`/`moedas`/`nivel` (nivel = maior `gamificacao_niveis.ordem` com `pontos_minimos <= xp_total`; abaixo do primeiro nível, `perfis.nivel = 0`).

### Duas decisões estruturais (regras de quiz em `submeter_avaliacao`)
1. **Faixas de acerto × peso substituem o XP fixo.** A antiga coluna `avaliacoes.xp` foi renomeada pra `avaliacoes.peso` (multiplicador, default 1; provas usam 2). Faixas: `quiz_ate_49`, `quiz_50_69`, `quiz_70_89`, `quiz_90_99`, `quiz_100` — pontos da faixa × peso da avaliação.
2. **Retentativa só paga o delta.** `submeter_avaliacao` soma tudo que já foi creditado pra aquela avaliação (`referencia_tipo='avaliacao_quiz'`) e credita só a diferença se a nova faixa valer mais. Nota pior nunca debita. `passar_prova` é bônus único (idempotente) só quando `avaliacoes.tipo = 'prova'`.

### Gatilhos instrumentados (triggers de banco, exceto onde indicado)
`aula_progresso` (insert/update `concluida`) → `concluir_aula`, e cascata no mesmo trigger pra `iniciar_curso` (primeira aula do curso), `concluir_modulo` e `concluir_curso`/`concluir_etapa` (via `gam_verificar_progresso_curso`, que também roda dentro de `submeter_avaliacao` quando uma aprovação fecha o curso). `certificados` → `certificado`. `comunidade_reacoes`/`comunidade_comentarios`/`comunidade_posts`/`aula_duvidas` → `reagir`/`comentar_post`/`criar_post`/`comentar_aula`. `desafio_entregas` (transição pra `entregue_em` não nulo) → `entregar_desafio`. `login_diario` é a exceção — não é trigger de banco, é chamado a partir de `app/layout.tsx` (`lib/gamificacao/login-diario.ts`, fire-and-forget, idempotente pelo `limite_diario=1`). `aniversario`/`aniversario_plataforma` existem no catálogo mas sem agendamento (pg_cron/Vercel Cron fica pra fase seguinte). `compra_aprovada`/`primeira_compra` ficam `ativo=false` até o Asaas entrar.

### Bugs corrigidos no caminho
- `lib/certificados/gerar.ts` e `lib/queries/cursos-biblioteca.ts` liam de uma tabela `aula_concluida` que **não existe** — a emissão automática de certificado nunca funcionou de verdade. Trocado por `aula_progresso.eq('concluida', true)`; `gerar.ts` agora chama a RPC `gam_curso_completo` (mesma função usada pelo motor de gamificação) em vez de duplicar a checagem em TS.

### Seed
Todos os valores de `pontos`/`moedas`/`limite_diario` dos gatilhos e os `pontos_minimos` dos níveis são **placeholder** — a spec original pediu pra calibrar depois pelo admin. O seed usa `ON CONFLICT (codigo) DO UPDATE` só em nome/descrição/categoria, então recalibragens feitas no admin sobrevivem a re-seeds.

### Nav com dado real (2026-07-13)
`lib/queries/nav.ts` plugou no motor de verdade:
- XP/moedas: view `gamificacao_saldo` (`security_invoker=true` — herda a RLS de `gamificacao_extrato`, então soma só o próprio usuário), não a coluna `perfis.xp` em cache
- Nível/título/próximo nível: busca `gamificacao_niveis` inteira (é pequena) e deriva no servidor — nível atual = maior `ordem` com `pontos_minimos <= xp`; título = `nome` desse nível; barra de progresso = `xp / pontos_minimos do próximo nível`
- Streak (dias consecutivos): RPC `gam_calcular_streak(usuario)` — conta dias distintos com lançamento `login_diario` no extrato (fuso America/Sao_Paulo), andando pra trás a partir de hoje (ou ontem, se ainda não logou hoje) até achar um buraco. **Substitui** a lógica antiga baseada em `perfil_estudo_dias`, que era dado de seed de um único usuário demo, nunca escrita pelo app.
- `perfis.xp_proximo_nivel` e `perfis.titulo` (colunas antigas) ficaram órfãs — não são mais lidas pelo nav, mas continuam existindo na tabela (não foram dropadas).

⚠️ **Gap de segurança fechado no caminho**: a policy de update de `perfis` é só por linha (`auth.uid() = id`), sem restrição de coluna — qualquer usuário logado podia sobrescrever seu próprio `xp`/`moedas`/`nivel` direto via client, sem passar pelo ledger. Trigger `trg_gam_proteger_perfis` (BEFORE UPDATE OF xp, moedas, nivel) reverte essas 3 colunas pro valor antigo a menos que a sessão tenha `set_config('app.gamificacao_write', 'on', true)` ativo — só `creditar_gamificacao()` seta essa flag antes de escrever.

### Fora do escopo por enquanto
Loja de recompensas (só o saldo de moedas existe), página pública de ranking, notificações de gamificação (spec já registrada acima), cron de aniversários, `perfil_insignias` (insígnias visuais avulsas, sem gatilho).

## Financeiro (módulo Asaas no admin)
Estrutura completa de assinaturas/cobranças/webhooks construída em 2026-07-13, **sem nenhuma chamada externa real** — a ideia foi deixar tudo pronto pra só plugar as chaves do Asaas depois. Ver pendências no fim da seção.

### Nomenclatura — atenção ao nome `planos`
Já existia uma tabela `planos` no banco, não documentada até então: é a feature dormente "meu plano de estudo" do aluno (`usuario_id`, `titulo`, `meta`, `passos` jsonb — o botão "Criar novo plano" em `HomeContent.tsx`, sem `onClick`, 0 linhas). Pra não colidir nem confundir sessões futuras, os planos de assinatura pagos vivem em **`planos_assinatura`**, não em `planos`. Mesma cautela vale pra `matriculas` (`usuario_id`, `curso_id`, `origem`, `turma`) — também pré-existente, também sem nenhuma leitura/escrita em código, provavelmente resquício de um modelo antigo de matrícula por turma; não usada pelo gate de acesso atual (que é por assinatura, não por matrícula).

### Tabelas
- `planos_assinatura` — `nome`, `descricao`, `valor_centavos`, `periodicidade` (mensal/anual), `asaas_plan_id` nullable, `ativo`. Catálogo ativo é público (RLS `select using (ativo = true)`) pra uma futura página de checkout.
- `assinaturas` — `usuario_id`, `plano_id`, `status` (ativa/inadimplente/suspensa/cancelada/cortesia), `asaas_subscription_id` nullable, `iniciada_em`, `proxima_cobranca`, `cancelada_em`, `observacao`. Índice único parcial `uq_assinatura_usuario_corrente` garante no máximo uma assinatura não-cancelada por aluno — ações do admin fazem `UPDATE` na mesma linha, nunca criam linha nova.
- `cobrancas` — `assinatura_id`, `valor_centavos`, `status` (pendente/confirmada/vencida/estornada), `metodo`, `vencimento`, `pago_em`, `asaas_payment_id` unique, `observacao` (campo extra além da spec original, pra marcar cobranças de teste no seed).
- `webhook_eventos` — log bruto de tudo que chega em `/api/webhooks/asaas`: `origem`, `evento_id_externo` unique (idempotência), `tipo`, `payload` jsonb, `processado`, `erro`.
- `config_financeiro` (singleton, id=1) — `dias_carencia` (default 3).
- `financeiro_log_acoes` — quem fez o quê: `admin_id`, `assinatura_id`, `acao` (conceder_cortesia/suspender/reativar/cancelar), `observacao`. Não existe um log genérico de ações do admin no projeto ainda, então esse log é escopado só ao financeiro.

### RPCs (todas `security definer`, `set search_path = public`)
- `tem_acesso_ativo(usuario)` — gate de conteúdo. `ativa`/`cortesia` sempre passam; `suspensa`/sem assinatura nunca passam; `inadimplente` passa durante `dias_carencia` contados de `proxima_cobranca` pra frente. Chamada por `lib/acesso/verificar.ts` em toda página de conteúdo pago.
- `fin_conceder_cortesia` / `fin_suspender_assinatura` / `fin_reativar_assinatura` / `fin_cancelar_assinatura` — todas checam `is_admin_papel(auth.uid(), array['super_admin','financeiro'])` internamente (não só na Server Action) e logam em `financeiro_log_acoes`. `fin_conceder_cortesia` faz upsert (atualiza a assinatura corrente se existir, senão cria) vinculada ao plano interno "Cortesia" (seed, `ativo=false`, não aparece no catálogo público).
- `processar_evento_asaas(webhook_evento_id)` — lê o payload já logado em `webhook_eventos` e atualiza `cobrancas`/`assinaturas` por `asaas_payment_id`/`asaas_subscription_id`. Concedida a `anon` **e** `authenticated` — a rota de webhook roda sem sessão de usuário (o Asaas não manda cookie), então a validação de origem é toda no route handler (token), não no RLS.
- `admin_buscar_usuario_por_email(email)` — resolve e-mail → `perfil.id` pra tela de "conceder cortesia". Só existe pra evitar introduzir um cliente Supabase service-role no projeto: como é `security definer`, a função em si enxerga `auth.users` (owner da função), mas só devolve `id`/`nome`/`ja_tem_assinatura`, e só pra quem já é admin financeiro/super_admin. **Não existe cliente service-role no projeto** — se surgir outra necessidade de ler `auth.users` ou bypassar RLS, o padrão é esse (RPC `security definer` estreita), não adicionar a service role key.

### Gate de acesso (`lib/acesso/`)
- `lib/acesso/verificar.ts` → `verificarAcessoConteudo()`: pega o usuário da sessão, chama `tem_acesso_ativo` via RPC, devolve `{ logado, permitido }`.
- `lib/acesso/config.ts` → `EXIGE_ASSINATURA_COMUNIDADE_E_AGENDA` (hoje `true`) — única constante que decide se Comunidade e Agenda também exigem assinatura ativa além de login. Fácil de virar `false` se decidirem liberar essas duas seções pra qualquer logado.
- Aplicado com gate incondicional (sempre exige assinatura) em `curso/[slug]`, `curso/[slug]/aula/[aulaId]`, `curso/[slug]/avaliacao/[avaliacaoId]` e `desafios/[slug]` — checado **depois** do `notFound()`/`redirect('/login')` já existente, pra 404 e "precisa logar" continuarem tendo prioridade sobre "precisa assinar".
- `components/AssinaturaNecessaria.tsx` — placeholder de paywall (`.pagina-assinatura-necessaria` no CSS, mesmo padrão visual de `.pagina-acesso-negado` mas em verde em vez de vermelho). Mensagem e CTA mudam conforme `logado` (deslogado → "faça login"; logado sem assinatura → "regularize"). CTA aponta pra `/perfil` — a página de checkout real é pendência de amanhã.

### Webhook (`app/api/webhooks/asaas/route.ts`)
Primeira rota `app/api/` do projeto (antes só existiam Server Actions). Fluxo: 1) valida `asaas-access-token` contra `ASAAS_WEBHOOK_TOKEN` — se a env existir e não bater, `401`; **se a env não existir, só loga `console.warn` e aceita qualquer chamada** (aceitável agora porque não há chave real; precisa estar configurada antes de apontar o Asaas de verdade pra essa URL); 2) loga bruto em `webhook_eventos` (id gerado no client com `crypto.randomUUID()` — ver pegadinha de RLS abaixo); 3) chama `processar_evento_asaas`. Eventos tratados: `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED` → cobrança confirmada + assinatura ativa; `PAYMENT_OVERDUE` → cobrança vencida + assinatura inadimplente; `SUBSCRIPTION_CANCELLED`/`SUBSCRIPTION_DELETED` → assinatura cancelada. Testado de ponta a ponta via curl local (insert idempotente, dedupe por `evento_id_externo`, `erro` populado quando a cobrança não é encontrada) — nenhuma chamada real ao Asaas.

⚠️ **Pegadinha de RLS descoberta no smoke test**: `.insert(...).select().single()` encadeado numa tabela onde a role que insere (`anon`, nesse caso) não tem policy de `SELECT` derruba o insert inteiro com `"new row violates row-level security policy"` — o Postgres exige que a linha do `RETURNING` também passe por uma policy de leitura, não só a de escrita. Corrigido gerando o `id` no client (`crypto.randomUUID()`) antes do insert e não encadeando `.select()`. Vale pra qualquer rota futura que escreva como `anon`/role sem SELECT.

### Admin (`app/admin/financeiro`, papéis `super_admin`/`financeiro`)
Segue o padrão de módulo dos demais (`lib/queries/admin-financeiro.ts` + `app/admin/financeiro/actions.ts` + `components/AdminFinanceiroContent.tsx`), com 4 abas internas:
- **Painel**: MRR (soma das assinaturas `ativa`, plano anual normalizado ÷12), assinantes ativos, inadimplentes, cortesias, faturamento do mês (cobranças `confirmada` com `pago_em` no mês corrente), gráfico de barras simples de receita dos últimos 6 meses, campo de `dias_carencia`.
- **Assinaturas**: busca por nome + filtro por status (client-side, dataset pequeno pré-lançamento), card "Conceder cortesia" (busca por e-mail via `admin_buscar_usuario_por_email`), linha expansível por aluno com histórico de cobranças e ações (suspender/reativar/cancelar, com `confirm()`/`prompt()` nativos pra confirmação e observação — mesmo padrão de diálogo nativo já usado em `AdminCertificadosContent`).
- **Planos**: CRUD completo. O plano "Cortesia" aparece marcado como "(interno — não excluir)" na lista — se for renomeado ou apagado, `fin_conceder_cortesia` não acha mais `plano_id` por nome e a próxima concessão de cortesia falha (constraint `NOT NULL`); não há proteção de banco contra isso, só o aviso visual.
- **Webhooks**: últimos 50 eventos de `webhook_eventos`, com status de processamento, erro e payload expansível — é a tela de depuração pra quando a integração real for ligada.

### Seed
2 planos reais (Mensal R$97, Anual R$970 — valores placeholder), 1 plano interno "Cortesia" (R$0, `ativo=false`), cortesia pré-lançamento pra `marlos.h.santos@gmail.com` (nada bloqueia o uso dele), 2 cobranças de teste na assinatura de cortesia (uma confirmada, uma pendente) marcadas em `observacao` como dado de teste.

### Pendências (integração real — "amanhã")
- **Chaves do Asaas**: `ASAAS_WEBHOOK_TOKEN` (validação do webhook) e as credenciais da API do Asaas em si (criação de assinatura/cobrança) — nenhuma existe ainda, nenhuma chamada de saída foi feita nesta sessão.
- **Checkout real**: `AssinaturaNecessaria` é só um placeholder; a página de assinar/pagar de fato (fluxo de criação de assinatura no Asaas) não existe.
- **Validação real do webhook**: hoje é só um `console.warn` quando a env não está setada — precisa validar a assinatura/token de verdade assim que o Asaas for conectado, e testar com payloads reais (o formato assumido — `event`, `payment.id`, `subscription.id` — é uma suposição razoável, não confirmado contra a doc do Asaas).
- **Cron de carência**: `tem_acesso_ativo` calcula a carência **dinamicamente na leitura** (não precisa de cron pro bloqueio em si funcionar). Um cron futuro pode servir pra lembrar o aluno durante a janela de carência (via notificações) ou pra transicionar o status depois que ela expira — não construído.
- **Criação de novas cobranças**: `processar_evento_asaas` só atualiza `cobrancas` já existentes (casadas por `asaas_payment_id`); o fluxo que cria uma `cobranca` nova a partir de um ciclo de cobrança do Asaas (ou que chama a API do Asaas pra criar a cobrança) fica pra quando a integração for ligada.
- **Notificações financeiras**: a spec de notificações (categoria "Financeiro" na seção acima) pede `notificar()` nos eventos de assinatura confirmada/atrasada/cancelada — como o sistema de notificações Fase 1 **ainda não foi implementado em código** (só documentado), `processar_evento_asaas` não dispara nada. Quando a Fase 1 for construída, plugar as chamadas ali.

## Usuários (módulo de suporte ao aluno no admin)
Visão 360° de cada aluno com ações administrativas — construído em 2026-07-13. Papéis: `super_admin` e o novo `suporte` (adicionado ao check constraint de `admin_usuarios.papel` e ao `PapelAdmin`/`PERMISSOES_SECAO.usuarios` em `lib/admin/permissoes.ts`).

### Banco — leitura via RPCs de consolidação, sem tabelas espelho
Todas as RPCs de leitura (`admin_listar_usuarios`, `admin_usuario_ficha`, `admin_usuario_extrato`, `admin_usuario_comunidade`, `admin_usuario_auditoria`) são `security definer` e checam `is_admin_papel(auth.uid(), array['super_admin','suporte'])` internamente — nenhuma policy de RLS nova foi adicionada nas tabelas de origem (assinaturas/cobrancas/gamificacao_extrato/comunidade_*) pro papel `suporte`; as RPCs agregam e curam os dados no servidor, evitando espalhar `suporte` pelas políticas de outros módulos. `admin_listar_usuarios` e `admin_usuario_ficha` também juntam `auth.users` (email, `last_sign_in_at` como "último acesso") do mesmo jeito que `admin_buscar_usuario_por_email` já fazia — sem cliente service-role.
- `perfis.status` (`ativo|suspenso|banido`, default `ativo`) — **gate em `middleware.ts`**, não em `tem_acesso_ativo`: esse RPC só cobre rotas de conteúdo pago específicas, enquanto suspensão/banimento precisa cortar acesso a QUALQUER rota (inclusive home/perfil/comunidade). O middleware busca `perfis.status` pra todo usuário autenticado (exceto em `/login` e `/conta-suspensa`, pra não entrar em loop) e redireciona pra `/conta-suspensa` se suspenso/banido.
- `admin_log_acoes_usuario` (dedicada, não reaproveitou `financeiro_log_acoes`): o log financeiro tem FK pra `assinatura_id` e vocabulário de ação sobre a ASSINATURA — misturar exigiria afrouxar isso pra um domínio diferente (ações sobre o USUÁRIO). A aba Auditoria da ficha faz `UNION` de `admin_log_acoes_usuario` com `financeiro_log_acoes` (via `admin_usuario_auditoria`) pra mostrar cortesias concedidas também.
- `fin_conceder_cortesia` foi ampliada pra aceitar o papel `suporte` (spec pediu reusar essa RPC em vez de duplicar) — as outras ações financeiras (suspender/reativar/cancelar assinatura) continuam só `super_admin`/`financeiro`.
- Gatilho `ajuste_admin` em `gamificacao_gatilhos` (`ativo=true` — precisa estar ativo pra passar pelo gate de `creditar_gamificacao`; "restrito a essa RPC" é garantido porque nenhum trigger automático referencia esse código, só `adm_ajustar_gamificacao` chama).

### RPCs de ação (todas com justificativa obrigatória, todas logam em `admin_log_acoes_usuario`)
`adm_suspender_usuario` / `adm_reativar_usuario` / `adm_banir_usuario` (mudam `perfis.status`) · `adm_resetar_senha` (só resolve o e-mail via `auth.users` e loga — quem dispara o e-mail de fato é a Server Action chamando `supabase.auth.resetPasswordForEmail(email)`, o método padrão do Supabase Auth; nunca define senha diretamente, nunca precisa de service role) · `adm_ajustar_gamificacao` (chama `creditar_gamificacao(..., 'ajuste_admin', null, null, pontos, moedas, false)` — `referencia_id` nulo, então nunca esbarra no bloqueio de idempotência; aceita pontos/moedas negativos pra correção) · `adm_emitir_certificado_manual` (reusa a mecânica oficial — `numero` via `nextval_certificado()`, mesmos campos de `lib/certificados/gerar.ts`, mesmo trigger `trg_gam_certificados` cascateando pra gamificação — mas pula de propósito o `gam_curso_completo`, já que o botão manual existe justamente pra exceções).

Como o fluxo de recuperação de senha não existia no app antes, `app/redefinir-senha/` (+ `RedefinirSenhaContent.tsx`) foi criado nesta sessão: escuta `onAuthStateChange('PASSWORD_RECOVERY')`, chama `supabase.auth.updateUser({password})`.

### Interface (`/admin/usuarios`)
- Lista paginada server-side (`admin_listar_usuarios`, filtros de busca/status da conta/status de assinatura/nível/"ativos nos últimos N dias", ordenação por coluna) — `lib/queries/admin-suporte.ts` + `app/admin/usuarios/page.tsx` (lê `searchParams`) + `AdminUsuariosContent.tsx`.
- Ficha do aluno (`/admin/usuarios/[id]`) em abas: Visão geral (dados + status + assinatura atual + botões de ação, todos com `confirm()`/`prompt()` nativo pra justificativa — mesmo padrão já usado em Financeiro/Certificados), Progresso (cursos/% aulas, avaliações, certificados + emissão manual), Gamificação (XP/moedas/nível/streak via `Emblemas` variante `mono` + extrato paginado + ajuste manual), Financeiro (leitura, linka pro módulo Financeiro pras ações), Comunidade (posts/comentários recentes, linka pro módulo Comunidade), Auditoria (log unificado).
- **Impersonação ("Ver como este aluno") propositalmente NÃO implementada** — botão existe desabilitado com tooltip "em breve". Fica de fora até ter desenho de segurança dedicado: sessão separada da do admin, banner visível durante a impersonação, log reforçado (toda ação feita durante a sessão impersonada precisa ficar rastreável de volta ao admin), expiração automática curta.

## Configurações (módulo guarda-chuva da plataforma no admin)
Papel: só `super_admin`. Construído em 2026-07-13 — registro único `config_plataforma`, sem RPCs (RLS direta: leitura pública `using (true)`, escrita `is_admin_papel(...,'super_admin')`). **Não duplica** `config_gamificacao`/`config_financeiro`/futuro `notificacao_config` — a aba Integrações só linka pra eles.

### Por que leitura pública de verdade (anon incluso)
`config_plataforma` precisa ser lida por: o middleware pra visitante deslogado (checagem de manutenção), `/termos` e `/privacidade` (páginas públicas), e `generateMetadata()` do layout root (roda antes de qualquer sessão existir). Não tem dado sensível — RLS `select using (true)` é a escolha certa aqui, ao contrário de `assinaturas`/`cobrancas`.

### Decisão: checagem de manutenção no middleware, não no layout
Ficou no `middleware.ts` (junto do gate de suspensão/banimento já existente), não no layout root — porque o middleware já tem `request.nextUrl.pathname` de graça pra excluir `/login` e `/manutencao` do próprio redirect sem loop; fazer isso no layout exigiria um hack pra descobrir a rota atual (não existe API direta pra isso em Server Component/layout). O custo (mais um `select` de linha única por request) é o mesmo já aceito pela checagem de suspensão. `ehAdmin` é computado uma vez e reusado tanto no bypass de manutenção quanto no gate de `/admin` (evita query duplicada).

### Efeitos aplicados (nada de config sem efeito)
1. **Manutenção**: `modo_manutencao=true` → middleware redireciona todo não-admin (logado ou não) pra `/manutencao`; admin navega normal e vê banner fixo no `NavPlataforma` (`d.modoManutencao && d.isAdmin`).
2. **Toggles de módulo** (`comunidade_ativa`/`desafios_ativos`/`agenda_ativa`): `NavPlataforma` esconde o link E cada página (`/comunidade`, `/agenda`, `/desafios`) faz `redirect('/')` se o próprio flag (lido via `carregarNav()`, que já busca `config_plataforma` pra todo mundo — logado ou não) estiver desligado — defesa dupla, mesmo dado, sem query extra.
3. **`pagina_inicial_pos_login`**: `LoginContent` usa `location.href = paginaInicialPosLogin || '/'` em vez do `/` fixo (prop vinda de `app/login/page.tsx`).
4. **Metadata**: `app/layout.tsx` trocou `metadata` estático por `generateMetadata()` async lendo `nome_plataforma`/`meta_titulo`/`meta_descricao`/`og_image_url`/`favicon_url`.
5. **`/termos` e `/privacidade`**: páginas públicas novas renderizando `termos_uso`/`politica_privacidade` (um parágrafo por linha).
6. **Logo**: `NavPlataforma` e `LoginContent` trocam o texto "peritos academy" por `<img>` quando `logo_url` existe (fallback pro texto atual).
7. **Rodapé**: `texto_rodape` renderizado num `<footer>` global no layout root (não escopado a uma página — é a única exceção à regra de CSS por página, documentada inline no CSS).

### Tabelas/campos
`config_plataforma` (id fixo=1): identidade (nome, slogan, logo_url, favicon_url), contato (email/whatsapp suporte, instagram/youtube/linkedin — colunas, não jsonb, pro padrão ficar igual a `config_gamificacao`), textos institucionais, comportamento (`pagina_inicial_pos_login`, `modo_manutencao` + `mensagem_manutencao`, os 3 toggles de módulo), SEO (`meta_titulo`/`meta_descricao`/`og_image_url`). Upload de logo/favicon/og_image reusa o bucket `capas` (mesmo padrão de selo de nível em Gamificação), path fixo `config-plataforma/{campo}.{ext}` (sempre sobrescreve, sem histórico).

### Aba Integrações
Somente leitura, checagem por presença de env (`!!process.env.X`), nunca o valor: Supabase (`NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`), Asaas webhook (`ASAAS_WEBHOOK_TOKEN`), Asaas API (`ASAAS_API_KEY` — nome assumido, a integração real ainda não define isso em lugar nenhum, ver pendência do Financeiro), Panda Video (informativo, sem API key). Inclui card linkando a pendência de `config_gamificacao.moeda_icone` (editável, não lido em lugar nenhum do app).

### Testes feitos (e um que não foi feito de propósito)
Testado via dev server local + toggle no banco com reversão imediata: `comunidade_ativa=false` → `/comunidade` responde 307 pra `/` (confirmado, revertido na sequência); `pagina_inicial_pos_login='/cursos'` → RSC payload de `/login` reflete o valor (confirmado, revertido). RLS de escrita testado em transação com rollback (usuário descartável sem papel admin tenta `update config_plataforma` → 0 linhas afetadas). **`modo_manutencao=true` NÃO foi testado ao vivo contra o banco compartilhado** — no meio dos testes uma chamada de reversão (`comunidade_ativa` de volta pra `true`) teve timeout de conexão e não aplicou na hora (precisou de uma segunda tentativa pra confirmar), o que expôs o risco real de um revert falhar silenciosamente. Como `modo_manutencao` bloqueia o site inteiro pra quem não é admin (raio de efeito bem maior que um único toggle de módulo), não valeu o risco de deixar produção presa em manutenção por engano. A lógica é estruturalmente idêntica ao teste que passou (mesmo padrão "lê flag → redirect"), só que no middleware em vez de num page.tsx — recomendo um teste manual único (ativar, conferir, desativar) da próxima vez que alguém estiver por perto pra reverter na hora se algo travar.

## Próximo grande passo: ADMIN
Áreas a construir (ordem sugerida):
1. ~~Base de acesso admin + níveis de permissão~~ ✅ feito
2. ~~Gestão de Cursos → Módulos → Aulas, Trilhas/Etapas, Avaliações/Questões~~ ✅ feito (Bloco 1)
3. ~~Desafios, Certificados, Comunidade, Agenda, Avisos/Novidades~~ ✅ feito (Bloco 2)
4. ~~Gamificação (XP/moedas/níveis/gatilhos)~~ ✅ feito — ver seção acima
5. ~~Sistema de Notificações e Celebrações (Fase 1: in-app + toasts + sons)~~ ✅ feito — ver seção acima; Fase 2 (email/push/whatsapp) pendente
6. ~~Configurações da plataforma + logo global~~ ✅ feito — ver seção acima
7. ~~Financeiro Asaas (assinaturas, cobranças, webhooks liberam/suspendem acesso)~~ ✅ estrutura feita — ver seção acima; integração real (chaves, checkout, validação de webhook) pendente
8. ~~Usuários~~ ✅ feito — ver seção acima (impersonação fica pra depois, ver pendência). Relatórios tem spec registrada (ver seção abaixo), construção adiada de propósito pra pós-lançamento.

## Módulo Relatórios (spec futura, construir ~2-4 semanas pós-lançamento)
**Decisão deliberada de NÃO construir agora** (2026-07-13): plataforma pré-lançamento, sem dados reais — um relatório rodado sobre dado de seed seria inválido no dia em que importasse de verdade, e pior, poderia passar confiança falsa. Construir só depois de ter tráfego real pra agregar.

### Princípio
Módulo 100% leitura. Nenhuma tabela nova de dados — no máximo views materializadas/RPCs de agregação sobre o que já existe (`aula_progresso`, `gamificacao_extrato`, `assinaturas`, `cobrancas`, `comunidade_posts`, `avaliacao_tentativas`/`avaliacao_respostas`). Papéis: `super_admin` e `financeiro` (aba financeira) e `suporte` (aba engajamento) — mesmo padrão de papel-por-aba que os outros módulos.

### Abas e métricas
1. **Engajamento**: alunos ativos (DAU/WAU/MAU via `gamificacao_extrato` filtrado por `gatilho_codigo='login_diario'`), aulas assistidas por período, cursos mais/menos assistidos, taxa de conclusão por curso, funil dentro de cada curso (onde os alunos param, aula a aula), horários de pico.
2. **Aprendizado**: nota média por avaliação, distribuição de notas, **questões mais erradas** (a métrica de maior valor pra revisar conteúdo), taxa de aprovação, tempo médio até conclusão de curso.
3. **Gamificação**: distribuição de alunos por nível, top streaks, XP médio, gatilhos mais acionados (leitura direta do `gamificacao_extrato`, já é o ledger completo).
4. **Financeiro**: evolução de MRR mês a mês, novas assinaturas vs. cancelamentos (churn), inadimplência ao longo do tempo, LTV simples — é a versão histórica/gráfica do painel instantâneo que já existe em `/admin/financeiro` (`carregarPainelFinanceiro`), não um cálculo novo.
5. **Comunidade**: posts/semana, taxa de dúvidas respondidas, membros mais ativos.

Todas as abas: filtro de período (7/30/90 dias/tudo) e exportação CSV.

### Pré-requisito já verificado (não é mais uma pendência)
A métrica "questões mais erradas" parecia depender de granularidade por questão nas submissões — **já existe**: `submeter_avaliacao` (ver seção Gamificação) grava uma linha por questão em `avaliacao_respostas` (`tentativa_id`, `questao_id`, `opcao_id`, `valor_informado`, `correta`), então a agregação "questão X errada em Y% das tentativas" é um `group by questao_id` direto sobre essa tabela, sem precisar de nenhuma migração antes. Confirmado direto no schema em 2026-07-13.

### Notas técnicas pra quando construir
- Gráficos: escolher lib na hora — `recharts` é o candidato natural no stack (React puro, sem dependência de canvas/SVG externo).
- Agregações pesadas (funil por curso, DAU/WAU/MAU histórico): view materializada com refresh diário via `pg_cron` — mesma pendência do cron de lembretes de agenda/aniversários (`aniversario`/`aniversario_plataforma` na seção Gamificação); resolver os crons juntos numa única sessão de infra em vez de espalhar `pg_cron` em pedaços.

## Fluxo de trabalho
- Sempre rodar `npm run build` antes de commitar pra pegar erros de tipo
- `next.config.ts` tem `eslint: { ignoreDuringBuilds: true }` (lints desligados no build; corrigir depois)
- Commits descritivos, push pra `main` dispara deploy Vercel
- Rodar migrações Supabase = ação manual do dev (abre no navegador)
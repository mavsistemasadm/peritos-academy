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
- **Ambiente**: Windows, VS Code, PowerShell

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
- Emissão automática: 100% aulas concluídas (`aula_concluida`) + todas avaliações aprovadas (`avaliacao_tentativas.aprovado = true`)
- Número via RPC `nextval_certificado()` (sequência `seq_certificado_numero`), formato `PA-{ano}-{5dígitos}`
- Constraint `uq_cert_usuario_curso unique(usuario_id, curso_id)`
- Popup animado com confetes randômicos ao completar
- Lógica em `lib/certificados/gerar.ts` → `verificarEEmitirCertificado(supabase, userId, cursoId)`

## Tabelas principais
- `perfis` (usuário: nome, slug, bio, cidade, estado, telefone, email_publico, mostrar_tel, mostrar_email, perfil_publico, foto_url, xp, nivel, moedas, titulo)
- `cursos`, `modulos`, `aulas`, `aula_progresso` (tem coluna `concluida` bool — não existe tabela `aula_concluida`, nunca criar código que a referencie), `aula_anotacoes`
- `trilhas`, `etapas`, `curso_trilha` (com trilha_nome, trilha_slug, etapa_nome)
- `avaliacoes`, `avaliacao_questoes`, `avaliacao_opcoes`, `avaliacao_tentativas`, `avaliacao_respostas` (+ views `_publicas`)
- `desafios`, `desafio_categorias`, `desafio_entregas` (nota_minima, arquivo_path)
- `certificados`, `perfil_insignias`, `perfil_estudo_dias`, `perfil_atividades`
- `eventos`, `evento_reservas` (agenda), `comunidade_*` (feed/ranking, ver Bloco 2)
- `novidades`, `novidade_leituras` (avisos/banners institucionais — diferente de `notificacoes`, ver Sistema de Notificações)
- `notificacoes` (notificações pessoais/sino), `admin_usuarios` (papéis do admin)
- `config_gamificacao`, `gamificacao_gatilhos`, `gamificacao_niveis`, `gamificacao_extrato` (ledger de XP/moedas, ver seção Gamificação)
- Bucket Storage `planilhas` (privado, uploads de aluno/documentos), `capas` (público, imagens de capa)
- Tabelas duplicadas/legadas — nunca usadas pelo app, não construir em cima: `posts`/`post_comentarios`/`post_reacoes` (substituídas por `comunidade_*`), `duvidas`/`duvida_respostas` (substituídas por `aula_duvidas`), `questoes`/`tentativas`/`materiais`/`progresso_aulas`

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

## Sistema de Notificações
Arquitetura multi-canal desde o início (in-app, email, push, whatsapp), mesmo a Fase 1 só ligando in-app — a ideia é nunca precisar refazer os gatilhos quando um canal novo entrar.

### Tabelas
- `notificacoes` (JÁ EXISTE, já tem UI funcionando): `usuario_id`, `tipo`, `prefixo`/`destaque`/`sufixo` (frase montada em 3 partes, `destaque` em negrito), `link_url`, `lida`, `criado_em`. RLS hoje só tem SELECT/UPDATE do próprio usuário — **sem INSERT** (ninguém escreve nela ainda, só existem 3 linhas de seed).
- `novidade_leituras` (JÁ EXISTE) — **não é notificação pessoal**, é o controle de leitura de `novidades` (avisos/banners do admin, Bloco 2). Não confundir os dois sistemas: avisos = broadcast institucional; notificações = eventos pessoais do usuário.
- `notif_tipos` (nova) — catálogo: `codigo` (pk, ex. `curso_concluido`), `categoria` (agenda/trilha/conteudo/avaliacoes/gamificacao/comunidade/financeiro/administrativo), `nome`, `descricao`, `canal_in_app`, `canal_email`, `canal_push`, `canal_whatsapp` (bool, editável no admin), `ativo`.
- `notif_fila_email`, `notif_fila_push`, `notif_fila_whatsapp` (novas, outbox) — criadas vazias na Fase 1. A função de disparo já escreve nelas quando o canal correspondente está ligado no catálogo; só não existe processador ainda. Fase 2/3 = só criar o worker que lê a fila, zero mudança nos gatilhos.
- `evento_notif_enviadas` (nova) — dedupe dos lembretes de agenda (evento_id + tipo_lembrete), pra pg_cron não mandar duplicado.

### Chokepoint único: `criar_notificacao()`
Função SQL `security definer` — todo gatilho (trigger de tabela ou pg_cron) chama só ela, nunca insere direto em `notificacoes`. Ela: 1) confere `notif_tipos.ativo` e `canal_in_app` pro tipo — se desligado no admin, não insere nada (kill-switch); 2) insere em `notificacoes`; 3) se `canal_email`/`canal_push`/`canal_whatsapp` estiverem ligados, insere na fila correspondente (hoje sempre vazio na Fase 1 porque nenhum tipo liga esses canais ainda). Isso é o que permite ligar email depois só mudando uma linha no catálogo.

### Categorias e gatilhos (Fase 1 = todos in-app)
- **Agenda**: lembrete de live 1 dia / 1h / 30min antes + "começou agora" — via `pg_cron` rodando a cada 5 min, olha `eventos.inicia_em` + `evento_reservas`, dedupe em `evento_notif_enviadas`.
- **Marcos de trilha** (in-app + email desde que a Fase 2 ligue o canal): terminou curso, passou em prova difícil, completou etapa, desbloqueou próxima etapa, insígnia de peso, subiu de nível.
- **Conteúdo**: nova aula/avaliação publicada num curso em que o aluno está matriculado.
- **Avaliações**: aprovado/reprovado ao submeter (via RPC `submeter_avaliacao`).
- **Gamificação**: XP ganho, nível, insígnias (mesmo gatilho de "marcos de trilha").
- **Comunidade**: dúvida de aula respondida, comentário no seu post, marcado como melhor resposta.
- **Financeiro**: reservado pro Asaas (assinatura confirmada/atrasada/cancelada) — só o catálogo existe por enquanto, sem integração real.
- **Administrativo**: boas-vindas ao criar conta.

✅ **Gap resolvido**: o motor de gamificação (abaixo) agora credita `perfis.xp`/`nivel`/`moedas` de verdade — os gatilhos de "subiu de nível", "completou etapa" e "desbloqueou próxima etapa" deixaram de ser dormentes. Só `perfil_insignias` (insígnias visuais avulsas) segue sem gatilho vivo — não faz parte do catálogo de `gamificacao_gatilhos`.

### Admin
Seção "Notificações": matriz `notif_tipos` (categoria → tipo → toggle por canal) + log das últimas notificações disparadas (suporte/debug).

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

### Fora do escopo por enquanto
Loja de recompensas (só o saldo de moedas existe), página pública de ranking, notificações de gamificação (spec já registrada acima), cron de aniversários, `perfil_insignias` (insígnias visuais avulsas, sem gatilho).

## Próximo grande passo: ADMIN
Áreas a construir (ordem sugerida):
1. ~~Base de acesso admin + níveis de permissão~~ ✅ feito
2. ~~Gestão de Cursos → Módulos → Aulas, Trilhas/Etapas, Avaliações/Questões~~ ✅ feito (Bloco 1)
3. ~~Desafios, Certificados, Comunidade, Agenda, Avisos/Novidades~~ ✅ feito (Bloco 2)
4. ~~Gamificação (XP/moedas/níveis/gatilhos)~~ ✅ feito — ver seção acima
5. Sistema de Notificações (Fase 1: in-app) — ver seção acima
6. Configurações da plataforma + logo global (tabela `config_plataforma`, refletir em nav/certificado/emails)
7. Financeiro Asaas (assinaturas, cobranças, webhooks liberam/suspendem acesso)
8. Usuários, Relatórios

## Fluxo de trabalho
- Sempre rodar `npm run build` antes de commitar pra pegar erros de tipo
- `next.config.ts` tem `eslint: { ignoreDuringBuilds: true }` (lints desligados no build; corrigir depois)
- Commits descritivos, push pra `main` dispara deploy Vercel
- Rodar migrações Supabase = ação manual do dev (abre no navegador)
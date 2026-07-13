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
- `cursos`, `modulos`, `aulas`, `aula_concluida`, `aula_progresso`, `aula_anotacoes`
- `trilhas`, `etapas`, `curso_trilha` (com trilha_nome, trilha_slug, etapa_nome)
- `avaliacoes`, `avaliacao_questoes`, `avaliacao_opcoes`, `avaliacao_tentativas`, `avaliacao_respostas` (+ views `_publicas`)
- `desafios`, `desafio_categorias`, `desafio_entregas` (nota_minima, arquivo_path)
- `certificados`, `perfil_insignias`, `perfil_estudo_dias`, `perfil_atividades`
- `eventos`, `evento_reservas` (agenda), `comunidade_*` (feed/ranking, ver Bloco 2)
- `novidades`, `novidade_leituras` (avisos/banners institucionais — diferente de `notificacoes`, ver Sistema de Notificações)
- `notificacoes` (notificações pessoais/sino), `admin_usuarios` (papéis do admin)
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

⚠️ **Gap descoberto durante o desenho**: `perfis.xp`/`perfis.nivel`, `perfil_insignias` e o progresso de etapas (`jornada_etapas`) não têm NENHUM gatilho vivo hoje que os atualize — `submeter_avaliacao` calcula `xp_ganho` mas nunca credita em `perfis.xp`. Os gatilhos de "subiu de nível", "insígnia de peso", "completou etapa" e "desbloqueou próxima etapa" ficam prontos mas dormentes até essa engine de gamificação existir (fora do escopo do bloco de notificações).

### Admin
Seção "Notificações": matriz `notif_tipos` (categoria → tipo → toggle por canal) + log das últimas notificações disparadas (suporte/debug).

## Próximo grande passo: ADMIN
Áreas a construir (ordem sugerida):
1. ~~Base de acesso admin + níveis de permissão~~ ✅ feito
2. ~~Gestão de Cursos → Módulos → Aulas, Trilhas/Etapas, Avaliações/Questões~~ ✅ feito (Bloco 1)
3. ~~Desafios, Certificados, Comunidade, Agenda, Avisos/Novidades~~ ✅ feito (Bloco 2)
4. Sistema de Notificações (Fase 1: in-app) — ver seção acima
5. Configurações da plataforma + logo global (tabela `config_plataforma`, refletir em nav/certificado/emails)
6. Financeiro Asaas (assinaturas, cobranças, webhooks liberam/suspendem acesso)
7. Usuários, Gamificação (engine de XP/nível/insígnias), Relatórios

## Fluxo de trabalho
- Sempre rodar `npm run build` antes de commitar pra pegar erros de tipo
- `next.config.ts` tem `eslint: { ignoreDuringBuilds: true }` (lints desligados no build; corrigir depois)
- Commits descritivos, push pra `main` dispara deploy Vercel
- Rodar migrações Supabase = ação manual do dev (abre no navegador)
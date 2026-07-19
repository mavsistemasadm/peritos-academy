-- ============================================================
-- Alguns gatilhos existem no catálogo (ativo=true) mas não têm nenhum
-- mecanismo real de disparo ligado ainda (aniversario/aniversario_plataforma
-- não têm cron/pg_cron configurado, ver seção Gamificação do CLAUDE.md).
-- Escondê-los do aluno some com o roadmap; prometer um número de XP sem
-- disparo ligado seria mentira. Lista editável no admin: quando o
-- agendamento for ligado de verdade, tira o código daqui e o valor real
-- volta a aparecer sozinho na tabela. Registro pós-aplicação via MCP
-- (name=gam_gatilhos_pendentes_agendamento).
-- ============================================================

alter table public.config_gamificacao
  add column if not exists gatilhos_pendentes_agendamento text[] not null default '{aniversario,aniversario_plataforma}';

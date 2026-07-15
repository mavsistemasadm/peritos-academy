-- Tour guiado de boas-vindas: disparo por perfis.tour_visto_em NULL.
-- Rodado via Supabase MCP (ver CLAUDE.md — fluxo de trabalho).
alter table public.perfis add column if not exists tour_visto_em timestamptz;

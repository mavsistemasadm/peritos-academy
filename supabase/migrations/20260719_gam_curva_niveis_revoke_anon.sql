-- ============================================================
-- Motor de gamificação — fecha brecha de segurança na curva de níveis.
-- Registro pós-aplicação via MCP (name=gam_curva_niveis_revoke_anon),
-- pra rastreabilidade do repo.
--
-- ACHADO CRÍTICO: gam_recalcular_curva_niveis() tinha EXECUTE liberado
-- pra anon/public (mesma pegadinha de grants default do Postgres já
-- documentada). Combinado com o fix "auth.uid() is not null" (que
-- permite contexto de migração/service, onde auth.uid() é null, chamar
-- a função sem checagem de admin), isso deixava a porta aberta pra
-- qualquer visitante anônimo (auth.uid() também null) recalcular a
-- curva de níveis da plataforma inteira sem estar logado.
-- ============================================================

revoke execute on function public.gam_recalcular_curva_niveis() from public, anon;

-- ============================================================
-- Higienização da Comunidade: remove prova social fabricada.
--
-- comunidade_ranking, comunidade_especialistas e comunidade_config
-- NÃO foram dropadas (decisão explícita) — só pararam de ser
-- consultadas pelo app (Comunidade, Home, Login e Perfil).
-- ============================================================

-- Métricas reais e agregadas (cross-usuário — RPC security definer
-- estreita, nunca service role em código alcançável por sessão de
-- usuário comum). Substitui comunidade_config nas 3 telas que a liam.
create or replace function public.comunidade_metricas()
returns table(total_perfis int, posts_semana int, casos_resolvidos_semana int)
language sql
security definer
set search_path = public
as $$
  select
    (select count(*)::int from perfis),
    (select count(*)::int from comunidade_posts where criado_em >= now() - interval '7 days'),
    (select count(*)::int from comunidade_posts where tipo = 'caso' and respondida = true and criado_em >= now() - interval '7 days')
$$;

revoke execute on function public.comunidade_metricas() from public;
grant execute on function public.comunidade_metricas() to authenticated, anon;

-- contar_reacoes não soma mais uteis_base (baseline de seed) — só
-- reações reais de comunidade_reacoes.
create or replace function public.contar_reacoes(p_post uuid, p_tipo text)
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::int
  from comunidade_reacoes r
  where r.post_id = p_post and r.tipo = p_tipo
$$;

-- zera os baselines inflados — colunas continuam existindo no schema
-- (por segurança), mas nenhum caminho de leitura as soma mais.
update comunidade_posts set uteis_base = 0, comentarios_base = 0;
update comunidade_espacos set qtd_base = 0;

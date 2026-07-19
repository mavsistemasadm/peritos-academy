-- ============================================================
-- email_candidatos_resumo_quinzenal() lia streak via gam_calcular_streak()
-- (RPC antiga, deriva de gamificacao_extrato) em vez de streak_estado
-- (fonte real, mesma que a pílula do nav usa) — mesma divergência já
-- corrigida em admin_usuario_ficha(). nivel_nome e o proxy de subiu_nivel
-- continuam inalterados (já liam perfis.nivel, que é a cache correta; o
-- proxy de subiu_nivel já é uma aproximação documentada no CLAUDE.md,
-- não uma leitura obsoleta). Registro pós-aplicação via MCP
-- (name=gam_resumo_quinzenal_streak_real).
-- ============================================================

create or replace function public.email_candidatos_resumo_quinzenal()
returns table(usuario_id uuid, nome text, xp_total integer, nivel_nome text, xp_periodo integer, aulas_periodo bigint, streak_dias integer, subiu_nivel boolean, novo_nivel_nome text)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
begin
  return query
  with base as (
    select p.id, p.nome, p.xp, p.nivel, p.criado_em,
      (select max(ee.criado_em) from email_enviados ee where ee.usuario_id = p.id and ee.tipo = 'resumo_quinzenal') as ultimo_resumo,
      coalesce((select sum(ge.pontos) from gamificacao_extrato ge where ge.usuario_id = p.id and ge.criado_em >= now() - interval '15 days'), 0) as xp_periodo,
      coalesce((select count(*) from aula_progresso ap where ap.usuario_id = p.id and ap.concluida and ap.concluida_em >= now() - interval '15 days'), 0) as aulas_periodo
    from perfis p
    where p.criado_em <= now() - interval '15 days'
  )
  select
    b.id, b.nome,
    b.xp as xp_total,
    gn.nome as nivel_nome,
    b.xp_periodo::int,
    b.aulas_periodo,
    coalesce(se.sequencia_atual, 0) as streak_dias,
    ((b.xp - b.xp_periodo) < coalesce(gn.pontos_minimos, 0)) as subiu_nivel,
    case when (b.xp - b.xp_periodo) < coalesce(gn.pontos_minimos, 0) then gn.nome else null end as novo_nivel_nome
  from base b
  left join gamificacao_niveis gn on gn.ordem = b.nivel
  left join streak_estado se on se.usuario_id = b.id
  where (b.ultimo_resumo is null or b.ultimo_resumo <= now() - interval '15 days')
    and (b.xp_periodo > 0 or b.aulas_periodo > 0);
end;
$function$;

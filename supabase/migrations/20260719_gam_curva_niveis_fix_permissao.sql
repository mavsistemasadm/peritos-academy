-- ============================================================
-- Motor de gamificação — curva de níveis calculável sob demanda
-- (2026-07-19). Registro pós-aplicação via MCP
-- (name=gam_curva_niveis_fix_permissao), pra rastreabilidade do repo.
--
-- gam_recalcular_curva_niveis(): teto = soma de todo XP de estudo
-- disponível na plataforma hoje (aulas de cursos publicados + avaliações
-- publicadas × peso + etapas.xp_conclusao + desafios.xp + bônus de curso
-- concluído × nº de cursos publicados), limiares dos 10 níveis em
-- 0/1/3/7/13/21/32/46/63/100% do teto, arredondados pra múltiplo de 50.
-- Botão "Recalcular curva" em /admin/gamificacao chama isso sob demanda
-- (quando novas avaliações/desafios forem publicados).
--
-- Fix de permissão nesta versão: a checagem original só permitia
-- is_admin_papel(auth.uid()), o que quebra ao chamar a função fora de
-- uma sessão de usuário (contexto de migração/service role, onde
-- auth.uid() é null) — só bloqueia quando existe uma sessão real de
-- usuário não-admin.
-- ============================================================

create or replace function public.gam_recalcular_curva_niveis()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_xp_aulas bigint;
  v_xp_avaliacoes bigint;
  v_xp_etapas bigint;
  v_xp_desafios bigint;
  v_bonus_cursos bigint;
  v_teto bigint;
  v_pct numeric[] := array[0, 1, 3, 7, 13, 21, 32, 46, 63, 100];
  v_ordem int;
  v_limiar bigint;
begin
  if auth.uid() is not null and not public.is_admin_papel(auth.uid()) then
    raise exception 'Sem permissão.';
  end if;

  select coalesce(sum(a.xp), 0) into v_xp_aulas
  from public.aulas a join public.modulos m on m.id = a.modulo_id join public.cursos c on c.id = m.curso_id
  where c.publicado = true;

  select coalesce(sum((select avaliacao_xp_base from public.config_gamificacao where id = 1) * greatest(coalesce(av.peso, 1), 1)), 0)
  into v_xp_avaliacoes
  from public.avaliacoes av join public.cursos c on c.id = av.curso_id
  where c.publicado = true and av.publicado = true;

  select coalesce(sum(xp_conclusao), 0) into v_xp_etapas from public.etapas;

  select coalesce(sum(xp), 0) into v_xp_desafios from public.desafios;

  select (bonus_curso_concluido * (select count(*) from public.cursos where publicado = true))
  into v_bonus_cursos from public.config_gamificacao where id = 1;

  v_teto := v_xp_aulas + v_xp_avaliacoes + v_xp_etapas + v_xp_desafios + coalesce(v_bonus_cursos, 0);
  if v_teto <= 0 then
    v_teto := 1000;
  end if;

  for v_ordem in 1..10 loop
    v_limiar := round(v_teto * v_pct[v_ordem] / 100.0 / 50.0) * 50;
    update public.gamificacao_niveis set pontos_minimos = v_limiar where ordem = v_ordem;
  end loop;

  update public.config_gamificacao
  set xp_teto_calculado = v_teto, xp_teto_calculado_em = now()
  where id = 1;

  return jsonb_build_object(
    'teto', v_teto,
    'componentes', jsonb_build_object(
      'aulas', v_xp_aulas, 'avaliacoes', v_xp_avaliacoes, 'etapas', v_xp_etapas,
      'desafios', v_xp_desafios, 'bonus_cursos', v_bonus_cursos
    )
  );
end;
$function$;

revoke execute on function public.gam_recalcular_curva_niveis() from public, anon;
grant execute on function public.gam_recalcular_curva_niveis() to authenticated;

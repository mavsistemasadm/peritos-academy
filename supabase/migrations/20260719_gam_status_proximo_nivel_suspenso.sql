-- ============================================================
-- gam_status_proximo_nivel() passa a marcar cada requisito como "suspenso"
-- quando não há conteúdo publicado daquele tipo (mesma regra de
-- gam_nivel_real) — o checklist de próximo nível não deve mostrar um
-- requisito impossível de cumprir como ⬜ pendente; mostra "em breve".
-- streak_marco_dias/participacoes_comunidade nunca suspendem (não são
-- catálogo de conteúdo publicável). Registro pós-aplicação via MCP
-- (name=gam_status_proximo_nivel_suspenso).
-- ============================================================

create or replace function public.gam_status_proximo_nivel()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_usuario uuid := auth.uid();
  v_xp int;
  v_nivel_atual record;
  v_proximo public.gamificacao_niveis%rowtype;
  v_c record;
  v_requisitos jsonb := '[]'::jsonb;
begin
  if v_usuario is null then
    return null;
  end if;

  select coalesce(xp, 0) into v_xp from public.perfis where id = v_usuario;
  select * into v_nivel_atual from public.gam_nivel_real(v_usuario, v_xp);

  select * into v_proximo from public.gamificacao_niveis where ordem = coalesce(v_nivel_atual.nivel_ordem, 0) + 1;

  if not found then
    return jsonb_build_object(
      'nivel_atual_ordem', v_nivel_atual.nivel_ordem,
      'nivel_atual_nome', v_nivel_atual.nivel_nome,
      'proximo_nivel', null
    );
  end if;

  select * into v_c from public.gam_contadores_usuario(v_usuario);

  if v_proximo.aulas_concluidas is not null then
    v_requisitos := v_requisitos || jsonb_build_object(
      'rotulo', 'aulas_concluidas', 'atual', v_c.aulas_concluidas, 'necessario', v_proximo.aulas_concluidas,
      'suspenso', v_c.aulas_publicadas = 0,
      'cumprido', v_c.aulas_publicadas = 0 or v_c.aulas_concluidas >= v_proximo.aulas_concluidas
    );
  end if;

  if v_proximo.cursos_completos is not null then
    v_requisitos := v_requisitos || jsonb_build_object(
      'rotulo', 'cursos_completos', 'atual', v_c.cursos_completos,
      'necessario', case when v_proximo.cursos_completos = -1 then v_c.cursos_publicados else v_proximo.cursos_completos end,
      'suspenso', v_c.cursos_publicados = 0,
      'cumprido', v_c.cursos_publicados = 0 or (case when v_proximo.cursos_completos = -1
        then v_c.cursos_completos >= v_c.cursos_publicados
        else v_c.cursos_completos >= v_proximo.cursos_completos end)
    );
  end if;

  if v_proximo.avaliacoes_aprovadas is not null then
    v_requisitos := v_requisitos || jsonb_build_object(
      'rotulo', 'avaliacoes_aprovadas', 'atual', v_c.avaliacoes_aprovadas,
      'necessario', case when v_proximo.avaliacoes_aprovadas = -1 then v_c.avaliacoes_publicadas else v_proximo.avaliacoes_aprovadas end,
      'suspenso', v_c.avaliacoes_publicadas = 0,
      'cumprido', v_c.avaliacoes_publicadas = 0 or (case when v_proximo.avaliacoes_aprovadas = -1
        then v_c.avaliacoes_aprovadas >= v_c.avaliacoes_publicadas
        else v_c.avaliacoes_aprovadas >= v_proximo.avaliacoes_aprovadas end)
    );
  end if;

  if v_proximo.desafios_completos is not null then
    v_requisitos := v_requisitos || jsonb_build_object(
      'rotulo', 'desafios_completos', 'atual', v_c.desafios_completos,
      'necessario', case when v_proximo.desafios_completos = -1 then v_c.desafios_existentes else v_proximo.desafios_completos end,
      'suspenso', v_c.desafios_existentes = 0,
      'cumprido', v_c.desafios_existentes = 0 or (case when v_proximo.desafios_completos = -1
        then v_c.desafios_completos >= v_c.desafios_existentes
        else v_c.desafios_completos >= v_proximo.desafios_completos end)
    );
  end if;

  if v_proximo.streak_marco_dias is not null then
    v_requisitos := v_requisitos || jsonb_build_object(
      'rotulo', 'streak_marco_dias', 'atual', v_c.streak_recorde, 'necessario', v_proximo.streak_marco_dias,
      'suspenso', false,
      'cumprido', v_c.streak_recorde >= v_proximo.streak_marco_dias
    );
  end if;

  if v_proximo.participacoes_comunidade is not null then
    v_requisitos := v_requisitos || jsonb_build_object(
      'rotulo', 'participacoes_comunidade', 'atual', v_c.participacoes_comunidade, 'necessario', v_proximo.participacoes_comunidade,
      'suspenso', false,
      'cumprido', v_c.participacoes_comunidade >= v_proximo.participacoes_comunidade
    );
  end if;

  return jsonb_build_object(
    'nivel_atual_ordem', v_nivel_atual.nivel_ordem,
    'nivel_atual_nome', v_nivel_atual.nivel_nome,
    'proximo_nivel', jsonb_build_object(
      'ordem', v_proximo.ordem, 'nome', v_proximo.nome, 'selo_url', v_proximo.selo_url,
      'xp_atual', v_xp, 'xp_necessario', v_proximo.pontos_minimos, 'xp_cumprido', v_xp >= v_proximo.pontos_minimos,
      'requisitos', v_requisitos
    )
  );
end;
$function$;

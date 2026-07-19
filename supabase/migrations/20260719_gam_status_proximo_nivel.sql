-- ============================================================
-- Motor de gamificação — checklist de próximo nível (dados reais) +
-- fecha uma brecha de privacidade. Registro pós-aplicação via MCP
-- (name=gam_status_proximo_nivel), pra rastreabilidade do repo.
--
-- ACHADO: gam_nivel_real(p_usuario, ...) estava com EXECUTE liberado
-- pra authenticated recebendo p_usuario como parâmetro livre — qualquer
-- usuário logado podia consultar contagens de progresso de QUALQUER
-- outro usuário (aulas concluídas, cursos, avaliações, desafios, streak,
-- comunidade) passando o UUID de outra pessoa. Revogado — só chamável
-- de dentro de outra função security definer, mesmo padrão de
-- creditar_gamificacao().
--
-- gam_contadores_usuario() centraliza as contagens em tempo real
-- (extraídas de dentro de gam_nivel_real, que agora a chama) pra não
-- duplicar a lógica entre gam_nivel_real e o novo status de próximo nível.
--
-- gam_status_proximo_nivel() é o único ponto exposto ao client: não
-- recebe usuário como parâmetro (usa auth.uid() internamente, mesmo
-- padrão seguro de registrar_acesso_diario()), então não há como um
-- usuário consultar o progresso de outro.
-- ============================================================

create or replace function public.gam_contadores_usuario(p_usuario uuid)
returns table(
  aulas_concluidas int, cursos_completos int, cursos_publicados int,
  avaliacoes_aprovadas int, avaliacoes_publicadas int,
  desafios_completos int, desafios_existentes int,
  streak_recorde int, participacoes_comunidade int
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  select count(*) into aulas_concluidas
    from public.aula_progresso where usuario_id = p_usuario and concluida = true;

  select count(*) into cursos_publicados from public.cursos where publicado = true;
  select count(*) into cursos_completos
    from public.cursos c where c.publicado = true and public.gam_curso_completo(p_usuario, c.id);

  select count(*) into avaliacoes_publicadas from public.avaliacoes where publicado = true;
  select count(distinct at.avaliacao_id) into avaliacoes_aprovadas
    from public.avaliacao_tentativas at
    join public.avaliacoes a on a.id = at.avaliacao_id
    where at.usuario_id = p_usuario and at.aprovado = true and a.publicado = true;

  select count(*) into desafios_existentes from public.desafios where publicado = true;
  select count(distinct de.desafio_id) into desafios_completos
    from public.desafio_entregas de
    join public.desafios d on d.id = de.desafio_id
    where de.usuario_id = p_usuario and de.entregue_em is not null
      and de.nota >= d.nota_minima and d.publicado = true;

  select coalesce(recorde, 0) into streak_recorde
    from public.streak_estado where usuario_id = p_usuario;
  streak_recorde := coalesce(streak_recorde, 0);

  select
    coalesce((select count(*) from public.comunidade_posts where usuario_id = p_usuario), 0)
    + coalesce((select count(*) from public.comunidade_comentarios where usuario_id = p_usuario), 0)
    + coalesce((select count(*) from public.comunidade_reacoes where usuario_id = p_usuario), 0)
  into participacoes_comunidade;

  return next;
end;
$function$;

revoke execute on function public.gam_contadores_usuario(uuid) from public, anon, authenticated;

-- gam_nivel_real passa a reusar gam_contadores_usuario (mesma lógica,
-- sem duplicação); assinatura e comportamento externo inalterados.
create or replace function public.gam_nivel_real(p_usuario uuid, p_xp_total int)
returns table(nivel_ordem int, nivel_nome text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_c record;
  v_nivel record;
begin
  select * into v_c from public.gam_contadores_usuario(p_usuario);

  for v_nivel in select * from public.gamificacao_niveis order by ordem desc loop
    if v_nivel.pontos_minimos > p_xp_total then continue; end if;

    if v_nivel.aulas_concluidas is not null and v_c.aulas_concluidas < v_nivel.aulas_concluidas then continue; end if;

    if v_nivel.cursos_completos is not null then
      if v_nivel.cursos_completos = -1 then
        if v_c.cursos_completos < v_c.cursos_publicados then continue; end if;
      elsif v_c.cursos_completos < v_nivel.cursos_completos then continue;
      end if;
    end if;

    if v_nivel.avaliacoes_aprovadas is not null then
      if v_nivel.avaliacoes_aprovadas = -1 then
        if v_c.avaliacoes_aprovadas < v_c.avaliacoes_publicadas then continue; end if;
      elsif v_c.avaliacoes_aprovadas < v_nivel.avaliacoes_aprovadas then continue;
      end if;
    end if;

    if v_nivel.desafios_completos is not null then
      if v_nivel.desafios_completos = -1 then
        if v_c.desafios_completos < v_c.desafios_existentes then continue; end if;
      elsif v_c.desafios_completos < v_nivel.desafios_completos then continue;
      end if;
    end if;

    if v_nivel.streak_marco_dias is not null and v_c.streak_recorde < v_nivel.streak_marco_dias then continue; end if;

    if v_nivel.participacoes_comunidade is not null and v_c.participacoes_comunidade < v_nivel.participacoes_comunidade then continue; end if;

    nivel_ordem := v_nivel.ordem;
    nivel_nome := v_nivel.nome;
    return next;
    return;
  end loop;

  return;
end;
$function$;

-- fecha a brecha: só chamável de dentro de outra security definer.
revoke execute on function public.gam_nivel_real(uuid, int) from public, anon, authenticated;

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
      'cumprido', v_c.aulas_concluidas >= v_proximo.aulas_concluidas
    );
  end if;

  if v_proximo.cursos_completos is not null then
    v_requisitos := v_requisitos || jsonb_build_object(
      'rotulo', 'cursos_completos', 'atual', v_c.cursos_completos,
      'necessario', case when v_proximo.cursos_completos = -1 then v_c.cursos_publicados else v_proximo.cursos_completos end,
      'cumprido', case when v_proximo.cursos_completos = -1
        then v_c.cursos_completos >= v_c.cursos_publicados
        else v_c.cursos_completos >= v_proximo.cursos_completos end
    );
  end if;

  if v_proximo.avaliacoes_aprovadas is not null then
    v_requisitos := v_requisitos || jsonb_build_object(
      'rotulo', 'avaliacoes_aprovadas', 'atual', v_c.avaliacoes_aprovadas,
      'necessario', case when v_proximo.avaliacoes_aprovadas = -1 then v_c.avaliacoes_publicadas else v_proximo.avaliacoes_aprovadas end,
      'cumprido', case when v_proximo.avaliacoes_aprovadas = -1
        then v_c.avaliacoes_aprovadas >= v_c.avaliacoes_publicadas
        else v_c.avaliacoes_aprovadas >= v_proximo.avaliacoes_aprovadas end
    );
  end if;

  if v_proximo.desafios_completos is not null then
    v_requisitos := v_requisitos || jsonb_build_object(
      'rotulo', 'desafios_completos', 'atual', v_c.desafios_completos,
      'necessario', case when v_proximo.desafios_completos = -1 then v_c.desafios_existentes else v_proximo.desafios_completos end,
      'cumprido', case when v_proximo.desafios_completos = -1
        then v_c.desafios_completos >= v_c.desafios_existentes
        else v_c.desafios_completos >= v_proximo.desafios_completos end
    );
  end if;

  if v_proximo.streak_marco_dias is not null then
    v_requisitos := v_requisitos || jsonb_build_object(
      'rotulo', 'streak_marco_dias', 'atual', v_c.streak_recorde, 'necessario', v_proximo.streak_marco_dias,
      'cumprido', v_c.streak_recorde >= v_proximo.streak_marco_dias
    );
  end if;

  if v_proximo.participacoes_comunidade is not null then
    v_requisitos := v_requisitos || jsonb_build_object(
      'rotulo', 'participacoes_comunidade', 'atual', v_c.participacoes_comunidade, 'necessario', v_proximo.participacoes_comunidade,
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

revoke execute on function public.gam_status_proximo_nivel() from public, anon;
grant execute on function public.gam_status_proximo_nivel() to authenticated;

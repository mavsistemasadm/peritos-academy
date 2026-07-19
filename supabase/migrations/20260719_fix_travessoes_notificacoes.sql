-- Bug editorial ativo: a limpeza anterior de travessões só pegou textos
-- estáticos (UI/componentes) — os TEMPLATES geradores em SQL escaparam.
-- 2 funções que chamam notificar() ainda produziam travessão (—):
--   gam_trg_aula_progresso (notificação "primeira_aula")
--   gam_calcular_streak (notificação "streak")
-- Grep de confirmação pós-fix: nenhuma das 10 funções que chamam notificar()
-- (creditar_gamificacao, gam_trg_aula_progresso, gam_trg_certificados,
-- gam_verificar_progresso_curso, gam_trg_desafio_entrega,
-- notif_trg_aula_duvida_resposta, notif_trg_comunidade_comentario,
-- notif_trg_comunidade_melhor_resposta, submeter_avaliacao,
-- gam_calcular_streak) contém "—" no corpo.

create or replace function public.gam_trg_aula_progresso()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_modulo_id uuid;
  v_curso_id uuid;
  v_total_modulo int;
  v_feitas_modulo int;
  v_feitas_curso int;
  v_total_concluidas_usuario int;
  v_modulo_titulo text;
  v_credito jsonb;
  v_aula_xp int;
begin
  if new.concluida is not true then
    return new;
  end if;

  select xp into v_aula_xp from public.aulas where id = new.aula_id;
  perform public.creditar_gamificacao(new.usuario_id, 'concluir_aula', 'aula', new.aula_id, v_aula_xp);

  select count(*) into v_total_concluidas_usuario
  from public.aula_progresso
  where usuario_id = new.usuario_id and concluida = true;

  if v_total_concluidas_usuario = 1 then
    perform public.notificar(
      new.usuario_id, 'primeira_aula',
      'Você concluiu sua ', 'primeira aula', '! Bem-vindo à jornada.',
      '/perfil', 'xp', '{}'::jsonb, true
    );
  end if;

  select a.modulo_id, m.curso_id into v_modulo_id, v_curso_id
  from public.aulas a join public.modulos m on m.id = a.modulo_id
  where a.id = new.aula_id;

  if v_curso_id is not null then
    select count(*) into v_feitas_curso
    from public.aula_progresso ap
    join public.aulas a on a.id = ap.aula_id
    join public.modulos m on m.id = a.modulo_id
    where m.curso_id = v_curso_id and ap.usuario_id = new.usuario_id and ap.concluida = true;

    if v_feitas_curso <= 1 then
      perform public.creditar_gamificacao(new.usuario_id, 'iniciar_curso', 'curso', v_curso_id);
    end if;
  end if;

  if v_modulo_id is not null then
    select count(*) into v_total_modulo from public.aulas where modulo_id = v_modulo_id;
    select count(*) into v_feitas_modulo
    from public.aula_progresso ap join public.aulas a on a.id = ap.aula_id
    where a.modulo_id = v_modulo_id and ap.usuario_id = new.usuario_id and ap.concluida = true;

    if v_total_modulo > 0 and v_feitas_modulo >= v_total_modulo then
      v_credito := public.creditar_gamificacao(new.usuario_id, 'concluir_modulo', 'modulo', v_modulo_id);

      if (v_credito->>'creditado')::boolean then
        select titulo into v_modulo_titulo from public.modulos where id = v_modulo_id;
        perform public.notificar(
          new.usuario_id, 'modulo_concluido',
          'Você concluiu o módulo ', coalesce(v_modulo_titulo, ''), '',
          null, null, jsonb_build_object('modulo_id', v_modulo_id), false
        );
      end if;
    end if;
  end if;

  perform public.gam_verificar_progresso_curso(new.usuario_id, v_curso_id);

  return new;
end;
$function$;

create or replace function public.gam_calcular_streak(p_usuario uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_dias date[];
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_cursor date;
  v_streak int := 0;
  i int;
  v_ja_notificado boolean;
begin
  select array_agg(dia order by dia desc) into v_dias
  from (
    select distinct (criado_em at time zone 'America/Sao_Paulo')::date as dia
    from public.gamificacao_extrato
    where usuario_id = p_usuario and gatilho_codigo = 'login_diario'
  ) t;

  if v_dias is null or array_length(v_dias, 1) = 0 then
    return 0;
  end if;

  if v_dias[1] = v_hoje then
    v_cursor := v_hoje;
  elsif v_dias[1] = v_hoje - 1 then
    v_cursor := v_hoje - 1;
  else
    return 0;
  end if;

  for i in 1 .. array_length(v_dias, 1) loop
    if v_dias[i] = v_cursor then
      v_streak := v_streak + 1;
      v_cursor := v_cursor - 1;
    else
      exit;
    end if;
  end loop;

  if v_streak in (7, 30) then
    select exists(
      select 1 from public.notificacoes
      where usuario_id = p_usuario and tipo = 'streak'
        and (dados->>'streak_dias')::int = v_streak
        and (criado_em at time zone 'America/Sao_Paulo')::date = v_hoje
    ) into v_ja_notificado;

    if not v_ja_notificado then
      perform public.notificar(
        p_usuario, 'streak',
        'Sequência de ', v_streak || ' dias', ' de estudo! Continue assim.',
        '/perfil', 'fogo_streak',
        jsonb_build_object('streak_dias', v_streak),
        true
      );
    end if;
  end if;

  return v_streak;
end;
$function$;

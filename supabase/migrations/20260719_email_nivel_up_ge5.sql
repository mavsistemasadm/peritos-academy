-- Email de nível: só a partir do nível 5 (níveis 2-4 continuam celebrando
-- no toast/sino, sem email — email em todo nível viraria spam). Gate na
-- fonte (creditar_gamificacao), não só na recepção do endpoint.
-- Também parametriza gam_status_proximo_nivel (p_usuario default auth.uid())
-- para o endpoint de email poder chamá-la via service role e mostrar "o que
-- falta pro próximo nível" com dado real, sem duplicar a lógica de
-- requisitos compostos.

create or replace function public.creditar_gamificacao(p_usuario uuid, p_codigo text, p_referencia_tipo text default null::text, p_referencia_id uuid default null::uuid, p_pontos_override integer default null::integer, p_moedas_override integer default null::integer, p_pular_idempotencia boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_config public.config_gamificacao%rowtype;
  v_gatilho public.gamificacao_gatilhos%rowtype;
  v_contagem_dia int;
  v_ja_existe boolean;
  v_pontos int;
  v_moedas int;
  v_xp_total int;
  v_moedas_total int;
  v_nivel_nome text;
  v_nivel_ordem int;
  v_nivel_antigo int;
  v_engajamento_hoje int;
begin
  select * into v_config from public.config_gamificacao where id = 1;
  if not found or not v_config.gamificacao_ativa or not v_config.gatilhos_ativos then
    return jsonb_build_object('creditado', false, 'motivo', 'desativado');
  end if;

  select * into v_gatilho from public.gamificacao_gatilhos where codigo = p_codigo and ativo = true;
  if not found then
    return jsonb_build_object('creditado', false, 'motivo', 'gatilho_invalido');
  end if;

  if v_gatilho.limite_diario is not null then
    select count(*) into v_contagem_dia
    from public.gamificacao_extrato
    where usuario_id = p_usuario and gatilho_codigo = p_codigo
      and (criado_em at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date;
    if v_contagem_dia >= v_gatilho.limite_diario then
      return jsonb_build_object('creditado', false, 'motivo', 'limite_diario');
    end if;
  end if;

  if p_referencia_id is not null and not p_pular_idempotencia then
    select exists(
      select 1 from public.gamificacao_extrato
      where usuario_id = p_usuario and gatilho_codigo = p_codigo
        and referencia_tipo = p_referencia_tipo and referencia_id = p_referencia_id
    ) into v_ja_existe;
    if v_ja_existe then
      return jsonb_build_object('creditado', false, 'motivo', 'duplicado');
    end if;
  end if;

  if v_gatilho.conta_teto_engajamento then
    select coalesce(sum(ge.pontos), 0) into v_engajamento_hoje
    from public.gamificacao_extrato ge
    join public.gamificacao_gatilhos gg on gg.codigo = ge.gatilho_codigo
    where ge.usuario_id = p_usuario and gg.conta_teto_engajamento
      and (ge.criado_em at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date;

    if v_engajamento_hoje >= v_config.teto_engajamento_diario then
      return jsonb_build_object('creditado', false, 'motivo', 'teto_engajamento_diario');
    end if;
  end if;

  v_pontos := coalesce(p_pontos_override, v_gatilho.pontos);
  v_moedas := coalesce(p_moedas_override, v_gatilho.moedas);

  if v_config.moeda_a_cada_xp is not null and v_config.moeda_a_cada_xp > 0 and v_moedas = 0 and v_pontos > 0 then
    v_moedas := v_pontos / v_config.moeda_a_cada_xp;
  end if;

  if v_pontos = 0 and v_moedas = 0 then
    return jsonb_build_object('creditado', false, 'motivo', 'sem_valor');
  end if;

  select nivel into v_nivel_antigo from public.perfis where id = p_usuario;

  insert into public.gamificacao_extrato (usuario_id, gatilho_codigo, pontos, moedas, referencia_tipo, referencia_id)
  values (p_usuario, p_codigo, v_pontos, v_moedas, p_referencia_tipo, p_referencia_id)
  on conflict do nothing;

  select coalesce(sum(pontos), 0), coalesce(sum(moedas), 0)
  into v_xp_total, v_moedas_total
  from public.gamificacao_extrato where usuario_id = p_usuario;

  select nr.nivel_ordem, nr.nivel_nome into v_nivel_ordem, v_nivel_nome
  from public.gam_nivel_real(p_usuario, v_xp_total) nr;

  perform set_config('app.gamificacao_write', 'on', true);
  update public.perfis
  set xp = v_xp_total, moedas = v_moedas_total, nivel = coalesce(v_nivel_ordem, 0)
  where id = p_usuario;

  if v_nivel_ordem is not null and v_nivel_ordem > coalesce(v_nivel_antigo, 0) then
    perform public.notificar(
      p_usuario, 'nivel_up',
      'Você alcançou o nível ', v_nivel_nome, '!',
      '/perfil', 'selo_nivel',
      jsonb_build_object(
        'nivel_ordem', v_nivel_ordem,
        'nivel_ordem_anterior', v_nivel_antigo,
        'nivel_nome', v_nivel_nome,
        'xp_total', v_xp_total
      ),
      true
    );

    -- Email de nível só a partir do 5 (2-4 celebram só no toast/sino).
    if v_nivel_ordem >= 5 then
      perform net.http_post(
        url := 'https://peritos-academy.vercel.app/api/internal/email-evento',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || public.email_internal_secret()
        ),
        body := jsonb_build_object('tipo', 'nivel_up', 'usuario_id', p_usuario, 'ref_id', v_nivel_ordem::text)
      );
    end if;
  end if;

  return jsonb_build_object(
    'creditado', true, 'pontos', v_pontos, 'moedas', v_moedas,
    'xp_total', v_xp_total, 'moedas_total', v_moedas_total, 'nivel_atual', v_nivel_nome
  );
end;
$function$;

-- Parametriza gam_status_proximo_nivel (mantém comportamento idêntico para
-- chamadas do client, que não passam parâmetro nenhum).
-- OBS: mudar a assinatura via CREATE OR REPLACE cria uma sobrecarga nova em
-- vez de substituir (identidade de função inclui tipos de parâmetro) — por
-- isso o drop explícito da versão sem parâmetro logo abaixo.
create or replace function public.gam_status_proximo_nivel(p_usuario uuid default auth.uid())
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_xp int;
  v_nivel_atual record;
  v_proximo public.gamificacao_niveis%rowtype;
  v_c record;
  v_requisitos jsonb := '[]'::jsonb;
begin
  if p_usuario is null then
    return null;
  end if;

  select coalesce(xp, 0) into v_xp from public.perfis where id = p_usuario;
  select * into v_nivel_atual from public.gam_nivel_real(p_usuario, v_xp);

  select * into v_proximo from public.gamificacao_niveis where ordem = coalesce(v_nivel_atual.nivel_ordem, 0) + 1;

  if not found then
    return jsonb_build_object(
      'nivel_atual_ordem', v_nivel_atual.nivel_ordem,
      'nivel_atual_nome', v_nivel_atual.nivel_nome,
      'proximo_nivel', null
    );
  end if;

  select * into v_c from public.gam_contadores_usuario(p_usuario);

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

drop function if exists public.gam_status_proximo_nivel();

-- ============================================================
-- Motor de gamificação — nível real (XP + requisitos compostos).
-- Registro pós-aplicação via MCP (name=gam_nivel_real_requisitos_compostos),
-- pra rastreabilidade do repo.
--
-- ACHADO: creditar_gamificacao() calculava nível só por XP (maior ordem
-- com pontos_minimos <= xp_total), ignorando por completo as colunas de
-- requisito composto adicionadas em gamificacao_niveis (aulas_concluidas,
-- cursos_completos, avaliacoes_aprovadas, desafios_completos,
-- streak_marco_dias, participacoes_comunidade). Excedente de XP sem o
-- requisito composto não pode subir de nível — regra explícita da tarefa.
-- gam_nivel_real() centraliza esse cálculo (contagens em tempo real,
-- nunca colunas cacheadas) e creditar_gamificacao passa a chamá-lo.
-- ============================================================

create or replace function public.gam_nivel_real(p_usuario uuid, p_xp_total int)
returns table(nivel_ordem int, nivel_nome text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_aulas_concl int;
  v_cursos_publicados int;
  v_cursos_completos int;
  v_avaliacoes_publicadas int;
  v_avaliacoes_aprovadas int;
  v_desafios_existentes int;
  v_desafios_completos int;
  v_streak_recorde int;
  v_participacoes int;
  v_nivel record;
begin
  select count(*) into v_aulas_concl
    from public.aula_progresso where usuario_id = p_usuario and concluida = true;

  select count(*) into v_cursos_publicados from public.cursos where publicado = true;
  select count(*) into v_cursos_completos
    from public.cursos c
    where c.publicado = true and public.gam_curso_completo(p_usuario, c.id);

  select count(*) into v_avaliacoes_publicadas from public.avaliacoes where publicado = true;
  select count(distinct at.avaliacao_id) into v_avaliacoes_aprovadas
    from public.avaliacao_tentativas at
    join public.avaliacoes a on a.id = at.avaliacao_id
    where at.usuario_id = p_usuario and at.aprovado = true and a.publicado = true;

  select count(*) into v_desafios_existentes from public.desafios where publicado = true;
  select count(distinct de.desafio_id) into v_desafios_completos
    from public.desafio_entregas de
    join public.desafios d on d.id = de.desafio_id
    where de.usuario_id = p_usuario and de.entregue_em is not null
      and de.nota >= d.nota_minima and d.publicado = true;

  select coalesce(recorde, 0) into v_streak_recorde
    from public.streak_estado where usuario_id = p_usuario;
  v_streak_recorde := coalesce(v_streak_recorde, 0);

  select
    coalesce((select count(*) from public.comunidade_posts where usuario_id = p_usuario), 0)
    + coalesce((select count(*) from public.comunidade_comentarios where usuario_id = p_usuario), 0)
    + coalesce((select count(*) from public.comunidade_reacoes where usuario_id = p_usuario), 0)
  into v_participacoes;

  for v_nivel in select * from public.gamificacao_niveis order by ordem desc loop
    if v_nivel.pontos_minimos > p_xp_total then continue; end if;

    if v_nivel.aulas_concluidas is not null and v_aulas_concl < v_nivel.aulas_concluidas then continue; end if;

    if v_nivel.cursos_completos is not null then
      if v_nivel.cursos_completos = -1 then
        if v_cursos_completos < v_cursos_publicados then continue; end if;
      elsif v_cursos_completos < v_nivel.cursos_completos then continue;
      end if;
    end if;

    if v_nivel.avaliacoes_aprovadas is not null then
      if v_nivel.avaliacoes_aprovadas = -1 then
        if v_avaliacoes_aprovadas < v_avaliacoes_publicadas then continue; end if;
      elsif v_avaliacoes_aprovadas < v_nivel.avaliacoes_aprovadas then continue;
      end if;
    end if;

    if v_nivel.desafios_completos is not null then
      if v_nivel.desafios_completos = -1 then
        if v_desafios_completos < v_desafios_existentes then continue; end if;
      elsif v_desafios_completos < v_nivel.desafios_completos then continue;
      end if;
    end if;

    if v_nivel.streak_marco_dias is not null and v_streak_recorde < v_nivel.streak_marco_dias then continue; end if;

    if v_nivel.participacoes_comunidade is not null and v_participacoes < v_nivel.participacoes_comunidade then continue; end if;

    nivel_ordem := v_nivel.ordem;
    nivel_nome := v_nivel.nome;
    return next;
    return;
  end loop;

  return;
end;
$function$;

revoke execute on function public.gam_nivel_real(uuid, int) from public, anon;
grant execute on function public.gam_nivel_real(uuid, int) to authenticated;

comment on function public.gam_nivel_real(uuid, int) is
  'Nível real do usuário: maior ordem cujo pontos_minimos E todos os requisitos compostos não-nulos batem (contagens em tempo real). -1 num requisito = 100% do total publicado/existente daquele recurso hoje. Chokepoint único de leitura de nível — creditar_gamificacao() e qualquer tela que precise do nível "de verdade" devem usar esta função, nunca reimplementar o cálculo.';

-- creditar_gamificacao passa a usar gam_nivel_real em vez do cálculo
-- só-por-XP. Resto da função inalterado (idempotência, teto de
-- engajamento, limite diário, notificação de level-up).
create or replace function public.creditar_gamificacao(
  p_usuario uuid,
  p_codigo text,
  p_referencia_tipo text default null,
  p_referencia_id uuid default null,
  p_pontos_override integer default null,
  p_moedas_override integer default null,
  p_pular_idempotencia boolean default false
)
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

    if v_nivel_ordem > 1 then
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

revoke execute on function public.creditar_gamificacao(uuid, text, text, uuid, int, int, boolean) from public, anon, authenticated;

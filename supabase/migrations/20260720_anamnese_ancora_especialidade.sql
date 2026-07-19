-- Correção 1 (achado da validação dos 3 perfis): quando o aluno declara
-- afinidade técnica específica na Q5 (opções 1,2,3,4,7,8 — as de peso 3,
-- área única), a trilha correspondente entra GARANTIDA no plano em posição
-- de destaque (logo após a Formação se a regra do iniciante disparou, ou em
-- 1º lugar se não disparou) — em vez de competir só por soma de votos e
-- poder acabar atrás de trilhas de escala/automação, como aconteceu no
-- perfil "perito bancário" (Bancário caiu pra 4º). As opções 5 ("todas as
-- áreas") e 6 ("ainda explorando") continuam decididas só pela soma de
-- votos — não mapeiam pra uma única trilha de peso 3, então a query da
-- âncora naturalmente não encontra nada pra elas (sem precisar de
-- exclusão explícita).
-- Configurável via config_anamnese.ancora_especialidade (default true).

alter table public.config_anamnese add column if not exists ancora_especialidade boolean not null default true;
alter table public.plano_trilhas add column if not exists forcada_ancora_especialidade boolean not null default false;

create or replace function public.anamnese_calcular_cronograma()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_usuario uuid := auth.uid();
  v_plano record;
  v_config record;
  v_horas_semana numeric;
  v_pt record;
  v_semana_cursor int := 1;
  v_carga_video numeric;
  v_carga_aval numeric;
  v_carga_efetiva numeric;
  v_semanas int;
  v_num_cursos int;
  v_num_avaliacoes int;
  v_carga_total numeric := 0;
  v_semanas_totais int;
  v_meses_totais int;
  v_trilha_slug text;
begin
  if v_usuario is null then
    raise exception 'É preciso estar autenticado.';
  end if;

  select * into v_plano from public.planos
  where usuario_id = v_usuario and origem = 'anamnese' and ativo = true
  order by criado_em desc limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'sem_plano_ativo');
  end if;

  select * into v_config from public.config_anamnese where id = 1;
  v_horas_semana := coalesce(v_plano.horas_semana_declarada, 6);

  for v_pt in select * from public.plano_trilhas where plano_id = v_plano.id order by ordem loop
    select slug into v_trilha_slug from public.trilhas where id = v_pt.trilha_id;

    select count(distinct c.id), coalesce(sum(a.duracao_seg), 0) / 3600.0
    into v_num_cursos, v_carga_video
    from public.curso_trilha ct
    join public.cursos c on c.id = ct.curso_id and c.publicado = true
    join public.modulos m on m.curso_id = c.id
    join public.aulas a on a.modulo_id = m.id
    where ct.trilha_slug = v_trilha_slug;

    select count(*) into v_num_avaliacoes
    from public.avaliacoes av
    where av.publicado = true
      and av.curso_id in (
        select ct.curso_id from public.curso_trilha ct
        join public.cursos c on c.id = ct.curso_id and c.publicado = true
        where ct.trilha_slug = v_trilha_slug
      );

    v_carga_video := coalesce(v_carga_video, 0);
    v_carga_aval := coalesce(v_num_avaliacoes, 0) * v_config.horas_por_avaliacao;
    v_carga_efetiva := (v_carga_video * v_config.fator_estudo_efetivo) + v_carga_aval;
    v_semanas := greatest(1, ceil(v_carga_efetiva / nullif(v_horas_semana, 0))::int);

    update public.plano_trilhas set
      num_cursos = coalesce(v_num_cursos, 0),
      num_avaliacoes = coalesce(v_num_avaliacoes, 0),
      carga_horas_video = round(v_carga_video, 1),
      carga_horas_avaliacoes = round(v_carga_aval, 1),
      carga_efetiva_horas = round(v_carga_efetiva, 1),
      semana_inicio = v_semana_cursor,
      semana_fim = v_semana_cursor + v_semanas - 1,
      mes_inicio = ceil(v_semana_cursor / 4.0)::int,
      mes_fim = ceil((v_semana_cursor + v_semanas - 1) / 4.0)::int
    where id = v_pt.id;

    v_semana_cursor := v_semana_cursor + v_semanas;
    v_carga_total := v_carga_total + v_carga_efetiva;
  end loop;

  v_semanas_totais := v_semana_cursor - 1;
  v_meses_totais := ceil(v_semanas_totais / 4.0)::int;

  update public.planos set
    semanas_totais = v_semanas_totais,
    meses_totais = v_meses_totais,
    excede_meta_meses = v_meses_totais > v_config.meta_meses,
    horas_semana_sugerida = ceil(v_carga_total / (v_config.meta_meses * 4.0))
  where id = v_plano.id;

  return jsonb_build_object(
    'ok', true,
    'plano_id', v_plano.id,
    'resumo', jsonb_build_object(
      'semanas_totais', v_semanas_totais,
      'meses_totais', v_meses_totais,
      'excede_meta_meses', v_meses_totais > v_config.meta_meses,
      'horas_semana_declarada', v_horas_semana,
      'horas_semana_sugerida_para_meta', ceil(v_carga_total / (v_config.meta_meses * 4.0))
    ),
    'trilhas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'ordem', pt.ordem,
        'trilha_id', pt.trilha_id,
        'trilha_nome', t.nome,
        'votos', pt.votos,
        'forcada_regra_iniciante', pt.forcada_regra_iniciante,
        'forcada_ancora_especialidade', pt.forcada_ancora_especialidade,
        'num_cursos', pt.num_cursos,
        'num_avaliacoes', pt.num_avaliacoes,
        'carga_horas_video', pt.carga_horas_video,
        'carga_horas_avaliacoes', pt.carga_horas_avaliacoes,
        'carga_efetiva_horas', pt.carga_efetiva_horas,
        'semana_inicio', pt.semana_inicio,
        'semana_fim', pt.semana_fim,
        'mes_inicio', pt.mes_inicio,
        'mes_fim', pt.mes_fim
      ) order by pt.ordem), '[]'::jsonb)
      from public.plano_trilhas pt join public.trilhas t on t.id = pt.trilha_id
      where pt.plano_id = v_plano.id
    )
  );
end;
$function$;

create or replace function public.anamnese_gerar_prescricao()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_usuario uuid := auth.uid();
  v_total_questoes int;
  v_respondidas int;
  v_config record;
  v_q1_ordem int;
  v_q5_ordem int;
  v_q13_ordem int;
  v_regra_iniciante boolean := false;
  v_avatar text;
  v_plano_id uuid;
  v_horas_semana numeric;
  v_trilha record;
  v_ordem int;
  v_for_trilha_id uuid;
  v_ja_tem_for boolean := false;
  v_ancora_esp_trilha_id uuid;
  v_ja_tem_ancora_esp boolean := false;
  v_meses_atual int;
  v_meses_tentativo int;
  v_qtd_trilhas_atual int;
  v_candidato record;
  v_expandiu boolean := false;
begin
  if v_usuario is null then
    raise exception 'É preciso estar autenticado.';
  end if;

  select count(*) into v_total_questoes from public.anamnese_questoes;
  select count(*) into v_respondidas from public.anamnese_respostas where usuario_id = v_usuario;
  if v_respondidas < v_total_questoes then
    return jsonb_build_object('ok', false, 'motivo', 'anamnese_incompleta', 'respondidas', v_respondidas, 'total', v_total_questoes);
  end if;

  select * into v_config from public.config_anamnese where id = 1;

  select opcao_ordem into v_q1_ordem from public.anamnese_respostas where usuario_id = v_usuario and questao_ordem = 0;
  select opcao_ordem into v_q13_ordem from public.anamnese_respostas where usuario_id = v_usuario and questao_ordem = 12;
  select opcao_ordem into v_q5_ordem from public.anamnese_respostas where usuario_id = v_usuario and questao_ordem = 4;

  if v_q1_ordem in (1, 2) then
    v_avatar := 'iniciante_transicao';
    v_regra_iniciante := true;
  elsif v_q1_ordem in (3, 4) then
    v_avatar := 'perito_em_evolucao';
  else
    if v_q13_ordem in (3, 6) then
      v_avatar := 'perito_em_evolucao';
    else
      v_avatar := 'iniciante_transicao';
    end if;
  end if;

  update public.perfis set anamnese_avatar = v_avatar where id = v_usuario;

  select horas_semana_valor into v_horas_semana
  from public.anamnese_respostas r
  join public.anamnese_opcoes o on o.questao_ordem = r.questao_ordem and o.opcao_ordem = r.opcao_ordem
  where r.usuario_id = v_usuario and r.questao_ordem = 2;

  create temporary table tmp_votos on commit drop as
  select ot.trilha_id, sum(ot.peso)::int as votos
  from public.anamnese_respostas r
  join public.anamnese_questoes q on q.ordem = r.questao_ordem and q.papel = 'diagnostica'
  join public.anamnese_opcao_trilhas ot on ot.questao_ordem = r.questao_ordem and ot.opcao_ordem = r.opcao_ordem
  where r.usuario_id = v_usuario
  group by ot.trilha_id;

  select id into v_for_trilha_id from public.trilhas where slug = 'principal';

  -- Âncora da especialidade: só as opções de peso 3 (área única) da Q5
  -- mapeiam pra uma trilha aqui — opções 5/6 (todas as áreas / explorando)
  -- não têm linha peso=3, então naturalmente não ativam nada.
  if v_config.ancora_especialidade then
    select trilha_id into v_ancora_esp_trilha_id
    from public.anamnese_opcao_trilhas
    where questao_ordem = 4 and opcao_ordem = v_q5_ordem and peso = 3;
  end if;

  update public.planos set ativo = false where usuario_id = v_usuario and origem = 'anamnese' and ativo = true;

  insert into public.planos (usuario_id, titulo, origem, ativo, horas_semana_declarada)
  values (v_usuario, 'Minha Rota do Perito', 'anamnese', true, v_horas_semana)
  returning id into v_plano_id;

  v_ordem := 1;

  -- Âncora 1: FOR sempre primeiro quando Q1 indica quem nunca atuou ou só
  -- estudou (Fase C.3 da curadoria).
  if v_regra_iniciante then
    insert into public.plano_trilhas (plano_id, usuario_id, trilha_id, ordem, votos, forcada_regra_iniciante)
    values (v_plano_id, v_usuario, v_for_trilha_id, v_ordem, coalesce((select votos from tmp_votos where trilha_id = v_for_trilha_id), 0), true);
    v_ordem := v_ordem + 1;
    v_ja_tem_for := true;
  end if;

  -- Âncora 2: especialidade declarada na Q5 entra logo depois (ou em 1º
  -- lugar, se a regra do iniciante não disparou).
  if v_ancora_esp_trilha_id is not null and not (v_ja_tem_for and v_ancora_esp_trilha_id = v_for_trilha_id) then
    insert into public.plano_trilhas (plano_id, usuario_id, trilha_id, ordem, votos, forcada_ancora_especialidade)
    values (v_plano_id, v_usuario, v_ancora_esp_trilha_id, v_ordem, coalesce((select votos from tmp_votos where trilha_id = v_ancora_esp_trilha_id), 0), true);
    v_ordem := v_ordem + 1;
    v_ja_tem_ancora_esp := true;
  end if;

  for v_trilha in
    select trilha_id, votos from tmp_votos
    where votos > 0
      and not (v_ja_tem_for and trilha_id = v_for_trilha_id)
      and not (v_ja_tem_ancora_esp and trilha_id = v_ancora_esp_trilha_id)
    order by votos desc, trilha_id asc
    limit greatest(0, v_config.teto_trilhas_prescricao
      - (case when v_ja_tem_for then 1 else 0 end)
      - (case when v_ja_tem_ancora_esp then 1 else 0 end))
  loop
    insert into public.plano_trilhas (plano_id, usuario_id, trilha_id, ordem, votos)
    values (v_plano_id, v_usuario, v_trilha.trilha_id, v_ordem, v_trilha.votos);
    v_ordem := v_ordem + 1;
  end loop;

  perform public.anamnese_calcular_cronograma();
  select meses_totais into v_meses_atual from public.planos where id = v_plano_id;
  select count(*) into v_qtd_trilhas_atual from public.plano_trilhas where plano_id = v_plano_id;

  -- Expansão: rota curta demais desperdiça o apetite declarado. Puxa mais
  -- trilhas por ordem de votos, uma a uma, recalculando o cronograma inteiro
  -- a cada tentativa — só fica se não ultrapassar a meta de 12 meses.
  if v_meses_atual < v_config.meses_minimo_antes_expandir then
    for v_candidato in
      select trilha_id, votos from tmp_votos
      where votos > 0
        and trilha_id not in (select trilha_id from public.plano_trilhas where plano_id = v_plano_id)
      order by votos desc, trilha_id asc
    loop
      exit when v_qtd_trilhas_atual >= v_config.teto_expandido;

      insert into public.plano_trilhas (plano_id, usuario_id, trilha_id, ordem, votos)
      values (v_plano_id, v_usuario, v_candidato.trilha_id, v_qtd_trilhas_atual + 1, v_candidato.votos);

      perform public.anamnese_calcular_cronograma();
      select meses_totais into v_meses_tentativo from public.planos where id = v_plano_id;

      if v_meses_tentativo > v_config.meta_meses then
        delete from public.plano_trilhas where plano_id = v_plano_id and trilha_id = v_candidato.trilha_id;
        perform public.anamnese_calcular_cronograma();
        exit;
      end if;

      v_qtd_trilhas_atual := v_qtd_trilhas_atual + 1;
      v_meses_atual := v_meses_tentativo;
      v_expandiu := true;
    end loop;
  end if;

  perform public.creditar_gamificacao(v_usuario, 'concluir_anamnese', 'anamnese_primeira_vez', v_usuario);

  if not exists (select 1 from public.perfil_insignias where usuario_id = v_usuario and nome = 'Rota Traçada') then
    insert into public.perfil_insignias (usuario_id, nome, descricao, icone, conquistada_em, quando_rotulo, ordem)
    values (v_usuario, 'Rota Traçada', 'Completou a anamnese e recebeu sua Rota do Perito personalizada.', 'mapa', current_date, 'ao concluir a anamnese', 0);
  end if;

  return jsonb_build_object(
    'ok', true, 'plano_id', v_plano_id, 'avatar', v_avatar,
    'regra_iniciante_aplicada', v_regra_iniciante,
    'ancora_especialidade_aplicada', v_ja_tem_ancora_esp,
    'expansao_aplicada', v_expandiu
  );
end;
$function$;

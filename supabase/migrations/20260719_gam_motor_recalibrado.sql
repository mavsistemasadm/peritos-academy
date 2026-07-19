-- ============================================================
-- Motor de gamificação — recalibração completa (2026-07-19).
--
-- Registro pós-aplicação via MCP (name=gam_motor_recalibrado), pra
-- rastreabilidade do repo. Cobre:
-- 1) Novas colunas de config/gatilhos/níveis pro motor recalibrado.
-- 2) etapas.xp_conclusao populado (uniforme, editável no admin).
-- 3) Novos gatilhos (streak_7, streak_30, melhor_resposta,
--    avaliacao_aprovada) + teto diário combinado de engajamento.
-- 4) Aposentadoria do sistema de faixa de quiz (quiz_ate_49..quiz_100 +
--    passar_prova) em favor de avaliacao_aprovada (peso × acerto,
--    só na 1ª aprovação) — ver rewrite de submeter_avaliacao().
-- 5) Rewrite dos triggers de crédito pra usar XP dinâmico
--    (aulas.xp, etapas.xp_conclusao, desafios.xp, bonus_curso_concluido)
--    em vez do valor fixo do gatilho.
-- 6) Novo trigger de melhor_resposta (crédito concedido pelo admin ao
--    marcar um comentário como melhor resposta).
-- ============================================================

alter table public.config_gamificacao
  add column if not exists avaliacao_xp_base int not null default 200,
  add column if not exists bonus_curso_concluido int not null default 100,
  add column if not exists teto_engajamento_diario int not null default 60,
  add column if not exists moeda_a_cada_xp int,
  add column if not exists xp_teto_calculado bigint,
  add column if not exists xp_teto_calculado_em timestamptz;

update public.config_gamificacao set moeda_a_cada_xp = 100 where id = 1 and moeda_a_cada_xp is null;

alter table public.gamificacao_gatilhos
  add column if not exists conta_teto_engajamento boolean not null default false;

alter table public.gamificacao_niveis
  add column if not exists cursos_completos int,
  add column if not exists avaliacoes_aprovadas int,
  add column if not exists desafios_completos int,
  add column if not exists streak_marco_dias int,
  add column if not exists participacoes_comunidade int;

comment on column public.gamificacao_niveis.cursos_completos is
  'Nulo = sem exigência. -1 = 100% dos cursos publicados (checagem dinâmica, não um número fixo).';
comment on column public.gamificacao_niveis.avaliacoes_aprovadas is
  'Nulo = sem exigência. -1 = 100% das avaliações publicadas.';
comment on column public.gamificacao_niveis.desafios_completos is
  'Nulo = sem exigência. -1 = 100% dos desafios existentes.';

-- valor inicial uniforme (50), editável no admin daqui pra frente —
-- só existia pra existir o bônus de etapa, spec não pediu calibragem fina.
update public.etapas set xp_conclusao = 50 where xp_conclusao is null or xp_conclusao = 0;

update public.gamificacao_gatilhos
  set conta_teto_engajamento = true
  where codigo in ('login_diario', 'criar_post', 'comentar_post', 'comentar_aula', 'reagir');

insert into public.gamificacao_gatilhos
  (codigo, nome, descricao, pontos, moedas, limite_diario, ativo, categoria, conta_teto_engajamento)
values
  ('streak_7', 'Marco de streak — 7 dias', 'Manteve acesso por 7 dias seguidos', 50, 0, null, true, 'marco', true),
  ('streak_30', 'Marco de streak — 30 dias', 'Manteve acesso por 30 dias seguidos', 250, 0, null, true, 'marco', true),
  ('melhor_resposta', 'Melhor resposta', 'Comentário marcado pelo admin como melhor resposta', 40, 0, null, true, 'especial', true),
  ('avaliacao_aprovada', 'Avaliação aprovada', 'Aprovação em avaliação de módulo ou prova (1ª vez, XP calculado por peso × acerto)', 0, 0, null, true, 'quiz', false)
on conflict (codigo) do update set
  nome = excluded.nome, descricao = excluded.descricao, pontos = excluded.pontos,
  moedas = excluded.moedas, limite_diario = excluded.limite_diario, ativo = excluded.ativo,
  categoria = excluded.categoria, conta_teto_engajamento = excluded.conta_teto_engajamento;

-- aposentados, não deletados (histórico do extrato antigo continua legível)
update public.gamificacao_gatilhos
  set ativo = false
  where codigo in ('quiz_ate_49', 'quiz_50_69', 'quiz_70_89', 'quiz_90_99', 'quiz_100', 'passar_prova');

-- concluir_aula passa a creditar aulas.xp dinâmico (via p_pontos_override),
-- e dispara iniciar_curso/concluir_modulo em cascata (já existia, mantido).
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
      'Você concluiu sua ', 'primeira aula', ' — bem-vindo à jornada!',
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

-- concluir_curso/concluir_etapa passam a creditar bonus_curso_concluido
-- (config) e etapas.xp_conclusao (dinâmico) em vez do valor fixo do gatilho.
create or replace function public.gam_verificar_progresso_curso(p_usuario uuid, p_curso_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_etapa_id uuid;
  v_todas_completas boolean;
  v_curso_titulo text;
  v_curso_capa text;
  v_credito jsonb;
  v_trilha_id uuid;
  v_trilha_principal boolean;
  v_bonus_curso int;
  v_etapa_xp int;
begin
  if p_curso_id is null or not public.gam_curso_completo(p_usuario, p_curso_id) then
    return;
  end if;

  select bonus_curso_concluido into v_bonus_curso from public.config_gamificacao where id = 1;
  v_credito := public.creditar_gamificacao(p_usuario, 'concluir_curso', 'curso', p_curso_id, v_bonus_curso);

  if (v_credito->>'creditado')::boolean then
    select titulo, coalesce(capa_horizontal_url, capa_url) into v_curso_titulo, v_curso_capa
    from public.cursos where id = p_curso_id;

    perform public.notificar(
      p_usuario, 'curso_concluido',
      'Você concluiu o curso ', coalesce(v_curso_titulo, ''), ', parabéns!',
      '/perfil#certificados', 'certificado',
      jsonb_build_object('curso_id', p_curso_id, 'curso_titulo', v_curso_titulo, 'capa_url', v_curso_capa),
      true
    );
  end if;

  for v_etapa_id in
    select distinct em.etapa_id from public.etapa_missoes em where em.curso_id = p_curso_id
  loop
    select bool_and(public.gam_curso_completo(p_usuario, em2.curso_id))
    into v_todas_completas
    from public.etapa_missoes em2
    where em2.etapa_id = v_etapa_id;

    if v_todas_completas then
      select xp_conclusao into v_etapa_xp from public.etapas where id = v_etapa_id;
      perform public.creditar_gamificacao(p_usuario, 'concluir_etapa', 'etapa', v_etapa_id, v_etapa_xp);

      select trilha_id into v_trilha_id from public.etapas where id = v_etapa_id;
      select coalesce(principal, false) into v_trilha_principal from public.trilhas where id = v_trilha_id;

      if v_trilha_principal and public.trilha_completa(p_usuario, v_trilha_id) then
        perform public.conceder_selo_excelencia_interno(p_usuario);
      end if;
    end if;
  end loop;
end;
$function$;

-- entregar_desafio passa a creditar desafios.xp dinâmico.
create or replace function public.gam_trg_desafio_entrega()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_desafio_titulo text;
  v_desafio_slug text;
  v_desafio_xp int;
begin
  if new.entregue_em is not null and old.entregue_em is null and new.usuario_id is not null then
    select titulo, slug, xp into v_desafio_titulo, v_desafio_slug, v_desafio_xp
    from public.desafios where id = new.desafio_id;

    perform public.creditar_gamificacao(new.usuario_id, 'entregar_desafio', 'desafio_entrega', new.id, v_desafio_xp);

    perform public.notificar(
      new.usuario_id, 'desafio_entrega',
      'Você enviou sua entrega do desafio ', coalesce(v_desafio_titulo, ''), '',
      case when v_desafio_slug is not null then '/desafios/' || v_desafio_slug else null end,
      null, jsonb_build_object('desafio_id', new.desafio_id, 'desafio_entrega_id', new.id), false
    );
  end if;
  return new;
end;
$function$;

create or replace function public.gam_trg_comunidade_post()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.usuario_id is not null then
    perform public.creditar_gamificacao(new.usuario_id, 'criar_post', 'comunidade_post', new.id);
  end if;
  return new;
end;
$function$;

-- comentar_post passa a excluir autocomentário (só credita em post de outro autor)
-- e a passar referencia_id real (idempotência absoluta, antes só tinha limite diário).
create or replace function public.gam_trg_comunidade_comentario()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_autor_post uuid;
begin
  if new.usuario_id is not null then
    select usuario_id into v_autor_post from public.comunidade_posts where id = new.post_id;

    if v_autor_post is distinct from new.usuario_id then
      perform public.creditar_gamificacao(new.usuario_id, 'comentar_post', 'comunidade_comentario', new.id);
    end if;
  end if;
  return new;
end;
$function$;

-- melhor_resposta: crédito concedido pelo admin ao marcar um comentário
-- (marcarMelhorResposta em app/admin/comunidade/actions.ts flipa a coluna).
create or replace function public.gam_trg_comunidade_melhor_resposta()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.melhor_resposta is true and coalesce(old.melhor_resposta, false) is not true and new.usuario_id is not null then
    perform public.creditar_gamificacao(new.usuario_id, 'melhor_resposta', 'comunidade_melhor_resposta', new.id);
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_gam_comunidade_melhor_resposta on public.comunidade_comentarios;
create trigger trg_gam_comunidade_melhor_resposta
  after update of melhor_resposta on public.comunidade_comentarios
  for each row execute function public.gam_trg_comunidade_melhor_resposta();

-- submeter_avaliacao: faixa de acerto x peso substituído por
-- avaliacao_xp_base (config) x peso x %acerto, só na 1ª aprovação
-- (creditar_gamificacao garante isso pela idempotência de referencia_id).
create or replace function public.submeter_avaliacao(p_avaliacao uuid, p_respostas jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user     uuid := auth.uid();
  v_av       avaliacoes%rowtype;
  v_q        avaliacao_questoes%rowtype;
  v_resp     jsonb;
  v_opcao    uuid;
  v_valor    numeric;
  v_correta  boolean;
  v_op_id    uuid;
  v_op_texto text;
  v_acertos  int := 0;
  v_total    int := 0;
  v_gab      jsonb := '[]'::jsonb;
  v_tent     uuid;
  v_nota     numeric;
  v_pct      numeric;
  v_aprovado boolean;
  v_media    numeric;
  v_xp_ganho int := 0;
  v_xp_base  int;
  v_credito  jsonb;
  v_curso_slug text;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para enviar a avaliação.';
  end if;

  select * into v_av from avaliacoes where id = p_avaliacao and publicado;
  if not found then
    raise exception 'Avaliação não encontrada.';
  end if;

  insert into avaliacao_tentativas (usuario_id, avaliacao_id)
  values (v_user, p_avaliacao)
  returning id into v_tent;

  for v_q in
    select * from avaliacao_questoes
    where avaliacao_id = p_avaliacao
    order by ordem
  loop
    v_total := v_total + 1;

    select r into v_resp
    from jsonb_array_elements(p_respostas) r
    where (r->>'questao_id')::uuid = v_q.id
    limit 1;

    v_correta := false; v_opcao := null; v_valor := null;
    v_op_id := null; v_op_texto := null;

    if v_q.tipo = 'multipla_escolha' then
      v_opcao := nullif(v_resp->>'opcao_id', '')::uuid;
      if v_opcao is not null then
        select coalesce(o.correta, false) into v_correta
        from avaliacao_opcoes o
        where o.id = v_opcao and o.questao_id = v_q.id;
        v_correta := coalesce(v_correta, false);
      end if;
      select o.id, o.texto into v_op_id, v_op_texto
      from avaliacao_opcoes o
      where o.questao_id = v_q.id and o.correta
      order by o.ordem limit 1;
    else
      v_valor := nullif(v_resp->>'valor', '')::numeric;
      if v_valor is not null then
        v_correta := abs(v_valor - v_q.resposta_valor) <= coalesce(v_q.tolerancia, 0);
      end if;
    end if;

    if v_correta then v_acertos := v_acertos + 1; end if;

    insert into avaliacao_respostas (tentativa_id, questao_id, opcao_id, valor_informado, correta)
    values (v_tent, v_q.id, v_opcao, v_valor, v_correta);

    v_gab := v_gab || jsonb_build_object(
      'questao_id',          v_q.id,
      'correta',             v_correta,
      'opcao_marcada',       v_opcao,
      'opcao_correta_id',    v_op_id,
      'opcao_correta_texto', v_op_texto,
      'resposta_valor',      v_q.resposta_valor,
      'valor_informado',     v_valor,
      'parecer',             v_q.parecer,
      'aula_id',             v_q.aula_id,
      'aula_ref',            v_q.aula_ref
    );
  end loop;

  if v_total = 0 then
    raise exception 'Esta avaliação ainda não tem questões.';
  end if;

  v_nota     := round(v_acertos::numeric / v_total * 10, 1);
  v_pct      := round(v_acertos::numeric / v_total * 100);
  v_aprovado := v_nota >= coalesce(v_av.nota_minima, 7.0);

  if v_aprovado then
    select avaliacao_xp_base into v_xp_base from config_gamificacao where id = 1;
    v_xp_ganho := round(coalesce(v_xp_base, 200) * greatest(coalesce(v_av.peso, 1), 1) * v_pct / 100);

    v_credito := creditar_gamificacao(v_user, 'avaliacao_aprovada', 'avaliacao_aprovada', p_avaliacao, v_xp_ganho);
    if not (v_credito->>'creditado')::boolean then
      v_xp_ganho := 0;
    end if;
  end if;

  update avaliacao_tentativas
  set nota = v_nota, acertos = v_acertos, total = v_total,
      xp_ganho = v_xp_ganho, aprovado = v_aprovado
  where id = v_tent;

  if v_aprovado then
    perform gam_verificar_progresso_curso(v_user, v_av.curso_id);

    select slug into v_curso_slug from cursos where id = v_av.curso_id;

    perform notificar(
      v_user, 'avaliacao_aprovada',
      'Você foi aprovado em ', coalesce(v_av.titulo, ''), '',
      case when v_curso_slug is not null then '/curso/' || v_curso_slug || '/avaliacao/' || p_avaliacao else null end,
      'trofeu',
      jsonb_build_object('avaliacao_id', p_avaliacao, 'nota', v_nota, 'titulo', v_av.titulo),
      true
    );
  end if;

  select round(avg(melhor), 1) into v_media
  from (
    select max(t.nota) as melhor
    from avaliacao_tentativas t
    join avaliacoes a on a.id = t.avaliacao_id
    where t.usuario_id = v_user and a.curso_id = v_av.curso_id
    group by t.avaliacao_id
  ) m;

  return jsonb_build_object(
    'nota', v_nota, 'acertos', v_acertos, 'total', v_total,
    'xp', v_xp_ganho, 'aprovado', v_aprovado,
    'media_curso', v_media, 'gabarito', v_gab
  );
end;
$function$;

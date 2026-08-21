-- 20260821_travas_na_sequencia.sql
--
-- As duas RPCs de escrita passam a ler a mesma sequência única do curso
-- (curso_sequencia + progresso_pendencia, ver 20260821_avaliacao_na_sequencia.sql).
--
-- Corpo gerado a partir do pg_get_functiondef vivo de cada função — só os blocos
-- de trava foram trocados, nada foi redigitado.

CREATE OR REPLACE FUNCTION public.concluir_aula(p_aula_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_modulo_id uuid;
  v_modulo_ordem int;
  v_aula_ordem int;
  v_curso_id uuid;
  v_video_url text;
  v_duracao integer;
  v_assistidos integer;
  v_terminou boolean;
  v_pct numeric;
  v_video_ok boolean := true;
  v_ja_concluida boolean;
  v_total_mat integer;
  v_materiais_pendentes jsonb;
  v_is_admin boolean;
  v_pend jsonb;
  v_aula_anterior_id uuid;
  v_aula_anterior_modulo_id uuid;
  v_anterior_concluida boolean;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'erro', 'Faça login para concluir a aula.');
  end if;

  select a.video_url, a.duracao_seg, a.modulo_id, m.ordem, a.ordem, m.curso_id
  into v_video_url, v_duracao, v_modulo_id, v_modulo_ordem, v_aula_ordem, v_curso_id
  from public.aulas a join public.modulos m on m.id = a.modulo_id
  where a.id = p_aula_id;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Aula não encontrada.');
  end if;

  select concluida into v_ja_concluida
  from public.aula_progresso where usuario_id = v_uid and aula_id = p_aula_id;
  if v_ja_concluida is true then
    return jsonb_build_object('ok', true);
  end if;

  v_is_admin := public.is_admin_papel(v_uid);

  if not v_is_admin then
    -- trava de sequência: a aula só conclui se TUDO que vem antes dela na
    -- jornada do curso estiver cumprido — aulas concluídas e avaliações
    -- aprovadas, cada uma na posição real em que aparece (ver curso_sequencia).
    -- A pendência volta nomeada e com id, pra tela poder mandar o aluno direto
    -- pro que falta em vez de dizer "conclua a avaliação do módulo anterior".
    v_pend := public.progresso_pendencia(v_uid, v_curso_id, p_aula_id);
    if coalesce((v_pend->>'bloqueado')::boolean, false) then
      return jsonb_build_object(
        'ok', false,
        'bloqueada_sequencia', true,
        'pendencia', v_pend,
        'erro', case v_pend->>'tipo'
                  when 'avaliacao' then 'Antes desta aula você precisa ser aprovado em: ' || (v_pend->>'titulo')
                  else 'Antes desta aula você precisa concluir: ' || (v_pend->>'titulo')
                end
      );
    end if;

    if v_video_url is not null then
      select coalesce(segundos_assistidos, 0), coalesce(video_terminou, false)
      into v_assistidos, v_terminou
      from public.aula_progresso where usuario_id = v_uid and aula_id = p_aula_id;

      if coalesce(v_duracao, 0) > 0 then
        v_assistidos := least(coalesce(v_assistidos, 0), v_duracao);
        v_pct := round(v_assistidos::numeric / v_duracao * 100);
        if v_assistidos < ceil(v_duracao * 0.7) then
          v_video_ok := false;
        end if;
      else
        -- duração ainda não populada pelo Panda: exige ter chegado ao fim (evento ended)
        v_pct := case when coalesce(v_terminou, false) then 100 else 0 end;
        v_video_ok := coalesce(v_terminou, false);
      end if;
    end if;

    select count(*) into v_total_mat
    from public.aula_materiais where aula_id = p_aula_id and arquivo_url is not null;

    if v_total_mat > 0 then
      select coalesce(jsonb_agg(jsonb_build_object('id', am.id, 'nome', am.nome) order by am.ordem), '[]'::jsonb)
      into v_materiais_pendentes
      from public.aula_materiais am
      where am.aula_id = p_aula_id and am.arquivo_url is not null
        and not exists (
          select 1 from public.material_downloads md
          where md.material_id = am.id and md.usuario_id = v_uid
        );
    else
      v_materiais_pendentes := '[]'::jsonb;
    end if;

    if not v_video_ok or jsonb_array_length(v_materiais_pendentes) > 0 then
      return jsonb_build_object(
        'ok', false,
        'video_ok', v_video_ok,
        'video_pct', coalesce(v_pct, 100),
        'materiais_pendentes', v_materiais_pendentes
      );
    end if;
  end if;

  perform set_config('app.conclusao_validada', 'on', true);
  insert into public.aula_progresso (usuario_id, aula_id, concluida, concluida_em)
  values (v_uid, p_aula_id, true, now())
  on conflict (usuario_id, aula_id) do update
    set concluida = true, concluida_em = now();

  return jsonb_build_object('ok', true);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.submeter_avaliacao(p_avaliacao uuid, p_respostas jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_pend jsonb;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para enviar a avaliação.';
  end if;

  select * into v_av from avaliacoes where id = p_avaliacao and publicado;
  if not found then
    raise exception 'Avaliação não encontrada.';
  end if;

  -- gate de sequência: a prova não pula as aulas, do mesmo jeito que as aulas
  -- não pulam a prova. Sem isso, o link direto da avaliação (que é público pra
  -- quem tem acesso ao curso) abriria a prova de um curso nunca assistido.
  if not public.is_admin_papel(v_user) then
    v_pend := public.progresso_pendencia(v_user, v_av.curso_id, p_avaliacao);
    if coalesce((v_pend->>'bloqueado')::boolean, false) then
      raise exception 'Esta avaliação ainda não está liberada. Antes dela: %', v_pend->>'titulo';
    end if;
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
$function$
;

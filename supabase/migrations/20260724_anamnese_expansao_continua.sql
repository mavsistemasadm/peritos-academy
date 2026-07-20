-- Causa raiz do "rota prescrita fechou mais curta que o esperado": o loop
-- de expansão de anamnese_gerar_prescricao() tentava a próxima trilha por
-- votos, e se ELA sozinha estourasse a meta de 12 meses, desistia de vez
-- (`exit`) mesmo havendo outras candidatas mais baratas na lista (por votos
-- desc) que poderiam caber no orçamento restante. Troca por `continue`:
-- descarta só a candidata que não coube e segue tentando as próximas, até
-- o teto_expandido ou esgotar candidatos. Não mexe em nada da ordem/peso
-- de votação nem da regra de âncora/iniciante — só a decisão de "desistir
-- vs. tentar a próxima" dentro do fallback de expansão.
CREATE OR REPLACE FUNCTION public.anamnese_gerar_prescricao()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  if v_regra_iniciante then
    insert into public.plano_trilhas (plano_id, usuario_id, trilha_id, ordem, votos, forcada_regra_iniciante)
    values (v_plano_id, v_usuario, v_for_trilha_id, v_ordem, coalesce((select votos from tmp_votos where trilha_id = v_for_trilha_id), 0), true);
    v_ordem := v_ordem + 1;
    v_ja_tem_for := true;
  end if;

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
        -- essa candidata sozinha estourou a meta — descarta só ela e
        -- segue tentando a próxima (por votos desc), em vez de desistir
        -- da expansão inteira. Antes: `exit` aqui podia deixar a rota um
        -- território mais curta do que devia sempre que a MAIOR votada
        -- entre as remanescentes fosse cara, mesmo com outra mais barata
        -- logo atrás na fila.
        delete from public.plano_trilhas where plano_id = v_plano_id and trilha_id = v_candidato.trilha_id;
        perform public.anamnese_calcular_cronograma();
        select meses_totais into v_meses_atual from public.planos where id = v_plano_id;
        continue;
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

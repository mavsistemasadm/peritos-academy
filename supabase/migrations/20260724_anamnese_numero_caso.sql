-- Número de caso real e sequencial da Rota do Perito. "CASO 0000" na
-- datilografia/carimbo era placeholder. Decisão: coluna em `perfis`, não em
-- `planos` — o caso é da PESSOA, não do plano (refazer a rota gera um plano
-- novo, mas nunca um segundo número para o mesmo usuário). Sequence
-- dedicada (mesmo padrão de seq_certificado_numero), formato 4 dígitos
-- (0001, 0002, ...) formatado no client a partir do inteiro puro.

create sequence if not exists public.seq_numero_caso;

alter table public.perfis add column if not exists numero_caso integer;

drop index if exists public.ux_perfis_numero_caso;
create unique index ux_perfis_numero_caso on public.perfis (numero_caso) where numero_caso is not null;

-- Atribuição idempotente dentro do próprio chokepoint que já gera a rota:
-- só atribui se o usuário ainda não tem número, então refazer a anamnese
-- (que chama esta mesma função de novo) nunca gera um segundo número.
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
  v_numero_caso int;
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

  select numero_caso into v_numero_caso from public.perfis where id = v_usuario;
  if v_numero_caso is null then
    v_numero_caso := nextval('public.seq_numero_caso');
    update public.perfis set numero_caso = v_numero_caso where id = v_usuario;
  end if;

  return jsonb_build_object(
    'ok', true, 'plano_id', v_plano_id, 'avatar', v_avatar,
    'regra_iniciante_aplicada', v_regra_iniciante,
    'ancora_especialidade_aplicada', v_ja_tem_ancora_esp,
    'expansao_aplicada', v_expandiu,
    'numero_caso', v_numero_caso
  );
end;
$function$;

-- Texto do selo do carimbo passa a interpolar o número real do caso
-- (era "CASO 0000" fixo).
update public.anamnese_textos_gerais
set texto = 'CASO {numero} · ROTA TRAÇADA'
where chave = 'microcopy_selo_dossie';

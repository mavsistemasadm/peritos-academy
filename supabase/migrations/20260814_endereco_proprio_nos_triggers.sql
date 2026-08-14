-- 20260814_endereco_proprio_nos_triggers.sql
--
-- O ENDEREÇO DA PLATAFORMA DENTRO DO BANCO.
--
-- Quatro funções mandam `net.http_post` para `/api/internal/email-evento` — é
-- assim que Postgres avisa a aplicação que precisa sair email, já que trigger
-- não fala HTTPS por conta própria e nenhum ponto de TS único intercepta os
-- três caminhos (nível, boas-vindas, certificado). O endereço estava cravado
-- dentro do corpo de cada uma, apontando para `peritos-academy.vercel.app`.
--
-- A plataforma ganhou domínio próprio em 14/08/2026,
-- `evolua.peritosacademy.com.br`, e o resto do repositório passou a ler
-- `SITE_URL` de `lib/site.ts`. Estas quatro são o que a constante do TS não
-- alcança: elas vivem no banco.
--
-- ⚠️ O `.vercel.app` ainda responde, então isto não conserta nada que esteja
-- quebrado hoje. Conserta o dia em que ele parar de responder — e aquele dia
-- não daria erro em lugar nenhum: o `net.http_post` é assíncrono e ninguém
-- espera a resposta dele. O sintoma seria o email simplesmente não sair, sem
-- log, sem alerta e sem nada na tela.
--
-- Os corpos abaixo NÃO foram redigitados: são o `pg_get_functiondef` de cada
-- função lido do banco em 14/08/2026, com a URL — e só a URL — substituída.
-- Redigitar arriscaria descolar o repositório do que roda de verdade, e é
-- exatamente esse descolamento que faz uma migração parecer explicar um
-- comportamento que ela não produz mais.

-- public.creditar_gamificacao — 1 ocorrência(s)
CREATE OR REPLACE FUNCTION public.creditar_gamificacao(p_usuario uuid, p_codigo text, p_referencia_tipo text DEFAULT NULL::text, p_referencia_id uuid DEFAULT NULL::uuid, p_pontos_override integer DEFAULT NULL::integer, p_moedas_override integer DEFAULT NULL::integer, p_pular_idempotencia boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        url := 'https://evolua.peritosacademy.com.br/api/internal/email-evento',
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
$function$
;

-- public.criar_perfil — 1 ocorrência(s)
CREATE OR REPLACE FUNCTION public.criar_perfil()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_nome text := coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1));
  v_slug text := public.slug_livre(v_nome);
begin
  -- ⚠️ O insert é protegido contra corrida. Duas contas criadas no mesmo
  -- instante podem calcular o mesmo slug antes de qualquer uma gravar, e aí o
  -- índice único derrubaria a SEGUNDA — ou seja, o cadastro falharia por causa
  -- de um endereço público. Sufixo aleatório e segue: entrar na plataforma vale
  -- mais que um slug bonito.
  begin
    insert into public.perfis (id, nome, slug)
    values (new.id, v_nome, v_slug)
    on conflict (id) do nothing;
  exception when unique_violation then
    insert into public.perfis (id, nome, slug)
    values (new.id, v_nome, public.slugificar_nome(v_nome) || '-' || left(md5(random()::text), 6))
    on conflict (id) do nothing;
  end;

  -- Importação em lote: a comunicação é feita à parte, com texto próprio.
  -- NÃO REMOVER sem antes conferir scripts/migration/README.md — é o que
  -- segura o e-mail de boas-vindas dos alunos migrados.
  if new.raw_user_meta_data ? 'migrado_de' then
    return new;
  end if;

  perform net.http_post(
    url := 'https://evolua.peritosacademy.com.br/api/internal/email-evento',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || public.email_internal_secret()
    ),
    body := jsonb_build_object('tipo', 'boas_vindas', 'usuario_id', new.id)
  );

  return new;
end;
$function$
;

-- public.gam_trg_certificados — 1 ocorrência(s)
CREATE OR REPLACE FUNCTION public.gam_trg_certificados()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_emite boolean;
  v_total_aulas int;
begin
  if new.numero is not null and new.emitido_em is not null
     and new.usuario_id is not null
     and (tg_op = 'INSERT' or old.numero is null or old.numero is distinct from new.numero) then
    perform public.creditar_gamificacao(new.usuario_id, 'certificado', 'certificado', new.id);

    perform public.notificar(
      new.usuario_id, 'certificado_disponivel',
      'Seu certificado do curso ', coalesce(new.curso_titulo, ''), ' já está disponível',
      '/perfil#certificados', 'certificado',
      jsonb_build_object('certificado_id', new.id, 'curso_id', new.curso_id, 'numero', new.numero),
      false
    );

    select emite_certificado into v_emite from public.cursos where id = new.curso_id;
    select count(*) into v_total_aulas
    from public.aulas a join public.modulos m on m.id = a.modulo_id
    where m.curso_id = new.curso_id;

    if coalesce(v_emite, false) and v_total_aulas > 10 then
      perform net.http_post(
        url := 'https://evolua.peritosacademy.com.br/api/internal/email-evento',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || public.email_internal_secret()
        ),
        body := jsonb_build_object('tipo', 'certificado', 'usuario_id', new.usuario_id, 'ref_id', new.curso_id)
      );
    end if;
  end if;
  return new;
end;
$function$
;

-- public.gam_verificar_progresso_curso — 1 ocorrência(s)
CREATE OR REPLACE FUNCTION public.gam_verificar_progresso_curso(p_usuario uuid, p_curso_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    perform net.http_post(
      url := 'https://evolua.peritosacademy.com.br/api/internal/email-evento',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || public.email_internal_secret()
      ),
      body := jsonb_build_object('tipo', 'curso_concluido', 'usuario_id', p_usuario, 'ref_id', p_curso_id::text)
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
$function$
;

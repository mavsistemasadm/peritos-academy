-- Email "curso concluído": não existia nenhum net.http_post aqui antes, só
-- a notificação in-app. Adiciona o hook de email em gam_verificar_progresso_curso
-- e uma nova função gam_proximo_curso_trilha para indicar o próximo curso da
-- mesma trilha na ordem editorial (curso_trilha.ordem), ou o primeiro curso
-- da trilha seguinte (trilhas.ordem) se a trilha atual já acabou.

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

    perform net.http_post(
      url := 'https://peritos-academy.vercel.app/api/internal/email-evento',
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
$function$;

create or replace function public.gam_proximo_curso_trilha(p_curso_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_trilha_slug text;
  v_ordem_atual int;
  v_trilha_ordem int;
  v_resultado record;
begin
  select ct.trilha_slug, ct.ordem into v_trilha_slug, v_ordem_atual
  from public.curso_trilha ct where ct.curso_id = p_curso_id;

  if v_trilha_slug is null then
    return null;
  end if;

  -- Próximo curso na mesma trilha.
  select c.id, c.titulo, c.slug, coalesce(c.capa_horizontal_url, c.capa_url) as capa_url
  into v_resultado
  from public.curso_trilha ct
  join public.cursos c on c.id = ct.curso_id
  where ct.trilha_slug = v_trilha_slug and ct.ordem > v_ordem_atual and c.publicado = true
  order by ct.ordem asc
  limit 1;

  if found then
    return jsonb_build_object('curso_id', v_resultado.id, 'titulo', v_resultado.titulo, 'slug', v_resultado.slug, 'capa_url', v_resultado.capa_url, 'mesma_trilha', true);
  end if;

  -- Trilha acabou: primeiro curso da trilha seguinte.
  select ordem into v_trilha_ordem from public.trilhas where slug = v_trilha_slug;
  if v_trilha_ordem is null then
    return null;
  end if;

  select c.id, c.titulo, c.slug, coalesce(c.capa_horizontal_url, c.capa_url) as capa_url
  into v_resultado
  from public.trilhas t
  join public.curso_trilha ct on ct.trilha_slug = t.slug
  join public.cursos c on c.id = ct.curso_id
  where t.ordem > v_trilha_ordem and c.publicado = true
  order by t.ordem asc, ct.ordem asc
  limit 1;

  if found then
    return jsonb_build_object('curso_id', v_resultado.id, 'titulo', v_resultado.titulo, 'slug', v_resultado.slug, 'capa_url', v_resultado.capa_url, 'mesma_trilha', false);
  end if;

  return null;
end;
$function$;

revoke execute on function public.gam_proximo_curso_trilha(uuid) from authenticated, anon;

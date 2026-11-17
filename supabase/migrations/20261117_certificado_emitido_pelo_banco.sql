-- 20261117_certificado_emitido_pelo_banco.sql
--
-- Terminou o curso, sai o certificado. A emissão deixou de depender da tela.
--
-- Antes: o certificado só nascia em lib/certificados/gerar.ts, chamado pelo
-- AulaContent depois do clique em "Marcar como concluída". Curso cujo último
-- item é uma AVALIAÇÃO (a aula de correção vem antes da prova final do módulo,
-- ver "A avaliação é um item da jornada") fechava na aprovação, e a página da
-- avaliação nunca chamava a emissão: curso completo, XP de conclusão creditado,
-- e nenhum certificado. Mais 83 conclusões de antes de 10/09/2026, quando a
-- emissão automática ainda não funcionava.
--
-- Agora: gam_verificar_progresso_curso (chamada pelo trigger de aula_progresso
-- E por submeter_avaliacao) emite o certificado assim que gam_curso_completo
-- vira verdade. O TS continua existindo só para abrir o popup na tela.

create or replace function public.emitir_certificado_interno(p_usuario uuid, p_curso_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_curso record;
  v_nota numeric;
  v_agora timestamptz := now();
  v_local timestamp := now() at time zone 'America/Sao_Paulo';
  v_meses text[] := array['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  v_numero text;
  v_id uuid;
begin
  if p_usuario is null or p_curso_id is null then return null; end if;

  select id, titulo, slug, emite_certificado, carga_horas into v_curso
  from public.cursos where id = p_curso_id;
  if not found or not coalesce(v_curso.emite_certificado, false) then return null; end if;

  -- já emitido: nada a fazer (unique usuario+curso garante o resto)
  if exists (select 1 from public.certificados
             where usuario_id = p_usuario and curso_id = p_curso_id and numero is not null) then
    return null;
  end if;

  if not public.gam_curso_completo(p_usuario, p_curso_id) then return null; end if;

  -- nota = média da melhor tentativa de cada avaliação do curso (mesma conta de gerar.ts)
  select round(avg(melhor)::numeric, 1) into v_nota
  from (
    select max(t.nota) melhor
    from public.avaliacoes av
    join public.avaliacao_tentativas t on t.avaliacao_id = av.id and t.usuario_id = p_usuario
    where av.curso_id = p_curso_id
    group by av.id
  ) s;

  v_numero := 'PA-' || extract(year from v_local)::int || '-' || lpad(public.nextval_certificado()::text, 5, '0');

  insert into public.certificados
    (usuario_id, curso_id, curso_titulo, curso_slug, numero, nota, carga_horas,
     emitido_em, emitido_rotulo, progresso_pct)
  values
    (p_usuario, p_curso_id, v_curso.titulo, v_curso.slug, v_numero, v_nota,
     round(v_curso.carga_horas)::int, v_agora,
     v_meses[extract(month from v_local)::int] || ' de ' || extract(year from v_local)::int, 100)
  on conflict (usuario_id, curso_id) do update
    set numero = excluded.numero, nota = excluded.nota, carga_horas = excluded.carga_horas,
        curso_titulo = excluded.curso_titulo, curso_slug = excluded.curso_slug,
        emitido_em = excluded.emitido_em, emitido_rotulo = excluded.emitido_rotulo,
        progresso_pct = 100
    where public.certificados.numero is null
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.emitir_certificado_interno(uuid, uuid) from public, authenticated, anon;

-- Corpo vivo de gam_verificar_progresso_curso (pg_get_functiondef em 17/11/2026),
-- com UMA linha a mais: a emissão, logo depois da checagem de curso completo e
-- antes do crédito de XP (que só roda uma vez; a emissão precisa rodar mesmo
-- para quem já recebeu o XP de conclusão e ficou sem certificado).
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

  perform public.emitir_certificado_interno(p_usuario, p_curso_id);

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
$function$;

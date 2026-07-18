-- ============================================================
-- Parte A da tarefa "motor de conclusão + página de detalhe": ajustes ao
-- motor de conclusão de aula já existente (ver 20260714_progressao_sequencial.sql
-- e a seção "Progressão sequencial de aulas" do CLAUDE.md).
--
-- O motor (RPC concluir_aula, trigger de proteção, aula_progresso,
-- material_downloads) já implementava quase toda a regra pedida. Dois
-- ajustes reais:
--
-- 1. aula_progresso.video_terminou: fallback pra aulas.duracao_seg nulo/0
--    (Panda ainda não populou a duração — tarefa pendente à parte). Antes o
--    RPC pulava o requisito de vídeo inteiramente nesse caso; agora exige
--    ter chegado no evento "ended" pelo menos uma vez.
-- 2. concluir_aula() atualizada pra checar video_terminou nesse fallback.
--    Resto da função (trava sequencial, 70%, materiais, idempotência,
--    bypass de admin) inalterado.
-- ============================================================

alter table public.aula_progresso
  add column if not exists video_terminou boolean not null default false;

create or replace function public.concluir_aula(p_aula_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    select a2.id, a2.modulo_id into v_aula_anterior_id, v_aula_anterior_modulo_id
    from public.aulas a2 join public.modulos m2 on m2.id = a2.modulo_id
    where m2.curso_id = v_curso_id
      and (m2.ordem, a2.ordem) < (v_modulo_ordem, v_aula_ordem)
    order by m2.ordem desc, a2.ordem desc
    limit 1;

    if v_aula_anterior_id is not null then
      select coalesce(concluida, false) into v_anterior_concluida
      from public.aula_progresso where usuario_id = v_uid and aula_id = v_aula_anterior_id;

      if not coalesce(v_anterior_concluida, false) then
        return jsonb_build_object('ok', false, 'bloqueada_sequencia', true, 'erro', 'Conclua a aula anterior primeiro.');
      end if;

      if v_aula_anterior_modulo_id <> v_modulo_id and exists (
        select 1 from public.avaliacoes av
        where av.modulo_id = v_aula_anterior_modulo_id and av.tipo = 'avaliacao' and av.publicado = true
          and not exists (
            select 1 from public.avaliacao_tentativas t
            where t.avaliacao_id = av.id and t.usuario_id = v_uid and t.aprovado = true
          )
      ) then
        return jsonb_build_object('ok', false, 'bloqueada_sequencia', true, 'erro', 'Conclua a avaliação do módulo anterior primeiro.');
      end if;
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
$function$;

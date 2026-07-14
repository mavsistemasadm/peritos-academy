-- concluir_aula() validava só os critérios PRÓPRIOS da aula (vídeo/materiais), mas não
-- a trava SEQUENCIAL em si — isso deixava uma aula sem vídeo/materiais (critérios
-- triviais) concluível via chamada direta de supabase.rpc('concluir_aula', ...) pulando
-- aulas anteriores não concluídas, mesmo que a navegação até ela fosse bloqueada pela
-- page.tsx. Corrigido: a trava sequencial + gate de avaliação de módulo agora também
-- é verificada dentro da própria RPC (defesa em profundidade, não só no redirect da página).
-- Rodado via Supabase MCP (ver CLAUDE.md — fluxo de trabalho).
create or replace function public.concluir_aula(p_aula_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_modulo_id uuid;
  v_modulo_ordem int;
  v_aula_ordem int;
  v_curso_id uuid;
  v_video_url text;
  v_duracao integer;
  v_assistidos integer;
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
    -- trava sequencial: aula anterior (mesmo curso, ordenada por módulo->aula) precisa
    -- estar concluída; se cruzar módulo, avaliações publicadas do módulo anterior
    -- precisam estar aprovadas.
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

    if v_video_url is not null and coalesce(v_duracao, 0) > 0 then
      select coalesce(segundos_assistidos, 0) into v_assistidos
      from public.aula_progresso where usuario_id = v_uid and aula_id = p_aula_id;
      v_assistidos := least(coalesce(v_assistidos, 0), v_duracao);
      v_pct := round(v_assistidos::numeric / v_duracao * 100);
      if v_assistidos < ceil(v_duracao * 0.7) then
        v_video_ok := false;
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
$$;

-- mesma pegadinha já documentada no CLAUDE.md pra notificar(): revoke de PUBLIC
-- sozinho não basta, o Supabase concede EXECUTE direto pra anon/authenticated via
-- alter default privileges em toda função nova. Precisa nomear os papéis.
revoke execute on function public.concluir_aula(uuid) from anon;
revoke execute on function public.concluir_aula(uuid) from public;
grant execute on function public.concluir_aula(uuid) to authenticated;

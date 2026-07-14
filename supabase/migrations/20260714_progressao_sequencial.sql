-- Progressão sequencial de aulas com critérios de conclusão (vídeo >=70% + todos os
-- materiais baixados) e trava de módulo por avaliação aprovada.
-- Rodado via Supabase MCP (ver CLAUDE.md — fluxo de trabalho).
--
-- Contexto: aula_progresso.concluida tinha default `true` (era um vestígio do modelo
-- "linha existe = concluída"). Isso quebraria a nova feature: agora a linha passa a
-- existir também para progresso PARCIAL (segundos assistidos), então o default precisa
-- virar `false`. Todo código de leitura já filtra .eq('concluida', true) explicitamente
-- (conferido em toda a base — home.ts, jornada.ts, cursos-biblioteca.ts, crons de email,
-- admin_usuario_ficha), com uma única exceção corrigida em paralelo no TS:
-- lib/queries/aula.ts lia só a existência da linha.

-- ---------- aula_progresso: tempo assistido + concluida agora é escrita protegida ----------
alter table public.aula_progresso add column if not exists segundos_assistidos integer not null default 0;
alter table public.aula_progresso alter column concluida set default false;
alter table public.aula_progresso alter column concluida_em drop default;
alter table public.aula_progresso alter column concluida_em drop not null;

-- Client grava segundos_assistidos direto (upsert, mesmo padrão de sempre), mas só a
-- RPC concluir_aula() pode setar concluida=true — mesmo padrão de trg_gam_proteger_perfis
-- (perfis.xp/moedas/nivel) usado em Gamificação.
create or replace function public.aula_progresso_proteger_conclusao()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.concluida is true and coalesce(current_setting('app.conclusao_validada', true), '') <> 'on' then
    if tg_op = 'UPDATE' then
      new.concluida := old.concluida;
      new.concluida_em := old.concluida_em;
    else
      new.concluida := false;
      new.concluida_em := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_aula_progresso_proteger_conclusao on public.aula_progresso;
create trigger trg_aula_progresso_proteger_conclusao
  before insert or update of concluida on public.aula_progresso
  for each row execute function public.aula_progresso_proteger_conclusao();

-- ---------- material_downloads: rastreio de download por aluno ----------
create table if not exists public.material_downloads (
  usuario_id uuid not null references auth.users(id) on delete cascade,
  material_id uuid not null references public.aula_materiais(id) on delete cascade,
  baixado_em timestamptz not null default now(),
  primary key (usuario_id, material_id)
);

alter table public.material_downloads enable row level security;

drop policy if exists material_downloads_do_dono on public.material_downloads;
create policy material_downloads_do_dono on public.material_downloads
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- ---------- RPC única de conclusão: valida critérios e credita concluida=true ----------
create or replace function public.concluir_aula(p_aula_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_video_url text;
  v_duracao integer;
  v_assistidos integer;
  v_pct numeric;
  v_video_ok boolean := true;
  v_ja_concluida boolean;
  v_total_mat integer;
  v_materiais_pendentes jsonb;
  v_is_admin boolean;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'erro', 'Faça login para concluir a aula.');
  end if;

  select video_url, duracao_seg into v_video_url, v_duracao
  from public.aulas where id = p_aula_id;
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

revoke all on function public.concluir_aula(uuid) from public;
grant execute on function public.concluir_aula(uuid) to authenticated;

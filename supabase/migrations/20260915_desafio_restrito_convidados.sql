-- Desafio restrito: só quem foi convidado pelo email vê, aceita e entrega.
--
-- Nasceu da seleção de peritos da MH Cálculos: o desafio não pode aparecer para
-- a base, e um candidato não pode ver a entrega do outro. Até aqui `desafios`
-- era legível por qualquer um (inclusive anon) quando publicado, as entregas
-- protocoladas eram legíveis por anon, e o bucket `planilhas` deixava qualquer
-- conta logada listar e baixar todos os arquivos de desafio, gabarito incluído.

alter table public.desafios
  add column if not exists restrito boolean not null default false;

create table if not exists public.desafio_convidados (
  desafio_id uuid not null references public.desafios(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  convidado_em timestamptz not null default now(),
  convidado_por uuid references auth.users(id) on delete set null,
  primary key (desafio_id, usuario_id)
);

alter table public.desafio_convidados enable row level security;

-- o convidado enxerga o próprio convite (é o que a policy de `desafios` consulta);
-- escrita e listagem completa só pelas RPCs adm_* abaixo
drop policy if exists desafio_convidados_proprio on public.desafio_convidados;
create policy desafio_convidados_proprio on public.desafio_convidados
  for select using (usuario_id = auth.uid());

-- ---------- quem enxerga o desafio ----------
-- Uma regra só para anon, aluno e candidato. Admin continua com desafios_admin_select.
drop policy if exists desafios_publico on public.desafios;
drop policy if exists desafios_leitura on public.desafios;
create policy desafios_leitura on public.desafios
  for select using (
    publicado = true
    and (
      restrito = false
      or exists (
        select 1 from public.desafio_convidados c
        where c.desafio_id = desafios.id and c.usuario_id = auth.uid()
      )
    )
  );

-- ---------- entregas ----------
-- Própria entrega sempre; admin tudo; a dos outros só em desafio não restrito.
-- A subconsulta em `desafios` passa pela RLS dele, então herda publicado/convite.
drop policy if exists entregas_publico on public.desafio_entregas;
drop policy if exists entregas_select on public.desafio_entregas;
create policy entregas_select on public.desafio_entregas
  for select using (
    usuario_id = auth.uid()
    or public.is_admin_papel(auth.uid(), array['super_admin', 'conteudo'])
    or (
      (entregue_em is not null or auth.uid() is not null)
      and exists (
        select 1 from public.desafios d
        where d.id = desafio_entregas.desafio_id and d.restrito = false
      )
    )
  );

-- Aceitar e entregar exige enxergar o desafio: sem convite, não há como criar a
-- linha nem pelo console; convite removido trava o protocolo de quem já aceitou.
drop policy if exists entregas_insert on public.desafio_entregas;
create policy entregas_insert on public.desafio_entregas
  for insert with check (
    usuario_id = auth.uid()
    and exists (select 1 from public.desafios d where d.id = desafio_entregas.desafio_id)
  );

drop policy if exists entregas_update on public.desafio_entregas;
create policy entregas_update on public.desafio_entregas
  for update using (
    usuario_id = auth.uid()
    and exists (select 1 from public.desafios d where d.id = desafio_entregas.desafio_id)
  );

-- ---------- arquivos de desafio no bucket `planilhas` ----------
-- A leitura geral continua para o resto do bucket (biblioteca, perfis) e deixa de
-- valer para `desafios/`, que ganha regra própria.
drop policy if exists planilhas_leitura_autenticado on storage.objects;
create policy planilhas_leitura_autenticado on storage.objects
  for select using (
    bucket_id = 'planilhas'
    and auth.uid() is not null
    and name not like 'desafios/%'
  );

drop policy if exists planilhas_desafios_leitura on storage.objects;
create policy planilhas_desafios_leitura on storage.objects
  for select using (
    bucket_id = 'planilhas'
    and name like 'desafios/%'
    and (
      public.is_admin_papel(auth.uid(), array['super_admin', 'conteudo'])
      -- a própria entrega
      or name like 'desafios/%/entregas/' || auth.uid()::text || '/%'
      -- documentos do processo: de desafio que a pessoa enxerga
      or (
        name like 'desafios/%/documentos/%'
        and exists (select 1 from public.desafios d where d.numero = split_part(name, '/', 2))
      )
      -- gabarito: só depois de protocolar
      or (
        name like 'desafios/%/gabarito.%'
        and exists (
          select 1 from public.desafios d
          join public.desafio_entregas e on e.desafio_id = d.id
          where d.numero = split_part(name, '/', 2)
            and e.usuario_id = auth.uid()
            and e.entregue_em is not null
        )
      )
    )
  );

-- ---------- RPCs do admin ----------

create or replace function public.adm_convidar_desafio(p_desafio_id uuid, p_emails text[])
returns table (email text, situacao text, nome text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_uid uuid;
  v_nome text;
  v_titulo text;
  v_slug text;
  v_publicado boolean;
  v_novo boolean;
begin
  if not public.is_admin_papel(auth.uid(), array['super_admin', 'conteudo']) then
    raise exception 'Sem permissão.';
  end if;

  select d.titulo, d.slug, d.publicado into v_titulo, v_slug, v_publicado
  from public.desafios d where d.id = p_desafio_id;
  if not found then
    raise exception 'Desafio não encontrado.';
  end if;

  foreach v_email in array p_emails loop
    v_email := lower(trim(v_email));
    continue when v_email = '';

    select u.id, p.nome into v_uid, v_nome
    from auth.users u
    left join public.perfis p on p.id = u.id
    where lower(u.email) = v_email
    limit 1;

    if v_uid is null then
      email := v_email; situacao := 'sem_conta'; nome := null;
      return next;
      continue;
    end if;

    insert into public.desafio_convidados (desafio_id, usuario_id, convidado_por)
    values (p_desafio_id, v_uid, auth.uid())
    on conflict do nothing;
    v_novo := found;

    -- sino só quando o link já abre; convidado antes de publicar não é avisado
    if v_novo and v_publicado then
      perform public.notificar(
        v_uid, 'desafio_convite',
        'Você foi convidado para o desafio ', coalesce(v_titulo, ''), '',
        '/desafios/' || v_slug, null,
        jsonb_build_object('desafio_id', p_desafio_id), false
      );
    end if;

    email := v_email;
    situacao := case when v_novo then 'convidado' else 'ja_convidado' end;
    nome := v_nome;
    return next;
  end loop;
end;
$$;

create or replace function public.adm_listar_convidados_desafio(p_desafio_id uuid)
returns table (usuario_id uuid, nome text, email text, convidado_em timestamptz, aceitou boolean, entregou boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_papel(auth.uid(), array['super_admin', 'conteudo']) then
    raise exception 'Sem permissão.';
  end if;

  return query
  select c.usuario_id, p.nome, u.email::text, c.convidado_em,
         (e.aceito_em is not null), (e.entregue_em is not null)
  from public.desafio_convidados c
  join auth.users u on u.id = c.usuario_id
  left join public.perfis p on p.id = c.usuario_id
  left join public.desafio_entregas e on e.desafio_id = c.desafio_id and e.usuario_id = c.usuario_id
  where c.desafio_id = p_desafio_id
  order by p.nome nulls last, u.email;
end;
$$;

create or replace function public.adm_remover_convidado_desafio(p_desafio_id uuid, p_usuario_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_papel(auth.uid(), array['super_admin', 'conteudo']) then
    raise exception 'Sem permissão.';
  end if;
  delete from public.desafio_convidados
  where desafio_id = p_desafio_id and usuario_id = p_usuario_id;
end;
$$;

revoke execute on function public.adm_convidar_desafio(uuid, text[]) from public, anon;
revoke execute on function public.adm_listar_convidados_desafio(uuid) from public, anon;
revoke execute on function public.adm_remover_convidado_desafio(uuid, uuid) from public, anon;
grant execute on function public.adm_convidar_desafio(uuid, text[]) to authenticated;
grant execute on function public.adm_listar_convidados_desafio(uuid) to authenticated;
grant execute on function public.adm_remover_convidado_desafio(uuid, uuid) to authenticated;

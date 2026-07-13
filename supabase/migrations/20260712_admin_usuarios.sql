-- ============================================================
-- ADMIN: base de acesso e papéis (Super Admin, Conteúdo, Financeiro, Moderador)
-- Rodado manualmente no Supabase SQL Editor (ver CLAUDE.md — fluxo de trabalho).
-- ============================================================

create table if not exists public.admin_usuarios (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfis(id) on delete cascade,
  papel text not null check (papel in ('super_admin','conteudo','financeiro','moderador')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  criado_por uuid references public.perfis(id),
  atualizado_em timestamptz not null default now(),
  unique (usuario_id, papel)
);

create index if not exists idx_admin_usuarios_usuario on public.admin_usuarios(usuario_id);

alter table public.admin_usuarios enable row level security;

create or replace function public.is_admin_papel(uid uuid, papeis text[] default null)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.admin_usuarios a
    where a.usuario_id = uid
      and a.ativo = true
      and (papeis is null or a.papel = any(papeis))
  );
$$;

grant execute on function public.is_admin_papel(uuid, text[]) to authenticated;

drop policy if exists admin_usuarios_select on public.admin_usuarios;
create policy admin_usuarios_select on public.admin_usuarios
  for select using (
    usuario_id = auth.uid()
    or public.is_admin_papel(auth.uid(), array['super_admin'])
  );

drop policy if exists admin_usuarios_insert on public.admin_usuarios;
create policy admin_usuarios_insert on public.admin_usuarios
  for insert with check ( public.is_admin_papel(auth.uid(), array['super_admin']) );

drop policy if exists admin_usuarios_update on public.admin_usuarios;
create policy admin_usuarios_update on public.admin_usuarios
  for update
  using ( public.is_admin_papel(auth.uid(), array['super_admin']) )
  with check ( public.is_admin_papel(auth.uid(), array['super_admin']) );

drop policy if exists admin_usuarios_delete on public.admin_usuarios;
create policy admin_usuarios_delete on public.admin_usuarios
  for delete using ( public.is_admin_papel(auth.uid(), array['super_admin']) );

create or replace function public.tg_admin_usuarios_atualizado_em()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists trg_admin_usuarios_atualizado_em on public.admin_usuarios;
create trigger trg_admin_usuarios_atualizado_em
  before update on public.admin_usuarios
  for each row execute function public.tg_admin_usuarios_atualizado_em();

-- Seed do primeiro Super Admin — ajustar o e-mail antes de rodar.
-- insert into public.admin_usuarios (usuario_id, papel, ativo)
-- select p.id, 'super_admin', true
-- from public.perfis p
-- join auth.users u on u.id = p.id
-- where u.email = 'SEU_EMAIL_AQUI'
-- on conflict (usuario_id, papel) do update set ativo = true, atualizado_em = now();

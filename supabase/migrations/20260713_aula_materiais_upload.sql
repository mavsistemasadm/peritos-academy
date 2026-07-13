-- ============================================================
-- MATERIAIS COMPLEMENTARES: aula_materiais já existia (metadados apenas,
-- arquivo_url sempre nulo no seed — nunca teve upload real de verdade,
-- só um link colado à mão). Esta migração: (1) estende o schema pra
-- suportar upload real com tamanho e data, (2) aperta a RLS de leitura
-- pro mesmo gate de assinatura do conteúdo pago (tem_acesso_ativo) em vez
-- de leitura pública, (3) cria o bucket privado 'materiais-aulas' com
-- policies de storage — download só via URL assinada (ver app/curso
-- actions, mesmo padrão de app/biblioteca/actions.ts com bucket 'planilhas').
-- Rodado via Supabase MCP (ver CLAUDE.md — fluxo de trabalho).
-- ============================================================

-- ---------- Extensão de schema ----------
-- Já existia um check constraint antigo (tipo in ('pdf','xls')), criado fora
-- das migrações rastreadas — precisa cair ANTES do update pra 'xlsx' não
-- violar o check velho.
alter table public.aula_materiais drop constraint if exists aula_materiais_tipo_check;

-- Normaliza o valor legado 'xls' pro novo conjunto antes de recriar o check.
update public.aula_materiais set tipo = 'xlsx' where tipo = 'xls';

alter table public.aula_materiais add constraint aula_materiais_tipo_check
  check (tipo in ('pdf','xlsx','docx','zip','outro'));

alter table public.aula_materiais add column if not exists tamanho_bytes bigint;
alter table public.aula_materiais add column if not exists criado_em timestamptz not null default now();

-- ---------- RLS da tabela: aperta de leitura pública pro gate de acesso ----------
-- Antes: `materiais_leitura_publica` (qual = true) — qualquer um, inclusive
-- anon, via a metadata. Item explícito da spec: mesmo gate de tem_acesso_ativo
-- usado no conteúdo pago.
drop policy if exists materiais_leitura_publica on public.aula_materiais;
drop policy if exists aula_materiais_leitura on public.aula_materiais;
create policy aula_materiais_leitura on public.aula_materiais
  for select using (
    public.is_admin_papel(auth.uid(), array['super_admin','conteudo'])
    or public.tem_acesso_ativo(auth.uid())
  );

-- ---------- Bucket privado 'materiais-aulas' ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('materiais-aulas', 'materiais-aulas', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = 20971520;

-- Leitura: mesmo gate de tem_acesso_ativo (pra createSignedUrl funcionar
-- só pra quem tem assinatura ativa) + admin de conteúdo (gestão/preview).
drop policy if exists materiais_aulas_leitura on storage.objects;
create policy materiais_aulas_leitura on storage.objects
  for select using (
    bucket_id = 'materiais-aulas' and (
      public.is_admin_papel(auth.uid(), array['super_admin','conteudo'])
      or public.tem_acesso_ativo(auth.uid())
    )
  );

drop policy if exists materiais_aulas_admin_insert on storage.objects;
create policy materiais_aulas_admin_insert on storage.objects
  for insert with check (
    bucket_id = 'materiais-aulas' and public.is_admin_papel(auth.uid(), array['super_admin','conteudo'])
  );

drop policy if exists materiais_aulas_admin_update on storage.objects;
create policy materiais_aulas_admin_update on storage.objects
  for update
  using ( bucket_id = 'materiais-aulas' and public.is_admin_papel(auth.uid(), array['super_admin','conteudo']) )
  with check ( bucket_id = 'materiais-aulas' and public.is_admin_papel(auth.uid(), array['super_admin','conteudo']) );

drop policy if exists materiais_aulas_admin_delete on storage.objects;
create policy materiais_aulas_admin_delete on storage.objects
  for delete using (
    bucket_id = 'materiais-aulas' and public.is_admin_papel(auth.uid(), array['super_admin','conteudo'])
  );

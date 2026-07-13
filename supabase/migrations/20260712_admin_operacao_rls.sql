-- ============================================================
-- ADMIN: RLS de escrita para o Bloco 2 (Desafios, Certificados,
-- Comunidade, Agenda, Avisos/Novidades) + 3 correções de bugs
-- pré-existentes encontradas no caminho:
--   1) certificados sem policy de insert/update -> emissão
--      automática (lib/certificados/gerar.ts) falhava sob RLS.
--   2) bucket 'planilhas' sem nenhuma policy de storage -> upload
--      de foto de perfil e de planilha de desafio quebrados.
--   3) eventos_criar_logado permitia qualquer usuário logado criar
--      evento (não só admin) -> aperta pra admin-only.
-- ============================================================

-- ---------- RLS habilitado (defensivo) ----------
alter table public.desafios enable row level security;
alter table public.desafio_categorias enable row level security;
alter table public.comunidade_posts enable row level security;
alter table public.comunidade_comentarios enable row level security;
alter table public.aula_duvidas enable row level security;
alter table public.eventos enable row level security;
alter table public.novidades enable row level security;
alter table public.certificados enable row level security;

-- ---------- Colunas novas: fixar/destacar posts da comunidade ----------
alter table public.comunidade_posts add column if not exists fixado boolean not null default false;
alter table public.comunidade_posts add column if not exists destaque boolean not null default false;

-- ---------- Desafios + categorias: CRUD completo (super_admin, conteudo) ----------
do $$
declare
  tabela text;
  tabelas text[] := array['desafios','desafio_categorias'];
begin
  foreach tabela in array tabelas loop
    execute format('drop policy if exists %I_admin_insert on public.%I;', tabela, tabela);
    execute format(
      'create policy %I_admin_insert on public.%I for insert with check ( public.is_admin_papel(auth.uid(), array[''super_admin'',''conteudo'']) );',
      tabela, tabela
    );
    execute format('drop policy if exists %I_admin_update on public.%I;', tabela, tabela);
    execute format(
      'create policy %I_admin_update on public.%I for update using ( public.is_admin_papel(auth.uid(), array[''super_admin'',''conteudo'']) ) with check ( public.is_admin_papel(auth.uid(), array[''super_admin'',''conteudo'']) );',
      tabela, tabela
    );
    execute format('drop policy if exists %I_admin_delete on public.%I;', tabela, tabela);
    execute format(
      'create policy %I_admin_delete on public.%I for delete using ( public.is_admin_papel(auth.uid(), array[''super_admin'',''conteudo'']) );',
      tabela, tabela
    );
  end loop;
end $$;

-- ---------- Comunidade: moderação de posts/comentários (super_admin, moderador) ----------
-- (insert de autoria própria já existe e continua intacto)
do $$
declare
  tabela text;
  tabelas text[] := array['comunidade_posts','comunidade_comentarios'];
begin
  foreach tabela in array tabelas loop
    execute format('drop policy if exists %I_admin_update on public.%I;', tabela, tabela);
    execute format(
      'create policy %I_admin_update on public.%I for update using ( public.is_admin_papel(auth.uid(), array[''super_admin'',''moderador'']) ) with check ( public.is_admin_papel(auth.uid(), array[''super_admin'',''moderador'']) );',
      tabela, tabela
    );
    execute format('drop policy if exists %I_admin_delete on public.%I;', tabela, tabela);
    execute format(
      'create policy %I_admin_delete on public.%I for delete using ( public.is_admin_papel(auth.uid(), array[''super_admin'',''moderador'']) );',
      tabela, tabela
    );
  end loop;
end $$;

drop policy if exists aula_duvidas_admin_delete on public.aula_duvidas;
create policy aula_duvidas_admin_delete on public.aula_duvidas
  for delete using ( public.is_admin_papel(auth.uid(), array['super_admin','moderador']) );

-- ---------- Agenda: eventos (super_admin, moderador, conteudo) ----------
-- remove a policy antiga que liberava insert pra qualquer usuário logado
drop policy if exists eventos_criar_logado on public.eventos;

drop policy if exists eventos_admin_insert on public.eventos;
create policy eventos_admin_insert on public.eventos
  for insert with check ( public.is_admin_papel(auth.uid(), array['super_admin','moderador','conteudo']) );

drop policy if exists eventos_admin_update on public.eventos;
create policy eventos_admin_update on public.eventos
  for update
  using ( public.is_admin_papel(auth.uid(), array['super_admin','moderador','conteudo']) )
  with check ( public.is_admin_papel(auth.uid(), array['super_admin','moderador','conteudo']) );

drop policy if exists eventos_admin_delete on public.eventos;
create policy eventos_admin_delete on public.eventos
  for delete using ( public.is_admin_papel(auth.uid(), array['super_admin','moderador','conteudo']) );

-- ---------- Avisos/Novidades (super_admin, moderador) ----------
drop policy if exists novidades_admin_insert on public.novidades;
create policy novidades_admin_insert on public.novidades
  for insert with check ( public.is_admin_papel(auth.uid(), array['super_admin','moderador']) );

drop policy if exists novidades_admin_update on public.novidades;
create policy novidades_admin_update on public.novidades
  for update
  using ( public.is_admin_papel(auth.uid(), array['super_admin','moderador']) )
  with check ( public.is_admin_papel(auth.uid(), array['super_admin','moderador']) );

drop policy if exists novidades_admin_delete on public.novidades;
create policy novidades_admin_delete on public.novidades
  for delete using ( public.is_admin_papel(auth.uid(), array['super_admin','moderador']) );

-- ---------- Certificados: admin (revogar/reemitir) + fix da emissão automática ----------
drop policy if exists certificados_proprio_insert on public.certificados;
create policy certificados_proprio_insert on public.certificados
  for insert with check ( usuario_id = auth.uid() );

drop policy if exists certificados_proprio_update on public.certificados;
create policy certificados_proprio_update on public.certificados
  for update using ( usuario_id = auth.uid() ) with check ( usuario_id = auth.uid() );

drop policy if exists certificados_admin_insert on public.certificados;
create policy certificados_admin_insert on public.certificados
  for insert with check ( public.is_admin_papel(auth.uid(), array['super_admin','conteudo']) );

drop policy if exists certificados_admin_update on public.certificados;
create policy certificados_admin_update on public.certificados
  for update
  using ( public.is_admin_papel(auth.uid(), array['super_admin','conteudo']) )
  with check ( public.is_admin_papel(auth.uid(), array['super_admin','conteudo']) );

drop policy if exists certificados_admin_delete on public.certificados;
create policy certificados_admin_delete on public.certificados
  for delete using ( public.is_admin_papel(auth.uid(), array['super_admin','conteudo']) );

-- ---------- Fix: bucket 'planilhas' sem nenhuma policy de storage ----------
-- Leitura: qualquer autenticado (mesmo padrão já usado em desafio_entregas,
-- que expõe a galeria de entregas de outros alunos publicamente pra logados).
drop policy if exists planilhas_leitura_autenticado on storage.objects;
create policy planilhas_leitura_autenticado on storage.objects
  for select using ( bucket_id = 'planilhas' and auth.uid() is not null );

-- Escrita: só nos próprios caminhos (perfis/{uid}/... e desafios/*/entregas/{uid}/...)
drop policy if exists planilhas_escrita_propria on storage.objects;
create policy planilhas_escrita_propria on storage.objects
  for insert with check (
    bucket_id = 'planilhas' and (
      name like 'perfis/' || auth.uid()::text || '/%'
      or name like 'desafios/%/entregas/' || auth.uid()::text || '/%'
    )
  );

drop policy if exists planilhas_atualizacao_propria on storage.objects;
create policy planilhas_atualizacao_propria on storage.objects
  for update
  using (
    bucket_id = 'planilhas' and (
      name like 'perfis/' || auth.uid()::text || '/%'
      or name like 'desafios/%/entregas/' || auth.uid()::text || '/%'
    )
  )
  with check (
    bucket_id = 'planilhas' and (
      name like 'perfis/' || auth.uid()::text || '/%'
      or name like 'desafios/%/entregas/' || auth.uid()::text || '/%'
    )
  );

-- Admin (super_admin, conteudo) escreve em qualquer caminho do bucket
-- (documentos do processo e gabarito dos desafios).
drop policy if exists planilhas_admin_insert on storage.objects;
create policy planilhas_admin_insert on storage.objects
  for insert with check (
    bucket_id = 'planilhas' and public.is_admin_papel(auth.uid(), array['super_admin','conteudo'])
  );

drop policy if exists planilhas_admin_update on storage.objects;
create policy planilhas_admin_update on storage.objects
  for update
  using ( bucket_id = 'planilhas' and public.is_admin_papel(auth.uid(), array['super_admin','conteudo']) )
  with check ( bucket_id = 'planilhas' and public.is_admin_papel(auth.uid(), array['super_admin','conteudo']) );

drop policy if exists planilhas_admin_delete on storage.objects;
create policy planilhas_admin_delete on storage.objects
  for delete using (
    bucket_id = 'planilhas' and public.is_admin_papel(auth.uid(), array['super_admin','conteudo'])
  );

-- ============================================================
-- ADMIN: RLS de escrita para o Bloco 1 (Cursos, Módulos, Aulas,
-- Trilhas/Etapas, Avaliações/Questões) + bucket de capas.
-- Rodado manualmente no Supabase SQL Editor (ver CLAUDE.md — fluxo de trabalho).
-- ============================================================

-- ---------- Bucket de capas (curso, aula, avaliação) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('capas', 'capas', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists capas_leitura_publica on storage.objects;
create policy capas_leitura_publica on storage.objects
  for select using ( bucket_id = 'capas' );

drop policy if exists capas_admin_insert on storage.objects;
create policy capas_admin_insert on storage.objects
  for insert with check (
    bucket_id = 'capas'
    and public.is_admin_papel(auth.uid(), array['super_admin','conteudo'])
  );

drop policy if exists capas_admin_update on storage.objects;
create policy capas_admin_update on storage.objects
  for update
  using ( bucket_id = 'capas' and public.is_admin_papel(auth.uid(), array['super_admin','conteudo']) )
  with check ( bucket_id = 'capas' and public.is_admin_papel(auth.uid(), array['super_admin','conteudo']) );

drop policy if exists capas_admin_delete on storage.objects;
create policy capas_admin_delete on storage.objects
  for delete using (
    bucket_id = 'capas'
    and public.is_admin_papel(auth.uid(), array['super_admin','conteudo'])
  );

-- ---------- RLS: garantir habilitado nas tabelas de conteúdo ----------
alter table public.cursos enable row level security;
alter table public.modulos enable row level security;
alter table public.aulas enable row level security;
alter table public.aula_capitulos enable row level security;
alter table public.aula_materiais enable row level security;
alter table public.trilhas enable row level security;
alter table public.etapas enable row level security;
alter table public.etapa_missoes enable row level security;
alter table public.avaliacoes enable row level security;
alter table public.avaliacao_questoes enable row level security;
alter table public.avaliacao_opcoes enable row level security;

-- ---------- Leitura extra pra admin (rascunhos não publicados) ----------
drop policy if exists cursos_admin_select on public.cursos;
create policy cursos_admin_select on public.cursos
  for select using ( public.is_admin_papel(auth.uid(), array['super_admin','conteudo']) );

drop policy if exists avaliacoes_admin_select on public.avaliacoes;
create policy avaliacoes_admin_select on public.avaliacoes
  for select using ( public.is_admin_papel(auth.uid(), array['super_admin','conteudo']) );

-- avaliacao_questoes/avaliacao_opcoes hoje só são lidas via view pública
-- ou RPC (gabarito fica oculto). Admin de conteúdo precisa ver o gabarito.
drop policy if exists avaliacao_questoes_admin_select on public.avaliacao_questoes;
create policy avaliacao_questoes_admin_select on public.avaliacao_questoes
  for select using ( public.is_admin_papel(auth.uid(), array['super_admin','conteudo']) );

drop policy if exists avaliacao_opcoes_admin_select on public.avaliacao_opcoes;
create policy avaliacao_opcoes_admin_select on public.avaliacao_opcoes
  for select using ( public.is_admin_papel(auth.uid(), array['super_admin','conteudo']) );

-- ---------- Escrita (insert/update/delete) — só super_admin e conteudo ----------
do $$
declare
  tabela text;
  tabelas text[] := array[
    'cursos','modulos','aulas','aula_capitulos','aula_materiais',
    'trilhas','etapas','etapa_missoes',
    'avaliacoes','avaliacao_questoes','avaliacao_opcoes'
  ];
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

-- ---------- Fix: default de avaliacoes.tipo estava fora do CHECK ----------
alter table public.avaliacoes alter column tipo set default 'avaliacao';

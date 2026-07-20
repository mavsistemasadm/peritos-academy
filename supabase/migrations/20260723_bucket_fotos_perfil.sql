-- Bucket dedicado para fotos de perfil. Antes o upload usava o bucket
-- 'planilhas' (privado) com getPublicUrl() — a URL pública gerada não
-- resolve pra bucket privado (só o path /object/public/ funciona sem
-- header de auth, e esse path só existe de fato pra bucket public=true),
-- então a foto nunca aparecia depois do upload. 'fotos-perfil' é público
-- (como 'capas'/'capas-cursos') pra também renderizar no perfil público
-- (/perito/[slug], acessível sem login).

insert into storage.buckets (id, name, public)
values ('fotos-perfil', 'fotos-perfil', true)
on conflict (id) do nothing;

drop policy if exists fotos_perfil_leitura_publica on storage.objects;
create policy fotos_perfil_leitura_publica on storage.objects
  for select using (bucket_id = 'fotos-perfil');

drop policy if exists fotos_perfil_escrita_propria on storage.objects;
create policy fotos_perfil_escrita_propria on storage.objects
  for insert with check (
    bucket_id = 'fotos-perfil' and name like auth.uid()::text || '/%'
  );

drop policy if exists fotos_perfil_atualizacao_propria on storage.objects;
create policy fotos_perfil_atualizacao_propria on storage.objects
  for update using (
    bucket_id = 'fotos-perfil' and name like auth.uid()::text || '/%'
  ) with check (
    bucket_id = 'fotos-perfil' and name like auth.uid()::text || '/%'
  );

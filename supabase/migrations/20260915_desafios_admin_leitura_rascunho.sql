-- Admin de conteúdo lê desafio em rascunho.
--
-- `desafios` só tinha SELECT para `publicado = true`. Criar desafio no admin faz
-- `.insert(...).select('id').single()` com `publicado = false`, e o RETURNING
-- também precisa passar numa policy de leitura: sem esta, o insert inteiro caía
-- com "new row violates row-level security policy". O editor (`select('*')` por
-- id, quesitos, documentos, gabarito) também não enxergava rascunho nenhum.
drop policy if exists desafios_admin_select on public.desafios;
create policy desafios_admin_select on public.desafios
  for select
  using (is_admin_papel(auth.uid(), array['super_admin', 'conteudo']));

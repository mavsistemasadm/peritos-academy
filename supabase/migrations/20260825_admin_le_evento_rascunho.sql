-- ══════════════════════════════════════════════════════════════════
-- O ADMIN NÃO CONSEGUIA CRIAR EVENTO — 2026-08-25
--
-- Sintoma em produção, ao clicar em "Novo evento" em /admin/agenda:
--
--   new row violates row-level security policy for table "eventos"
--
-- A mensagem acusa a policy de INSERT, e a policy de INSERT estava certa o
-- tempo todo. Quem recusava era a de SELECT.
--
-- `eventos` tinha uma única policy de leitura, `publicado = true`. E
-- `criarEvento` insere com `publicado: false` (todo evento nasce rascunho) e
-- encadeia `.select('id').single()` para devolver o id à tela. O Postgres
-- exige que a linha do RETURNING também passe por uma policy de leitura: o
-- rascunho recém-criado não passava, e a transação inteira caía.
--
-- ⚠️ É exatamente a pegadinha que o CLAUDE.md já registrava desde o webhook do
-- Asaas: `.insert(...).select()` numa tabela onde quem escreve não tem policy
-- de SELECT derruba o insert, e o erro aponta para o lugar errado. Lá foi
-- resolvido gerando o id no cliente; aqui a resposta certa é outra, porque o
-- problema é mais fundo.
--
-- ── O SEGUNDO SINTOMA, QUE NINGUÉM TINHA LIGADO A ESTE ──
--
-- `carregarEventosAdmin` faz `select('*')` sem filtro de publicação, para a
-- lista do admin mostrar rascunhos e publicados. Com a policy de leitura
-- limitada a `publicado = true`, **a lista do admin nunca mostrou um
-- rascunho**: ele era criado (quando era) e sumia da tela, sem erro, sem
-- linha vazia, sem nada. Um evento em preparação simplesmente não existia
-- para quem o estava preparando.
--
-- Os dois são a mesma falta: o admin não tinha permissão de LER o que ele
-- mesmo administra. Mesmos papéis das outras três policies desta tabela.
-- ══════════════════════════════════════════════════════════════════

drop policy if exists eventos_admin_le on public.eventos;
create policy eventos_admin_le on public.eventos
  for select using (is_admin_papel(auth.uid(), array['super_admin','moderador','conteudo']));

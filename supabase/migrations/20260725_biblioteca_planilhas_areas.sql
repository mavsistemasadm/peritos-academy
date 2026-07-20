-- Fase 2 da migração da Biblioteca de Modelos de Planilhas (Ensinio).
-- Preserva o agrupamento por área dos 8 módulos originais: cada planilha
-- fica vinculada à sua área, com ordem interna preservada (coluna nova).
-- Ordem final de exibição das áreas foi decisão editorial do Marlos:
-- Trabalhista, Previdenciária, Bancária, Tributária, Diversos,
-- Petições e Manifestações, Laudos Periciais.

-- ordem interna dentro de cada área (sequência original do Ensinio)
alter table public.planilhas add column if not exists ordem integer not null default 0;

-- reordena as 3 áreas que já existiam pra intercalar com as novas
update public.planilha_areas set ordem = 3 where slug = 'bancaria';
update public.planilha_areas set ordem = 4 where slug = 'tributaria';
-- 'previdenciaria' já está em ordem = 2, sem mudança

insert into public.planilha_areas (id, slug, nome, ordem) values
  ('dada0001-0000-4000-8000-000000000004', 'trabalhista', 'Trabalhista', 1),
  ('dada0001-0000-4000-8000-000000000005', 'diversos', 'Diversos', 5),
  ('dada0001-0000-4000-8000-000000000006', 'peticoes-e-manifestacoes', 'Petições e Manifestações', 6),
  ('dada0001-0000-4000-8000-000000000007', 'laudos-periciais', 'Laudos Periciais', 7)
on conflict (id) do update set slug = excluded.slug, nome = excluded.nome, ordem = excluded.ordem;

-- limpa os 10 registros seed (sem arquivo real no bucket, ver INVENTARIO.md)
delete from public.planilhas where id::text like 'dbdb0001-%';

-- ============================================================
-- Ordenação editorial de trilhas e cursos na biblioteca de cursos.
--
-- curso_trilha NÃO é uma tabela — é uma VIEW (DISTINCT ON curso_id) sobre
-- etapa_missoes/etapas/trilhas. etapa_missoes já tinha uma coluna `ordem`,
-- mas com outro significado (posição do curso dentro da SUA etapa, lida
-- ao vivo por /jornada para ordenar os passos da missão). Reaproveitar
-- essa coluna com a ordem "achatada" 1..N cruzando etapas quebraria a
-- ordenação da /jornada. Por isso: coluna nova `ordem_biblioteca`,
-- exclusiva da vitrine editorial, e a view passa a preferir (no
-- DISTINCT ON) a linha curada quando um curso pertence a duas trilhas
-- ao mesmo tempo (ex.: "Revisão de Benefício PREVI").
-- ============================================================

alter table public.etapa_missoes
  add column if not exists ordem_biblioteca int not null default 0;

create or replace view public.curso_trilha as
select distinct on (em.curso_id)
  em.curso_id,
  t.nome as trilha_nome,
  t.slug as trilha_slug,
  e.nome as etapa_nome,
  em.ordem_biblioteca as ordem
from public.etapa_missoes em
join public.etapas e on e.id = em.etapa_id
join public.trilhas t on t.id = e.trilha_id
order by em.curso_id, (em.ordem_biblioteca > 0) desc, e.ordem;

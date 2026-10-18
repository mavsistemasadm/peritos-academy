-- Lives: o parágrafo de cada email escrito para o assunto da live (18/10/2026).
-- { titulo, anuncio, vespera, hoje, comecando, ao_vivo }. `titulo` é o título
-- para o qual os textos foram escritos: se a live for renomeada, eles são
-- escritos de novo (lib/evento/textos.ts).
alter table public.eventos add column if not exists textos_email jsonb;

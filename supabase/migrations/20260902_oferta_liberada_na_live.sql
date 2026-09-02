-- ══════════════════════════════════════════════════════════════════
-- 20260902_oferta_liberada_na_live.sql
--
-- O apresentador libera a oferta NO MOMENTO do pitch, e não antes.
--
-- A faixa de venda ficava visível a live inteira. Quem entra na sala às 11h e
-- encontra a oferta já na tela lê a aula como um infomercial de uma hora — e a
-- promessa desta live é o contrário disso: uma hora resolvendo o problema da
-- pessoa, sem pauta fechada. A oferta vale mais dita uma vez, na hora certa,
-- do que exposta sessenta minutos até virar paisagem.
-- ══════════════════════════════════════════════════════════════════

alter table eventos
  add column if not exists oferta_liberada boolean not null default false;

comment on column eventos.oferta_liberada is
  'Interruptor do apresentador durante a transmissão. Nasce false SEMPRE — inclusive na cópia da semana seguinte (ver repetirEvento).';

-- ⚠️ REALTIME É A METADE QUE FAZ O RECURSO EXISTIR.
--
-- Sem ele, a faixa só apareceria para quem desse F5 — e ninguém recarrega a
-- página no meio de uma transmissão. O apresentador clicaria, veria a oferta
-- na PRÓPRIA tela, e concluiria que funcionou; a sala inteira continuaria sem
-- ver nada. É a "falha que funciona" que este ecossistema já documentou.
--
-- A tabela já é legível por anônimo para evento publicado (policy
-- `select using (publicado = true)`), que é o que permite o navegador de quem
-- não tem conta assinar o canal — mesma condição que fez o chat funcionar.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'eventos'
  ) then
    alter publication supabase_realtime add table public.eventos;
  end if;
end $$;

-- ⚠️ REPLICA IDENTITY FULL: sem isto o payload de UPDATE chega sem as colunas
-- que não mudaram, e o cliente não consegue confirmar de qual evento é a
-- linha. Com uma sala aberta por semana isso é barato.
alter table eventos replica identity full;

-- ─────────────────────────────────────────────────────────────
-- Verificação
-- ─────────────────────────────────────────────────────────────
-- select column_name, column_default from information_schema.columns
--   where table_name = 'eventos' and column_name = 'oferta_liberada';
-- select tablename from pg_publication_tables
--   where pubname = 'supabase_realtime' and schemaname = 'public';

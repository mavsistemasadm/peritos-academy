-- ══════════════════════════════════════════════════════════════════
-- Lives nos grupos de WhatsApp da Peritos Academy (18/10/2026)
--
-- O mesmo esquema dos emails: o convite quando o dono pede (pelo Jarvis), e
-- sozinhos o "é hoje" de manhã e o "estamos ao vivo" na hora.
--
-- whatsapp_grupos: os grupos onde se publica. O JID vem da Evolution
--   (fetchAllGroups); `ativo` liga e desliga cada grupo sem apagar.
-- evento_whatsapp_envios: uma linha por (evento, grupo, momento), inserida
--   ANTES do envio. É o dedupe: o cron roda de hora em hora e a mesma
--   mensagem não pode cair duas vezes num grupo.
-- eventos.avisar_grupos: ligado quando o convite sai nos grupos; é o que faz
--   o cron mandar os lembretes daquela live.
--
-- Sem policy nenhuma: só o servidor (chave de serviço) lê e escreve.
-- ══════════════════════════════════════════════════════════════════

create table if not exists public.whatsapp_grupos (
  jid        text primary key,
  nome       text not null,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);
alter table public.whatsapp_grupos enable row level security;

create table if not exists public.evento_whatsapp_envios (
  evento_id  uuid not null references public.eventos(id) on delete cascade,
  grupo_jid  text not null,
  momento    text not null check (momento in ('anuncio', 'hoje', 'ao_vivo')),
  criado_em  timestamptz not null default now(),
  enviado_em timestamptz,
  erro       text,
  primary key (evento_id, grupo_jid, momento)
);
alter table public.evento_whatsapp_envios enable row level security;

alter table public.eventos add column if not exists avisar_grupos boolean not null default false;

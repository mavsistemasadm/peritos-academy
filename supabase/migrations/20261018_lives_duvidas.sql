-- ══════════════════════════════════════════════════════════════════
-- Dúvidas enviadas antes da live (18/10/2026)
--
-- Live de tira-dúvidas: o convite (email, WhatsApp, página do evento) leva a
-- pessoa a mandar a dúvida ANTES, por escrito, com um documento ou imagem de
-- até 20 MB. O apresentador abre /admin/agenda/{id}/duvidas, responde na live
-- e dá baixa em cada uma. As abertas ficam até serem respondidas.
--
-- eventos.recebe_duvidas: liga o recebimento. Desligado por padrão: só a live
--   de tira-dúvidas pede isso (o Jarvis liga quando o dono diz que é).
-- evento_duvidas: uma linha por dúvida. Aluno logado grava usuario_id; quem
--   não tem conta grava nome e email. O anexo fica no bucket privado
--   `evento-duvidas`, em `{evento_id}/{uuid}-{nome}`.
--
-- Sem policy nenhuma: quem escreve é a server action (chave de serviço),
-- depois de validar; quem lê é a página do admin, depois de conferir o papel.
-- Uma policy de insert para anon deixaria um formulário aberto na internet com
-- a chave que vai no HTML (mesmo motivo de evento_inscricoes).
-- ══════════════════════════════════════════════════════════════════

alter table public.eventos add column if not exists recebe_duvidas boolean not null default false;

create table if not exists public.evento_duvidas (
  id             uuid primary key default gen_random_uuid(),
  evento_id      uuid not null references public.eventos(id) on delete cascade,
  usuario_id     uuid references public.perfis(id) on delete set null,
  nome           text not null,
  email          text not null,
  texto          text not null check (char_length(texto) between 3 and 4000),
  anexo_path     text,
  anexo_nome     text,
  anexo_tipo     text,
  anexo_bytes    integer check (anexo_bytes is null or anexo_bytes <= 20971520),
  status         text not null default 'aberta' check (status in ('aberta', 'respondida')),
  respondida_em  timestamptz,
  respondida_por uuid,
  criado_em      timestamptz not null default now()
);
create index if not exists idx_evento_duvidas_evento on public.evento_duvidas (evento_id, status, criado_em);
alter table public.evento_duvidas enable row level security;

-- O teto de 20 MB e os tipos aceitos moram também no bucket: a URL assinada
-- de upload é emitida para o navegador, e quem tem a URL poderia mandar outra
-- coisa. O Storage recusa por conta própria.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evento-duvidas', 'evento-duvidas', false, 20971520, array[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain'
])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

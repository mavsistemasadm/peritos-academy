-- ══════════════════════════════════════════════════════════════════
-- "O RESEND ACEITOU" NÃO É "O EMAIL CHEGOU" — 2026-08-25
--
-- Incidente: o domínio `peritosacademy.com.br` saiu do ar como remetente
-- verificado no Resend, e **nenhum email da plataforma foi entregue desde
-- então**. Ninguém percebeu por três semanas. Medido hoje: 632 linhas em
-- `email_enviados`, 624 delas depois de 06/08.
--
-- ── POR QUE PASSOU DESPERCEBIDO ──
--
-- A API do Resend responde 200 com um id no ato do envio, e só descobre que o
-- domínio não está verificado DEPOIS, de forma assíncrona. `enviarEmail()`
-- checava só o campo `error` da resposta, via 200, concluía "enviado" e
-- gravava a linha de dedupe. Do lado de cá tudo dava certo: sem erro, sem log,
-- sem alerta. O painel do Resend dizia "Failed" em todos, e nada nesta
-- plataforma tinha como saber disso.
--
-- ⚠️ E o dedupe transformou a falha em permanente. O índice único
-- (usuario, tipo, ref) existe para não mandar duas vezes; com a linha gravada
-- na falha, ele passou a garantir que aqueles 624 emails **nunca mais serão
-- tentados**. A carta pessoal de quem entrou em agosto não chegou e não chega
-- mais. Perder o email é ruim; gravar que ele foi enviado é o que fecha a
-- porta.
--
-- ── O QUE MUDA ──
--
-- A linha deixa de significar "chamamos a API" e passa a significar "este
-- email está de pé": `aceito` enquanto o Resend não disse o contrário,
-- `entregue` quando confirmou, `falhou` quando recusou. Quem consulta o dedupe
-- ignora `falhou`, então uma falha volta a ser retentável sozinha na próxima
-- passagem do cron.
--
-- Quem escreve `entregue`/`falhou` é o webhook /api/webhooks/resend. Sem ele
-- configurado, tudo fica em `aceito` e o comportamento é o de antes — não
-- melhora, mas também não piora.
-- ══════════════════════════════════════════════════════════════════

alter table public.email_enviados
  add column if not exists resend_id text,
  add column if not exists estado text not null default 'aceito',
  add column if not exists detalhe text;

alter table public.email_convidados_enviados
  add column if not exists resend_id text,
  add column if not exists estado text not null default 'aceito',
  add column if not exists detalhe text;

-- NOT VALID: as 632 linhas antigas não têm estado conferido e não podem
-- segurar a migração. A regra passa a valer para tudo que for escrito daqui
-- em diante, que é o que importa.
alter table public.email_enviados
  drop constraint if exists email_enviados_estado_ck;
alter table public.email_enviados
  add constraint email_enviados_estado_ck check (estado in ('aceito','entregue','falhou')) not valid;

alter table public.email_convidados_enviados
  drop constraint if exists email_convidados_estado_ck;
alter table public.email_convidados_enviados
  add constraint email_convidados_estado_ck check (estado in ('aceito','entregue','falhou')) not valid;

-- O webhook chega com o id do Resend e mais nada: é por ele que a linha é
-- encontrada.
create index if not exists idx_email_enviados_resend on public.email_enviados (resend_id) where resend_id is not null;
create index if not exists idx_email_convidados_resend on public.email_convidados_enviados (resend_id) where resend_id is not null;

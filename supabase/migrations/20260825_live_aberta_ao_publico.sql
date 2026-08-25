-- ══════════════════════════════════════════════════════════════════
-- LIVE ABERTA A QUEM NÃO É ALUNO — 2026-08-25
--
-- Até aqui, participar de um evento exigia conta: `evento_reservas` tem FK
-- para o usuário, e a página do evento mandava para o login. Isso fecha a
-- porta justamente para o público de uma live de apresentação — a pessoa que
-- ainda não é aluna e que a live existe para converter.
--
-- Este arquivo abre essa porta sem abrir a plataforma: o convidado deixa nome
-- e email, recebe confirmação e lembretes, e assiste. Não vira conta, não
-- ganha acesso a nada, e é isso que faz a live poder ser divulgada em
-- qualquer lugar sem custo nenhum de acesso.
--
-- ── POR QUE UMA FLAG POR EVENTO, E NÃO UM MODO GLOBAL ──
--
-- `aberto_ao_publico` nasce `false` e é ligada evento a evento. A maioria dos
-- encontros é mentoria de turma e plantão de aluno: abrir todos por padrão
-- entregaria de graça o que se vende, e o erro seria silencioso — ninguém
-- percebe uma sala aberta demais, só percebe uma sala fechada demais.
--
-- ── POR QUE UMA TABELA SEPARADA DE `evento_reservas` ──
--
-- Reserva é de aluno e aponta para `perfis`; inscrição pública é de alguém que
-- não existe na base. Enfiar as duas na mesma tabela exigiria afrouxar a FK de
-- usuário para nullable, e daí toda leitura de reserva (gamificação, contagem
-- de confirmados, ficha do aluno) passaria a ter que lembrar de filtrar os
-- convidados. São duas coisas com o mesmo nome em português e naturezas
-- diferentes — mesma armadilha de `tem_acesso_plataforma` vs `tem_acesso_curso`.
-- ══════════════════════════════════════════════════════════════════

alter table public.eventos add column if not exists aberto_ao_publico boolean not null default false;

comment on column public.eventos.aberto_ao_publico is
  'Live aberta: quem não tem conta pode se inscrever pela página pública e recebe lembretes. Opt-in por evento.';

-- ── A LISTA DE CONVIDADOS ────────────────────────────────────────
create table if not exists public.evento_inscricoes (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  nome text not null,
  email text not null,
  whatsapp text,
  -- Preenchido quando o email já é de um aluno. Não concede nada: serve para
  -- a tela do admin não tratar como lead novo quem já está dentro, e para o
  -- lembrete não chegar duplicado a quem também reservou pela agenda.
  usuario_id uuid references public.perfis(id) on delete set null,
  origem text not null default 'pagina_evento',
  cancelado_em timestamptz,
  criado_em timestamptz not null default now()
);

-- Idempotência da inscrição: a pessoa clica duas vezes, ou volta pelo link do
-- email e se inscreve de novo — nos dois casos é a mesma inscrição, e não
-- duas. Sem isto ela receberia cada lembrete em duplicata, que é o jeito mais
-- rápido de o convite virar spam aos olhos de quem recebeu.
create unique index if not exists uq_evento_inscricoes_email
  on public.evento_inscricoes (evento_id, lower(email));

create index if not exists idx_evento_inscricoes_evento on public.evento_inscricoes (evento_id);

alter table public.evento_inscricoes enable row level security;

-- ⚠️ Nenhuma policy de INSERT, de propósito — nem para anon.
-- A inscrição entra pela server action, com a service role, depois de validar
-- e normalizar. Uma policy de insert para `anon` transformaria a tabela num
-- formulário aberto na internet: qualquer um com a chave publicável (que vai
-- no HTML de toda página) despejaria linhas direto, sem passar por validação
-- nenhuma. A regra de quem pode se inscrever é da aplicação; o banco só
-- guarda.
drop policy if exists insc_admin_le on public.evento_inscricoes;
create policy insc_admin_le on public.evento_inscricoes
  for select using (is_admin_papel(auth.uid(), array['super_admin','moderador','conteudo']));

-- ── EMAIL PARA QUEM NÃO TEM CONTA ────────────────────────────────
--
-- `email_enviados` não serve aqui: seu `usuario_id` é NOT NULL e o índice
-- único de dedupe é montado sobre ele. Com usuário nulo o Postgres trata cada
-- linha como distinta e o dedupe simplesmente para de existir — o mesmo
-- lembrete sairia a cada passagem do cron. Daí uma tabela irmã, com a mesma
-- ideia e a chave certa: o endereço.
create table if not exists public.email_convidados_enviados (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  tipo text not null,
  ref_id text,
  assunto text not null,
  criado_em timestamptz not null default now()
);

create unique index if not exists uq_email_convidados_enviados
  on public.email_convidados_enviados (lower(email), tipo, coalesce(ref_id, '__geral__'));

alter table public.email_convidados_enviados enable row level security;
-- Sem policy nenhuma: só a service role escreve e lê (crons e a action de
-- inscrição). Ninguém logado tem o que fazer aqui.

-- ── DESCADASTRO POR ENDEREÇO ─────────────────────────────────────
--
-- O aluno cancela email em `email_preferencias`, que é por usuário. O
-- convidado não tem usuário — e mesmo assim o link "cancelar inscrição"
-- precisa funcionar, tanto por decência quanto porque é o que mantém o
-- domínio fora das listas de spam.
create table if not exists public.email_optout_publico (
  email text primary key,
  criado_em timestamptz not null default now()
);

alter table public.email_optout_publico enable row level security;
-- Idem: só a service role. A página /email/cancelar roda com ela.

-- ── O CHAT AO LADO DO PLAYER ─────────────────────────────────────
--
-- Quando a transmissão é do YouTube, o player e o chat do YouTube são
-- embutidos na própria página do evento — ninguém sai daqui para assistir.
--
-- ⚠️ O chat é opt-out por evento, e não fixo, porque nem toda transmissão tem
-- chat: numa live com chat desativado no YouTube o iframe carrega uma tela de
-- erro do YouTube dentro da nossa página, e o que o aluno vê é a plataforma
-- parecendo quebrada num momento em que ninguém vai abrir chamado — vai
-- embora.
alter table public.eventos add column if not exists chat_ao_vivo boolean not null default true;

comment on column public.eventos.chat_ao_vivo is
  'Embute o chat do YouTube ao lado do player. Desligar quando a transmissão não tiver chat.';

-- ── O ENDEREÇO DE EMAIL DE UM ALUNO ──────────────────────────────
--
-- ⚠️ `perfis` NÃO tem coluna `email` — o endereço mora em `auth.users`, que o
-- PostgREST não expõe. Escrever `perfis.select('email')` compila, passa no
-- lint e falha só em execução, dizendo que a coluna não existe.
--
-- Duas funções `security definer` resolvem, no mesmo espírito de
-- `admin_buscar_usuario_por_email`: a função enxerga `auth.users` porque
-- pertence ao owner, mas devolve só o que quem chama precisa. A diferença é
-- quem chama — lá é um admin com sessão, aqui é a service role dos crons e da
-- inscrição, que não tem `auth.uid()` e por isso não passaria na checagem de
-- papel daquela.
--
-- EXECUTE revogado de `authenticated` e `anon` nomeando os papéis: revogar de
-- PUBLIC sozinho não basta (o Supabase concede direto a esses dois via
-- `alter default privileges`), pegadinha já documentada em `notificar()`.
-- Sem isso, qualquer pessoa logada viraria "quem é o dono deste email?" num
-- fetch — um verificador de base de alunos aberto na internet.

create or replace function public.usuario_id_por_email(p_email text)
returns uuid
language sql
security definer
set search_path = public
as $$
  select u.id from auth.users u where lower(u.email) = lower(btrim(p_email)) limit 1;
$$;

revoke execute on function public.usuario_id_por_email(text) from public, authenticated, anon;

create or replace function public.emails_de_usuarios(p_ids uuid[])
returns table (id uuid, nome text, email text)
language sql
security definer
set search_path = public
as $$
  select p.id, p.nome, u.email::text
  from public.perfis p
  join auth.users u on u.id = p.id
  where p.id = any(p_ids) and u.email is not null;
$$;

revoke execute on function public.emails_de_usuarios(uuid[]) from public, authenticated, anon;

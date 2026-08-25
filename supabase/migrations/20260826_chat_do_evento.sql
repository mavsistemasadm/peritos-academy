-- ══════════════════════════════════════════════════════════════════
-- CHAT PRÓPRIO DA TRANSMISSÃO — 2026-08-26
--
-- O chat embutido era o do YouTube, e ele tem um defeito que anula o motivo de
-- a live existir: **para escrever, é preciso estar logado numa conta do
-- Google**, e dentro de um iframe esse login costuma nem funcionar (cookie de
-- terceiro). Ou seja, o convidado que deixou nome e email para assistir podia
-- ler o chat e não podia falar. Numa live feita para converter quem ainda não
-- é aluno, calar exatamente essa pessoa é o pior resultado possível.
--
-- Este é o chat da casa: quem está na página fala, com ou sem conta.
--
-- ── QUEM ESCREVE, E COMO É IDENTIFICADO ──
--
--   aluno logado → pela sessão, com nome e link do perfil
--   convidado    → pelo cookie assinado da inscrição (ver evento-publico.ts)
--
-- ⚠️ **NÃO existe policy de INSERT, para ninguém.** A escrita passa pela server
-- action, com a service role, depois de identificar quem fala e conferir o
-- limite de vazão. Uma policy de insert para `anon` transformaria a tabela num
-- formulário aberto na internet: a chave publicável vai no HTML de toda
-- página, e qualquer um despejaria mensagem em nome de qualquer nome, em laço,
-- durante a transmissão. Não haveria como distinguir de gente.
--
-- ── A LEITURA É PÚBLICA, E PRECISA SER ──
--
-- É o que permite o navegador de quem não tem conta assinar o canal de
-- Realtime e receber as mensagens novas. O que se lê é o que já está na tela
-- de todo mundo; não há nada aqui que não seja público por definição.
-- ══════════════════════════════════════════════════════════════════

create table if not exists public.evento_mensagens (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  -- Quem falou. Um dos dois está preenchido; nunca os dois, nunca nenhum.
  usuario_id uuid references public.perfis(id) on delete set null,
  inscricao_id uuid references public.evento_inscricoes(id) on delete set null,
  -- Congelado na hora de falar, de propósito: se a pessoa mudar o nome no
  -- perfil depois, o que ela disse continua atribuído a quem ela era. E o
  -- convidado não tem perfil de onde ler nome nenhum.
  autor_nome text not null,
  -- Marca visual de quem conduz. Lida na hora do envio, não na renderização:
  -- é o que ela era ao falar.
  eh_apresentador boolean not null default false,
  texto text not null,
  -- Moderação: a mensagem some da tela sem sumir do registro.
  oculta_em timestamptz,
  oculta_por uuid references public.perfis(id) on delete set null,
  criado_em timestamptz not null default now(),

  constraint evento_mensagens_autor_ck check (
    (usuario_id is not null) <> (inscricao_id is not null)
  ),
  constraint evento_mensagens_texto_ck check (
    length(btrim(texto)) between 1 and 500
  )
);

create index if not exists idx_evento_mensagens_evento
  on public.evento_mensagens (evento_id, criado_em);

alter table public.evento_mensagens enable row level security;

drop policy if exists msg_leitura_publica on public.evento_mensagens;
create policy msg_leitura_publica on public.evento_mensagens
  for select using (
    exists (select 1 from public.eventos e where e.id = evento_id and e.publicado)
  );

-- Moderação é o único caminho de escrita que passa por policy, e é de admin.
drop policy if exists msg_admin_modera on public.evento_mensagens;
create policy msg_admin_modera on public.evento_mensagens
  for update using (is_admin_papel(auth.uid(), array['super_admin','moderador','conteudo']))
  with check (is_admin_papel(auth.uid(), array['super_admin','moderador','conteudo']));

-- ── REALTIME ────────────────────────────────────────────────────
--
-- Primeira tabela deste projeto a entrar na publicação de Realtime. A
-- publicação já existia, vazia. Sem esta linha o chat funciona por recarga de
-- página, que para um chat é o mesmo que não funcionar.
--
-- ⚠️ O Realtime respeita a RLS de leitura acima, então o que trafega é o que
-- qualquer pessoa já poderia consultar.
alter publication supabase_realtime add table public.evento_mensagens;

-- `replica identity full` faz o UPDATE de moderação chegar ao navegador com a
-- linha inteira. Sem isso, o evento de update viria só com a chave primária e
-- a mensagem ocultada continuaria na tela de quem já estava assistindo — que é
-- exatamente a pessoa de quem se quis esconder.
alter table public.evento_mensagens replica identity full;

-- ── O MODO DO CHAT ──────────────────────────────────────────────
--
-- `chat_ao_vivo` era booleano e só respondia "embute o do YouTube ou não".
-- Agora são três respostas, e a do meio deixou de ser a melhor.
alter table public.eventos add column if not exists chat_modo text not null default 'proprio';

update public.eventos
   set chat_modo = case when coalesce(chat_ao_vivo, true) then 'proprio' else 'nenhum' end
 where chat_modo = 'proprio';

alter table public.eventos drop constraint if exists eventos_chat_modo_ck;
alter table public.eventos
  add constraint eventos_chat_modo_ck check (chat_modo in ('nenhum','youtube','proprio'));

comment on column public.eventos.chat_modo is
  'nenhum · youtube (exige conta do Google para escrever) · proprio (qualquer participante fala)';

alter table public.eventos drop column if exists chat_ao_vivo;

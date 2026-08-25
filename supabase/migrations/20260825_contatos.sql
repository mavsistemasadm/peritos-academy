-- ══════════════════════════════════════════════════════════════════
-- BANCO DE CONTATOS — 2026-08-25
--
-- Quem se inscreve numa live aberta não vira aluno, não vira conta, e até
-- aqui não viraria nada: o nome e o email ficariam presos à linha de um
-- evento que acaba em duas horas. Esta tabela é onde essa pessoa passa a
-- existir depois que a live termina.
--
-- ── POR QUE NÃO REAPROVEITAR `evento_inscricoes` ──
--
-- Aquela tabela responde "quem vem neste encontro" e tem uma linha por
-- pessoa POR EVENTO. Alguém que assiste três lives é três linhas lá, com três
-- grafias possíveis do mesmo nome. Aqui é uma linha por pessoa, para sempre,
-- que é a pergunta diferente: "com quem podemos falar".
--
-- ── AS TAGS ──
--
-- `tags text[]`, e não uma tabela de junção, porque o uso é filtrar e exportar
-- — nunca juntar. A convenção é `chave:valor` para o que é referência
-- (`evento:aula-inaugural`) e palavra solta para o que é estado
-- (`nao-aluno`). Índice GIN para o filtro não virar varredura quando a base
-- crescer.
--
-- ⚠️ `nao-aluno` é uma FOTOGRAFIA do dia da captura, não uma verdade
-- permanente: a pessoa pode assinar amanhã. Quem responde "é aluno hoje?" é o
-- `usuario_id` (preenchido quando o email casa com uma conta) e as tabelas de
-- acesso — nunca a tag. Filtrar campanha por `nao-aluno` sem cruzar com isso
-- é como se acaba oferecendo a plataforma a quem já paga por ela.
-- ══════════════════════════════════════════════════════════════════

create table if not exists public.contatos (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  nome text,
  whatsapp text,
  -- Preenchido quando o endereço é de uma conta da Academy.
  usuario_id uuid references public.perfis(id) on delete set null,
  tags text[] not null default '{}',
  -- De onde a pessoa entrou pela primeira vez. Não muda depois: é história.
  origem text,
  aceita_email boolean not null default true,
  aceita_whatsapp boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index if not exists uq_contatos_email on public.contatos (lower(email));
create index if not exists idx_contatos_tags on public.contatos using gin (tags);

alter table public.contatos enable row level security;

-- Sem policy de escrita para ninguém: a gravação é da service role, pela
-- server action de inscrição. Leitura só para admin — é uma base de dados
-- pessoais de gente que não é usuária desta plataforma, e a régua para ela
-- tem que ser pelo menos a mesma de `migracao_alunos`.
drop policy if exists contatos_admin_le on public.contatos;
create policy contatos_admin_le on public.contatos
  for select using (is_admin_papel(auth.uid(), array['super_admin','moderador','conteudo']));

-- ── REGISTRAR UM CONTATO ─────────────────────────────────────────
--
-- Uma função e não um upsert na aplicação porque a regra de mesclagem tem
-- três cuidados que não sobrevivem a serem reescritos em cada lugar que
-- captura um contato:
--
--   1. Tag nunca é substituída, é somada — a pessoa que veio de duas lives
--      pertence às duas, e um upsert comum apagaria a primeira.
--   2. Campo vazio não apaga campo cheio — quem se inscreveu com WhatsApp e
--      depois sem não pode perder o telefone que já tinha dado.
--   3. `origem` só é gravada no nascimento. Ela responde "por onde essa
--      pessoa chegou até nós", e essa resposta não muda na segunda visita.
create or replace function public.registrar_contato(
  p_email text,
  p_nome text default null,
  p_whatsapp text default null,
  p_tags text[] default '{}',
  p_origem text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(p_email));
  v_id uuid;
begin
  if v_email is null or v_email = '' then
    return null;
  end if;

  insert into public.contatos (email, nome, whatsapp, tags, origem, usuario_id)
  values (
    v_email,
    nullif(btrim(coalesce(p_nome, '')), ''),
    nullif(btrim(coalesce(p_whatsapp, '')), ''),
    coalesce(p_tags, '{}'),
    p_origem,
    public.usuario_id_por_email(v_email)
  )
  on conflict (lower(email)) do update set
    nome       = coalesce(nullif(btrim(coalesce(excluded.nome, '')), ''), contatos.nome),
    whatsapp   = coalesce(nullif(btrim(coalesce(excluded.whatsapp, '')), ''), contatos.whatsapp),
    -- Soma sem repetir. A ordem final não importa; a ausência, sim.
    tags       = (
      select coalesce(array_agg(distinct t), '{}')
      from unnest(contatos.tags || excluded.tags) as t
    ),
    usuario_id = coalesce(excluded.usuario_id, contatos.usuario_id),
    atualizado_em = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.registrar_contato(text, text, text, text[], text) from public, authenticated, anon;

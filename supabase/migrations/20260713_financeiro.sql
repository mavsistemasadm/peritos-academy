-- ============================================================
-- FINANCEIRO: planos de assinatura, assinaturas, cobranças, webhooks Asaas
-- Rodado via Supabase MCP (ver CLAUDE.md — fluxo de trabalho).
--
-- Nota de nomenclatura: já existe uma tabela `planos` no banco (não documentada
-- no CLAUDE.md até aqui) pertencente a uma feature dormente e distinta — "meu
-- plano de estudo" do aluno (usuario_id, titulo, meta, passos jsonb), 0 linhas,
-- sem nenhuma leitura/escrita em código hoje (o botão "Criar novo plano" em
-- HomeContent.tsx não tem onClick). Pra não colidir com ela nem arriscar
-- confundir sessões futuras, os planos de assinatura pagos vivem em
-- `planos_assinatura`, não em `planos`.
-- ============================================================

-- ---------- planos_assinatura ----------
create table if not exists public.planos_assinatura (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  valor_centavos int not null check (valor_centavos >= 0),
  periodicidade text not null check (periodicidade in ('mensal','anual')),
  asaas_plan_id text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- ---------- assinaturas ----------
create table if not exists public.assinaturas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfis(id) on delete cascade,
  plano_id uuid not null references public.planos_assinatura(id),
  status text not null default 'ativa' check (status in ('ativa','inadimplente','suspensa','cancelada','cortesia')),
  asaas_subscription_id text,
  iniciada_em timestamptz not null default now(),
  proxima_cobranca date,
  cancelada_em timestamptz,
  observacao text
);

create index if not exists idx_assinaturas_usuario on public.assinaturas(usuario_id);
create index if not exists idx_assinaturas_status on public.assinaturas(status);

-- No máximo uma assinatura "corrente" (não cancelada) por aluno — ações
-- manuais do admin (cortesia/suspender/reativar/cancelar) mudam o status
-- da mesma linha em vez de criar linhas novas.
create unique index if not exists uq_assinatura_usuario_corrente
  on public.assinaturas(usuario_id) where status <> 'cancelada';

-- ---------- cobrancas ----------
create table if not exists public.cobrancas (
  id uuid primary key default gen_random_uuid(),
  assinatura_id uuid not null references public.assinaturas(id) on delete cascade,
  valor_centavos int not null check (valor_centavos >= 0),
  status text not null default 'pendente' check (status in ('pendente','confirmada','vencida','estornada')),
  metodo text,
  vencimento date not null,
  pago_em timestamptz,
  asaas_payment_id text unique,
  observacao text,
  criado_em timestamptz not null default now()
);

create index if not exists idx_cobrancas_assinatura on public.cobrancas(assinatura_id);
create index if not exists idx_cobrancas_vencimento on public.cobrancas(vencimento);
create index if not exists idx_cobrancas_status on public.cobrancas(status);

-- ---------- webhook_eventos ----------
create table if not exists public.webhook_eventos (
  id uuid primary key default gen_random_uuid(),
  origem text not null default 'asaas',
  evento_id_externo text unique,
  tipo text,
  payload jsonb,
  processado boolean not null default false,
  erro text,
  recebido_em timestamptz not null default now()
);

create index if not exists idx_webhook_eventos_recebido on public.webhook_eventos(recebido_em desc);

-- ---------- config_financeiro (singleton) ----------
create table if not exists public.config_financeiro (
  id int primary key default 1 check (id = 1),
  dias_carencia int not null default 3
);
insert into public.config_financeiro (id, dias_carencia) values (1, 3) on conflict (id) do nothing;

-- ---------- financeiro_log_acoes ----------
-- Log das ações manuais do admin financeiro (conceder cortesia, suspender,
-- reativar, cancelar) — quem fez, em qual assinatura, com qual observação.
create table if not exists public.financeiro_log_acoes (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.perfis(id),
  assinatura_id uuid references public.assinaturas(id) on delete set null,
  acao text not null check (acao in ('conceder_cortesia','suspender','reativar','cancelar')),
  observacao text,
  criado_em timestamptz not null default now()
);

create index if not exists idx_financeiro_log_assinatura on public.financeiro_log_acoes(assinatura_id);

-- ============================================================
-- RLS
-- ============================================================
alter table public.planos_assinatura enable row level security;
alter table public.assinaturas enable row level security;
alter table public.cobrancas enable row level security;
alter table public.webhook_eventos enable row level security;
alter table public.config_financeiro enable row level security;
alter table public.financeiro_log_acoes enable row level security;

-- planos_assinatura: catálogo de planos ativos é público (pra futura página
-- de checkout); planos inativos só visíveis pro admin financeiro.
drop policy if exists planos_assinatura_leitura_publica on public.planos_assinatura;
create policy planos_assinatura_leitura_publica on public.planos_assinatura
  for select using (ativo = true);
drop policy if exists planos_assinatura_admin_leitura on public.planos_assinatura;
create policy planos_assinatura_admin_leitura on public.planos_assinatura
  for select using (public.is_admin_papel(auth.uid(), array['super_admin','financeiro']));
drop policy if exists planos_assinatura_admin_insert on public.planos_assinatura;
create policy planos_assinatura_admin_insert on public.planos_assinatura
  for insert with check (public.is_admin_papel(auth.uid(), array['super_admin','financeiro']));
drop policy if exists planos_assinatura_admin_update on public.planos_assinatura;
create policy planos_assinatura_admin_update on public.planos_assinatura
  for update using (public.is_admin_papel(auth.uid(), array['super_admin','financeiro']))
  with check (public.is_admin_papel(auth.uid(), array['super_admin','financeiro']));
drop policy if exists planos_assinatura_admin_delete on public.planos_assinatura;
create policy planos_assinatura_admin_delete on public.planos_assinatura
  for delete using (public.is_admin_papel(auth.uid(), array['super_admin','financeiro']));

-- assinaturas: aluno lê só a própria; admin financeiro lê tudo; escrita só
-- via RPCs security definer (nenhuma policy de insert/update/delete aqui).
drop policy if exists assinaturas_leitura_propria on public.assinaturas;
create policy assinaturas_leitura_propria on public.assinaturas
  for select using (usuario_id = auth.uid());
drop policy if exists assinaturas_admin_leitura on public.assinaturas;
create policy assinaturas_admin_leitura on public.assinaturas
  for select using (public.is_admin_papel(auth.uid(), array['super_admin','financeiro']));

-- cobrancas: aluno lê só as cobranças da própria assinatura; admin financeiro
-- lê tudo; escrita só via RPC (processar_evento_asaas).
drop policy if exists cobrancas_leitura_propria on public.cobrancas;
create policy cobrancas_leitura_propria on public.cobrancas
  for select using (
    exists (select 1 from public.assinaturas a where a.id = cobrancas.assinatura_id and a.usuario_id = auth.uid())
  );
drop policy if exists cobrancas_admin_leitura on public.cobrancas;
create policy cobrancas_admin_leitura on public.cobrancas
  for select using (public.is_admin_papel(auth.uid(), array['super_admin','financeiro']));

-- webhook_eventos: qualquer chamada (inclusive anônima — é o Asaas batendo
-- na rota, sem sessão de usuário) pode inserir o log bruto; só o admin
-- financeiro lê; só a RPC processar_evento_asaas atualiza processado/erro.
drop policy if exists webhook_eventos_insert_publico on public.webhook_eventos;
create policy webhook_eventos_insert_publico on public.webhook_eventos
  for insert to anon, authenticated with check (true);
drop policy if exists webhook_eventos_admin_leitura on public.webhook_eventos;
create policy webhook_eventos_admin_leitura on public.webhook_eventos
  for select using (public.is_admin_papel(auth.uid(), array['super_admin','financeiro']));

-- config_financeiro: só admin financeiro lê/edita (tem_acesso_ativo é
-- security definer e enxerga a linha independente de RLS).
drop policy if exists config_financeiro_admin_leitura on public.config_financeiro;
create policy config_financeiro_admin_leitura on public.config_financeiro
  for select using (public.is_admin_papel(auth.uid(), array['super_admin','financeiro']));
drop policy if exists config_financeiro_admin_update on public.config_financeiro;
create policy config_financeiro_admin_update on public.config_financeiro
  for update using (public.is_admin_papel(auth.uid(), array['super_admin','financeiro']))
  with check (public.is_admin_papel(auth.uid(), array['super_admin','financeiro']));

-- financeiro_log_acoes: só admin financeiro lê; escrita só via RPCs.
drop policy if exists financeiro_log_admin_leitura on public.financeiro_log_acoes;
create policy financeiro_log_admin_leitura on public.financeiro_log_acoes
  for select using (public.is_admin_papel(auth.uid(), array['super_admin','financeiro']));

-- ============================================================
-- FUNÇÕES
-- ============================================================

-- tem_acesso_ativo: gate de conteúdo. Ativa/cortesia sempre passam;
-- inadimplente passa durante os dias de carência contados a partir da
-- próxima_cobranca vencida; suspensa/cancelada/sem assinatura não passam.
create or replace function public.tem_acesso_ativo(p_usuario_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_status text;
  v_prox date;
  v_carencia int;
begin
  select status, proxima_cobranca into v_status, v_prox
  from public.assinaturas
  where usuario_id = p_usuario_id and status <> 'cancelada';

  if v_status is null then return false; end if;
  if v_status in ('ativa','cortesia') then return true; end if;
  if v_status = 'suspensa' then return false; end if;

  -- inadimplente: carência
  if v_prox is null then return false; end if;
  select dias_carencia into v_carencia from public.config_financeiro where id = 1;
  return (current_date - v_prox) <= coalesce(v_carencia, 3);
end;
$$;
grant execute on function public.tem_acesso_ativo(uuid) to authenticated;

-- fin_conceder_cortesia: cria ou atualiza a assinatura corrente do usuário
-- pra status 'cortesia', vinculada ao plano "Cortesia" (seed).
create or replace function public.fin_conceder_cortesia(p_usuario_id uuid, p_observacao text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_plano_cortesia uuid;
  v_assinatura_id uuid;
begin
  if not public.is_admin_papel(v_admin_id, array['super_admin','financeiro']) then
    raise exception 'Sem permissão.';
  end if;

  select id into v_plano_cortesia from public.planos_assinatura where nome = 'Cortesia' limit 1;

  select id into v_assinatura_id from public.assinaturas where usuario_id = p_usuario_id and status <> 'cancelada';

  if v_assinatura_id is not null then
    update public.assinaturas
      set status = 'cortesia', observacao = p_observacao, plano_id = coalesce(v_plano_cortesia, plano_id)
      where id = v_assinatura_id;
  else
    insert into public.assinaturas (usuario_id, plano_id, status, observacao)
      values (p_usuario_id, v_plano_cortesia, 'cortesia', p_observacao)
      returning id into v_assinatura_id;
  end if;

  insert into public.financeiro_log_acoes (admin_id, assinatura_id, acao, observacao)
    values (v_admin_id, v_assinatura_id, 'conceder_cortesia', p_observacao);

  return v_assinatura_id;
end;
$$;
grant execute on function public.fin_conceder_cortesia(uuid, text) to authenticated;

create or replace function public.fin_suspender_assinatura(p_assinatura_id uuid, p_observacao text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
begin
  if not public.is_admin_papel(v_admin_id, array['super_admin','financeiro']) then
    raise exception 'Sem permissão.';
  end if;

  update public.assinaturas set status = 'suspensa', observacao = p_observacao where id = p_assinatura_id;

  insert into public.financeiro_log_acoes (admin_id, assinatura_id, acao, observacao)
    values (v_admin_id, p_assinatura_id, 'suspender', p_observacao);
end;
$$;
grant execute on function public.fin_suspender_assinatura(uuid, text) to authenticated;

create or replace function public.fin_reativar_assinatura(p_assinatura_id uuid, p_observacao text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
begin
  if not public.is_admin_papel(v_admin_id, array['super_admin','financeiro']) then
    raise exception 'Sem permissão.';
  end if;

  update public.assinaturas set status = 'ativa', observacao = p_observacao, cancelada_em = null where id = p_assinatura_id;

  insert into public.financeiro_log_acoes (admin_id, assinatura_id, acao, observacao)
    values (v_admin_id, p_assinatura_id, 'reativar', p_observacao);
end;
$$;
grant execute on function public.fin_reativar_assinatura(uuid, text) to authenticated;

create or replace function public.fin_cancelar_assinatura(p_assinatura_id uuid, p_observacao text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
begin
  if not public.is_admin_papel(v_admin_id, array['super_admin','financeiro']) then
    raise exception 'Sem permissão.';
  end if;

  update public.assinaturas set status = 'cancelada', cancelada_em = now(), observacao = p_observacao where id = p_assinatura_id;

  insert into public.financeiro_log_acoes (admin_id, assinatura_id, acao, observacao)
    values (v_admin_id, p_assinatura_id, 'cancelar', p_observacao);
end;
$$;
grant execute on function public.fin_cancelar_assinatura(uuid, text) to authenticated;

-- processar_evento_asaas: lógica de processamento pronta, sem nenhuma
-- chamada externa — só atualiza cobrancas/assinaturas já existentes a
-- partir do payload logado em webhook_eventos. Concedida também a `anon`
-- porque a rota de webhook roda sem sessão de usuário (o Asaas não manda
-- cookie de auth); a validação de origem é feita no route handler via
-- ASAAS_WEBHOOK_TOKEN antes de sequer chegar aqui.
create or replace function public.processar_evento_asaas(p_webhook_evento_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evento record;
  v_payment_id text;
  v_subscription_id text;
  v_cobranca record;
begin
  select * into v_evento from public.webhook_eventos where id = p_webhook_evento_id;
  if not found then return; end if;

  v_payment_id := v_evento.payload -> 'payment' ->> 'id';
  v_subscription_id := v_evento.payload -> 'subscription' ->> 'id';

  if v_evento.tipo in ('PAYMENT_CONFIRMED','PAYMENT_RECEIVED') then
    select * into v_cobranca from public.cobrancas where asaas_payment_id = v_payment_id;
    if found then
      update public.cobrancas set status = 'confirmada', pago_em = now() where id = v_cobranca.id;
      update public.assinaturas set status = 'ativa' where id = v_cobranca.assinatura_id;
      update public.webhook_eventos set processado = true, erro = null where id = p_webhook_evento_id;
    else
      update public.webhook_eventos
        set processado = false, erro = 'cobranca não encontrada para asaas_payment_id=' || coalesce(v_payment_id, 'null')
        where id = p_webhook_evento_id;
    end if;

  elsif v_evento.tipo = 'PAYMENT_OVERDUE' then
    select * into v_cobranca from public.cobrancas where asaas_payment_id = v_payment_id;
    if found then
      update public.cobrancas set status = 'vencida' where id = v_cobranca.id;
      update public.assinaturas set status = 'inadimplente' where id = v_cobranca.assinatura_id;
      update public.webhook_eventos set processado = true, erro = null where id = p_webhook_evento_id;
    else
      update public.webhook_eventos
        set processado = false, erro = 'cobranca não encontrada para asaas_payment_id=' || coalesce(v_payment_id, 'null')
        where id = p_webhook_evento_id;
    end if;

  elsif v_evento.tipo in ('SUBSCRIPTION_CANCELLED','SUBSCRIPTION_DELETED') then
    update public.assinaturas set status = 'cancelada', cancelada_em = now()
      where asaas_subscription_id = v_subscription_id;
    update public.webhook_eventos set processado = true, erro = null where id = p_webhook_evento_id;

  else
    update public.webhook_eventos
      set processado = true, erro = 'tipo de evento não tratado: ' || coalesce(v_evento.tipo, 'null')
      where id = p_webhook_evento_id;
  end if;
end;
$$;
grant execute on function public.processar_evento_asaas(uuid) to anon, authenticated;

-- ============================================================
-- SEED (idempotente — UUIDs fixos, ON CONFLICT (id) DO UPDATE)
-- ============================================================

-- Planos de exemplo (valores placeholder — calibrar depois no admin).
insert into public.planos_assinatura (id, nome, descricao, valor_centavos, periodicidade, ativo)
values
  ('f1000000-0000-0000-0000-000000000001', 'Mensal', 'Acesso completo à plataforma, cobrança mensal.', 9700, 'mensal', true),
  ('f1000000-0000-0000-0000-000000000002', 'Anual', 'Acesso completo à plataforma, cobrança anual (2 meses de desconto).', 97000, 'anual', true)
on conflict (id) do update set
  nome = excluded.nome, descricao = excluded.descricao, valor_centavos = excluded.valor_centavos,
  periodicidade = excluded.periodicidade, ativo = excluded.ativo;

-- Plano interno "Cortesia" — não aparece no catálogo público (ativo=false),
-- usado só como plano_id de referência quando fin_conceder_cortesia() roda.
insert into public.planos_assinatura (id, nome, descricao, valor_centavos, periodicidade, ativo)
values ('f1000000-0000-0000-0000-000000000003', 'Cortesia', 'Acesso de cortesia concedido manualmente pelo admin — sem cobrança.', 0, 'mensal', false)
on conflict (id) do update set
  nome = excluded.nome, descricao = excluded.descricao, valor_centavos = excluded.valor_centavos,
  periodicidade = excluded.periodicidade, ativo = excluded.ativo;

-- Cortesia pré-lançamento pra marlos.h.santos@gmail.com — nada bloqueia o
-- uso dele enquanto a plataforma ainda não tem assinantes pagantes reais.
insert into public.assinaturas (id, usuario_id, plano_id, status, observacao)
values (
  'f1000000-0000-0000-0000-0000000000a1',
  '5d23ca46-0628-4d5b-ae81-23b8bedf68fc',
  'f1000000-0000-0000-0000-000000000003',
  'cortesia',
  'Cortesia pré-lançamento — fundador da plataforma'
)
on conflict (id) do update set
  usuario_id = excluded.usuario_id, plano_id = excluded.plano_id,
  status = excluded.status, observacao = excluded.observacao;

-- Duas cobranças de teste na assinatura de cortesia acima, só pra existir
-- algo pra renderizar no histórico de cobranças e nas telas do admin —
-- claramente marcadas em observacao, não são cobranças reais do Asaas.
insert into public.cobrancas (id, assinatura_id, valor_centavos, status, metodo, vencimento, pago_em, observacao)
values
  (
    'f1000000-0000-0000-0000-0000000000b1',
    'f1000000-0000-0000-0000-0000000000a1',
    9700, 'confirmada', 'pix', (current_date - interval '20 days')::date, now() - interval '20 days',
    'Dado de teste — não é cobrança real do Asaas'
  ),
  (
    'f1000000-0000-0000-0000-0000000000b2',
    'f1000000-0000-0000-0000-0000000000a1',
    9700, 'pendente', null, (current_date + interval '10 days')::date, null,
    'Dado de teste — não é cobrança real do Asaas'
  )
on conflict (id) do update set
  assinatura_id = excluded.assinatura_id, valor_centavos = excluded.valor_centavos, status = excluded.status,
  metodo = excluded.metodo, vencimento = excluded.vencimento, pago_em = excluded.pago_em, observacao = excluded.observacao;

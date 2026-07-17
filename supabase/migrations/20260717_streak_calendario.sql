-- ============================================================
-- Sistema de streak (dias consecutivos) com calendário e proteções.
-- Substitui, só para a pílula/popover do header, a streak derivada de
-- gamificacao_extrato(gatilho_codigo='login_diario') (gam_calcular_streak,
-- ver 20260713_gamificacao_nav_streak.sql) — essa RPC continua existindo e
-- é usada de outros lugares (admin_usuario_ficha, resumo quinzenal por
-- email), não foi tocada. O novo motor é baseado em acesso real por dia
-- (não em crédito de gamificação) e adiciona proteção automática (2/mês)
-- e histórico em calendário, coisas que gam_calcular_streak não tinha.
-- ============================================================

-- ---------- Tabelas ----------
create table if not exists public.streak_dias (
  usuario_id uuid not null references auth.users(id) on delete cascade,
  dia date not null,
  protegido boolean not null default false,
  primary key (usuario_id, dia)
);

create index if not exists idx_streak_dias_usuario_dia
  on public.streak_dias (usuario_id, dia desc);

alter table public.streak_dias enable row level security;

drop policy if exists streak_dias_select_proprio on public.streak_dias;
create policy streak_dias_select_proprio on public.streak_dias
  for select using (auth.uid() = usuario_id);
-- Sem policy de insert/update/delete: única escrita é via RPC security definer.

create table if not exists public.streak_estado (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  sequencia_atual int not null default 0,
  recorde int not null default 0,
  ultimo_acesso date,
  protecoes_usadas_mes int not null default 0,
  mes_referencia_protecoes date
);

alter table public.streak_estado enable row level security;

drop policy if exists streak_estado_select_proprio on public.streak_estado;
create policy streak_estado_select_proprio on public.streak_estado
  for select using (auth.uid() = usuario_id);
-- Sem policy de insert/update/delete: única escrita é via RPC security definer.

-- ---------- RPC: registrar_acesso_diario() ----------
-- Idempotente por dia (fuso America/Sao_Paulo). Chamada em toda carga de
-- página autenticada (lib/queries/nav.ts, chokepoint de dados do header).
create or replace function public.registrar_acesso_diario()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ja_hoje boolean;
  v_estado public.streak_estado%rowtype;
  v_mes_atual date;
  v_gap int;
  v_registrou boolean := false;
begin
  if v_usuario is null then
    return null;
  end if;

  select exists(
    select 1 from public.streak_dias where usuario_id = v_usuario and dia = v_hoje
  ) into v_ja_hoje;

  if not v_ja_hoje then
    v_registrou := true;

    insert into public.streak_dias (usuario_id, dia, protegido) values (v_usuario, v_hoje, false);

    insert into public.streak_estado (usuario_id) values (v_usuario)
      on conflict (usuario_id) do nothing;

    select * into v_estado from public.streak_estado where usuario_id = v_usuario for update;

    v_mes_atual := date_trunc('month', v_hoje)::date;
    if v_estado.mes_referencia_protecoes is distinct from v_mes_atual then
      v_estado.protecoes_usadas_mes := 0;
      v_estado.mes_referencia_protecoes := v_mes_atual;
    end if;

    v_gap := v_hoje - coalesce(v_estado.ultimo_acesso, v_hoje - 1);

    if v_gap = 1 then
      v_estado.sequencia_atual := v_estado.sequencia_atual + 1;
    elsif v_gap = 2 and v_estado.protecoes_usadas_mes < 2 then
      v_estado.protecoes_usadas_mes := v_estado.protecoes_usadas_mes + 1;
      insert into public.streak_dias (usuario_id, dia, protegido)
        values (v_usuario, v_hoje - 1, true)
        on conflict (usuario_id, dia) do update set protegido = true;
      v_estado.sequencia_atual := v_estado.sequencia_atual + 2;
    else
      -- gap = 2 sem proteção disponível, gap > 2, ou estado inconsistente (gap <= 0)
      v_estado.sequencia_atual := 1;
    end if;

    v_estado.recorde := greatest(v_estado.recorde, v_estado.sequencia_atual);
    v_estado.ultimo_acesso := v_hoje;

    update public.streak_estado set
      sequencia_atual = v_estado.sequencia_atual,
      recorde = v_estado.recorde,
      ultimo_acesso = v_estado.ultimo_acesso,
      protecoes_usadas_mes = v_estado.protecoes_usadas_mes,
      mes_referencia_protecoes = v_estado.mes_referencia_protecoes
    where usuario_id = v_usuario;
  else
    select * into v_estado from public.streak_estado where usuario_id = v_usuario;
  end if;

  return jsonb_build_object(
    'sequencia_atual', coalesce(v_estado.sequencia_atual, 0),
    'recorde', coalesce(v_estado.recorde, 0),
    'protecoes_restantes', 2 - coalesce(v_estado.protecoes_usadas_mes, 0),
    'registrou_hoje', v_registrou
  );
end;
$$;

-- Postgres concede EXECUTE a PUBLIC por padrão na criação da função — revogar
-- só de anon não basta (mesma pegadinha de notificar(), ver CLAUDE.md/seção
-- Notificações: anon herda execução via PUBLIC mesmo com revoke específico).
revoke execute on function public.registrar_acesso_diario() from public;
grant execute on function public.registrar_acesso_diario() to authenticated;

-- ---------- RPC: obter_streak(p_mes, p_ano) ----------
create or replace function public.obter_streak(p_mes int, p_ano int)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_usuario uuid := auth.uid();
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_estado public.streak_estado%rowtype;
  v_dias jsonb;
begin
  if v_usuario is null then
    return null;
  end if;

  if p_mes < 1 or p_mes > 12 then
    raise exception 'p_mes inválido: %', p_mes using errcode = '22023';
  end if;

  select * into v_estado from public.streak_estado where usuario_id = v_usuario;

  select coalesce(jsonb_agg(jsonb_build_object('dia', to_char(dia, 'YYYY-MM-DD'), 'protegido', protegido) order by dia), '[]'::jsonb)
  into v_dias
  from public.streak_dias
  where usuario_id = v_usuario
    and extract(year from dia) = p_ano
    and extract(month from dia) = p_mes;

  return jsonb_build_object(
    'sequencia_atual', coalesce(v_estado.sequencia_atual, 0),
    'recorde', coalesce(v_estado.recorde, 0),
    'protecoes_restantes',
      case
        when v_estado.mes_referencia_protecoes is distinct from date_trunc('month', v_hoje)::date then 2
        else 2 - coalesce(v_estado.protecoes_usadas_mes, 0)
      end,
    'dias', v_dias
  );
end;
$$;

revoke execute on function public.obter_streak(int, int) from public;
grant execute on function public.obter_streak(int, int) to authenticated;

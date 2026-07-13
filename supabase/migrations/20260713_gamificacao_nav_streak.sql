-- ============================================================
-- Consolidação pós-gamificação: saldo real pro nav, streak derivada
-- do extrato, e trava contra edição direta de xp/moedas/nivel em perfis
-- (a policy de update de perfis é só por linha — qualquer usuário logado
-- podia hoje sobrescrever seu próprio xp/moedas/nivel via chamada direta
-- ao Supabase, contornando o ledger).
-- ============================================================

-- ---------- View de saldo (fonte real pro nav) ----------
-- security_invoker=true: a view roda com os privilégios de quem consulta,
-- então herda as RLS de gamificacao_extrato (usuário só vê o próprio saldo,
-- admin vê todos) em vez de rodar com os privilégios do dono da view.
create or replace view public.gamificacao_saldo
with (security_invoker = true) as
select
  usuario_id,
  coalesce(sum(pontos), 0)::int as xp_total,
  coalesce(sum(moedas), 0)::int as moedas_total
from public.gamificacao_extrato
group by usuario_id;

grant select on public.gamificacao_saldo to authenticated;

-- ---------- Streak de login_diario (dias consecutivos) ----------
create or replace function public.gam_calcular_streak(p_usuario uuid)
returns int
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_dias date[];
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_cursor date;
  v_streak int := 0;
  i int;
begin
  select array_agg(dia order by dia desc) into v_dias
  from (
    select distinct (criado_em at time zone 'America/Sao_Paulo')::date as dia
    from public.gamificacao_extrato
    where usuario_id = p_usuario and gatilho_codigo = 'login_diario'
  ) t;

  if v_dias is null or array_length(v_dias, 1) = 0 then
    return 0;
  end if;

  -- se logou hoje, começa hoje; se não, a streak de ontem ainda vale
  -- (só quebra quando passa um dia inteiro sem login)
  if v_dias[1] = v_hoje then
    v_cursor := v_hoje;
  elsif v_dias[1] = v_hoje - 1 then
    v_cursor := v_hoje - 1;
  else
    return 0;
  end if;

  for i in 1 .. array_length(v_dias, 1) loop
    if v_dias[i] = v_cursor then
      v_streak := v_streak + 1;
      v_cursor := v_cursor - 1;
    else
      exit;
    end if;
  end loop;

  return v_streak;
end;
$$;

grant execute on function public.gam_calcular_streak(uuid) to authenticated;

-- ---------- Trava: xp/moedas/nivel em perfis só mudam via creditar_gamificacao ----------
create or replace function public.gam_proteger_perfis_xp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('app.gamificacao_write', true), '') <> 'on' then
    new.xp := old.xp;
    new.moedas := old.moedas;
    new.nivel := old.nivel;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_gam_proteger_perfis on public.perfis;
create trigger trg_gam_proteger_perfis
  before update of xp, moedas, nivel on public.perfis
  for each row execute function public.gam_proteger_perfis_xp();

-- creditar_gamificacao precisa sinalizar a trava antes de escrever em perfis
create or replace function public.creditar_gamificacao(
  p_usuario uuid,
  p_codigo text,
  p_referencia_tipo text default null,
  p_referencia_id uuid default null,
  p_pontos_override int default null,
  p_moedas_override int default null,
  p_pular_idempotencia boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config public.config_gamificacao%rowtype;
  v_gatilho public.gamificacao_gatilhos%rowtype;
  v_contagem_dia int;
  v_ja_existe boolean;
  v_pontos int;
  v_moedas int;
  v_xp_total int;
  v_moedas_total int;
  v_nivel_nome text;
  v_nivel_ordem int;
begin
  select * into v_config from public.config_gamificacao where id = 1;
  if not found or not v_config.gamificacao_ativa or not v_config.gatilhos_ativos then
    return jsonb_build_object('creditado', false, 'motivo', 'desativado');
  end if;

  select * into v_gatilho from public.gamificacao_gatilhos where codigo = p_codigo and ativo = true;
  if not found then
    return jsonb_build_object('creditado', false, 'motivo', 'gatilho_invalido');
  end if;

  if v_gatilho.limite_diario is not null then
    select count(*) into v_contagem_dia
    from public.gamificacao_extrato
    where usuario_id = p_usuario and gatilho_codigo = p_codigo
      and (criado_em at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date;
    if v_contagem_dia >= v_gatilho.limite_diario then
      return jsonb_build_object('creditado', false, 'motivo', 'limite_diario');
    end if;
  end if;

  if p_referencia_id is not null and not p_pular_idempotencia then
    select exists(
      select 1 from public.gamificacao_extrato
      where usuario_id = p_usuario and gatilho_codigo = p_codigo
        and referencia_tipo = p_referencia_tipo and referencia_id = p_referencia_id
    ) into v_ja_existe;
    if v_ja_existe then
      return jsonb_build_object('creditado', false, 'motivo', 'duplicado');
    end if;
  end if;

  v_pontos := coalesce(p_pontos_override, v_gatilho.pontos);
  v_moedas := coalesce(p_moedas_override, v_gatilho.moedas);

  if v_pontos = 0 and v_moedas = 0 then
    return jsonb_build_object('creditado', false, 'motivo', 'sem_valor');
  end if;

  insert into public.gamificacao_extrato (usuario_id, gatilho_codigo, pontos, moedas, referencia_tipo, referencia_id)
  values (p_usuario, p_codigo, v_pontos, v_moedas, p_referencia_tipo, p_referencia_id)
  on conflict do nothing;

  select coalesce(sum(pontos), 0), coalesce(sum(moedas), 0)
  into v_xp_total, v_moedas_total
  from public.gamificacao_extrato where usuario_id = p_usuario;

  select nome, ordem into v_nivel_nome, v_nivel_ordem
  from public.gamificacao_niveis
  where pontos_minimos <= v_xp_total
  order by pontos_minimos desc limit 1;

  perform set_config('app.gamificacao_write', 'on', true);
  update public.perfis
  set xp = v_xp_total, moedas = v_moedas_total, nivel = coalesce(v_nivel_ordem, 0)
  where id = p_usuario;

  return jsonb_build_object(
    'creditado', true, 'pontos', v_pontos, 'moedas', v_moedas,
    'xp_total', v_xp_total, 'moedas_total', v_moedas_total, 'nivel_atual', v_nivel_nome
  );
end;
$$;

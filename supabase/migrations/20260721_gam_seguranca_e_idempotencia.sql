-- ============================================================
-- Motor de gamificação — bloco 0: correção de segurança urgente +
-- idempotência real do ledger.
--
-- ACHADO CRÍTICO (auditoria pré-tarefa): creditar_gamificacao tinha
-- EXECUTE liberado pra PUBLIC/anon/authenticated (mesma pegadinha de
-- grants default do Postgres já documentada pro notificar() no
-- CLAUDE.md, mas que não tinha sido aplicada aqui). Qualquer visitante
-- conseguia creditar XP arbitrário pra qualquer usuário chamando a RPC
-- direto do browser, já que a função nem checa auth.uid() = p_usuario.
-- Revogado — só SECURITY DEFINER (triggers/RPCs) chama a partir de agora.
-- ============================================================

revoke execute on function public.creditar_gamificacao(uuid, text, text, uuid, int, int, boolean) from public, anon, authenticated;

-- login_diario era creditado via lib/gamificacao/login-diario.ts chamando
-- creditar_gamificacao direto (client autenticado comum) — migrado pra
-- dentro de registrar_acesso_diario() (chokepoint real do streak nascente,
-- chamado por nav.ts em toda página autenticada e por app/layout.tsx —
-- já é security definer com auth.uid() interno, seguro deixar EXECUTE pra
-- authenticated porque não recebe usuário como parâmetro). Também passa a
-- creditar os marcos de streak (7/30 dias).
create or replace function public.registrar_acesso_diario()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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

    perform public.creditar_gamificacao(v_usuario, 'login_diario', 'streak_dia', gen_random_uuid());

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

    if v_estado.sequencia_atual = 7 then
      perform public.creditar_gamificacao(v_usuario, 'streak_7', 'streak_marco_7', gen_random_uuid());
    elsif v_estado.sequencia_atual = 30 then
      perform public.creditar_gamificacao(v_usuario, 'streak_30', 'streak_marco_30', gen_random_uuid());
    end if;
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
$function$;

-- idempotência real: constraint física, não só a checagem EXISTS de antes
-- (que era vulnerável a corrida). login_diario e marcos de streak usam
-- gen_random_uuid() de propósito — sua idempotência já vem da lógica acima
-- (v_ja_hoje / sequencia_atual), não desta constraint.
create unique index if not exists uq_gamificacao_extrato_idempotencia
  on public.gamificacao_extrato (usuario_id, gatilho_codigo, referencia_tipo, referencia_id)
  where referencia_id is not null;

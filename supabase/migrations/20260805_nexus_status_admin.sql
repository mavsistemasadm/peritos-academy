-- ============================================================
-- adm_definir_nexus_status: admin marca/desmarca o aluno como assinante Nexus
--
-- Precisa ser RPC security definer, e não escrita direta na tabela, porque a
-- policy de update de `perfis` é por linha (auth.uid() = id) — um admin não é
-- dono da linha do aluno e seria barrado pelo RLS. Mesmo padrão de
-- adm_suspender_usuario / adm_ajustar_gamificacao.
--
-- Enquanto não existe integração de assinatura entre Nexus e Academy, esta é
-- a única forma de marcar alguém como assinante. Quando a integração chegar,
-- ela passa a escrever no mesmo campo e esta RPC continua valendo pro caso
-- manual (cortesia, suporte, correção).
-- ============================================================

-- 'nexus_status' entra no vocabulário do log de ações administrativas —
-- usar 'ajuste_gamificacao' emprestado deixaria a aba Auditoria mentindo.
alter table public.admin_log_acoes_usuario drop constraint if exists admin_log_acoes_usuario_acao_check;
alter table public.admin_log_acoes_usuario add constraint admin_log_acoes_usuario_acao_check
  check (acao = any (array[
    'suspender', 'reativar', 'banir', 'resetar_senha',
    'ajuste_gamificacao', 'emitir_certificado_manual', 'nexus_status'
  ]));

create or replace function public.adm_definir_nexus_status(
  p_usuario_id uuid,
  p_status text,
  p_justificativa text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_antes text;
begin
  if not public.is_admin_papel(v_admin, array['super_admin', 'suporte']) then
    raise exception 'sem permissão';
  end if;
  if p_status not in ('none', 'active', 'cancelled') then
    raise exception 'status inválido: %', p_status;
  end if;
  if coalesce(btrim(p_justificativa), '') = '' then
    raise exception 'justificativa é obrigatória';
  end if;

  select nexus_status into v_antes from public.perfis where id = p_usuario_id;
  if v_antes is null then
    raise exception 'aluno não encontrado';
  end if;

  update public.perfis
  set nexus_status = p_status,
      nexus_assinado_em = case when p_status = 'active' then now() else nexus_assinado_em end,
      nexus_cancelado_em = case when p_status = 'cancelled' then now() else nexus_cancelado_em end
  where id = p_usuario_id;

  insert into public.admin_log_acoes_usuario (admin_id, alvo_usuario_id, acao, justificativa, detalhe)
  values (
    v_admin, p_usuario_id, 'nexus_status', btrim(p_justificativa),
    jsonb_build_object('de', v_antes, 'para', p_status)
  );

  return jsonb_build_object('ok', true, 'de', v_antes, 'para', p_status);
end;
$$;

revoke execute on function public.adm_definir_nexus_status(uuid, text, text) from public;
grant execute on function public.adm_definir_nexus_status(uuid, text, text) to authenticated;

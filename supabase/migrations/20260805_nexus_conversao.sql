-- ============================================================
-- Fecha o laço da conversão das sugestões do Nexus
--
-- A tabela nexus_cta_interactions já aceitava a ação 'assinou', mas nada
-- gravava — então a métrica principal da spec ("taxa de conversão: clique ->
-- assinatura do Nexus") era impossível de calcular. Agora, quando o aluno é
-- marcado como assinante, a conversão é registrada e ATRIBUÍDA ao último app
-- em que ele clicou (ou, na falta de clique, ao último que viu).
--
-- Atribuição por último clique é a escolha simples e honesta aqui: sem
-- integração com o Nexus não existe funil real pra rastrear, e o que se quer
-- responder é "qual app despertou o interesse que virou assinatura".
-- ============================================================

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
  v_app_atribuido text;
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

  -- Virou assinante: registra a conversão, atribuída ao último app clicado
  -- (preferência) ou ao último exibido. Só quando é ENTRADA em 'active', pra
  -- não contar duas vezes se o admin reconfirmar o mesmo status.
  if p_status = 'active' and v_antes <> 'active' then
    select app into v_app_atribuido
    from public.nexus_cta_interactions
    where usuario_id = p_usuario_id and acao = 'clicada'
    order by criado_em desc
    limit 1;

    if v_app_atribuido is null then
      select app into v_app_atribuido
      from public.nexus_cta_interactions
      where usuario_id = p_usuario_id and acao = 'exibida'
      order by criado_em desc
      limit 1;
    end if;

    insert into public.nexus_cta_interactions (usuario_id, app, placement, acao, contexto)
    values (
      p_usuario_id,
      coalesce(v_app_atribuido, 'sem_atribuicao'),
      'perfil',  -- placement é not null; a conversão não nasce de um placement
      'assinou',
      case when v_app_atribuido is null then 'sem interacao previa' else 'ultimo app clicado/exibido' end
    );
  end if;

  insert into public.admin_log_acoes_usuario (admin_id, alvo_usuario_id, acao, justificativa, detalhe)
  values (
    v_admin, p_usuario_id, 'nexus_status', btrim(p_justificativa),
    jsonb_build_object('de', v_antes, 'para', p_status, 'app_atribuido', v_app_atribuido)
  );

  return jsonb_build_object('ok', true, 'de', v_antes, 'para', p_status, 'app_atribuido', v_app_atribuido);
end;
$$;

revoke execute on function public.adm_definir_nexus_status(uuid, text, text) from public;
grant execute on function public.adm_definir_nexus_status(uuid, text, text) to authenticated;

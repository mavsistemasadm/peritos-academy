-- ============================================================
-- admin_usuario_ficha() tinha dois consumidores obsoletos do motor de
-- gamificação, achados na auditoria pós-recalibração. Registro pós-
-- aplicação via MCP (name=gam_admin_ficha_dados_reais).
--
-- 1) Nível calculado só por XP (mesmo bug já corrigido em nav.ts/home.ts/
--    perfil.ts) — ignorava requisito composto. Trocado por gam_nivel_real.
-- 2) Streak lido via gam_calcular_streak() (RPC antiga, deriva de
--    gamificacao_extrato) em vez de streak_estado (fonte real, mesma que
--    a pílula do nav usa) — a divergência entre os dois já estava
--    sinalizada como pendência da tarefa original. Trocado.
-- ============================================================

create or replace function public.admin_usuario_ficha(p_usuario_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_perfil public.perfis%rowtype;
  v_email text;
  v_ultimo_acesso timestamptz;
  v_assinatura jsonb;
  v_xp int; v_moedas int; v_nivel int; v_nivel_nome text; v_streak int;
  v_cursos jsonb; v_avaliacoes jsonb; v_certificados jsonb;
  v_posts_count int; v_comentarios_count int;
begin
  if not public.is_admin_papel(auth.uid(), array['super_admin','suporte']) then
    raise exception 'Sem permissão.';
  end if;

  select * into v_perfil from public.perfis where id = p_usuario_id;
  if not found then
    raise exception 'Usuário não encontrado.';
  end if;

  select email, last_sign_in_at into v_email, v_ultimo_acesso from auth.users where id = p_usuario_id;

  select jsonb_build_object(
    'id', a.id, 'status', a.status, 'plano_nome', pa.nome,
    'proxima_cobranca', a.proxima_cobranca, 'iniciada_em', a.iniciada_em, 'observacao', a.observacao,
    'cobrancas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'valor_centavos', c.valor_centavos, 'status', c.status,
        'vencimento', c.vencimento, 'pago_em', c.pago_em, 'metodo', c.metodo
      ) order by c.vencimento desc)
      from public.cobrancas c where c.assinatura_id = a.id
    ), '[]'::jsonb)
  ) into v_assinatura
  from public.assinaturas a join public.planos_assinatura pa on pa.id = a.plano_id
  where a.usuario_id = p_usuario_id and a.status <> 'cancelada'
  limit 1;

  select coalesce(sum(pontos), 0), coalesce(sum(moedas), 0) into v_xp, v_moedas
  from public.gamificacao_extrato where usuario_id = p_usuario_id;

  select nr.nivel_ordem, nr.nivel_nome into v_nivel, v_nivel_nome
  from public.gam_nivel_real(p_usuario_id, v_xp) nr;

  select coalesce(sequencia_atual, 0) into v_streak
  from public.streak_estado where usuario_id = p_usuario_id;
  v_streak := coalesce(v_streak, 0);

  select coalesce(jsonb_agg(jsonb_build_object(
    'curso_id', c.id, 'titulo', c.titulo, 'slug', c.slug,
    'total_aulas', ca.total_aulas, 'aulas_concluidas', ca.concluidas,
    'pct', case when ca.total_aulas > 0 then round(ca.concluidas::numeric / ca.total_aulas * 100) else 0 end
  ) order by c.titulo), '[]'::jsonb) into v_cursos
  from public.cursos c
  join lateral (
    select count(*) as total_aulas, count(*) filter (where ap.concluida) as concluidas
    from public.aulas au
    join public.modulos m on m.id = au.modulo_id
    left join public.aula_progresso ap on ap.aula_id = au.id and ap.usuario_id = p_usuario_id
    where m.curso_id = c.id
  ) ca on true
  where ca.concluidas > 0;

  select coalesce(jsonb_agg(jsonb_build_object(
    'avaliacao_id', av.id, 'titulo', av.titulo, 'curso_titulo', c.titulo,
    'melhor_nota', t.melhor_nota, 'aprovado', t.aprovado, 'tentativas', t.tentativas
  ) order by av.titulo), '[]'::jsonb) into v_avaliacoes
  from public.avaliacoes av
  join public.cursos c on c.id = av.curso_id
  join lateral (
    select max(nota) as melhor_nota, bool_or(aprovado) as aprovado, count(*) as tentativas
    from public.avaliacao_tentativas t where t.avaliacao_id = av.id and t.usuario_id = p_usuario_id
  ) t on true
  where t.tentativas > 0;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ce.id, 'numero', ce.numero, 'curso_titulo', ce.curso_titulo,
    'nota', ce.nota, 'emitido_em', ce.emitido_em
  ) order by ce.emitido_em desc), '[]'::jsonb) into v_certificados
  from public.certificados ce where ce.usuario_id = p_usuario_id and ce.numero is not null;

  select count(*) into v_posts_count from public.comunidade_posts where usuario_id = p_usuario_id;
  select count(*) into v_comentarios_count from public.comunidade_comentarios where usuario_id = p_usuario_id;

  return jsonb_build_object(
    'id', v_perfil.id, 'nome', v_perfil.nome, 'email', v_email, 'foto_url', v_perfil.foto_url,
    'slug', v_perfil.slug, 'status', v_perfil.status, 'criado_em', v_perfil.criado_em,
    'ultimo_acesso', v_ultimo_acesso, 'cidade', v_perfil.cidade, 'estado', v_perfil.estado,
    'assinatura', v_assinatura,
    'xp', v_xp, 'moedas', v_moedas, 'nivel', coalesce(v_nivel, 0), 'nivel_nome', coalesce(v_nivel_nome, 'Iniciante'),
    'streak', v_streak,
    'cursos', v_cursos, 'avaliacoes', v_avaliacoes, 'certificados', v_certificados,
    'posts_count', v_posts_count, 'comentarios_count', v_comentarios_count
  );
end;
$function$;

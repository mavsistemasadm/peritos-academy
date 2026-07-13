-- ============================================================
-- USUÁRIOS (suporte ao aluno): papel 'suporte', perfis.status,
-- log unificado de ações administrativas, RPCs de consolidação
-- (leitura agregada) e RPCs de ação (suspender/reativar/banir/
-- resetar senha/ajuste de gamificação/certificado manual).
-- Rodado via Supabase MCP (ver CLAUDE.md — fluxo de trabalho).
-- ============================================================

-- ---------- papel 'suporte' ----------
alter table public.admin_usuarios drop constraint if exists admin_usuarios_papel_check;
alter table public.admin_usuarios add constraint admin_usuarios_papel_check
  check (papel in ('super_admin','conteudo','financeiro','moderador','suporte'));

-- ---------- perfis.status ----------
alter table public.perfis add column if not exists status text not null default 'ativo';
alter table public.perfis drop constraint if exists perfis_status_check;
alter table public.perfis add constraint perfis_status_check check (status in ('ativo','suspenso','banido'));

-- ---------- admin_log_acoes_usuario ----------
-- Log dedicado (em vez de esticar financeiro_log_acoes): financeiro_log_acoes
-- tem FK pra assinatura_id e um vocabulário de ação (conceder_cortesia/
-- suspender/reativar/cancelar) que é sobre a ASSINATURA, não sobre o usuário
-- em si — misturar as duas coisas exigiria afrouxar a FK e o vocabulário pra
-- um domínio diferente. A aba "Auditoria" da ficha do aluno faz UNION dos
-- dois logs (ver admin_usuario_auditoria) pra dar a visão completa.
create table if not exists public.admin_log_acoes_usuario (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.perfis(id),
  alvo_usuario_id uuid not null references public.perfis(id) on delete cascade,
  acao text not null check (acao in ('suspender','reativar','banir','resetar_senha','ajuste_gamificacao','emitir_certificado_manual')),
  justificativa text,
  detalhe jsonb,
  criado_em timestamptz not null default now()
);
create index if not exists idx_admin_log_usuario_alvo on public.admin_log_acoes_usuario(alvo_usuario_id, criado_em desc);
alter table public.admin_log_acoes_usuario enable row level security;

drop policy if exists admin_log_usuario_leitura on public.admin_log_acoes_usuario;
create policy admin_log_usuario_leitura on public.admin_log_acoes_usuario
  for select using (public.is_admin_papel(auth.uid(), array['super_admin','suporte']));
-- Sem policy de insert: só as RPCs security definer abaixo escrevem aqui
-- (mesmo padrão de financeiro_log_acoes).

-- ---------- gatilho especial 'ajuste_admin' ----------
-- ativo=true pra funcionar via creditar_gamificacao (idempotência/limite
-- diário e o FK de gamificacao_extrato dependem do gatilho existir e estar
-- ativo) — "uso restrito a esta RPC" é garantido arquiteturalmente (nenhum
-- trigger automático do motor de gamificação referencia esse código, só
-- adm_ajustar_gamificacao chama), não pelo flag ativo.
insert into public.gamificacao_gatilhos (codigo, nome, descricao, pontos, moedas, limite_diario, ativo, categoria)
values ('ajuste_admin', 'Ajuste manual (admin)', 'Correção pontual de XP/moedas feita por um admin, com justificativa', 0, 0, null, true, 'especial')
on conflict (codigo) do update set nome = excluded.nome, descricao = excluded.descricao, categoria = excluded.categoria;

-- ---------- fin_conceder_cortesia: amplia pra 'suporte' ----------
-- A ficha do aluno (módulo Usuários) reusa esta RPC em vez de duplicá-la
-- (spec explícita) — só o gate de permissão muda pra também aceitar
-- 'suporte'; as outras ações financeiras (suspender/reativar/cancelar
-- assinatura) continuam restritas a super_admin/financeiro.
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
  if not public.is_admin_papel(v_admin_id, array['super_admin','financeiro','suporte']) then
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

-- ============================================================
-- RPCs de leitura agregada (consolidação — sem tabelas espelho)
-- ============================================================

-- admin_listar_usuarios: lista paginada com busca/filtros/ordenação.
-- Security definer pra poder juntar auth.users (email, último acesso via
-- last_sign_in_at) sem precisar de service role — mesmo padrão de
-- admin_buscar_usuario_por_email.
create or replace function public.admin_listar_usuarios(
  p_busca text default null,
  p_status_conta text default null,
  p_status_assinatura text default null,
  p_nivel int default null,
  p_ativos_dias int default null,
  p_ordenar_por text default 'criado_em',
  p_ordenar_dir text default 'desc',
  p_offset int default 0,
  p_limit int default 25
)
returns table(
  id uuid, nome text, email text, foto_url text, slug text,
  status text, criado_em timestamptz, ultimo_acesso timestamptz,
  assinatura_status text, nivel int, nivel_nome text,
  total_count bigint
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin_papel(auth.uid(), array['super_admin','suporte']) then
    raise exception 'Sem permissão.';
  end if;

  return query
  with base as (
    select
      p.id, p.nome, u.email::text as email, p.foto_url, p.slug, p.status, p.criado_em,
      u.last_sign_in_at as ultimo_acesso,
      coalesce(a.status, 'sem_assinatura') as assinatura_status,
      p.nivel,
      (select n.nome from public.gamificacao_niveis n where n.ordem = p.nivel) as nivel_nome
    from public.perfis p
    join auth.users u on u.id = p.id
    left join public.assinaturas a on a.usuario_id = p.id and a.status <> 'cancelada'
  ),
  filtrado as (
    select * from base b
    where
      (p_busca is null or btrim(p_busca) = '' or b.nome ilike '%' || p_busca || '%' or b.email ilike '%' || p_busca || '%')
      and (p_status_conta is null or b.status = p_status_conta)
      and (p_status_assinatura is null or b.assinatura_status = p_status_assinatura)
      and (p_nivel is null or b.nivel = p_nivel)
      and (p_ativos_dias is null or b.ultimo_acesso >= now() - (p_ativos_dias || ' days')::interval)
  )
  select f.*, count(*) over() as total_count
  from filtrado f
  order by
    case when p_ordenar_por = 'nome' and p_ordenar_dir = 'asc' then f.nome end asc,
    case when p_ordenar_por = 'nome' and p_ordenar_dir = 'desc' then f.nome end desc,
    case when p_ordenar_por = 'nivel' and p_ordenar_dir = 'asc' then f.nivel end asc,
    case when p_ordenar_por = 'nivel' and p_ordenar_dir = 'desc' then f.nivel end desc,
    case when p_ordenar_por = 'ultimo_acesso' and p_ordenar_dir = 'asc' then f.ultimo_acesso end asc,
    case when p_ordenar_por = 'ultimo_acesso' and p_ordenar_dir = 'desc' then f.ultimo_acesso end desc,
    case when p_ordenar_por = 'criado_em' and p_ordenar_dir = 'asc' then f.criado_em end asc,
    case when (p_ordenar_por is null or p_ordenar_por = 'criado_em') and p_ordenar_dir <> 'asc' then f.criado_em end desc
  offset p_offset limit p_limit;
end;
$$;
grant execute on function public.admin_listar_usuarios(text,text,text,int,int,text,text,int,int) to authenticated;

-- admin_usuario_ficha: consolida visão geral + progresso + gamificação
-- atual + assinatura atual + contagens de comunidade num único round-trip.
create or replace function public.admin_usuario_ficha(p_usuario_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
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

  select nome, ordem into v_nivel_nome, v_nivel
  from public.gamificacao_niveis where pontos_minimos <= v_xp order by pontos_minimos desc limit 1;

  v_streak := public.gam_calcular_streak(p_usuario_id);

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
$$;
grant execute on function public.admin_usuario_ficha(uuid) to authenticated;

-- admin_usuario_extrato: ledger paginado (aba Gamificação).
create or replace function public.admin_usuario_extrato(p_usuario_id uuid, p_offset int default 0, p_limit int default 20)
returns table(id uuid, gatilho_codigo text, gatilho_nome text, pontos int, moedas int, criado_em timestamptz, total_count bigint)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin_papel(auth.uid(), array['super_admin','suporte']) then
    raise exception 'Sem permissão.';
  end if;

  return query
  select e.id, e.gatilho_codigo, g.nome, e.pontos, e.moedas, e.criado_em, count(*) over() as total_count
  from public.gamificacao_extrato e
  left join public.gamificacao_gatilhos g on g.codigo = e.gatilho_codigo
  where e.usuario_id = p_usuario_id
  order by e.criado_em desc
  offset p_offset limit p_limit;
end;
$$;
grant execute on function public.admin_usuario_extrato(uuid,int,int) to authenticated;

-- admin_usuario_comunidade: posts/comentários recentes (aba Comunidade).
create or replace function public.admin_usuario_comunidade(p_usuario_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare v_posts jsonb; v_comentarios jsonb;
begin
  if not public.is_admin_papel(auth.uid(), array['super_admin','suporte']) then
    raise exception 'Sem permissão.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'titulo', p.titulo, 'corpo', left(p.corpo, 200), 'tipo', p.tipo, 'criado_em', p.criado_em
  ) order by p.criado_em desc), '[]'::jsonb) into v_posts
  from (select * from public.comunidade_posts where usuario_id = p_usuario_id order by criado_em desc limit 10) p;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'post_id', c.post_id, 'corpo', left(c.corpo, 200), 'criado_em', c.criado_em
  ) order by c.criado_em desc), '[]'::jsonb) into v_comentarios
  from (select * from public.comunidade_comentarios where usuario_id = p_usuario_id order by criado_em desc limit 10) c;

  return jsonb_build_object('posts', v_posts, 'comentarios', v_comentarios);
end;
$$;
grant execute on function public.admin_usuario_comunidade(uuid) to authenticated;

-- admin_usuario_auditoria: UNION de admin_log_acoes_usuario (ações sobre o
-- usuário) com financeiro_log_acoes (cortesias concedidas por esta ficha),
-- filtrado pelo usuário-alvo — dá a visão completa na aba Auditoria mesmo
-- pra quem só tem o papel 'suporte' (sem acesso direto ao financeiro_log_acoes).
create or replace function public.admin_usuario_auditoria(p_usuario_id uuid)
returns table(id uuid, admin_id uuid, admin_nome text, acao text, justificativa text, detalhe jsonb, criado_em timestamptz)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin_papel(auth.uid(), array['super_admin','suporte']) then
    raise exception 'Sem permissão.';
  end if;

  return query
  select l.id, l.admin_id, pa.nome, l.acao, l.justificativa, l.detalhe, l.criado_em
  from public.admin_log_acoes_usuario l
  join public.perfis pa on pa.id = l.admin_id
  where l.alvo_usuario_id = p_usuario_id
  union all
  select f.id, f.admin_id, pb.nome, f.acao, f.observacao, null::jsonb, f.criado_em
  from public.financeiro_log_acoes f
  join public.assinaturas a on a.id = f.assinatura_id
  join public.perfis pb on pb.id = f.admin_id
  where a.usuario_id = p_usuario_id
  order by criado_em desc;
end;
$$;
grant execute on function public.admin_usuario_auditoria(uuid) to authenticated;

-- ============================================================
-- RPCs de ação (todas logam em admin_log_acoes_usuario, justificativa obrigatória)
-- ============================================================

create or replace function public.adm_suspender_usuario(p_usuario_id uuid, p_justificativa text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_admin uuid := auth.uid();
begin
  if not public.is_admin_papel(v_admin, array['super_admin','suporte']) then
    raise exception 'Sem permissão.';
  end if;
  if p_justificativa is null or btrim(p_justificativa) = '' then
    raise exception 'Justificativa é obrigatória.';
  end if;

  update public.perfis set status = 'suspenso' where id = p_usuario_id;

  insert into public.admin_log_acoes_usuario (admin_id, alvo_usuario_id, acao, justificativa)
    values (v_admin, p_usuario_id, 'suspender', p_justificativa);
end;
$$;
grant execute on function public.adm_suspender_usuario(uuid,text) to authenticated;

create or replace function public.adm_reativar_usuario(p_usuario_id uuid, p_justificativa text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_admin uuid := auth.uid();
begin
  if not public.is_admin_papel(v_admin, array['super_admin','suporte']) then
    raise exception 'Sem permissão.';
  end if;
  if p_justificativa is null or btrim(p_justificativa) = '' then
    raise exception 'Justificativa é obrigatória.';
  end if;

  update public.perfis set status = 'ativo' where id = p_usuario_id;

  insert into public.admin_log_acoes_usuario (admin_id, alvo_usuario_id, acao, justificativa)
    values (v_admin, p_usuario_id, 'reativar', p_justificativa);
end;
$$;
grant execute on function public.adm_reativar_usuario(uuid,text) to authenticated;

create or replace function public.adm_banir_usuario(p_usuario_id uuid, p_justificativa text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_admin uuid := auth.uid();
begin
  if not public.is_admin_papel(v_admin, array['super_admin','suporte']) then
    raise exception 'Sem permissão.';
  end if;
  if p_justificativa is null or btrim(p_justificativa) = '' then
    raise exception 'Justificativa é obrigatória.';
  end if;

  update public.perfis set status = 'banido' where id = p_usuario_id;

  insert into public.admin_log_acoes_usuario (admin_id, alvo_usuario_id, acao, justificativa)
    values (v_admin, p_usuario_id, 'banir', p_justificativa);
end;
$$;
grant execute on function public.adm_banir_usuario(uuid,text) to authenticated;

-- adm_resetar_senha: só resolve o e-mail + loga a ação (security definer,
-- enxerga auth.users como admin_buscar_usuario_por_email). Quem de fato
-- dispara o e-mail de recuperação é a Server Action, chamando
-- supabase.auth.resetPasswordForEmail(email) — o método padrão do Supabase
-- Auth, sem nunca definir senha diretamente e sem precisar de service role.
create or replace function public.adm_resetar_senha(p_usuario_id uuid, p_justificativa text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_admin uuid := auth.uid(); v_email text;
begin
  if not public.is_admin_papel(v_admin, array['super_admin','suporte']) then
    raise exception 'Sem permissão.';
  end if;
  if p_justificativa is null or btrim(p_justificativa) = '' then
    raise exception 'Justificativa é obrigatória.';
  end if;

  select email into v_email from auth.users where id = p_usuario_id;
  if v_email is null then
    raise exception 'Usuário não encontrado.';
  end if;

  insert into public.admin_log_acoes_usuario (admin_id, alvo_usuario_id, acao, justificativa)
    values (v_admin, p_usuario_id, 'resetar_senha', p_justificativa);

  return v_email;
end;
$$;
grant execute on function public.adm_resetar_senha(uuid,text) to authenticated;

-- adm_ajustar_gamificacao: lança um ajuste manual direto no ledger via
-- creditar_gamificacao (reusa recálculo de xp_total/moedas_total/nível já
-- testado ali) — referencia_id nulo, então nunca cai no bloqueio de
-- idempotência (cada ajuste é um lançamento novo, mesmo repetindo o gatilho).
create or replace function public.adm_ajustar_gamificacao(p_usuario_id uuid, p_pontos int, p_moedas int, p_justificativa text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_admin uuid := auth.uid(); v_resultado jsonb;
begin
  if not public.is_admin_papel(v_admin, array['super_admin','suporte']) then
    raise exception 'Sem permissão.';
  end if;
  if p_justificativa is null or btrim(p_justificativa) = '' then
    raise exception 'Justificativa é obrigatória.';
  end if;
  if coalesce(p_pontos, 0) = 0 and coalesce(p_moedas, 0) = 0 then
    raise exception 'Informe pontos ou moedas diferentes de zero.';
  end if;

  v_resultado := public.creditar_gamificacao(p_usuario_id, 'ajuste_admin', null, null, p_pontos, p_moedas, false);

  insert into public.admin_log_acoes_usuario (admin_id, alvo_usuario_id, acao, justificativa, detalhe)
    values (v_admin, p_usuario_id, 'ajuste_gamificacao', p_justificativa, jsonb_build_object('pontos', p_pontos, 'moedas', p_moedas));

  return v_resultado;
end;
$$;
grant execute on function public.adm_ajustar_gamificacao(uuid,int,int,text) to authenticated;

-- adm_emitir_certificado_manual: reusa a mecânica oficial de emissão
-- (numero via nextval_certificado(), mesma tabela/campos de
-- lib/certificados/gerar.ts, mesmo trigger trg_gam_certificados cascateando
-- pro motor de gamificação) mas pula de propósito a checagem de 100% de
-- conclusão (gam_curso_completo) — é exatamente pra isso que existe o botão
-- manual, pra exceções que o fluxo automático não cobre.
create or replace function public.adm_emitir_certificado_manual(p_usuario_id uuid, p_curso_id uuid, p_justificativa text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_curso public.cursos%rowtype;
  v_seq bigint;
  v_numero text;
  v_meses text[] := array['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  v_rotulo text;
begin
  if not public.is_admin_papel(v_admin, array['super_admin','suporte']) then
    raise exception 'Sem permissão.';
  end if;
  if p_justificativa is null or btrim(p_justificativa) = '' then
    raise exception 'Justificativa é obrigatória.';
  end if;

  select * into v_curso from public.cursos where id = p_curso_id;
  if not found then
    raise exception 'Curso não encontrado.';
  end if;

  if exists (select 1 from public.certificados where usuario_id = p_usuario_id and curso_id = p_curso_id and numero is not null) then
    raise exception 'Este aluno já tem certificado emitido para este curso — use o módulo Certificados pra revogar/reemitir.';
  end if;

  select public.nextval_certificado() into v_seq;
  v_numero := 'PA-' || extract(year from now()) || '-' || lpad(v_seq::text, 5, '0');
  v_rotulo := v_meses[extract(month from now())::int] || ' de ' || extract(year from now());

  insert into public.certificados (usuario_id, curso_id, curso_titulo, curso_slug, numero, carga_horas, emitido_em, emitido_rotulo, progresso_pct)
  values (p_usuario_id, p_curso_id, v_curso.titulo, v_curso.slug, v_numero, v_curso.carga_horas, now(), v_rotulo, 100)
  on conflict (usuario_id, curso_id) do update set
    numero = excluded.numero, emitido_em = excluded.emitido_em, emitido_rotulo = excluded.emitido_rotulo, progresso_pct = 100;

  insert into public.admin_log_acoes_usuario (admin_id, alvo_usuario_id, acao, justificativa, detalhe)
    values (v_admin, p_usuario_id, 'emitir_certificado_manual', p_justificativa,
      jsonb_build_object('curso_id', p_curso_id, 'curso_titulo', v_curso.titulo, 'numero', v_numero));

  return jsonb_build_object('emitido', true, 'numero', v_numero);
end;
$$;
grant execute on function public.adm_emitir_certificado_manual(uuid,uuid,text) to authenticated;

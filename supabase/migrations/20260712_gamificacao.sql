-- ============================================================
-- GAMIFICAÇÃO: config, catálogo de gatilhos, níveis, extrato (ledger),
-- RPC única de crédito, instrumentação dos eventos existentes,
-- e reforma de submeter_avaliacao (faixas de acerto x peso).
-- ============================================================

-- ---------- perfis: data de nascimento (pro gatilho de aniversário) ----------
alter table public.perfis add column if not exists data_nascimento date;

-- ---------- config_gamificacao (singleton) ----------
create table if not exists public.config_gamificacao (
  id int primary key default 1,
  gamificacao_ativa boolean not null default true,
  gatilhos_ativos boolean not null default true,
  ranking_ativo boolean not null default true,
  loja_ativa boolean not null default false,
  niveis_ativos boolean not null default true,
  exibir_pontuacao_perfil boolean not null default true,
  exibir_nivel_previa_perfil boolean not null default true,
  xp_singular text not null default 'Ponto de Experiência',
  xp_plural text not null default 'Pontos de Experiência',
  xp_abreviacao text not null default 'XP',
  moeda_singular text not null default 'Moeda',
  moeda_plural text not null default 'Moedas',
  moeda_abreviacao text not null default 'moedas',
  moeda_cor text,
  moeda_icone text,
  texto_como_acumular text,
  constraint config_gamificacao_singleton check (id = 1)
);
insert into public.config_gamificacao (id) values (1) on conflict (id) do nothing;
alter table public.config_gamificacao enable row level security;

-- ---------- gamificacao_gatilhos (catálogo) ----------
create table if not exists public.gamificacao_gatilhos (
  codigo text primary key,
  nome text not null,
  descricao text,
  pontos int not null default 0,
  moedas int not null default 0,
  limite_diario int,
  ativo boolean not null default true,
  categoria text not null check (categoria in ('comum','quiz','marco','especial')),
  atualizado_em timestamptz not null default now()
);
alter table public.gamificacao_gatilhos enable row level security;

-- ---------- gamificacao_niveis ----------
create table if not exists public.gamificacao_niveis (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  pontos_minimos int not null unique,
  selo_url text,
  ordem int not null
);
alter table public.gamificacao_niveis enable row level security;

-- ---------- gamificacao_extrato (ledger — fonte da verdade) ----------
create table if not exists public.gamificacao_extrato (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfis(id) on delete cascade,
  gatilho_codigo text not null references public.gamificacao_gatilhos(codigo),
  pontos int not null default 0,
  moedas int not null default 0,
  referencia_tipo text,
  referencia_id uuid,
  criado_em timestamptz not null default now()
);
create index if not exists idx_gam_extrato_usuario_gatilho_dia on public.gamificacao_extrato(usuario_id, gatilho_codigo, criado_em);
create unique index if not exists uq_gam_extrato_idempotencia
  on public.gamificacao_extrato(usuario_id, gatilho_codigo, referencia_tipo, referencia_id)
  where referencia_id is not null;
alter table public.gamificacao_extrato enable row level security;

-- ---------- RLS ----------
drop policy if exists config_gamificacao_leitura on public.config_gamificacao;
create policy config_gamificacao_leitura on public.config_gamificacao for select using (auth.uid() is not null);
drop policy if exists config_gamificacao_admin_update on public.config_gamificacao;
create policy config_gamificacao_admin_update on public.config_gamificacao for update
  using (public.is_admin_papel(auth.uid(), array['super_admin']))
  with check (public.is_admin_papel(auth.uid(), array['super_admin']));

drop policy if exists gatilhos_leitura on public.gamificacao_gatilhos;
create policy gatilhos_leitura on public.gamificacao_gatilhos for select using (auth.uid() is not null);
drop policy if exists gatilhos_admin_insert on public.gamificacao_gatilhos;
create policy gatilhos_admin_insert on public.gamificacao_gatilhos for insert with check (public.is_admin_papel(auth.uid(), array['super_admin']));
drop policy if exists gatilhos_admin_update on public.gamificacao_gatilhos;
create policy gatilhos_admin_update on public.gamificacao_gatilhos for update
  using (public.is_admin_papel(auth.uid(), array['super_admin']))
  with check (public.is_admin_papel(auth.uid(), array['super_admin']));
drop policy if exists gatilhos_admin_delete on public.gamificacao_gatilhos;
create policy gatilhos_admin_delete on public.gamificacao_gatilhos for delete using (public.is_admin_papel(auth.uid(), array['super_admin']));

drop policy if exists niveis_leitura on public.gamificacao_niveis;
create policy niveis_leitura on public.gamificacao_niveis for select using (auth.uid() is not null);
drop policy if exists niveis_admin_insert on public.gamificacao_niveis;
create policy niveis_admin_insert on public.gamificacao_niveis for insert with check (public.is_admin_papel(auth.uid(), array['super_admin']));
drop policy if exists niveis_admin_update on public.gamificacao_niveis;
create policy niveis_admin_update on public.gamificacao_niveis for update
  using (public.is_admin_papel(auth.uid(), array['super_admin']))
  with check (public.is_admin_papel(auth.uid(), array['super_admin']));
drop policy if exists niveis_admin_delete on public.gamificacao_niveis;
create policy niveis_admin_delete on public.gamificacao_niveis for delete using (public.is_admin_papel(auth.uid(), array['super_admin']));

-- extrato: leitura só do próprio + admin; escrita SOMENTE via RPC security definer
drop policy if exists extrato_leitura_propria on public.gamificacao_extrato;
create policy extrato_leitura_propria on public.gamificacao_extrato for select using (usuario_id = auth.uid());
drop policy if exists extrato_admin_leitura on public.gamificacao_extrato;
create policy extrato_admin_leitura on public.gamificacao_extrato for select using (public.is_admin_papel(auth.uid(), array['super_admin']));

-- ---------- RPC única: creditar_gamificacao ----------
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

  update public.perfis
  set xp = v_xp_total, moedas = v_moedas_total, nivel = coalesce(v_nivel_ordem, 0)
  where id = p_usuario;

  return jsonb_build_object(
    'creditado', true, 'pontos', v_pontos, 'moedas', v_moedas,
    'xp_total', v_xp_total, 'moedas_total', v_moedas_total, 'nivel_atual', v_nivel_nome
  );
end;
$$;

grant execute on function public.creditar_gamificacao(uuid, text, text, uuid, int, int, boolean) to authenticated;

-- ---------- Progresso de curso/etapa (chamado após aula concluída ou avaliação aprovada) ----------
create or replace function public.gam_curso_completo(p_usuario uuid, p_curso_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_total_aulas int;
  v_feitas_aulas int;
  v_total_avals int;
  v_aprovadas int;
begin
  if p_curso_id is null then
    return false;
  end if;

  select count(*) into v_total_aulas
  from public.aulas a join public.modulos m on m.id = a.modulo_id
  where m.curso_id = p_curso_id;

  if v_total_aulas = 0 then
    return false;
  end if;

  select count(*) into v_feitas_aulas
  from public.aula_progresso ap
  join public.aulas a on a.id = ap.aula_id
  join public.modulos m on m.id = a.modulo_id
  where m.curso_id = p_curso_id and ap.usuario_id = p_usuario and ap.concluida = true;

  select count(*) into v_total_avals from public.avaliacoes where curso_id = p_curso_id;

  select count(distinct t.avaliacao_id) into v_aprovadas
  from public.avaliacao_tentativas t
  join public.avaliacoes av on av.id = t.avaliacao_id
  where av.curso_id = p_curso_id and t.usuario_id = p_usuario and t.aprovado = true;

  return v_feitas_aulas >= v_total_aulas and v_aprovadas >= v_total_avals;
end;
$$;

create or replace function public.gam_verificar_progresso_curso(p_usuario uuid, p_curso_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_etapa_id uuid;
  v_todas_completas boolean;
begin
  if p_curso_id is null or not public.gam_curso_completo(p_usuario, p_curso_id) then
    return;
  end if;

  perform public.creditar_gamificacao(p_usuario, 'concluir_curso', 'curso', p_curso_id);

  for v_etapa_id in
    select distinct em.etapa_id from public.etapa_missoes em where em.curso_id = p_curso_id
  loop
    select bool_and(public.gam_curso_completo(p_usuario, em2.curso_id))
    into v_todas_completas
    from public.etapa_missoes em2
    where em2.etapa_id = v_etapa_id;

    if v_todas_completas then
      perform public.creditar_gamificacao(p_usuario, 'concluir_etapa', 'etapa', v_etapa_id);
    end if;
  end loop;
end;
$$;

-- ---------- Trigger: aula_progresso -> concluir_aula + cascata módulo/curso/etapa ----------
create or replace function public.gam_trg_aula_progresso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_modulo_id uuid;
  v_curso_id uuid;
  v_total_modulo int;
  v_feitas_modulo int;
begin
  if new.concluida is not true then
    return new;
  end if;

  perform public.creditar_gamificacao(new.usuario_id, 'concluir_aula', 'aula', new.aula_id);

  select a.modulo_id, m.curso_id into v_modulo_id, v_curso_id
  from public.aulas a join public.modulos m on m.id = a.modulo_id
  where a.id = new.aula_id;

  if v_modulo_id is not null then
    select count(*) into v_total_modulo from public.aulas where modulo_id = v_modulo_id;
    select count(*) into v_feitas_modulo
    from public.aula_progresso ap join public.aulas a on a.id = ap.aula_id
    where a.modulo_id = v_modulo_id and ap.usuario_id = new.usuario_id and ap.concluida = true;

    if v_total_modulo > 0 and v_feitas_modulo >= v_total_modulo then
      perform public.creditar_gamificacao(new.usuario_id, 'concluir_modulo', 'modulo', v_modulo_id);
    end if;
  end if;

  perform public.gam_verificar_progresso_curso(new.usuario_id, v_curso_id);

  return new;
end;
$$;

drop trigger if exists trg_gam_aula_progresso on public.aula_progresso;
create trigger trg_gam_aula_progresso
  after insert or update of concluida on public.aula_progresso
  for each row execute function public.gam_trg_aula_progresso();

-- ---------- Trigger: certificados -> certificado ----------
create or replace function public.gam_trg_certificados()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.numero is not null and new.emitido_em is not null
     and new.usuario_id is not null
     and (tg_op = 'INSERT' or old.numero is null or old.numero is distinct from new.numero) then
    perform public.creditar_gamificacao(new.usuario_id, 'certificado', 'certificado', new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_gam_certificados on public.certificados;
create trigger trg_gam_certificados
  after insert or update of numero, emitido_em on public.certificados
  for each row execute function public.gam_trg_certificados();

-- ---------- Triggers: comunidade + dúvidas de aula ----------
create or replace function public.gam_trg_comunidade_reacao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.usuario_id is not null then
    perform public.creditar_gamificacao(new.usuario_id, 'reagir');
  end if;
  return new;
end;
$$;
drop trigger if exists trg_gam_comunidade_reacoes on public.comunidade_reacoes;
create trigger trg_gam_comunidade_reacoes after insert on public.comunidade_reacoes
  for each row execute function public.gam_trg_comunidade_reacao();

create or replace function public.gam_trg_comunidade_comentario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.usuario_id is not null then
    perform public.creditar_gamificacao(new.usuario_id, 'comentar_post');
  end if;
  return new;
end;
$$;
drop trigger if exists trg_gam_comunidade_comentarios on public.comunidade_comentarios;
create trigger trg_gam_comunidade_comentarios after insert on public.comunidade_comentarios
  for each row execute function public.gam_trg_comunidade_comentario();

create or replace function public.gam_trg_aula_duvida()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.usuario_id is not null then
    perform public.creditar_gamificacao(new.usuario_id, 'comentar_aula');
  end if;
  return new;
end;
$$;
drop trigger if exists trg_gam_aula_duvidas on public.aula_duvidas;
create trigger trg_gam_aula_duvidas after insert on public.aula_duvidas
  for each row execute function public.gam_trg_aula_duvida();

create or replace function public.gam_trg_comunidade_post()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.usuario_id is not null then
    perform public.creditar_gamificacao(new.usuario_id, 'criar_post');
  end if;
  return new;
end;
$$;
drop trigger if exists trg_gam_comunidade_posts on public.comunidade_posts;
create trigger trg_gam_comunidade_posts after insert on public.comunidade_posts
  for each row execute function public.gam_trg_comunidade_post();

-- ---------- Trigger: desafio_entregas -> entregar_desafio ----------
create or replace function public.gam_trg_desafio_entrega()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.entregue_em is not null and old.entregue_em is null and new.usuario_id is not null then
    perform public.creditar_gamificacao(new.usuario_id, 'entregar_desafio', 'desafio_entrega', new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_gam_desafio_entregas on public.desafio_entregas;
create trigger trg_gam_desafio_entregas after update of entregue_em on public.desafio_entregas
  for each row execute function public.gam_trg_desafio_entrega();

-- ---------- avaliacoes.xp -> peso (multiplicador, não mais XP fixo) ----------
alter table public.avaliacoes rename column xp to peso;
alter table public.avaliacoes alter column peso set default 1;
update public.avaliacoes set peso = case when tipo = 'prova' then 2 else 1 end;

-- ---------- submeter_avaliacao: credita por faixa de acerto x peso ----------
create or replace function public.submeter_avaliacao(p_avaliacao uuid, p_respostas jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_av       avaliacoes%rowtype;
  v_q        avaliacao_questoes%rowtype;
  v_resp     jsonb;
  v_opcao    uuid;
  v_valor    numeric;
  v_correta  boolean;
  v_op_id    uuid;
  v_op_texto text;
  v_acertos  int := 0;
  v_total    int := 0;
  v_gab      jsonb := '[]'::jsonb;
  v_tent     uuid;
  v_nota     numeric;
  v_pct      numeric;
  v_aprovado boolean;
  v_media    numeric;
  v_faixa_codigo text;
  v_faixa_gatilho gamificacao_gatilhos%rowtype;
  v_pontos_faixa int;
  v_moedas_faixa int;
  v_ja_pontos int;
  v_ja_moedas int;
  v_delta_pontos int;
  v_delta_moedas int;
  v_xp_ganho int := 0;
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para enviar a avaliação.';
  end if;

  select * into v_av from avaliacoes where id = p_avaliacao and publicado;
  if not found then
    raise exception 'Avaliação não encontrada.';
  end if;

  insert into avaliacao_tentativas (usuario_id, avaliacao_id)
  values (v_user, p_avaliacao)
  returning id into v_tent;

  for v_q in
    select * from avaliacao_questoes
    where avaliacao_id = p_avaliacao
    order by ordem
  loop
    v_total := v_total + 1;

    select r into v_resp
    from jsonb_array_elements(p_respostas) r
    where (r->>'questao_id')::uuid = v_q.id
    limit 1;

    v_correta := false; v_opcao := null; v_valor := null;
    v_op_id := null; v_op_texto := null;

    if v_q.tipo = 'multipla_escolha' then
      v_opcao := nullif(v_resp->>'opcao_id', '')::uuid;
      if v_opcao is not null then
        select coalesce(o.correta, false) into v_correta
        from avaliacao_opcoes o
        where o.id = v_opcao and o.questao_id = v_q.id;
        v_correta := coalesce(v_correta, false);
      end if;
      select o.id, o.texto into v_op_id, v_op_texto
      from avaliacao_opcoes o
      where o.questao_id = v_q.id and o.correta
      order by o.ordem limit 1;
    else
      v_valor := nullif(v_resp->>'valor', '')::numeric;
      if v_valor is not null then
        v_correta := abs(v_valor - v_q.resposta_valor) <= coalesce(v_q.tolerancia, 0);
      end if;
    end if;

    if v_correta then v_acertos := v_acertos + 1; end if;

    insert into avaliacao_respostas (tentativa_id, questao_id, opcao_id, valor_informado, correta)
    values (v_tent, v_q.id, v_opcao, v_valor, v_correta);

    v_gab := v_gab || jsonb_build_object(
      'questao_id',          v_q.id,
      'correta',             v_correta,
      'opcao_marcada',       v_opcao,
      'opcao_correta_id',    v_op_id,
      'opcao_correta_texto', v_op_texto,
      'resposta_valor',      v_q.resposta_valor,
      'valor_informado',     v_valor,
      'parecer',             v_q.parecer,
      'aula_id',             v_q.aula_id,
      'aula_ref',            v_q.aula_ref
    );
  end loop;

  if v_total = 0 then
    raise exception 'Esta avaliação ainda não tem questões.';
  end if;

  v_nota     := round(v_acertos::numeric / v_total * 10, 1);
  v_pct      := round(v_acertos::numeric / v_total * 100);
  v_aprovado := v_nota >= coalesce(v_av.nota_minima, 7.0);

  v_faixa_codigo := case
    when v_pct >= 100 then 'quiz_100'
    when v_pct >= 90  then 'quiz_90_99'
    when v_pct >= 70  then 'quiz_70_89'
    when v_pct >= 50  then 'quiz_50_69'
    else 'quiz_ate_49'
  end;

  select * into v_faixa_gatilho from gamificacao_gatilhos where codigo = v_faixa_codigo;
  if found then
    v_pontos_faixa := v_faixa_gatilho.pontos * greatest(coalesce(v_av.peso, 1), 1);
    v_moedas_faixa := v_faixa_gatilho.moedas * greatest(coalesce(v_av.peso, 1), 1);

    -- soma tudo que já foi creditado nessa avaliação (faixas anteriores) — só paga o delta
    select coalesce(sum(pontos), 0), coalesce(sum(moedas), 0)
    into v_ja_pontos, v_ja_moedas
    from gamificacao_extrato
    where usuario_id = v_user and referencia_tipo = 'avaliacao_quiz' and referencia_id = p_avaliacao;

    v_delta_pontos := greatest(0, v_pontos_faixa - v_ja_pontos);
    v_delta_moedas := greatest(0, v_moedas_faixa - v_ja_moedas);

    if v_delta_pontos > 0 or v_delta_moedas > 0 then
      perform creditar_gamificacao(v_user, v_faixa_codigo, 'avaliacao_quiz', p_avaliacao, v_delta_pontos, v_delta_moedas, true);
      v_xp_ganho := v_delta_pontos;
    end if;
  end if;

  if v_aprovado and v_av.tipo = 'prova' then
    perform creditar_gamificacao(v_user, 'passar_prova', 'avaliacao_prova', p_avaliacao);
  end if;

  update avaliacao_tentativas
  set nota = v_nota, acertos = v_acertos, total = v_total,
      xp_ganho = v_xp_ganho, aprovado = v_aprovado
  where id = v_tent;

  if v_aprovado then
    perform gam_verificar_progresso_curso(v_user, v_av.curso_id);
  end if;

  select round(avg(melhor), 1) into v_media
  from (
    select max(t.nota) as melhor
    from avaliacao_tentativas t
    join avaliacoes a on a.id = t.avaliacao_id
    where t.usuario_id = v_user and a.curso_id = v_av.curso_id
    group by t.avaliacao_id
  ) m;

  return jsonb_build_object(
    'nota', v_nota, 'acertos', v_acertos, 'total', v_total,
    'xp', v_xp_ganho, 'aprovado', v_aprovado,
    'media_curso', v_media, 'gabarito', v_gab
  );
end;
$$;

-- ---------- Seed: gatilhos (ON CONFLICT preserva pontos/moedas/limite/ativo calibrados no admin) ----------
insert into public.gamificacao_gatilhos (codigo, nome, descricao, pontos, moedas, limite_diario, ativo, categoria) values
  ('login_diario', 'Login diário', 'Acessar a plataforma pela primeira vez no dia', 5, 0, 1, true, 'comum'),
  ('reagir', 'Reagir a um post', 'Marcar Útil ou Parabenizar na comunidade', 3, 0, 10, true, 'comum'),
  ('comentar_post', 'Comentar em um post', 'Comentar em um post da comunidade', 5, 0, 10, true, 'comum'),
  ('comentar_aula', 'Comentar em uma aula', 'Fazer uma pergunta/comentário numa aula', 5, 0, 10, true, 'comum'),
  ('criar_post', 'Criar um post', 'Publicar um novo post na comunidade', 8, 0, 5, true, 'comum'),
  ('iniciar_curso', 'Iniciar um curso', 'Começar um novo curso', 10, 2, null, true, 'marco'),
  ('concluir_aula', 'Concluir uma aula', 'Marcar uma aula como concluída', 5, 0, 50, true, 'marco'),
  ('concluir_modulo', 'Concluir um módulo', 'Terminar todas as aulas de um módulo', 25, 2, null, true, 'marco'),
  ('concluir_curso', 'Concluir um curso', 'Terminar todas as aulas e avaliações de um curso', 80, 5, null, true, 'marco'),
  ('concluir_etapa', 'Concluir uma etapa da trilha', 'Terminar todos os cursos de uma etapa', 150, 10, null, true, 'marco'),
  ('entregar_desafio', 'Entregar um desafio', 'Protocolar o laudo de um desafio pericial', 30, 3, null, true, 'marco'),
  ('quiz_ate_49', 'Quiz: até 49% de acerto', 'Faixa de acerto até 49%', 10, 0, null, true, 'quiz'),
  ('quiz_50_69', 'Quiz: 50% a 69% de acerto', 'Faixa de acerto de 50% a 69%', 20, 1, null, true, 'quiz'),
  ('quiz_70_89', 'Quiz: 70% a 89% de acerto', 'Faixa de acerto de 70% a 89%', 30, 2, null, true, 'quiz'),
  ('quiz_90_99', 'Quiz: 90% a 99% de acerto', 'Faixa de acerto de 90% a 99%', 40, 3, null, true, 'quiz'),
  ('quiz_100', 'Quiz: 100% de acerto', 'Acerto total', 60, 5, null, true, 'quiz'),
  ('passar_prova', 'Aprovado em prova', 'Bônus por ser aprovado numa prova final', 50, 5, null, true, 'quiz'),
  ('certificado', 'Certificado emitido', 'Receber um certificado de conclusão', 50, 1, null, true, 'especial'),
  ('aniversario', 'Aniversário', 'Presente de aniversário do usuário', 50, 5, null, true, 'especial'),
  ('aniversario_plataforma', 'Aniversário de cadastro', '1 ano de conta na plataforma', 100, 5, null, true, 'especial'),
  ('compra_aprovada', 'Compra aprovada', 'Assinatura confirmada (Asaas)', 50, 2, null, false, 'especial'),
  ('primeira_compra', 'Primeira compra', 'Primeira assinatura confirmada (Asaas)', 100, 5, null, false, 'especial')
on conflict (codigo) do update set
  nome = excluded.nome, descricao = excluded.descricao, categoria = excluded.categoria;

-- ---------- Seed: níveis (idempotente por pontos_minimos) ----------
insert into public.gamificacao_niveis (nome, pontos_minimos, ordem) values
  ('Explorador Novato', 75, 1),
  ('Conhecedor de Lógicas', 850, 2),
  ('Aspirante a Perito', 1200, 3),
  ('Decifrador de Cálculos', 1700, 4),
  ('Profissão Perito', 2500, 5),
  ('Autoridade Pericial', 3200, 6),
  ('Desenvolvedor de Teses', 4000, 7),
  ('Estrategista Expert', 5000, 8),
  ('Mestre Supremo', 7500, 9),
  ('Eu Sou a Lenda', 10000, 10)
on conflict (pontos_minimos) do nothing;

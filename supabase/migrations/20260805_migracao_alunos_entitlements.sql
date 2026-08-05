-- ============================================================
-- MIGRAÇÃO DE ALUNOS DA ENSINIO + CAMADA DE ACESSO POR CURSO
--
-- Contexto: até aqui a plataforma só sabia responder "tem assinatura ativa?"
-- (tem_acesso_ativo, booleano, por usuário) — não existia acesso por curso
-- nem data de expiração. A migração da Ensinio exige as duas coisas: alunos
-- com "Apenas: Curso PASEP", alunos com "Tudo EXCETO: <9 itens>" e alunos com
-- validade até uma data específica.
--
-- Esta migração é ADITIVA: tem_acesso_ativo() continua com o significado e o
-- corpo de sempre ("tem assinatura Asaas vigente"), e quem assina pelo Asaas
-- não é afetado por nada aqui. Se todas as linhas de acessos_conteudo fossem
-- apagadas, a plataforma voltaria a se comportar exatamente como hoje.
--
-- Rodar no SQL Editor do Supabase (ver CLAUDE.md — migração é ação manual).
-- ============================================================

-- ============================================================
-- 1. CONCESSÕES DE ACESSO
-- ============================================================
-- Uma linha por produto concedido. O acesso é uma REGRA, não uma lista
-- congelada de cursos: escopo 'total' com exceções significa "tudo que existe
-- hoje e tudo que for publicado amanhã, menos estes". Isso é o que corresponde
-- ao que foi vendido como vitalício — expandir em N linhas por curso
-- congelaria o catálogo na data da importação.
create table if not exists public.acessos_conteudo (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfis(id) on delete cascade,
  -- 'total'      : todos os cursos, menos as exceções em acessos_excecoes
  -- 'curso'      : só o curso em curso_id
  -- 'biblioteca' : Biblioteca de Planilhas (não é curso, ver seção 4)
  escopo text not null check (escopo in ('total', 'curso', 'biblioteca')),
  curso_id uuid references public.cursos(id) on delete cascade,
  vitalicio boolean not null default false,
  expira_em date,
  origem text not null default 'migracao_ensinio'
    check (origem in ('migracao_ensinio', 'admin', 'assinatura')),
  ativo boolean not null default true,
  observacao text,
  criado_em timestamptz not null default now(),

  -- curso_id é obrigatório em escopo 'curso' e proibido nos outros — evita
  -- linha ambígua tipo escopo='total' com curso_id preenchido.
  constraint acessos_conteudo_escopo_curso check (
    (escopo = 'curso' and curso_id is not null)
    or (escopo <> 'curso' and curso_id is null)
  ),
  -- vitalício não tem data; com data não é vitalício. Um dos dois, nunca os
  -- dois nem nenhum — é o que garante que "vigente" abaixo nunca seja nulo.
  constraint acessos_conteudo_vigencia check (
    (vitalicio and expira_em is null)
    or (not vitalicio and expira_em is not null)
  )
);

create index if not exists idx_acessos_conteudo_usuario
  on public.acessos_conteudo (usuario_id) where ativo;
create index if not exists idx_acessos_conteudo_curso
  on public.acessos_conteudo (curso_id) where ativo and escopo = 'curso';

-- Exceções de um acesso 'total' ("Tudo EXCETO: ..."). Tabela separada em vez
-- de um array de uuid na linha pra ganhar a FK: se um curso for excluído do
-- catálogo, a exceção correspondente vai embora sozinha em vez de virar um
-- uuid órfão apontando pra nada.
--
-- A exceção pode ser de um CURSO ou de uma TRILHA inteira. A do Black Friday
-- 2023 tem os dois tipos: 7 cursos nomeados + a trilha "MasterClass" (que na
-- matriz aparece como um item só, e é a trilha, não um curso dela). Excluir a
-- trilha por referência — e não expandindo os cursos dela na importação — é o
-- que mantém a regra viva: curso novo publicado dentro da MasterClass fica
-- excluído sozinho, sem ninguém ter que rodar script de correção.
create table if not exists public.acessos_excecoes (
  id uuid primary key default gen_random_uuid(),
  acesso_id uuid not null references public.acessos_conteudo(id) on delete cascade,
  curso_id uuid references public.cursos(id) on delete cascade,
  -- FK em trilhas(slug), que é unique — slug e não uuid porque é assim que o
  -- catálogo da importação nomeia a trilha, e o slug é estável.
  trilha_slug text references public.trilhas(slug) on update cascade on delete cascade,

  -- exatamente um dos dois alvos
  constraint acessos_excecoes_alvo check (
    (curso_id is not null and trilha_slug is null)
    or (curso_id is null and trilha_slug is not null)
  )
);

create unique index if not exists uq_acessos_excecoes_curso
  on public.acessos_excecoes (acesso_id, curso_id) where curso_id is not null;
create unique index if not exists uq_acessos_excecoes_trilha
  on public.acessos_excecoes (acesso_id, trilha_slug) where trilha_slug is not null;

-- ============================================================
-- 2. HISTÓRICO DA MIGRAÇÃO
-- ============================================================
-- Registro append-only do que veio da Ensinio: uma linha por
-- (aluno × produto), inclusive pros produtos que NÃO foram importados por já
-- estarem vencidos (importado = false, usuario_id nulo). Guarda o dado de
-- origem cru — o que ele pagou, quando comprou, qual era a validade — pra
-- conferência futura, mesmo que a concessão seja depois alterada no admin.
--
-- Nomes em português seguindo o padrão do resto do schema; o mapeamento pros
-- nomes pedidos na spec original é: migrado_em = migrated_at,
-- plataforma_origem = source_platform, usuario_id = user_id.
create table if not exists public.migracao_alunos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references public.perfis(id) on delete set null,
  email text not null,
  nome_completo text,
  plano_origem text not null,
  grupo_origem text,
  tipo_acesso_origem text,
  valor_pago_origem numeric(12, 2),
  data_compra_origem timestamptz,
  acesso_concedido text,
  regra_vencimento text,
  data_vencimento date,
  -- concessão gerada por esta linha (nulo quando não importada)
  acesso_id uuid references public.acessos_conteudo(id) on delete set null,
  importado boolean not null default true,
  motivo_nao_importado text,
  migrado_em timestamptz not null default now(),
  plataforma_origem text not null default 'Ensinio',

  -- se não importou, tem que dizer por quê (e vice-versa)
  constraint migracao_alunos_motivo check (
    (importado and motivo_nao_importado is null)
    or (not importado and motivo_nao_importado is not null)
  )
);

create index if not exists idx_migracao_alunos_email on public.migracao_alunos (lower(email));
create index if not exists idx_migracao_alunos_usuario on public.migracao_alunos (usuario_id);
create index if not exists idx_migracao_alunos_importado on public.migracao_alunos (importado);

-- Idempotência da importação: rodar o script duas vezes não duplica o
-- histórico nem as concessões. A chave é (email, produto, validade) porque um
-- mesmo aluno pode ter comprado o MESMO produto duas vezes com validades
-- diferentes (renovação) — e aí são duas linhas legítimas.
create unique index if not exists uq_migracao_alunos_linha
  on public.migracao_alunos (lower(email), plano_origem, coalesce(data_vencimento, '9999-12-31'::date));

-- ============================================================
-- 3. MARCA DO ALUNO MIGRADO
-- ============================================================
alter table public.perfis add column if not exists migrado_de text;
alter table public.perfis add column if not exists migrado_em timestamptz;
-- primeira visita do migrado (mostra as boas-vindas específicas uma só vez —
-- mesmo padrão de perfis.tour_visto_em)
alter table public.perfis add column if not exists boas_vindas_migrado_em timestamptz;

comment on column public.perfis.migrado_de is
  'Plataforma de origem quando o aluno veio de importação em lote (ex.: Ensinio). Nulo = cadastro nativo.';

-- ============================================================
-- 4. GATE DE ACESSO
-- ============================================================
-- "Vigente" é calculado NA LEITURA (vitalicio or expira_em >= current_date) —
-- não existe job pra virar o status quando a data passa. Mesmo princípio que
-- tem_acesso_ativo() já usa pro cálculo de dias_carencia: nada pra agendar,
-- nada pra dessincronizar, e o acesso cai no instante exato do vencimento.

-- tem_acesso_curso: pode este usuário abrir ESTE curso?
create or replace function public.tem_acesso_curso(p_usuario_id uuid, p_curso_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    -- 1) assinatura Asaas vigente cobre todo o catálogo (comportamento atual)
    public.tem_acesso_ativo(p_usuario_id)
    -- 2) concessão específica deste curso
    or exists (
      select 1
      from public.acessos_conteudo a
      where a.usuario_id = p_usuario_id
        and a.ativo
        and a.escopo = 'curso'
        and a.curso_id = p_curso_id
        and (a.vitalicio or a.expira_em >= current_date)
    )
    -- 3) concessão total, desde que este curso não seja exceção dela — nem
    --    diretamente, nem por pertencer a uma trilha excetuada
    or exists (
      select 1
      from public.acessos_conteudo a
      where a.usuario_id = p_usuario_id
        and a.ativo
        and a.escopo = 'total'
        and (a.vitalicio or a.expira_em >= current_date)
        and not exists (
          select 1
          from public.acessos_excecoes e
          where e.acesso_id = a.id
            and (
              e.curso_id = p_curso_id
              or (
                e.trilha_slug is not null
                -- Vínculo curso→trilha lido das tabelas BASE, não da view
                -- public.curso_trilha: aquela view é DISTINCT ON (curso_id) e
                -- devolve no máximo UMA trilha por curso, então um curso que
                -- esteja na MasterClass e também em outra trilha poderia não
                -- aparecer como MasterClass ali — e a exceção furaria.
                and exists (
                  select 1
                  from public.etapa_missoes em
                  join public.etapas et on et.id = em.etapa_id
                  join public.trilhas tr on tr.id = et.trilha_id
                  where em.curso_id = p_curso_id
                    and tr.slug = e.trilha_slug
                )
              )
            )
        )
    );
$$;
revoke execute on function public.tem_acesso_curso(uuid, uuid) from public;
grant execute on function public.tem_acesso_curso(uuid, uuid) to authenticated, anon;

-- Sobrecarga por slug: as páginas de curso/aula/avaliação têm o slug da URL
-- na mão, mas nem todas carregam o uuid do curso (getAvaliacao devolve só
-- slug e título). Resolver o slug aqui dentro evita um roundtrip extra no
-- servidor e mantém o call site das páginas com uma linha só. Os nomes dos
-- parâmetros diferem (p_curso_id vs p_curso_slug), então o PostgREST resolve
-- a sobrecarga sem ambiguidade.
create or replace function public.tem_acesso_curso(p_usuario_id uuid, p_curso_slug text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.tem_acesso_curso(
    p_usuario_id,
    (select c.id from public.cursos c where c.slug = p_curso_slug)
  );
$$;
revoke execute on function public.tem_acesso_curso(uuid, text) from public;
grant execute on function public.tem_acesso_curso(uuid, text) to authenticated, anon;

-- tem_acesso_plataforma: tem acesso a ALGUMA coisa paga?
-- Usado pelas seções que não são por curso (Comunidade, Agenda, Desafios).
-- Sem isso um aluno migrado "Apenas: Curso PASEP" não entraria na Comunidade,
-- porque ele não tem linha em `assinaturas` nenhuma.
create or replace function public.tem_acesso_plataforma(p_usuario_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    public.tem_acesso_ativo(p_usuario_id)
    or exists (
      select 1
      from public.acessos_conteudo a
      where a.usuario_id = p_usuario_id
        and a.ativo
        and (a.vitalicio or a.expira_em >= current_date)
    );
$$;
revoke execute on function public.tem_acesso_plataforma(uuid) from public;
grant execute on function public.tem_acesso_plataforma(uuid) to authenticated, anon;

-- tem_acesso_biblioteca: Biblioteca de Planilhas.
-- A biblioteca nunca foi gateada por assinatura — quem manda é a flag
-- perfis.acesso_biblioteca, concedida à mão. Mantido: a flag continua valendo
-- (e continua sem expirar, como sempre). O que muda é que um acesso migrado
-- também abre a biblioteca, e esse SIM expira junto com o produto.
create or replace function public.tem_acesso_biblioteca(p_usuario_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    coalesce((select p.acesso_biblioteca from public.perfis p where p.id = p_usuario_id), false)
    or exists (
      select 1
      from public.acessos_conteudo a
      where a.usuario_id = p_usuario_id
        and a.ativo
        and a.escopo = 'biblioteca'
        and (a.vitalicio or a.expira_em >= current_date)
    );
$$;
revoke execute on function public.tem_acesso_biblioteca(uuid) from public;
grant execute on function public.tem_acesso_biblioteca(uuid) to authenticated, anon;

-- ============================================================
-- 5. RLS
-- ============================================================
alter table public.acessos_conteudo enable row level security;
alter table public.acessos_excecoes enable row level security;
alter table public.migracao_alunos enable row level security;

-- acessos_conteudo: o aluno vê as próprias concessões (a tela de perfil pode
-- querer mostrar "seu acesso vai até ..."); suporte/financeiro veem tudo.
-- Nenhuma policy de escrita: só o service role (importador) e RPCs escrevem.
drop policy if exists acessos_conteudo_leitura_propria on public.acessos_conteudo;
create policy acessos_conteudo_leitura_propria on public.acessos_conteudo
  for select using (usuario_id = auth.uid());

drop policy if exists acessos_conteudo_admin_leitura on public.acessos_conteudo;
create policy acessos_conteudo_admin_leitura on public.acessos_conteudo
  for select using (
    public.is_admin_papel(auth.uid(), array['super_admin', 'suporte', 'financeiro'])
  );

drop policy if exists acessos_excecoes_leitura_propria on public.acessos_excecoes;
create policy acessos_excecoes_leitura_propria on public.acessos_excecoes
  for select using (
    exists (
      select 1 from public.acessos_conteudo a
      where a.id = acessos_excecoes.acesso_id
        and (
          a.usuario_id = auth.uid()
          or public.is_admin_papel(auth.uid(), array['super_admin', 'suporte', 'financeiro'])
        )
    )
  );

-- migracao_alunos: só admin. Tem valor pago e dado de compra de origem —
-- não é informação que o aluno precise ver na plataforma nova.
drop policy if exists migracao_alunos_admin_leitura on public.migracao_alunos;
create policy migracao_alunos_admin_leitura on public.migracao_alunos
  for select using (
    public.is_admin_papel(auth.uid(), array['super_admin', 'suporte', 'financeiro'])
  );

-- ============================================================
-- 6. MATERIAIS DE AULA — policies passam a ser por curso
-- ============================================================
-- Antes: `tem_acesso_ativo(auth.uid())` — booleano da plataforma inteira.
-- Sem esta parte, um aluno migrado com "Apenas: Curso PASEP" baixaria o
-- material de qualquer aula de qualquer curso, bastando descobrir a URL: o
-- gate de página o barraria na aula, mas a tabela e o bucket não.
drop policy if exists aula_materiais_leitura on public.aula_materiais;
create policy aula_materiais_leitura on public.aula_materiais
  for select using (
    public.is_admin_papel(auth.uid(), array['super_admin', 'conteudo'])
    or exists (
      select 1
      from public.aulas au
      join public.modulos m on m.id = au.modulo_id
      where au.id = aula_materiais.aula_id
        and public.tem_acesso_curso(auth.uid(), m.curso_id)
    )
  );

-- Bucket privado: o path de upload é `{aula_id}/{uuid}-{nome}` (ver
-- uploadMateriais em app/admin/cursos/actions.ts), então o primeiro segmento
-- do name identifica a aula e dá pra chegar no curso pelo mesmo join. Sem
-- isso o createSignedUrl continuaria assinando material de curso alheio.
drop policy if exists materiais_aulas_leitura on storage.objects;
create policy materiais_aulas_leitura on storage.objects
  for select using (
    bucket_id = 'materiais-aulas'
    and (
      public.is_admin_papel(auth.uid(), array['super_admin', 'conteudo'])
      or exists (
        select 1
        from public.aulas au
        join public.modulos m on m.id = au.modulo_id
        where au.id::text = split_part(storage.objects.name, '/', 1)
          and public.tem_acesso_curso(auth.uid(), m.curso_id)
      )
    )
  );

-- ============================================================
-- 7. LEITURA DE APOIO PRO ADMIN
-- ============================================================
-- Resumo do acesso de um aluno em uma linha, pra ficha do módulo Usuários.
-- security definer + checagem de papel dentro, mesmo padrão das outras RPCs
-- de admin_* (ver 20260713_usuarios_suporte.sql).
create or replace function public.adm_acesso_resumo(p_usuario_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_resultado jsonb;
begin
  if not public.is_admin_papel(auth.uid(), array['super_admin', 'suporte', 'financeiro']) then
    raise exception 'sem permissão';
  end if;

  select jsonb_build_object(
    'assinatura_ativa', public.tem_acesso_ativo(p_usuario_id),
    'acesso_plataforma', public.tem_acesso_plataforma(p_usuario_id),
    'acesso_biblioteca', public.tem_acesso_biblioteca(p_usuario_id),
    'concessoes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'escopo', a.escopo,
        'curso', c.titulo,
        'vitalicio', a.vitalicio,
        'expira_em', a.expira_em,
        'vigente', (a.vitalicio or a.expira_em >= current_date),
        'origem', a.origem,
        'excecoes', coalesce((
          select jsonb_agg(rotulo order by rotulo)
          from (
            select ce.titulo as rotulo
            from public.acessos_excecoes e
            join public.cursos ce on ce.id = e.curso_id
            where e.acesso_id = a.id and e.curso_id is not null
            union all
            select 'Trilha: ' || tr.nome
            from public.acessos_excecoes e
            join public.trilhas tr on tr.slug = e.trilha_slug
            where e.acesso_id = a.id and e.trilha_slug is not null
          ) x
        ), '[]'::jsonb)
      ) order by a.criado_em)
      from public.acessos_conteudo a
      left join public.cursos c on c.id = a.curso_id
      where a.usuario_id = p_usuario_id and a.ativo
    ), '[]'::jsonb)
  ) into v_resultado;

  return v_resultado;
end;
$$;
revoke execute on function public.adm_acesso_resumo(uuid) from public;
grant execute on function public.adm_acesso_resumo(uuid) to authenticated;

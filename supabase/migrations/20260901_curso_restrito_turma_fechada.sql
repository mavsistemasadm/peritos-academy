-- ══════════════════════════════════════════════════════════════════
-- TURMA FECHADA: O CURSO RESTRITO — 2026-09-01
--
-- Uma mentoria de 60 pessoas não tinha como existir aqui. `cursos.publicado`
-- é tudo ou nada: ligado, o curso aparece no catálogo para a base inteira;
-- desligado, ele some para todo mundo — inclusive para os 60, porque
-- `buscarCurso` e `getAula` exigem `publicado = true`. Deixar em rascunho não
-- era meio-termo, era o curso fechado também para quem pagou por ele.
--
-- `cursos.restrito` é a terceira posição que faltava: **publicado, e mesmo
-- assim invisível para quem não foi matriculado nominalmente**.
--
-- ── A ARMADILHA QUE ESTA MIGRAÇÃO EXISTE PARA DESARMAR ────────────
--
-- "Pode abrir este curso" e "foi matriculado neste curso" parecem a mesma
-- pergunta e não são. `tem_acesso_curso` responde a primeira, e ela é ampla de
-- propósito: passa quem tem assinatura Asaas vigente e passa quem tem
-- concessão de escopo `total`. Em 01/09/2026 isso são **571 concessões totais
-- vigentes** numa base de 546 perfis — ou seja, praticamente todo mundo.
--
-- Construir turma fechada em cima dela daria uma turma de 571 pessoas. O
-- mesmo vale para a agenda: um evento com visibilidade "Alunos do curso"
-- alcançaria a base inteira, e o anúncio por email junto.
--
-- Por isso nasce `matriculado_no_curso()`, que só aceita a **linha nominal**
-- em `acessos_conteudo` (escopo `curso`, aquele curso, vigente). É a pergunta
-- estreita, e ela tem nome próprio justamente para nunca ser confundida com a
-- larga — o mesmo cuidado que o CLAUDE.md já registra sobre
-- `tem_acesso_plataforma` × `tem_acesso_curso`.
--
-- ── ONDE A REGRA É APLICADA (uma só, e por herança) ───────────────
--
-- A mudança de comportamento mora dentro de `tem_acesso_curso`: curso
-- restrito passa a responder pela regra estreita, curso normal continua
-- respondendo exatamente como antes, byte por byte. Consequência deliberada:
-- tudo que já chamava `tem_acesso_curso` aperta junto, sem uma linha a mais.
--
--   · páginas de curso, aula e avaliação (`verificarAcessoCurso`)
--   · RLS de `aula_materiais` e do bucket `materiais-aulas`
--   · `evento_visivel_para` → a agenda do aluno
--   · `evento_audiencia`    → quem recebe o email de anúncio
--
-- ⚠️ **Escrever a regra de novo em qualquer um desses lugares é o erro a
-- evitar.** Duas cópias divergem no dia em que uma ganhar uma exceção que a
-- outra não tem, e o sintoma seria o email alcançando quem a tela esconde.
--
-- ⚠️ **Assinatura não abre curso restrito, e isso é a decisão, não um efeito
-- colateral.** Turma fechada que abre para quem assina não é turma fechada.
-- Quem quiser vender a mentoria como parte do plano é só deixá-la sem a
-- marca de restrita.
-- ══════════════════════════════════════════════════════════════════

alter table public.cursos
  add column if not exists restrito boolean not null default false;

comment on column public.cursos.restrito is
  'Turma fechada: publicado, mas só visível e acessível para quem tem concessão nominal de escopo `curso`. Nem assinatura nem escopo `total` abrem. Ver 20260901_curso_restrito_turma_fechada.sql.';


-- ── A PERGUNTA ESTREITA ──────────────────────────────────────────
--
-- Admin passa (`is_admin_papel` sem filtro de papel, mesmo bypass que
-- `concluir_aula` já usa): quem monta a mentoria precisa conseguir abrir e
-- conferir a mentoria antes de matricular alguém, e sem isto o autor do curso
-- ficaria trancado do próprio curso.
create or replace function public.matriculado_no_curso(p_usuario_id uuid, p_curso_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_usuario_id is not null and p_curso_id is not null and (
    exists (
      select 1
      from public.acessos_conteudo a
      where a.usuario_id = p_usuario_id
        and a.ativo
        and a.escopo = 'curso'
        and a.curso_id = p_curso_id
        and (a.vitalicio or a.expira_em >= current_date)
    )
    or public.is_admin_papel(p_usuario_id)
  );
$$;

revoke execute on function public.matriculado_no_curso(uuid, uuid) from public;
grant execute on function public.matriculado_no_curso(uuid, uuid) to authenticated, anon;


-- ── O GATE, COM O DESVIO NA FRENTE ───────────────────────────────
--
-- O corpo do `else` é o `pg_get_functiondef` da função viva em 01/09/2026,
-- copiado e não redigitado: as três cláusulas de sempre (assinatura, concessão
-- do curso, concessão total menos as exceções) seguem intactas para os 73
-- cursos normais. O que entrou foi o `case` em volta.
--
-- ⚠️ **Defeito antigo corrigido de carona: curso inexistente devolvia SIM.**
-- A cláusula 3 (concessão de escopo `total`) não menciona `p_curso_id` a não
-- ser dentro do `not exists` das exceções — então, para um curso que não
-- existe, ela era simplesmente verdadeira. Medido em 01/09/2026 na função
-- viva: `tem_acesso_curso(<alguém com escopo total>, 'curso-que-nunca-existiu')`
-- respondia `true`. Nada explorava isso hoje (as três páginas dão 404 antes de
-- perguntar, e a RLS de material sempre chega com o id vindo de um join), mas
-- é um "sim" silencioso esperando o primeiro chamador que confie nele — e a
-- sobrecarga por slug transforma qualquer slug com erro de digitação
-- exatamente nesse caso. Agora o `null` é recusado na primeira linha.
create or replace function public.tem_acesso_curso(p_usuario_id uuid, p_curso_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_usuario_id is null or p_curso_id is null then false
    when coalesce((select c.restrito from public.cursos c where c.id = p_curso_id), false)
      -- Turma fechada: só a matrícula nominal. Assinatura e escopo `total`
      -- param aqui, de propósito. Ver o cabeçalho do arquivo.
      then public.matriculado_no_curso(p_usuario_id, p_curso_id)
    else
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
      )
  end;
$$;

revoke execute on function public.tem_acesso_curso(uuid, uuid) from public;
grant execute on function public.tem_acesso_curso(uuid, uuid) to authenticated, anon;


-- ── AS LISTAGENS, EM UMA CHAMADA SÓ ──────────────────────────────
--
-- O catálogo, a vitrine da home e a jornada montam listas de dezenas de
-- cursos. Perguntar `tem_acesso_curso` um a um seria uma ida ao banco por
-- card; esta devolve, de uma vez, só os ids restritos que quem está olhando
-- pode ver. Quem chama guarda num Set e filtra em memória.
--
-- Deslogado recebe lista vazia — `auth.uid()` nulo derruba
-- `matriculado_no_curso` na primeira condição.
create or replace function public.cursos_restritos_visiveis()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.cursos c
  where c.restrito
    and public.matriculado_no_curso(auth.uid(), c.id);
$$;

revoke execute on function public.cursos_restritos_visiveis() from public;
grant execute on function public.cursos_restritos_visiveis() to authenticated, anon;


-- Busca da matrícula nominal: é a consulta que passa a rodar em toda listagem
-- de catálogo e em todo card de evento de curso restrito.
create index if not exists idx_acessos_conteudo_curso_ativo
  on public.acessos_conteudo (curso_id, usuario_id)
  where ativo and escopo = 'curso';

-- ══════════════════════════════════════════════════════
-- O SELO DE QUALIDADE: a base vem antes, e em ordem (04/09/2026)
--
-- Decisão do dono. Quem entra a partir de agora só abre os outros territórios
-- depois de concluir a **Formação Pericial de Alta Performance**, e dentro dela
-- os cursos abrem em SEQUÊNCIA -- ninguém chega em "VOCÊ, Perito é!" sem ter
-- feito o que vem antes.
--
-- O motivo, na voz dele: é o selo de qualidade. Perícia bancária, trabalhista e
-- previdenciária são aplicações de um mesmo raciocínio; quem chega nelas sem a
-- base decora fórmula, e fórmula decorada não sobrevive ao primeiro caso que
-- foge do exemplo.
--
-- ── O QUE JÁ EXISTIA, e por isso esta migração é pequena ──
--
--   gam_curso_completo   aulas concluídas E aprovado em todas as avaliações
--   trilha_completa      todos os cursos das etapas da trilha
--   trilhas.principal    a flag da Formação Pericial
--   conceder_selo_...    grava perfis.selo_excelencia_em e a insígnia
--
-- A definição de "concluído" já era a certa. O que faltava era TRAVAR.
--
-- ── AS TRÊS PEÇAS ──
--
-- 1. `etapa_missoes.obrigatorio` — tira o Excel Básico da corrente sem tirá-lo
--    da trilha. ⚠️ E `trilha_completa` passa a respeitá-la, para que o SELO e a
--    TRAVA usem a mesma definição: se divergissem, alguém ganharia o selo e
--    continuaria travado, ou o contrário.
--
-- 2. `perfis.exige_formacao_base` — quem está sujeito à regra.
--
-- 3. `formacao_liberou_curso` — a pergunta nova.
--
-- ⚠️ **A TRAVA NÃO ENTRA EM `tem_acesso_curso`, E ISSO É A DECISÃO MAIS
-- IMPORTANTE DAQUI.** Aquela função responde "esta pessoa comprou isto?", e a
-- tela renderiza a recusa dela como *"assine para ter acesso"*. Dizer isso a
-- quem acabou de pagar é mentira -- e é a MESMA lição que
-- `20260901_curso_restrito_turma_fechada` já registra: "recusar um curso
-- restrito com a tela de assine é mentira: assinar não abre turma fechada".
--
-- Aqui a recusa tem outra causa e outra mensagem: *"conclua X para abrir este
-- curso"*, com o caminho para o X.
--
-- ⚠️ **`exige_formacao_base` NASCE FALSO, e só o provisionamento de quem entra
-- de agora em diante o liga.** São 549 perfis hoje, 52 com aula concluída e
-- ZERO com o selo: ligar a regra para todos tiraria, amanhã, o acesso de quem
-- está no meio de um curso de perícia bancária. Ninguém perde o que já tem --
-- é a mesma régua de "nunca puxar para trás" que o batimento do Nexus segue.
-- ══════════════════════════════════════════════════════

-- ── 1. O curso que NÃO trava ──
alter table public.etapa_missoes
  add column if not exists obrigatorio boolean not null default true;

comment on column public.etapa_missoes.obrigatorio is
  'false = o curso aparece na trilha e conta como conteúdo, mas não é exigido para concluí-la nem para destravar o próximo. Hoje: Excel Básico ao Avançado.';

-- ⚠️ O Excel Básico sai da obrigação, e não da trilha. Ele é 36 das 91 aulas da
-- base (40%), e é justamente o curso de que o público mais provável --
-- contador, administrador, alguém que já vive de planilha -- menos precisa.
-- Exigi-lo geraria o atrito máximo em quem se beneficia dele o mínimo.
update public.etapa_missoes em
   set obrigatorio = false
  from public.cursos c
 where c.id = em.curso_id
   and c.slug = 'excel-para-caculo';

-- ── 2. Quem está sujeito à regra ──
alter table public.perfis
  add column if not exists exige_formacao_base boolean not null default false;

comment on column public.perfis.exige_formacao_base is
  'true = precisa concluir a Formação Pericial antes de abrir os demais territórios. Ligado só no provisionamento de quem entra a partir de 04/09/2026 — quem já estava dentro não perde acesso.';

-- ── 3. `trilha_completa` passa a respeitar o `obrigatorio` ──
--
-- ⚠️ MESMA DEFINIÇÃO PARA O SELO E PARA A TRAVA. Sem isto, o Excel Básico
-- continuaria sendo exigido para o SELO (que usa esta função) e dispensado pela
-- trava — e a pessoa destravaria a plataforma inteira sem nunca receber o selo
-- que a trava existe para proteger.
create or replace function public.trilha_completa(p_usuario uuid, p_trilha_id uuid)
returns boolean
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_tem_etapa boolean;
  v_tem_etapa_vazia boolean;
  v_incompleta boolean;
begin
  if p_trilha_id is null or p_usuario is null then
    return false;
  end if;

  select exists (select 1 from public.etapas where trilha_id = p_trilha_id) into v_tem_etapa;
  if not v_tem_etapa then
    return false;
  end if;

  -- Etapa sem nenhuma missão OBRIGATÓRIA não conta como vazia: uma etapa que
  -- só tenha cursos recomendados está satisfeita por construção.
  select exists (
    select 1 from public.etapas e
    where e.trilha_id = p_trilha_id
      and not exists (select 1 from public.etapa_missoes em where em.etapa_id = e.id)
  ) into v_tem_etapa_vazia;
  if v_tem_etapa_vazia then
    return false;
  end if;

  select exists (
    select 1
    from public.etapas e
    join public.etapa_missoes em on em.etapa_id = e.id
    where e.trilha_id = p_trilha_id
      and em.obrigatorio
      and not public.gam_curso_completo(p_usuario, em.curso_id)
  ) into v_incompleta;

  return not v_incompleta;
end;
$function$;

-- ── 4. A base está concluída? ──
create or replace function public.formacao_base_completa(p_usuario uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  -- O selo é a resposta rápida: quem o tem já concluiu, e a data não volta
  -- atrás. Sem ele, calcula -- porque o selo é concedido por gatilho de
  -- gamificação, e um gatilho que não rodou não pode trancar ninguém.
  select coalesce(
    (select selo_excelencia_em is not null from public.perfis where id = p_usuario),
    false
  ) or coalesce(
    public.trilha_completa(p_usuario, (select id from public.trilhas where principal limit 1)),
    false
  );
$function$;

-- ── 5. A pergunta nova: a PROGRESSÃO liberou este curso? ──
--
-- ⚠️ Responde `true` para quem não está sujeito à regra, para curso recomendado
-- e para curso fora de trilha nenhuma. A trava é a exceção, não o padrão: um
-- curso novo que alguém cadastre sem etapa não pode nascer trancado.
create or replace function public.formacao_liberou_curso(p_usuario uuid, p_curso_id uuid)
returns boolean
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_exige boolean;
  v_trilha_principal uuid;
  v_na_base boolean;
  v_obrigatorio boolean;
  v_ordem_etapa int;
  v_ordem_curso int;
begin
  if p_usuario is null or p_curso_id is null then
    return false;
  end if;

  select coalesce(exige_formacao_base, false) into v_exige
    from public.perfis where id = p_usuario;
  if not coalesce(v_exige, false) then
    return true;
  end if;

  select id into v_trilha_principal from public.trilhas where principal limit 1;
  if v_trilha_principal is null then
    return true;
  end if;

  -- Este curso é da base?
  select true, bool_or(em.obrigatorio), min(e.ordem), min(em.ordem)
    into v_na_base, v_obrigatorio, v_ordem_etapa, v_ordem_curso
  from public.etapa_missoes em
  join public.etapas e on e.id = em.etapa_id
  where em.curso_id = p_curso_id and e.trilha_id = v_trilha_principal;

  -- FORA da base: só abre com a base concluída.
  if not coalesce(v_na_base, false) then
    return public.formacao_base_completa(p_usuario);
  end if;

  -- Recomendado (Excel Básico): abre sempre. Ele não trava e não é travado.
  if not coalesce(v_obrigatorio, true) then
    return true;
  end if;

  -- DENTRO da base: abre quando nenhum obrigatório ANTERIOR está pendente.
  -- A ordem é (etapa.ordem, missao.ordem) — a mesma que o aluno vê na tela.
  return not exists (
    select 1
    from public.etapa_missoes em
    join public.etapas e on e.id = em.etapa_id
    where e.trilha_id = v_trilha_principal
      and em.obrigatorio
      and (e.ordem, em.ordem) < (v_ordem_etapa, v_ordem_curso)
      and not public.gam_curso_completo(p_usuario, em.curso_id)
  );
end;
$function$;

-- ── 6. O que falta para abrir: a mensagem precisa DIZER qual curso ──
--
-- ⚠️ Sem isto a tela só sabe dizer "ainda não liberado", que é a recusa sem
-- caminho. O nome do curso pendente é o que transforma a trava em sequência.
create or replace function public.formacao_curso_pendente(p_usuario uuid, p_curso_id uuid)
returns table (curso_id uuid, titulo text, slug text)
language sql
stable security definer
set search_path to 'public'
as $function$
  with principal as (select id from public.trilhas where principal limit 1),
  alvo as (
    select min(e.ordem) as oe, min(em.ordem) as oc
    from public.etapa_missoes em
    join public.etapas e on e.id = em.etapa_id
    where em.curso_id = p_curso_id and e.trilha_id = (select id from principal)
  )
  select c.id, c.titulo, c.slug
  from public.etapa_missoes em
  join public.etapas e on e.id = em.etapa_id
  join public.cursos c on c.id = em.curso_id
  where e.trilha_id = (select id from principal)
    and em.obrigatorio
    and not public.gam_curso_completo(p_usuario, em.curso_id)
    -- Curso da base: o pendente anterior a ele. Curso de fora: o primeiro
    -- pendente da base inteira.
    and (
      (select oe from alvo) is null
      or (e.ordem, em.ordem) < ((select oe from alvo), (select oc from alvo))
    )
  order by e.ordem, em.ordem
  limit 1;
$function$;

revoke execute on function public.formacao_liberou_curso(uuid, uuid) from public;
revoke execute on function public.formacao_base_completa(uuid) from public;
revoke execute on function public.formacao_curso_pendente(uuid, uuid) from public;
grant execute on function public.formacao_liberou_curso(uuid, uuid) to authenticated;
grant execute on function public.formacao_base_completa(uuid) to authenticated;
grant execute on function public.formacao_curso_pendente(uuid, uuid) to authenticated;

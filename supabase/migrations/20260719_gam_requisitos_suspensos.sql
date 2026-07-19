-- ============================================================
-- Suspensão dinâmica de requisitos compostos sem conteúdo publicado.
-- Registro pós-aplicação via MCP (name=gam_requisitos_suspensos_v2).
--
-- Decisão do Marlos: as avaliações de "VOCÊ, Perito é!" continuam sendo
-- avaliações normais (nenhuma reclassificação pra desafios). A tabela
-- desafios continua vazia até o Marlos publicar desafios reais pela seção
-- Desafios do admin. Enquanto isso, um requisito de nível como
-- "desafios_completos" não pode travar ninguém — não existe conteúdo
-- pra cumprir. Regra geral (à prova de futuro): se o total PUBLICADO de
-- um tipo de conteúdo é 0, o requisito daquele tipo fica suspenso
-- (tratado como cumprido no cálculo de nível) até o dia em que o primeiro
-- item daquele tipo for publicado — sem precisar mexer em código.
--
-- Aplica a cursos_completos, avaliacoes_aprovadas, desafios_completos e
-- aulas_concluidas (todos têm um "total publicado" natural). NÃO aplica a
-- streak_marco_dias nem participacoes_comunidade — não são catálogos de
-- conteúdo publicável pelo admin (streak é mecânica de acesso; comunidade
-- é ação do próprio aluno), sempre "existem" e continuam exigidos.
-- ============================================================

drop function if exists public.gam_contadores_usuario(uuid) cascade;

create function public.gam_contadores_usuario(p_usuario uuid)
returns table(
  aulas_concluidas int, aulas_publicadas int,
  cursos_completos int, cursos_publicados int,
  avaliacoes_aprovadas int, avaliacoes_publicadas int,
  desafios_completos int, desafios_existentes int,
  streak_recorde int, participacoes_comunidade int
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  select count(*) into aulas_concluidas
    from public.aula_progresso where usuario_id = p_usuario and concluida = true;

  select count(*) into aulas_publicadas
    from public.aulas a join public.modulos m on m.id = a.modulo_id join public.cursos c on c.id = m.curso_id
    where c.publicado = true;

  select count(*) into cursos_publicados from public.cursos where publicado = true;
  select count(*) into cursos_completos
    from public.cursos c where c.publicado = true and public.gam_curso_completo(p_usuario, c.id);

  select count(*) into avaliacoes_publicadas from public.avaliacoes where publicado = true;
  select count(distinct at.avaliacao_id) into avaliacoes_aprovadas
    from public.avaliacao_tentativas at
    join public.avaliacoes a on a.id = at.avaliacao_id
    where at.usuario_id = p_usuario and at.aprovado = true and a.publicado = true;

  select count(*) into desafios_existentes from public.desafios where publicado = true;
  select count(distinct de.desafio_id) into desafios_completos
    from public.desafio_entregas de
    join public.desafios d on d.id = de.desafio_id
    where de.usuario_id = p_usuario and de.entregue_em is not null
      and de.nota >= d.nota_minima and d.publicado = true;

  select coalesce(recorde, 0) into streak_recorde
    from public.streak_estado where usuario_id = p_usuario;
  streak_recorde := coalesce(streak_recorde, 0);

  select
    coalesce((select count(*) from public.comunidade_posts where usuario_id = p_usuario), 0)
    + coalesce((select count(*) from public.comunidade_comentarios where usuario_id = p_usuario), 0)
    + coalesce((select count(*) from public.comunidade_reacoes where usuario_id = p_usuario), 0)
  into participacoes_comunidade;

  return next;
end;
$function$;

revoke execute on function public.gam_contadores_usuario(uuid) from public, anon, authenticated;

create or replace function public.gam_nivel_real(p_usuario uuid, p_xp_total int)
returns table(nivel_ordem int, nivel_nome text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_c record;
  v_nivel record;
begin
  select * into v_c from public.gam_contadores_usuario(p_usuario);

  for v_nivel in select * from public.gamificacao_niveis order by ordem desc loop
    if v_nivel.pontos_minimos > p_xp_total then continue; end if;

    if v_nivel.aulas_concluidas is not null and v_c.aulas_publicadas > 0
       and v_c.aulas_concluidas < v_nivel.aulas_concluidas then continue; end if;

    if v_nivel.cursos_completos is not null and v_c.cursos_publicados > 0 then
      if v_nivel.cursos_completos = -1 then
        if v_c.cursos_completos < v_c.cursos_publicados then continue; end if;
      elsif v_c.cursos_completos < v_nivel.cursos_completos then continue;
      end if;
    end if;

    if v_nivel.avaliacoes_aprovadas is not null and v_c.avaliacoes_publicadas > 0 then
      if v_nivel.avaliacoes_aprovadas = -1 then
        if v_c.avaliacoes_aprovadas < v_c.avaliacoes_publicadas then continue; end if;
      elsif v_c.avaliacoes_aprovadas < v_nivel.avaliacoes_aprovadas then continue;
      end if;
    end if;

    if v_nivel.desafios_completos is not null and v_c.desafios_existentes > 0 then
      if v_nivel.desafios_completos = -1 then
        if v_c.desafios_completos < v_c.desafios_existentes then continue; end if;
      elsif v_c.desafios_completos < v_nivel.desafios_completos then continue;
      end if;
    end if;

    if v_nivel.streak_marco_dias is not null and v_c.streak_recorde < v_nivel.streak_marco_dias then continue; end if;
    if v_nivel.participacoes_comunidade is not null and v_c.participacoes_comunidade < v_nivel.participacoes_comunidade then continue; end if;

    nivel_ordem := v_nivel.ordem;
    nivel_nome := v_nivel.nome;
    return next;
    return;
  end loop;

  return;
end;
$function$;

revoke execute on function public.gam_nivel_real(uuid, int) from public, anon, authenticated;

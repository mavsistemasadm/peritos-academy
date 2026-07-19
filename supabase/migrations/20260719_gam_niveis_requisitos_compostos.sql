-- ============================================================
-- Motor de gamificação — requisitos compostos dos 10 níveis
-- (2026-07-19). Registro pós-aplicação via MCP
-- (name=gam_niveis_requisitos_compostos), pra rastreabilidade do repo.
--
-- Um nível só é alcançado quando XP E requisito composto batem ao
-- mesmo tempo — excedente de XP não substitui requisito faltante (ver
-- gam_nivel_real(), migration seguinte). N9/N10 usam o sentinela -1
-- ("100% do que existe hoje") em vez de um número fixo.
-- ============================================================

alter table public.gamificacao_niveis
  add column if not exists aulas_concluidas int;

comment on column public.gamificacao_niveis.aulas_concluidas is
  'Nulo = sem exigência. Contagem simples de aulas concluídas (usado só no N2, antes do 1º curso completo).';

update public.gamificacao_niveis set
  aulas_concluidas = null, cursos_completos = null, avaliacoes_aprovadas = null,
  desafios_completos = null, streak_marco_dias = null, participacoes_comunidade = null
where ordem = 1;

update public.gamificacao_niveis set
  aulas_concluidas = 3, cursos_completos = null, avaliacoes_aprovadas = null,
  desafios_completos = null, streak_marco_dias = null, participacoes_comunidade = null
where ordem = 2;

update public.gamificacao_niveis set
  aulas_concluidas = null, cursos_completos = 1, avaliacoes_aprovadas = null,
  desafios_completos = null, streak_marco_dias = null, participacoes_comunidade = null
where ordem = 3;

update public.gamificacao_niveis set
  aulas_concluidas = null, cursos_completos = 2, avaliacoes_aprovadas = 1,
  desafios_completos = null, streak_marco_dias = null, participacoes_comunidade = null
where ordem = 4;

update public.gamificacao_niveis set
  aulas_concluidas = null, cursos_completos = 4, avaliacoes_aprovadas = 3,
  desafios_completos = null, streak_marco_dias = 7, participacoes_comunidade = null
where ordem = 5;

update public.gamificacao_niveis set
  aulas_concluidas = null, cursos_completos = 7, avaliacoes_aprovadas = 6,
  desafios_completos = 1, streak_marco_dias = null, participacoes_comunidade = null
where ordem = 6;

update public.gamificacao_niveis set
  aulas_concluidas = null, cursos_completos = 12, avaliacoes_aprovadas = 10,
  desafios_completos = 2, streak_marco_dias = null, participacoes_comunidade = 1
where ordem = 7;

update public.gamificacao_niveis set
  aulas_concluidas = null, cursos_completos = 20, avaliacoes_aprovadas = 18,
  desafios_completos = 4, streak_marco_dias = null, participacoes_comunidade = null
where ordem = 8;

update public.gamificacao_niveis set
  aulas_concluidas = null, cursos_completos = 35, avaliacoes_aprovadas = 28,
  desafios_completos = -1, streak_marco_dias = null, participacoes_comunidade = null
where ordem = 9;

update public.gamificacao_niveis set
  aulas_concluidas = null, cursos_completos = -1, avaliacoes_aprovadas = -1,
  desafios_completos = -1, streak_marco_dias = null, participacoes_comunidade = null
where ordem = 10;

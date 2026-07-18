-- ============================================================
-- Varredura global de dados fabricados (Frente A). Achado sistemático:
-- toda coluna "*_base" no schema é o mesmo padrão de baseline somado
-- a contagem real (já resolvido em comunidade_posts/comunidade_espacos
-- em 20260718_higienizacao_comunidade.sql). Faltavam eventos, planilhas
-- e desafios — resolvidos aqui, mesmo molde: RPC/coluna zerada, nenhum
-- caminho de leitura soma baseline nunca mais.
-- ============================================================

-- contar_confirmados: mesmo fix de contar_reacoes, só reservas reais.
create or replace function public.contar_confirmados(p_evento uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::int
  from evento_reservas r
  where r.evento_id = p_evento
$$;

update eventos set confirmados_base = 0;

-- planilha_downloads.SELECT é restrita ao dono da linha (pdl_select) —
-- contagem cross-usuário real só via RPC security definer.
create or replace function public.planilha_downloads_contagem()
returns table(planilha_id uuid, downloads int)
language sql
security definer
set search_path = public
as $$
  select pd.planilha_id, count(*)::int
  from planilha_downloads pd
  group by pd.planilha_id
$$;

revoke execute on function public.planilha_downloads_contagem() from public;
grant execute on function public.planilha_downloads_contagem() to authenticated;

update planilhas set downloads_base = 0;

-- desafios.participantes_base: já tinha contagem real (desafio_entregas
-- é legível cross-usuário, RLS permissiva); só a soma extra era fabricada.
update desafios set participantes_base = 0;

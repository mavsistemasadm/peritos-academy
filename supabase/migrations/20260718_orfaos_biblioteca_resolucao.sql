-- ============================================================
-- Resolução dos 6 cursos órfãos encontrados na auditoria de
-- 20260718_ordenacao_editorial_biblioteca.sql.
--
-- 2 vinculados (posicionados por último na etapa escolhida, tanto em
-- ordem_biblioteca quanto em ordem/jornada — sem reordenar os cursos
-- já existentes na etapa):
--   - PJE Calc e Liquidação de Sentença → Expert em Cálculos
--     Trabalhistas / Carreira Trabalhista
--   - Precificação de cálculos e negócios periciais → Negócios e
--     Empreendedorismo Pericial / Base de um negócio pericial
--
-- 4 despublicados sem vínculo (duplicatas/descontinuados, decisão do
-- Marlos — nada deletado, só publicado=false):
--   - Planilha Automática de Revisão de Cheque Especial
--   - IA da Peritos Academy: "Os Galácticos"
--   - Como iniciar na carreira de Perito (dup. de "Como dar o pontapé
--     inicial na carreira de Perito")
--   - Tudo começa com uma decisão! (dup. de "Entenda as consequências
--     da sua decisão. Está pronto para ser Perito?")
-- ============================================================

insert into public.etapa_missoes (etapa_id, curso_id, ordem, ordem_biblioteca)
select '8525c9c5-c6cf-4475-a7a4-49d3c60b4951', '038cdc70-8580-4ea6-b96b-b12b918e89c3', 3, 4
where not exists (
  select 1 from public.etapa_missoes
  where etapa_id = '8525c9c5-c6cf-4475-a7a4-49d3c60b4951' and curso_id = '038cdc70-8580-4ea6-b96b-b12b918e89c3'
);

insert into public.etapa_missoes (etapa_id, curso_id, ordem, ordem_biblioteca)
select '9767225c-897f-45fa-936d-ace02c983388', '2513c6c8-4bcb-48d9-9988-ca69075bb6d5', 5, 7
where not exists (
  select 1 from public.etapa_missoes
  where etapa_id = '9767225c-897f-45fa-936d-ace02c983388' and curso_id = '2513c6c8-4bcb-48d9-9988-ca69075bb6d5'
);

update public.cursos set publicado = false
where id in (
  '8f87e9f6-ffc3-435e-82d4-b798db14584c', -- Planilha Automática de Revisão de Cheque Especial
  'f7e22603-17f8-4e48-b81b-87ec171ebc82', -- IA da Peritos Academy: "Os Galácticos"
  'e04f159b-3166-4d3d-a79c-721fc1fe55e7', -- Como iniciar na carreira de Perito
  'a44c619f-10e4-4677-9429-8c33c1633a16'  -- Tudo começa com uma decisão!
);

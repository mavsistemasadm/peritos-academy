-- Textos novos para os estados "sem rota" e "em andamento" de /meu-plano
-- (a página deixou de ser a casca antiga "Organize seus estudos"). Reusa
-- a mesma tabela anamnese_textos_gerais (20260721_anamnese_textos_cerimonia.sql).

insert into public.anamnese_textos_gerais (chave, texto) values
  ('meu_plano_convite_linha', 'Responda 16 perguntas e receba o mapa do seu primeiro ano'),
  ('meu_plano_retomar_titulo', 'Retomar minha rota'),
  ('meu_plano_retomar_cta', 'Continuar de onde parei'),
  ('meu_plano_tesouro_titulo', 'Rota concluída'),
  ('meu_plano_tesouro_mensagem', 'Você percorreu o mapa inteiro da sua Rota do Perito. O tesouro é seu.')
on conflict (chave) do update set texto = excluded.texto;

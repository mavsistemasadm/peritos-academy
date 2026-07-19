-- Textos da cerimônia do mapa da Rota do Perito. Fonte:
-- docs/conteudo/TEXTOS_MAPA_ROTA_DO_PERITO.md (pacote aprovado pelo Marlos).
-- Editável no admin numa tarefa futura — por ora só as tabelas + seed.

create table if not exists public.anamnese_territorios (
  trilha_id uuid primary key references public.trilhas(id),
  x_pct numeric not null,
  y_pct numeric not null,
  descricao_curta text not null,
  justificativa_unica text,
  justificativa_iniciante text,
  justificativa_evoluido text
);

create table if not exists public.anamnese_frases_espelho (
  chave text primary key,
  texto text not null
);

create table if not exists public.anamnese_textos_gerais (
  chave text primary key,
  texto text not null
);

alter table public.anamnese_territorios enable row level security;
alter table public.anamnese_frases_espelho enable row level security;
alter table public.anamnese_textos_gerais enable row level security;

drop policy if exists anamnese_territorios_leitura on public.anamnese_territorios;
create policy anamnese_territorios_leitura on public.anamnese_territorios for select to authenticated using (true);
drop policy if exists anamnese_frases_espelho_leitura on public.anamnese_frases_espelho;
create policy anamnese_frases_espelho_leitura on public.anamnese_frases_espelho for select to authenticated using (true);
drop policy if exists anamnese_textos_gerais_leitura on public.anamnese_textos_gerais;
create policy anamnese_textos_gerais_leitura on public.anamnese_textos_gerais for select to authenticated using (true);

-- Coordenadas (x_pct, y_pct) mapeadas por inspeção de pixel real sobre
-- public/rota/mesa-perito.png (1456x816) — ver conferência visual na sessão.
-- Atribuição fixa: trilhas.ordem 1..13 -> envelope 1..13 (mesma posição pra
-- todo aluno; só o traçado do caminho e o destaque mudam por usuário).
insert into public.anamnese_territorios (trilha_id, x_pct, y_pct, descricao_curta, justificativa_unica, justificativa_iniciante, justificativa_evoluido)
select t.id,
  v.x_pct, v.y_pct, v.descricao_curta, v.justificativa_unica, v.justificativa_iniciante, v.justificativa_evoluido
from (values
  (1, 26.8, 12.9,
    'Onde todo perito nasce. A base que sustenta cada laudo da sua carreira.',
    'Este é o principal selo de qualidade da Peritos Academy. Não é um curso introdutório: é o nivelamento na barra estabelecida pela casa, e por isso serve tanto para quem está começando do zero quanto para quem já atua e nunca passou por uma formação estruturada. Aqui você domina a estrutura judicial, constrói o Excel que trabalha por você, executa dezenas de cálculos reais e monta as suas próprias planilhas de atualização. Você sai desta trilha elaborando uma grande variedade de cálculos judiciais com segurança e precisão, no padrão que sustenta o resto do mapa inteiro.',
    null, null),
  (2, 44.3, 11.0,
    'O caminho até o juízo confiar um processo ao seu nome.',
    null,
    'O perito nomeado pelo juízo tem o cliente mais estável que existe: a própria Justiça. As varas precisam de peritos qualificados e a demanda supera a oferta em boa parte do país. Esta trilha percorre o caminho completo: como se cadastrar e ser encontrado, como conquistar a primeira nomeação, como redigir quesitos e laudos que constroem reputação, e como transformar isso nos seus primeiros honorários judiciais. Você sai com o mapa da nomeação na mão e o método para ela se repetir.',
    'Competência sem visibilidade não gera nomeação. Esta trilha resolve o lado do jogo que a técnica sozinha não resolve: posicionar o seu nome diante dos juízos, estruturar laudos automáticos que multiplicam sua capacidade de resposta e dominar a redação de quesitos que fazem o seu trabalho ser lembrado. O resultado esperado: nomeações deixando de ser eventuais e virando fluxo.'),
  (3, 58.0, 19.0,
    'Os cálculos que aparecem em toda mesa: pensão, aluguel, rescisões.',
    'Pensão alimentícia, revisão de aluguel e verbas rescisórias são os cálculos que chegam a toda mesa de perito, o ano inteiro, em qualquer cidade. É o feijão com arroz que paga contas e abre portas: advogados testam o perito novo exatamente por essas demandas antes de confiar os casos grandes. Você sai desta trilha resolvendo com rapidez e padrão os três cálculos mais pedidos do mercado, pronto para nunca mais recusar um caso por insegurança no básico.',
    null, null),
  (4, 62.2, 31.2,
    'O maior volume de processos do país, dominado do tempo de serviço à liquidação.',
    null,
    'A Justiça do Trabalho concentra o maior volume de processos com cálculo do país: milhões de reclamatórias, todas precisando de liquidação. É o mercado de entrada mais garantido da perícia. Os três programas desta trilha levam você do tempo de serviço e prescrição até a liquidação completa de sentença, passando por férias, verbas, adicionais e horas extras. Você sai calculando uma reclamatória inteira de ponta a ponta, no padrão que resiste a impugnação.',
    'A área que você declarou como ofício, tratada como carreira e não como curso: três programas progressivos que consolidam método onde hoje existe prática. Do refinamento das verbas e reflexos até os desafios finais da trilha, o objetivo é um só: o título de expert deixar de ser autopercepção e virar padrão verificável nos seus cálculos. Você fecha o ciclo dominando a liquidação trabalhista completa com assinatura própria.'),
  (5, 85.5, 39.2,
    'Aposentadorias, revisões e os cálculos contra a Fazenda Pública.',
    null,
    'O Brasil envelhece e a fila de aposentadorias, revisões e ações contra o INSS só cresce: é um mercado com demanda estrutural, que não depende de moda. Os três programas levam você do cálculo de todos os tipos de benefício até as revisões completas e os cálculos contra a Fazenda Pública, o degrau mais valorizado da área. Você sai apto a atender do segurado individual ao escritório previdenciarista, com o cálculo que decide a causa.',
    'A sua especialidade declarada, fechada em ciclo completo: benefícios, todas as revisões e os segredos dos cálculos contra a Fazenda Pública, a fronteira onde os honorários são maiores e os peritos preparados são poucos. O resultado esperado: você atendendo advogados previdenciaristas como referência técnica, não como orçamento entre três.'),
  (6, 23.7, 33.3,
    'Juros, contratos e revisionais: pensar como o banco para encontrar o que ele esconde.',
    null,
    'Revisional bancária é um oceano: cartão, cheque especial, financiamento, habitacional, execuções. Cada contrato em disputa precisa de um cálculo, e a maioria dos peritos foge da complexidade dos juros. É exatamente por isso que quem domina cobra caro. O território mais denso do mapa, dez cursos, ensina você a pensar como o banco pensa: juros, capitalização, sistemas de amortização e as revisões de cada modalidade. Você sai recalculando qualquer contrato bancário e apurando a diferença que sustenta a ação.',
    'A área que você escolheu como ofício, no arsenal mais completo da plataforma: das discussões contratuais e do mundo dos juros até as revisões de cartão, cheque especial, financiamentos, SFH, execuções bancárias, TJLP, FIES e o Kit Bancário Profissional com planilha automatizada. O resultado esperado: nenhuma modalidade bancária fora do seu alcance, e um kit pronto para transformar cada contrato em proposta de trabalho.'),
  (7, 15.6, 50.7,
    'Recuperação de tributos para pessoas e empresas. Alto valor por caso.',
    null,
    'A recuperação tributária vive um dos melhores momentos da história: teses consolidadas nos tribunais superiores, empresas pagando tributo indevido todos os meses e escassez de quem saiba calcular a recuperação. É a área do alto valor por caso: um único laudo para uma empresa média vale mais que dezenas de cálculos comuns. Você sai desta trilha dominando as principais teses de pessoa física e jurídica, do imposto de renda ao ICMS, pronto para atender o mercado empresarial.',
    'A especialidade que você apontou, no segmento de maior tíquete da perícia: teses tributárias para PF e PJ com jurisprudência madura e demanda empresarial constante. Da isenção de IR à exclusão do ICMS das bases de PIS e COFINS, o objetivo é você entrar no mercado que advogados tributaristas e empresas disputam: o do perito que entrega o número que fundamenta a recuperação.'),
  (8, 47.7, 50.9,
    'Fundos de pensão e reservas matemáticas. Um nicho que pouquíssimos dominam.',
    null,
    'Fundos de pensão como PETROS, PREVI e FUNCEF concentram milhões de participantes e teses revisionais bilionárias, e quase nenhum perito domina cálculo atuarial. É o território da escassez: pouca concorrência, demanda represada e honorários à altura da raridade. Você sai desta trilha calculando as principais revisões de benefício dos grandes fundos e os expurgos na reserva matemática, com um diferencial que pouquíssimos currículos têm.',
    'A sua área declarada é também uma das mais raras do mercado: revisões de PETROS, PREVI e FUNCEF e expurgos na reserva matemática, com massa enorme de beneficiários e um punhado de peritos aptos. O resultado esperado: você entre os poucos nomes que advogados dessa área conseguem citar, cobrando como quem não tem substituto na esquina.'),
  (9, 65.2, 67.0,
    'As teses de massa que geram demanda constante e faturamento recorrente.',
    null,
    'Esta trilha existe para quem precisa começar a faturar rápido: nove teses de massa em alta no mercado, de expurgos da poupança a precatórios, consórcios, planos de saúde e PASEP. São demandas que chegam em volume, com cálculo padronizável e mercado comprador o ano inteiro. Você sai com um portfólio de teses prontas para oferecer a advogados hoje, gerando receita enquanto atravessa o resto do mapa.',
    'Você pediu volume e recorrência, e este é o território delas: nove teses de massa com demanda constante, do precatório ao PASEP, ideais para padronizar, precificar e escalar. O resultado esperado: uma esteira de casos girando no seu escritório, financiando as especialidades de maior tíquete com faturamento previsível.'),
  (10, 32.3, 63.5,
    'Seu arsenal: planilhas que calculam em minutos o que levaria dias.',
    null,
    'A diferença entre o perito que atende três casos por mês e o que atende trinta não é conhecimento: é ferramenta. Estas sete planilhas profissionais, do cartão ponto à Revisão da Vida Toda, fazem em minutos o que a mão faz em dias, e você aprende cada uma por dentro, entendendo a lógica antes de confiar no automático. Você sai equipado com o arsenal que transforma conhecimento em capacidade de produção real.',
    'Seu tempo é o teto do seu faturamento, e estas planilhas levantam o teto: sete ferramentas profissionais de RMC e superendividamento a SFH, FGTS, Vida Toda e cálculos trabalhistas completos. O resultado esperado: sua capacidade de entrega multiplicada sem multiplicar suas horas, com o padrão de qualidade embutido na ferramenta.'),
  (11, 13.7, 67.2,
    'Uma planilha, milhares de cálculos. A engenharia da escala.',
    null,
    'Automação é o divisor de águas da perícia moderna: enquanto a maioria calcula processo por processo, quem automatiza processa milhares de cálculos de uma vez e atende demandas que ninguém mais consegue. Esta trilha mostra o caminho desde as primeiras automações até a planilha que transforma o impossível em rotina. Você sai enxergando a perícia como engenharia de escala, anos à frente da concorrência.',
    'Você quer escala de verdade, e escala é engenharia: estruturar dados, tratar informações automaticamente e construir a planilha que executa milhares de cálculos de uma vez. Esta trilha é o projeto dessa máquina. O resultado esperado: seu escritório operando em volume que a concorrência manual não alcança, com você no controle da lógica, não refém dela.'),
  (12, 85.9, 61.2,
    'Transformar competência técnica em clientes, contratos e receita.',
    null,
    'Perícia é profissão e é negócio, e quem trata só como profissão fica esperando o telefone tocar. Esta trilha constrói o lado comercial desde o início: documentos essenciais, precificação, estratégias comerciais, e-mails que vendem e o mapa para os primeiros cem mil em seis meses, além de tráfego pago para peritos. Você sai com carreira e negócio nascendo juntos, sem depender de indicação para existir.',
    'Competência técnica você tem; esta trilha constrói o que transforma competência em receita previsível: posicionamento, precificação estratégica, funil comercial, e-mails que convertem e anúncios no Google e no Facebook falando com quem contrata perito. O resultado esperado: clientes chegando por sistema, não por sorte, e o seu conhecimento finalmente precificado à altura.'),
  (13, 52.7, 82.2,
    'Aulas magnas de casos reais. Bônus para quem quer ir além.',
    'As aulas magnas da casa: casos reais de alto nível dissecados do início ao fim, sem pressa e sem simplificação. É o território bônus do mapa, feito para quem quer ver a teoria aplicada em batalha de verdade. O resultado esperado: o tipo de insight que rende solução direta para o processo que está na sua mesa.',
    null, null)
) as v(trilha_ordem, x_pct, y_pct, descricao_curta, justificativa_unica, justificativa_iniciante, justificativa_evoluido)
join public.trilhas t on t.ordem = v.trilha_ordem
on conflict (trilha_id) do update set
  x_pct = excluded.x_pct, y_pct = excluded.y_pct,
  descricao_curta = excluded.descricao_curta,
  justificativa_unica = excluded.justificativa_unica,
  justificativa_iniciante = excluded.justificativa_iniciante,
  justificativa_evoluido = excluded.justificativa_evoluido;

insert into public.anamnese_frases_espelho (chave, texto) values
  ('pode_mais', 'Você disse que sabe que pode mais. A partir de hoje, existe um caminho com o seu nome.'),
  ('transicao', 'Você está em transição. Esta rota foi desenhada para transformar essa virada em profissão.'),
  ('urgencia_financeira', 'Você precisa de resultado, não de promessa. Esta rota começa pelo que gera retorno primeiro.'),
  ('reconhecimento', 'Você quer ser respeitado pelo que sabe. Este mapa termina exatamente nesse lugar.'),
  ('cansaco_emprego', 'Você está pronto para trabalhar por conta do seu próprio nome. O caminho está traçado.'),
  ('ja_atua_evoluir', 'Você não começa do zero. Começa da experiência, e ela encurta o caminho.'),
  ('medo', 'Você chegou até aqui respondendo com honestidade. É assim que se começa bem.'),
  ('fallback', 'Suas respostas desenharam este mapa. Cada território abaixo existe por uma razão sua.')
on conflict (chave) do update set texto = excluded.texto;

insert into public.anamnese_textos_gerais (chave, texto) values
  ('convite_titulo', 'A Rota do Perito'),
  ('convite_descricao', 'Antes de começar sua jornada, vamos entender seu momento e seus objetivos. Com base nas suas respostas, vamos montar uma rota personalizada para que você aproveite ao máximo a plataforma e conquiste resultados reais com a perícia.'),
  ('convite_botao_acao', 'Descobrir minha rota'),
  ('convite_botao_recusa', 'Me lembre depois'),
  ('tesouro_base', 'Esta é a sua rota para o primeiro ano. Seguindo ela no seu ritmo, em 12 meses você colhe resultados sólidos como perito. Este caminho é seu.'),
  ('tesouro_flexao_nomeacoes', 'Nomeado pelo juízo, com método próprio e o respeito dos processos.'),
  ('tesouro_flexao_negocio', 'Posicionado no mercado, com clientes e um negócio pericial de pé.'),
  ('tesouro_aviso_excede', 'No seu ritmo, esta rota atravessa o ano e segue adiante. Com {horas_sugeridas}h por semana, você fecha em 12 meses.'),
  ('microcopy_selo_dossie', 'CASO 0000 · ROTA TRAÇADA'),
  ('microcopy_antes_lacre', 'Analisamos as suas 16 respostas.'),
  ('microcopy_marcador_inicial', 'VOCÊ ESTÁ AQUI'),
  ('microcopy_territorio_explorar', 'Território a explorar'),
  ('microcopy_prazo_honesto', 'Esta rota foi calculada para o seu ritmo de {horas}h por semana. Sem atalhos mágicos, com constância de verdade.'),
  ('microcopy_cta_principal', 'Começar minha rota'),
  ('microcopy_cta_secundario', 'Guardar meu mapa'),
  ('microcopy_toast_xp', '+25 XP · Rota Traçada'),
  ('microcopy_meu_plano_titulo', 'Minha Rota do Perito'),
  ('microcopy_refazer', 'Refazer minha Rota do Perito. Seu progresso nos cursos não muda; apenas o mapa será redesenhado.')
on conflict (chave) do update set texto = excluded.texto;

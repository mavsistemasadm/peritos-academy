-- Motor da "Rota do Perito" (anamnese de onboarding). Camada de apresentação
-- (mapa SVG, cena final, Meu plano visual) fica para uma tarefa futura — esta
-- migration só constrói schema + RPCs + seed, sem UI nenhuma.
--
-- Decisões de integração (documentadas aqui porque não há outro lugar):
-- 1) `planos` já existe (feature dormente "meu plano de estudo", 0 uso em
--    código, RLS `planos_proprios` já cobre auth.uid()=usuario_id). Em vez de
--    uma tabela nova paralela, a Rota do Perito é UM `planos` com
--    `origem='anamnese'` — 100% aditivo, zero risco pra feature dormente
--    (que continuaria criando linhas com origem='manual' se algum dia for
--    ligada). `plano_trilhas` é filha de `planos` (plano_id), com
--    usuario_id duplicado pra RLS simples (padrão já usado noutras tabelas
--    do projeto em vez de subquery em toda policy).
-- 2) `perfis.avatar` viraria colisão de nome com `perfis.avatar_url` (foto
--    de perfil, já existente) — a coluna nova se chama `anamnese_avatar`.
-- 3) anamnese_questoes/anamnese_opcoes usam chave natural (ordem inteira,
--    0-indexed pra questão / 1-indexed pra opção) em vez de UUID — mesmo
--    padrão de `gamificacao_gatilhos.codigo`: é um catálogo pequeno e fixo,
--    não precisa de UUID surrogate, e fica idempotente por natureza
--    (ON CONFLICT na chave natural).
-- 4) anamnese_opcao_trilhas (os pesos de voto) é o "gabarito" deste
--    mecanismo — mesma lógica de avaliacao_opcoes.correta: RLS habilitada,
--    SEM policy de select pra authenticated/anon. Só as RPCs (security
--    definer) enxergam os pesos.

-- ══════════════════════════════════════════════════════════════════
-- 1) SCHEMA
-- ══════════════════════════════════════════════════════════════════

create table if not exists public.anamnese_questoes (
  ordem int primary key,
  enunciado text not null,
  papel text not null check (papel in ('diagnostica','calibracao','emocional')),
  ensinio_id int
);

create table if not exists public.anamnese_opcoes (
  questao_ordem int not null references public.anamnese_questoes(ordem) on delete cascade,
  opcao_ordem int not null,
  texto text not null,
  horas_semana_valor numeric,
  primary key (questao_ordem, opcao_ordem)
);

create table if not exists public.anamnese_opcao_trilhas (
  questao_ordem int not null,
  opcao_ordem int not null,
  trilha_id uuid not null references public.trilhas(id) on delete cascade,
  peso int not null check (peso > 0),
  primary key (questao_ordem, opcao_ordem, trilha_id),
  foreign key (questao_ordem, opcao_ordem) references public.anamnese_opcoes(questao_ordem, opcao_ordem) on delete cascade
);

create table if not exists public.anamnese_respostas (
  usuario_id uuid not null references auth.users(id) on delete cascade,
  questao_ordem int not null,
  opcao_ordem int not null,
  respondido_em timestamptz not null default now(),
  primary key (usuario_id, questao_ordem),
  foreign key (questao_ordem, opcao_ordem) references public.anamnese_opcoes(questao_ordem, opcao_ordem)
);

alter table public.anamnese_questoes enable row level security;
alter table public.anamnese_opcoes enable row level security;
alter table public.anamnese_opcao_trilhas enable row level security;
alter table public.anamnese_respostas enable row level security;

drop policy if exists anamnese_questoes_leitura on public.anamnese_questoes;
create policy anamnese_questoes_leitura on public.anamnese_questoes for select to authenticated using (true);

drop policy if exists anamnese_opcoes_leitura on public.anamnese_opcoes;
create policy anamnese_opcoes_leitura on public.anamnese_opcoes for select to authenticated using (true);

-- anamnese_opcao_trilhas: propositalmente SEM policy de select — é o
-- "gabarito" (qual opção vota em qual trilha), só as RPCs enxergam.

drop policy if exists anamnese_respostas_proprias on public.anamnese_respostas;
create policy anamnese_respostas_proprias on public.anamnese_respostas for all
  using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

-- perfis.avatar_url já existe (foto de perfil) — nome novo pra não colidir.
alter table public.perfis add column if not exists anamnese_avatar text
  check (anamnese_avatar in ('iniciante_transicao','perito_em_evolucao'));

-- planos: aditivo, só usado quando origem='anamnese'. RLS existente
-- (planos_proprios, auth.uid()=usuario_id) já cobre as linhas novas.
alter table public.planos add column if not exists origem text not null default 'manual'
  check (origem in ('manual','anamnese'));
alter table public.planos add column if not exists horas_semana_declarada numeric;
alter table public.planos add column if not exists semanas_totais int;
alter table public.planos add column if not exists meses_totais int;
alter table public.planos add column if not exists excede_meta_meses boolean;
alter table public.planos add column if not exists horas_semana_sugerida numeric;

create table if not exists public.plano_trilhas (
  id uuid primary key default gen_random_uuid(),
  plano_id uuid not null references public.planos(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  trilha_id uuid not null references public.trilhas(id),
  ordem int not null,
  votos int not null default 0,
  forcada_regra_iniciante boolean not null default false,
  num_cursos int,
  num_avaliacoes int,
  carga_horas_video numeric,
  carga_horas_avaliacoes numeric,
  carga_efetiva_horas numeric,
  semana_inicio int,
  semana_fim int,
  mes_inicio int,
  mes_fim int,
  unique (plano_id, trilha_id),
  unique (plano_id, ordem)
);

alter table public.plano_trilhas enable row level security;
drop policy if exists plano_trilhas_proprios on public.plano_trilhas;
create policy plano_trilhas_proprios on public.plano_trilhas for all
  using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

-- Config singleton (mesmo padrão de config_gamificacao/config_financeiro).
create table if not exists public.config_anamnese (
  id int primary key default 1 check (id = 1),
  horas_por_avaliacao numeric not null default 1,
  fator_estudo_efetivo numeric not null default 1.5,
  teto_trilhas_prescricao int not null default 5,
  meta_meses int not null default 12
);
alter table public.config_anamnese enable row level security;
drop policy if exists config_anamnese_leitura on public.config_anamnese;
create policy config_anamnese_leitura on public.config_anamnese for select to authenticated using (true);
insert into public.config_anamnese (id) values (1) on conflict (id) do nothing;

-- Gatilho de gamificação (25 XP, idempotente por referencia_id=usuario_id
-- na RPC — ver anamnese_gerar_prescricao). Preserva pontos/moedas/ativo se
-- o admin já tiver recalibrado (mesmo padrão do seed de gamificacao_gatilhos
-- documentado no projeto: ON CONFLICT só atualiza nome/descricao/categoria).
insert into public.gamificacao_gatilhos (codigo, nome, descricao, pontos, moedas, limite_diario, ativo, categoria)
values ('concluir_anamnese', 'Concluir a Rota do Perito', 'Creditado uma única vez, ao terminar a anamnese e gerar a rota personalizada.', 25, 0, 1, true, 'marco')
on conflict (codigo) do update set
  nome = excluded.nome, descricao = excluded.descricao, categoria = excluded.categoria;

-- ══════════════════════════════════════════════════════════════════
-- 2) SEED — 16 questões, com a curadoria de CURADORIA_ROTA_PERITO.md
-- ══════════════════════════════════════════════════════════════════

insert into public.anamnese_questoes (ordem, enunciado, papel, ensinio_id) values
  (0, 'Em qual dessas situações você se encaixa hoje?', 'diagnostica', 1),
  (1, 'Qual seu principal objetivo ao entrar na Peritos Academy?', 'diagnostica', 2),
  (2, 'Quanto tempo por semana você pode se dedicar aos estudos na plataforma?', 'calibracao', 3),
  (3, 'Qual dessas formas de atuação mais combina com o que você busca?', 'diagnostica', 4),
  (4, 'Em qual dessas áreas você tem mais interesse ou afinidade técnica?', 'diagnostica', 5),
  (5, 'Você tem interesse em usar inteligência artificial ou automações na sua atuação como perito?', 'diagnostica', 6),
  (6, 'Como está sua confiança em relação aos cálculos judiciais hoje?', 'diagnostica', 7),
  (7, 'Qual dessas frases mais representa sua realidade atual?', 'diagnostica', 8),
  (8, 'Como está seu domínio do Excel atualmente?', 'diagnostica', 9),
  (9, 'Qual tipo de conteúdo mais te interessa na plataforma?', 'diagnostica', 10),
  (10, 'O que te motivou a buscar a perícia nesse momento da sua vida?', 'emocional', 16),
  (11, 'Como seria a sua vida ideal daqui a 12 meses?', 'emocional', 17),
  (12, 'Qual dessas frases mais se aproxima do que você sente hoje?', 'emocional', 18),
  (13, 'Você sente apoio da sua família ou das pessoas próximas nessa decisão?', 'emocional', 19),
  (14, 'Por que você acredita que agora é a hora certa para entrar na perícia?', 'emocional', 20),
  (15, 'Quantas vezes você já adiou a vida que queria por medo, rotina ou cansaço e até quando vai continuar fazendo isso com você e com sua família?', 'emocional', 21)
on conflict (ordem) do update set enunciado = excluded.enunciado, papel = excluded.papel, ensinio_id = excluded.ensinio_id;

insert into public.anamnese_opcoes (questao_ordem, opcao_ordem, texto, horas_semana_valor) values
-- Q1
(0,1,'Nunca atuei com perícia e estou começando do zero.', null),
(0,2,'Já estudei perícia, mas ainda não atuei profissionalmente.', null),
(0,3,'Já atuei com cálculos e quero crescer nesse mercado.', null),
(0,4,'Quero empreender com perícia, ter mais clientes e escalar meu negócio.', null),
(0,5,'Quero conquistar nomeações e atuar como perito judicial.', null),
(0,6,'Quero me especializar tecnicamente em uma área específica.', null),
-- Q2
(1,1,'Iniciar uma nova carreira e viver de perícia.', null),
(1,2,'Fazer meus primeiros cálculos e conseguir clientes.', null),
(1,3,'Ganhar dinheiro rápido com teses práticas e planilhas automáticas.', null),
(1,4,'Já sou Perito e quero montar um negócio pericial atendendo empresas e advogados.', null),
(1,5,'Conseguir nomeações e atuar como perito do juízo.', null),
(1,6,'Me especializar tecnicamente em uma área específica.', null),
-- Q3 (calibra ritmo — opções 5+6 do Ensinio fundidas em 1 só, ambas "Mais de 10 horas")
(2,1,'Menos de 2 horas por semana.', 1.5),
(2,2,'De 2 a 4 horas por semana.', 3),
(2,3,'De 5 a 7 horas por semana.', 6),
(2,4,'De 8 a 10 horas por semana.', 9),
(2,5,'Mais de 10 horas por semana.', 12),
-- Q4
(3,1,'Quero ser nomeado pelo juízo e atuar oficialmente nos processos.', null),
(3,2,'Quero atender diretamente advogados e empresas como prestador de serviços.', null),
(3,3,'Quero aprender as duas formas, mas começar com o que gera resultado mais rápido.', null),
(3,4,'Quero atuar de forma independente e empreender com a perícia.', null),
(3,5,'Ainda não sei exatamente, quero conhecer mais as possibilidades.', null),
(3,6,'Já atuo em uma das formas, mas quero expandir para as duas.', null),
-- Q5 (2 opções novas: 7 e 8)
(4,1,'Cálculos trabalhistas (horas extras, verbas, rescisão, etc.)', null),
(4,2,'Cálculos bancários (empréstimos, financiamentos, revisão de contratos)', null),
(4,3,'Cálculos previdenciários (INSS, RMI, atrasados, vida toda)', null),
(4,4,'Teses de massa com alto volume e faturamento rápido', null),
(4,5,'Quero aprender todas as áreas e atuar de forma ampla', null),
(4,6,'Ainda estou explorando, não tenho certeza sobre qual seguir', null),
(4,7,'Teses tributárias (recuperação de tributos para PF e PJ)', null),
(4,8,'Cálculos atuariais e fundos de pensão', null),
-- Q6
(5,1,'Sim, quero usar tudo o que puder para ganhar produtividade.', null),
(5,2,'Sim, mas ainda não sei como isso pode me ajudar.', null),
(5,3,'Tenho curiosidade, mas nunca usei.', null),
(5,4,'Já uso planilhas automáticas ou ferramentas de produtividade.', null),
(5,5,'Uso eventualmente, mas quero ir além.', null),
(5,6,'Não tenho interesse no momento.', null),
-- Q7
(6,1,'Não me sinto seguro(a), quero aprender do zero.', null),
(6,2,'Sei o básico, mas não sei se estou fazendo certo.', null),
(6,3,'Já fiz alguns cálculos, mas tenho dúvidas técnicas.', null),
(6,4,'Me sinto seguro em algumas áreas, mas quero aprofundar.', null),
(6,5,'Tenho total confiança técnica, mas quero mais resultado no mercado.', null),
(6,6,'Já domino os cálculos e quero crescer com escala e autoridade.', null),
-- Q8
(7,1,'Preciso urgente de uma nova fonte de renda.', null),
(7,2,'Estou cansado do meu trabalho atual e quero mudar.', null),
(7,3,'Quero aprender uma nova habilidade com potencial de crescimento.', null),
(7,4,'Quero empreender com perícia e me destacar no mercado.', null),
(7,5,'Já sou perito, mas ainda não consegui resultados relevantes.', null),
(7,6,'Já atuo, mas quero escalar, dominar mais áreas e ser autoridade.', null),
-- Q9
(8,1,'Mal sei abrir uma planilha.', null),
(8,2,'Sei o básico, mas tenho dificuldades.', null),
(8,3,'Me viro bem, mas não uso fórmulas avançadas.', null),
(8,4,'Tenho bom domínio, uso fórmulas e crio estruturas.', null),
(8,5,'Uso Excel diariamente em cálculos ou rotinas profissionais.', null),
(8,6,'Já automatizei planilhas ou usei VBA.', null),
-- Q10
(9,1,'Passo a passo para iniciar do zero.', null),
(9,2,'Conteúdo técnico de cálculo e jurisprudência aplicada.', null),
(9,3,'Estratégias para captar clientes e crescer como perito.', null),
(9,4,'Planilhas automáticas, produtividade e atuação com volume.', null),
(9,5,'Modelos prontos, laudos, petições e nomeações.', null),
(9,6,'Um pouco de tudo para me tornar referência completa.', null),
-- Q11 (emocional)
(10,1,'Estou em um momento de transição e quero mudar de profissão.', null),
(10,2,'Quero crescer financeiramente e ter mais liberdade.', null),
(10,3,'Estou cansado de não ser valorizado no meu trabalho atual.', null),
(10,4,'Já tenho experiência, mas quero uma carreira com mais propósito.', null),
(10,5,'Vi na perícia uma chance real de construir algo meu.', null),
(10,6,'Quero fazer diferença com meu conhecimento e ganhar bem por isso.', null),
-- Q12 (emocional)
(11,1,'Ter minha própria carteira de clientes e viver da perícia.', null),
(11,2,'Ser nomeado judicialmente e reconhecido como perito.', null),
(11,3,'Ter liberdade para trabalhar de onde eu quiser e ganhar bem.', null),
(11,4,'Trabalhar com algo que me dá orgulho e estabilidade.', null),
(11,5,'Ter múltiplas fontes de renda com perícia.', null),
(11,6,'Ser referência em uma área técnica e respeitado no meio jurídico.', null),
-- Q13 (emocional — usada na regra de avatar)
(12,1,'Sei que posso mais, mas não sei por onde começar.', null),
(12,2,'Já tentei antes, mas faltou direcionamento.', null),
(12,3,'Sou Perito e estou cansado de me sentir travado ou estagnado.', null),
(12,4,'Tenho vontade, mas falta tempo e apoio.', null),
(12,5,'Estou decidido a fazer dar certo dessa vez.', null),
(12,6,'Não quero mais depender de outras pessoas para crescer.', null),
-- Q14 (emocional, só 5 opções no Ensinio original)
(13,1,'Sim, todos me apoiam e acreditam em mim.', null),
(13,2,'Nem todos entendem, mas sabem que é importante pra mim.', null),
(13,3,'Ainda não falei sobre isso com ninguém.', null),
(13,4,'Algumas pessoas não acreditam que isso pode dar certo.', null),
(13,5,'Isso é por mim, vou fazer acontecer com ou sem apoio.', null),
-- Q15 (emocional — opções 3+4 do Ensinio fundidas em 1 só, texto idêntico)
(14,1,'Porque eu decidi parar de adiar e agir.', null),
(14,2,'Porque preciso de resultado financeiro urgente.', null),
(14,3,'Porque quero crescer de verdade e viver com mais liberdade.', null),
(14,4,'Porque chegou minha hora de ser reconhecido.', null),
-- Q16 (emocional)
(15,1,'Não quero mais viver assim. Estou pronto para mudar.', null),
(15,2,'Ainda me sinto preso, mas sei que preciso fazer algo.', null)
on conflict (questao_ordem, opcao_ordem) do update set texto = excluded.texto, horas_semana_valor = excluded.horas_semana_valor;

-- Votos (só Q1-Q10 diagnósticas têm linhas aqui; Q3 e Q11-Q16 não votam).
-- Siglas seguem CURADORIA_ROTA_PERITO.md — resolvidas por slug de trilhas.
insert into public.anamnese_opcao_trilhas (questao_ordem, opcao_ordem, trilha_id, peso)
select v.questao_ordem, v.opcao_ordem, t.id, v.peso
from (values
  -- Q1
  (0,1,'principal',2),
  (0,2,'principal',2),(0,2,'calculos-essenciais-do-perito',1),
  (0,3,'teses-lucrativas-e-de-alto-volume',2),(0,3,'plano-de-automacao-pericial',1),
  (0,4,'negocios-e-empreendedorismo-pericial',2),
  (0,5,'como-se-tornar-um-perito-com-nomeacoes-judiciais',2),
  -- Q2
  (1,1,'principal',2),
  (1,2,'calculos-essenciais-do-perito',2),(1,2,'como-se-tornar-um-perito-com-nomeacoes-judiciais',1),
  (1,3,'teses-lucrativas-e-de-alto-volume',2),(1,3,'planilhas-de-calculos-inteligentes-e-automatizadas',1),
  (1,4,'negocios-e-empreendedorismo-pericial',2),
  (1,5,'como-se-tornar-um-perito-com-nomeacoes-judiciais',2),
  -- Q4
  (3,1,'como-se-tornar-um-perito-com-nomeacoes-judiciais',2),
  (3,2,'negocios-e-empreendedorismo-pericial',2),
  (3,3,'teses-lucrativas-e-de-alto-volume',2),(3,3,'como-se-tornar-um-perito-com-nomeacoes-judiciais',1),
  (3,4,'negocios-e-empreendedorismo-pericial',2),(3,4,'plano-de-automacao-pericial',1),
  (3,5,'principal',1),
  (3,6,'negocios-e-empreendedorismo-pericial',1),(3,6,'plano-de-automacao-pericial',1),
  -- Q5
  (4,1,'expert-em-calculos-trabalhistas',3),
  (4,2,'perito-bancario-profissional',3),
  (4,3,'especialista-em-calculos-prevideniciarios',3),
  (4,4,'teses-lucrativas-e-de-alto-volume',3),
  (4,5,'perito-bancario-profissional',1),(4,5,'expert-em-calculos-trabalhistas',1),(4,5,'especialista-em-calculos-prevideniciarios',1),
  (4,6,'principal',1),(4,6,'calculos-essenciais-do-perito',1),
  (4,7,'teses-de-calculos-tributarios',3),
  (4,8,'teses-de-calculos-atuariais',3),
  -- Q6
  (5,1,'plano-de-automacao-pericial',2),(5,1,'planilhas-de-calculos-inteligentes-e-automatizadas',1),
  (5,2,'plano-de-automacao-pericial',2),
  (5,3,'plano-de-automacao-pericial',1),
  (5,4,'planilhas-de-calculos-inteligentes-e-automatizadas',2),
  (5,5,'planilhas-de-calculos-inteligentes-e-automatizadas',1),(5,5,'plano-de-automacao-pericial',1),
  -- Q7
  (6,1,'principal',2),(6,1,'calculos-essenciais-do-perito',1),
  (6,2,'calculos-essenciais-do-perito',2),
  (6,3,'calculos-essenciais-do-perito',2),
  (6,5,'negocios-e-empreendedorismo-pericial',1),(6,5,'teses-lucrativas-e-de-alto-volume',1),
  (6,6,'negocios-e-empreendedorismo-pericial',2),(6,6,'plano-de-automacao-pericial',1),
  -- Q8
  (7,1,'teses-lucrativas-e-de-alto-volume',2),
  (7,2,'principal',1),(7,2,'como-se-tornar-um-perito-com-nomeacoes-judiciais',1),
  (7,3,'principal',1),
  (7,4,'negocios-e-empreendedorismo-pericial',2),
  (7,5,'plano-de-automacao-pericial',1),(7,5,'teses-lucrativas-e-de-alto-volume',1),
  (7,6,'negocios-e-empreendedorismo-pericial',1),(7,6,'plano-de-automacao-pericial',1),
  -- Q9
  (8,1,'principal',1),
  (8,2,'principal',1),
  (8,3,'calculos-essenciais-do-perito',1),
  (8,4,'plano-de-automacao-pericial',1),
  (8,5,'planilhas-de-calculos-inteligentes-e-automatizadas',2),
  (8,6,'planilhas-de-calculos-inteligentes-e-automatizadas',2),(8,6,'plano-de-automacao-pericial',1),
  -- Q10
  (9,1,'principal',1),(9,1,'como-se-tornar-um-perito-com-nomeacoes-judiciais',1),
  (9,3,'negocios-e-empreendedorismo-pericial',2),
  (9,4,'planilhas-de-calculos-inteligentes-e-automatizadas',2),(9,4,'teses-lucrativas-e-de-alto-volume',1),
  (9,5,'como-se-tornar-um-perito-com-nomeacoes-judiciais',2)
) as v(questao_ordem, opcao_ordem, trilha_slug, peso)
join public.trilhas t on t.slug = v.trilha_slug
on conflict (questao_ordem, opcao_ordem, trilha_id) do update set peso = excluded.peso;

-- ══════════════════════════════════════════════════════════════════
-- 3) RPCs
-- ══════════════════════════════════════════════════════════════════

create or replace function public.anamnese_responder(p_questao_ordem int, p_opcao_ordem int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_usuario uuid := auth.uid();
  v_existe boolean;
  v_respondidas int;
  v_total int;
begin
  if v_usuario is null then
    raise exception 'É preciso estar autenticado para responder a anamnese.';
  end if;

  select exists(
    select 1 from public.anamnese_opcoes
    where questao_ordem = p_questao_ordem and opcao_ordem = p_opcao_ordem
  ) into v_existe;
  if not v_existe then
    raise exception 'Opção inválida para esta questão.';
  end if;

  insert into public.anamnese_respostas (usuario_id, questao_ordem, opcao_ordem, respondido_em)
  values (v_usuario, p_questao_ordem, p_opcao_ordem, now())
  on conflict (usuario_id, questao_ordem)
  do update set opcao_ordem = excluded.opcao_ordem, respondido_em = now();

  select count(*) into v_respondidas from public.anamnese_respostas where usuario_id = v_usuario;
  select count(*) into v_total from public.anamnese_questoes;

  return jsonb_build_object('ok', true, 'questoes_respondidas', v_respondidas, 'total_questoes', v_total);
end;
$function$;
revoke execute on function public.anamnese_responder(int, int) from anon;

create or replace function public.anamnese_meu_progresso()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_usuario uuid := auth.uid();
  v_respostas jsonb;
  v_proxima int;
  v_total int;
begin
  if v_usuario is null then
    return null;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('questao_ordem', questao_ordem, 'opcao_ordem', opcao_ordem) order by questao_ordem), '[]'::jsonb)
  into v_respostas
  from public.anamnese_respostas where usuario_id = v_usuario;

  select count(*) into v_total from public.anamnese_questoes;

  select min(q.ordem) into v_proxima
  from public.anamnese_questoes q
  where not exists (
    select 1 from public.anamnese_respostas r where r.usuario_id = v_usuario and r.questao_ordem = q.ordem
  );

  return jsonb_build_object(
    'respostas', v_respostas,
    'total_questoes', v_total,
    'questoes_respondidas', jsonb_array_length(v_respostas),
    'proxima_questao_ordem', v_proxima
  );
end;
$function$;
revoke execute on function public.anamnese_meu_progresso() from anon;

create or replace function public.anamnese_calcular_cronograma()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_usuario uuid := auth.uid();
  v_plano record;
  v_config record;
  v_horas_semana numeric;
  v_pt record;
  v_semana_cursor int := 1;
  v_carga_video numeric;
  v_carga_aval numeric;
  v_carga_efetiva numeric;
  v_semanas int;
  v_num_cursos int;
  v_num_avaliacoes int;
  v_carga_total numeric := 0;
  v_semanas_totais int;
  v_meses_totais int;
  v_trilha_slug text;
begin
  if v_usuario is null then
    raise exception 'É preciso estar autenticado.';
  end if;

  select * into v_plano from public.planos
  where usuario_id = v_usuario and origem = 'anamnese' and ativo = true
  order by criado_em desc limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'sem_plano_ativo');
  end if;

  select * into v_config from public.config_anamnese where id = 1;
  v_horas_semana := coalesce(v_plano.horas_semana_declarada, 6);

  for v_pt in select * from public.plano_trilhas where plano_id = v_plano.id order by ordem loop
    select slug into v_trilha_slug from public.trilhas where id = v_pt.trilha_id;

    select count(distinct c.id), coalesce(sum(a.duracao_seg), 0) / 3600.0
    into v_num_cursos, v_carga_video
    from public.curso_trilha ct
    join public.cursos c on c.id = ct.curso_id and c.publicado = true
    join public.modulos m on m.curso_id = c.id
    join public.aulas a on a.modulo_id = m.id
    where ct.trilha_slug = v_trilha_slug;

    select count(*) into v_num_avaliacoes
    from public.avaliacoes av
    where av.publicado = true
      and av.curso_id in (
        select ct.curso_id from public.curso_trilha ct
        join public.cursos c on c.id = ct.curso_id and c.publicado = true
        where ct.trilha_slug = v_trilha_slug
      );

    v_carga_video := coalesce(v_carga_video, 0);
    v_carga_aval := coalesce(v_num_avaliacoes, 0) * v_config.horas_por_avaliacao;
    v_carga_efetiva := (v_carga_video * v_config.fator_estudo_efetivo) + v_carga_aval;
    v_semanas := greatest(1, ceil(v_carga_efetiva / nullif(v_horas_semana, 0))::int);

    update public.plano_trilhas set
      num_cursos = coalesce(v_num_cursos, 0),
      num_avaliacoes = coalesce(v_num_avaliacoes, 0),
      carga_horas_video = round(v_carga_video, 1),
      carga_horas_avaliacoes = round(v_carga_aval, 1),
      carga_efetiva_horas = round(v_carga_efetiva, 1),
      semana_inicio = v_semana_cursor,
      semana_fim = v_semana_cursor + v_semanas - 1,
      mes_inicio = ceil(v_semana_cursor / 4.0)::int,
      mes_fim = ceil((v_semana_cursor + v_semanas - 1) / 4.0)::int
    where id = v_pt.id;

    v_semana_cursor := v_semana_cursor + v_semanas;
    v_carga_total := v_carga_total + v_carga_efetiva;
  end loop;

  v_semanas_totais := v_semana_cursor - 1;
  v_meses_totais := ceil(v_semanas_totais / 4.0)::int;

  update public.planos set
    semanas_totais = v_semanas_totais,
    meses_totais = v_meses_totais,
    excede_meta_meses = v_meses_totais > v_config.meta_meses,
    horas_semana_sugerida = ceil(v_carga_total / (v_config.meta_meses * 4.0))
  where id = v_plano.id;

  return jsonb_build_object(
    'ok', true,
    'plano_id', v_plano.id,
    'resumo', jsonb_build_object(
      'semanas_totais', v_semanas_totais,
      'meses_totais', v_meses_totais,
      'excede_meta_meses', v_meses_totais > v_config.meta_meses,
      'horas_semana_declarada', v_horas_semana,
      'horas_semana_sugerida_para_meta', ceil(v_carga_total / (v_config.meta_meses * 4.0))
    ),
    'trilhas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'ordem', pt.ordem,
        'trilha_id', pt.trilha_id,
        'trilha_nome', t.nome,
        'votos', pt.votos,
        'forcada_regra_iniciante', pt.forcada_regra_iniciante,
        'num_cursos', pt.num_cursos,
        'num_avaliacoes', pt.num_avaliacoes,
        'carga_horas_video', pt.carga_horas_video,
        'carga_horas_avaliacoes', pt.carga_horas_avaliacoes,
        'carga_efetiva_horas', pt.carga_efetiva_horas,
        'semana_inicio', pt.semana_inicio,
        'semana_fim', pt.semana_fim,
        'mes_inicio', pt.mes_inicio,
        'mes_fim', pt.mes_fim
      ) order by pt.ordem), '[]'::jsonb)
      from public.plano_trilhas pt join public.trilhas t on t.id = pt.trilha_id
      where pt.plano_id = v_plano.id
    )
  );
end;
$function$;
revoke execute on function public.anamnese_calcular_cronograma() from anon;

create or replace function public.anamnese_gerar_prescricao()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_usuario uuid := auth.uid();
  v_total_questoes int;
  v_respondidas int;
  v_config record;
  v_q1_ordem int;
  v_q13_ordem int;
  v_regra_iniciante boolean := false;
  v_avatar text;
  v_plano_id uuid;
  v_horas_semana numeric;
  v_trilha record;
  v_ordem int;
  v_for_trilha_id uuid;
  v_ja_tem_for boolean := false;
begin
  if v_usuario is null then
    raise exception 'É preciso estar autenticado.';
  end if;

  select count(*) into v_total_questoes from public.anamnese_questoes;
  select count(*) into v_respondidas from public.anamnese_respostas where usuario_id = v_usuario;
  if v_respondidas < v_total_questoes then
    return jsonb_build_object('ok', false, 'motivo', 'anamnese_incompleta', 'respondidas', v_respondidas, 'total', v_total_questoes);
  end if;

  select * into v_config from public.config_anamnese where id = 1;

  select opcao_ordem into v_q1_ordem from public.anamnese_respostas where usuario_id = v_usuario and questao_ordem = 0;
  select opcao_ordem into v_q13_ordem from public.anamnese_respostas where usuario_id = v_usuario and questao_ordem = 12;

  if v_q1_ordem in (1, 2) then
    v_avatar := 'iniciante_transicao';
    v_regra_iniciante := true;
  elsif v_q1_ordem in (3, 4) then
    v_avatar := 'perito_em_evolucao';
  else
    -- Q1 opção 5 ou 6 (objetivo, não indica nível de experiência) — Q13
    -- desempata: menção explícita de já ser/atuar como perito = evoluído.
    if v_q13_ordem in (3, 6) then
      v_avatar := 'perito_em_evolucao';
    else
      v_avatar := 'iniciante_transicao';
    end if;
  end if;

  update public.perfis set anamnese_avatar = v_avatar where id = v_usuario;

  select horas_semana_valor into v_horas_semana
  from public.anamnese_respostas r
  join public.anamnese_opcoes o on o.questao_ordem = r.questao_ordem and o.opcao_ordem = r.opcao_ordem
  where r.usuario_id = v_usuario and r.questao_ordem = 2;

  create temporary table tmp_votos on commit drop as
  select ot.trilha_id, sum(ot.peso)::int as votos
  from public.anamnese_respostas r
  join public.anamnese_questoes q on q.ordem = r.questao_ordem and q.papel = 'diagnostica'
  join public.anamnese_opcao_trilhas ot on ot.questao_ordem = r.questao_ordem and ot.opcao_ordem = r.opcao_ordem
  where r.usuario_id = v_usuario
  group by ot.trilha_id;

  select id into v_for_trilha_id from public.trilhas where slug = 'principal';

  update public.planos set ativo = false where usuario_id = v_usuario and origem = 'anamnese' and ativo = true;

  insert into public.planos (usuario_id, titulo, origem, ativo, horas_semana_declarada)
  values (v_usuario, 'Minha Rota do Perito', 'anamnese', true, v_horas_semana)
  returning id into v_plano_id;

  v_ordem := 1;
  -- Regra do iniciante: FOR sempre entra primeiro quando Q1 indica quem
  -- nunca atuou ou só estudou (Fase C.3 da curadoria).
  if v_regra_iniciante then
    insert into public.plano_trilhas (plano_id, usuario_id, trilha_id, ordem, votos, forcada_regra_iniciante)
    values (v_plano_id, v_usuario, v_for_trilha_id, v_ordem, coalesce((select votos from tmp_votos where trilha_id = v_for_trilha_id), 0), true);
    v_ordem := v_ordem + 1;
    v_ja_tem_for := true;
  end if;

  for v_trilha in
    select trilha_id, votos from tmp_votos
    where votos > 0 and not (v_ja_tem_for and trilha_id = v_for_trilha_id)
    order by votos desc, trilha_id asc
    limit greatest(0, v_config.teto_trilhas_prescricao - (case when v_ja_tem_for then 1 else 0 end))
  loop
    insert into public.plano_trilhas (plano_id, usuario_id, trilha_id, ordem, votos, forcada_regra_iniciante)
    values (v_plano_id, v_usuario, v_trilha.trilha_id, v_ordem, v_trilha.votos, false);
    v_ordem := v_ordem + 1;
  end loop;

  -- XP idempotente: referencia_id = usuario_id garante 1 crédito por
  -- usuário na vida, mesmo que "Refazer minha Rota" gere um plano_id novo.
  perform public.creditar_gamificacao(v_usuario, 'concluir_anamnese', 'anamnese_primeira_vez', v_usuario);

  if not exists (select 1 from public.perfil_insignias where usuario_id = v_usuario and nome = 'Rota Traçada') then
    insert into public.perfil_insignias (usuario_id, nome, descricao, icone, conquistada_em, quando_rotulo, ordem)
    values (v_usuario, 'Rota Traçada', 'Completou a anamnese e recebeu sua Rota do Perito personalizada.', 'mapa', current_date, 'ao concluir a anamnese', 0);
  end if;

  perform public.anamnese_calcular_cronograma();

  return jsonb_build_object('ok', true, 'plano_id', v_plano_id, 'avatar', v_avatar, 'regra_iniciante_aplicada', v_regra_iniciante);
end;
$function$;
revoke execute on function public.anamnese_gerar_prescricao() from anon;

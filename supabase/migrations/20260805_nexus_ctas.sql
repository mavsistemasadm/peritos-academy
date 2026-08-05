-- ============================================================
-- SUGESTÕES CONTEXTUAIS DO MH NEXUS DENTRO DA PERITOS ACADEMY
--
-- Sugestões discretas nos momentos certos da jornada do aluno, para quem
-- ainda não assina o Nexus. Não é vitrine: cada sugestão parte de uma dor
-- real do perito e pinta a sensação de resolvê-la.
--
-- Escopo desta migração (decidido com o dono do produto): SEM integração de
-- login e SEM sincronização de assinatura com o Nexus. O status de assinante
-- é uma flag manual, editável pelo admin. Quando a integração existir, basta
-- passar a escrever em `perfis.nexus_status` — nada mais muda.
-- ============================================================

-- ============================================================
-- 1. STATUS DO ALUNO EM RELAÇÃO AO NEXUS
-- ============================================================
-- 'none'      = nunca assinou       -> vê as sugestões
-- 'active'    = assinante ativo     -> NÃO vê nada, em nenhum placement
-- 'cancelled' = já assinou e saiu   -> vê, mas com copy de ex-assinante
alter table public.perfis add column if not exists nexus_status text not null default 'none';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'perfis_nexus_status_check'
  ) then
    alter table public.perfis add constraint perfis_nexus_status_check
      check (nexus_status in ('none', 'active', 'cancelled')) not valid;
  end if;
end $$;

alter table public.perfis add column if not exists nexus_plano text;
alter table public.perfis add column if not exists nexus_assinado_em timestamptz;
alter table public.perfis add column if not exists nexus_cancelado_em timestamptz;

comment on column public.perfis.nexus_status is
  'Relação do aluno com o MH Nexus. Hoje é flag manual do admin (não há sync com o Nexus). "active" desliga todas as sugestões.';

-- ============================================================
-- 2. CONFIGURAÇÃO (singleton, id = 1)
-- ============================================================
create table if not exists public.nexus_cta_config (
  id int primary key default 1 check (id = 1),

  -- destino padrão de todo CTA; os campos por app sobrescrevem quando não nulos
  link_global text not null default 'https://nexusperitosacademy.com.br',
  link_financeiro text,
  link_opera text,
  link_galacticos text,
  link_ponto text,
  link_ache_um_perito text,
  link_biblioteca text,

  ativo boolean not null default true,
  ativo_aula boolean not null default true,
  ativo_conquista boolean not null default true,
  ativo_sino boolean not null default true,
  ativo_perfil boolean not null default true,
  ativo_bloqueio boolean not null default true,

  max_sino_por_semana int not null default 1 check (max_sino_por_semana >= 0),
  dias_pausa_dismissal int not null default 30 check (dias_pausa_dismissal >= 0),
  dispensas_para_pausar int not null default 3 check (dispensas_para_pausar >= 1),

  atualizado_em timestamptz not null default now()
);

insert into public.nexus_cta_config (id) values (1) on conflict (id) do nothing;

-- ============================================================
-- 3. POOL DE VARIAÇÕES DE COPY
-- ============================================================
-- `publico`: 'novo' = nunca assinou · 'ex' = ex-assinante (tom de retomada).
-- `titulo` é a frase curta (toast/sino); `corpo` é o texto completo
-- (aula/perfil/bloqueio).
create table if not exists public.nexus_cta_copies (
  id uuid primary key default gen_random_uuid(),
  app text not null check (app in (
    'financeiro', 'opera', 'galacticos', 'ponto', 'ache_um_perito', 'biblioteca'
  )),
  chave text not null unique,
  publico text not null default 'novo' check (publico in ('novo', 'ex')),
  titulo text not null,
  corpo text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create index if not exists idx_nexus_copies_app on public.nexus_cta_copies (app) where ativo;

-- Copies do conteúdo bloqueado: variam por CONTEÚDO, não por app, então
-- moram separado. `alvo` é o slug do curso (ou 'biblioteca'/'__padrao__').
create table if not exists public.nexus_cta_bloqueio (
  id uuid primary key default gen_random_uuid(),
  alvo text not null unique,
  corpo text not null,
  ativo boolean not null default true
);

-- ============================================================
-- 4. INTERAÇÕES (métricas + memória de rotação)
-- ============================================================
create table if not exists public.nexus_cta_interactions (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfis(id) on delete cascade,
  app text not null,
  placement text not null check (placement in ('aula', 'conquista', 'sino', 'perfil', 'bloqueio')),
  copy_chave text,
  acao text not null check (acao in ('exibida', 'clicada', 'dispensada', 'assinou')),
  contexto text,
  criado_em timestamptz not null default now()
);

create index if not exists idx_nexus_inter_usuario
  on public.nexus_cta_interactions (usuario_id, criado_em desc);
-- índice do cálculo de dispensas por app (o filtro mais quente da seleção)
create index if not exists idx_nexus_inter_dispensa
  on public.nexus_cta_interactions (usuario_id, app, criado_em desc) where acao = 'dispensada';

-- ============================================================
-- 5. RLS
-- ============================================================
alter table public.nexus_cta_config enable row level security;
alter table public.nexus_cta_copies enable row level security;
alter table public.nexus_cta_bloqueio enable row level security;
alter table public.nexus_cta_interactions enable row level security;

-- config e copies: leitura liberada (são texto de marketing, sem nada
-- sensível, e a tela de bloqueio precisa ler deslogado). Escrita só super_admin.
drop policy if exists nexus_config_leitura on public.nexus_cta_config;
create policy nexus_config_leitura on public.nexus_cta_config for select using (true);
drop policy if exists nexus_config_escrita on public.nexus_cta_config;
create policy nexus_config_escrita on public.nexus_cta_config
  for update using (public.is_admin_papel(auth.uid(), array['super_admin']))
  with check (public.is_admin_papel(auth.uid(), array['super_admin']));

drop policy if exists nexus_copies_leitura on public.nexus_cta_copies;
create policy nexus_copies_leitura on public.nexus_cta_copies for select using (ativo);
drop policy if exists nexus_bloqueio_leitura on public.nexus_cta_bloqueio;
create policy nexus_bloqueio_leitura on public.nexus_cta_bloqueio for select using (ativo);

-- interações: o aluno insere e lê as próprias (o componente registra
-- exibida/clicada/dispensada direto). Admin lê tudo, pra métricas.
drop policy if exists nexus_inter_propria_leitura on public.nexus_cta_interactions;
create policy nexus_inter_propria_leitura on public.nexus_cta_interactions
  for select using (usuario_id = auth.uid());
drop policy if exists nexus_inter_propria_insert on public.nexus_cta_interactions;
create policy nexus_inter_propria_insert on public.nexus_cta_interactions
  for insert with check (usuario_id = auth.uid());
drop policy if exists nexus_inter_admin_leitura on public.nexus_cta_interactions;
create policy nexus_inter_admin_leitura on public.nexus_cta_interactions
  for select using (public.is_admin_papel(auth.uid(), array['super_admin', 'suporte', 'financeiro']));

-- ============================================================
-- 6. SEED DAS COPIES APROVADAS
-- ============================================================
-- Texto reproduzido literalmente da spec. Regras de voz respeitadas na
-- origem: segunda pessoa, frases curtas, sem travessão, sem urgência
-- artificial, começa pela dor e termina na sensação de resolver.
-- ON CONFLICT (chave) DO UPDATE deixa o seed idempotente e permite corrigir
-- texto reaplicando a migração.
insert into public.nexus_cta_copies (app, chave, publico, titulo, corpo) values

-- ---------------- FINANCEIRO MH (6) ----------------
('financeiro', 'financeiro_v1', 'novo',
 'Você fechou o mês no azul?',
 'Fim do mês e você não sabe se deu lucro ou prejuízo. Fica naquela sensação de que trabalhou muito, mas o dinheiro sumiu. Com o Financeiro MH, você abre um painel e em 5 segundos sabe exatamente quanto entrou, quanto saiu e quanto sobrou. A sensação de controle muda tudo.'),
('financeiro', 'financeiro_v2', 'novo',
 'Já pagou juros por esquecimento?',
 'Já pagou juros por esquecer uma conta? Aquela multa boba que come o lucro de um cálculo inteiro. O Financeiro MH te avisa todo dia o que vence amanhã. Você nunca mais perde dinheiro por esquecimento.'),
('financeiro', 'financeiro_v3', 'novo',
 'Você sabe sua meta do mês?',
 'Você sabe quanto precisa faturar por mês pra cobrir seus custos e ainda sobrar? A maioria dos peritos não sabe. O Financeiro MH mostra uma barra de progresso da sua meta em tempo real. Você acompanha quanto falta. E quando bate, sente.'),
('financeiro', 'financeiro_v4', 'novo',
 'Ainda controla tudo no Excel?',
 'Ainda controla seu financeiro numa planilha do Excel? Aquela que nunca está atualizada, que você esquece de preencher, que não avisa nada? O Financeiro MH faz isso por você. Atualizado em tempo real, com comparativo do mês anterior e projeção.'),
('financeiro', 'financeiro_v5', 'novo',
 'Faturou mais e não sentiu?',
 'Seu faturamento cresceu, mas você não sente que ficou mais rico. Acontece quando o financeiro não acompanha o negócio. O Financeiro MH separa tudo: receitas, despesas, saldo, e ainda mostra se o mês está indo melhor ou pior que o anterior.'),
('financeiro', 'financeiro_v6', 'novo',
 'Tem mais de um CNPJ?',
 'Abriu uma segunda empresa e agora mistura tudo? Não sabe se é o escritório que dá lucro ou o outro negócio? O Financeiro MH separa cada CNPJ com painel próprio. Cada empresa com seu número, sem confusão.'),
('financeiro', 'financeiro_ex1', 'ex',
 'O painel continua lá',
 'Lembra quando você abria o painel e sabia na hora se o mês estava no azul? O Financeiro MH continua lá, atualizado, esperando você voltar.'),

-- ---------------- OPERA CRM (6) ----------------
('opera', 'opera_v1', 'novo',
 'Mandou orçamento e esqueceu?',
 'Mandou orçamento e esqueceu de fazer follow-up? Quando lembrou, o advogado já fechou com outro. Com o Opera, cada oportunidade fica rastreada. Você sabe exatamente quem está negociando, quem precisa de retorno e quem está prestes a fechar.'),
('opera', 'opera_v2', 'novo',
 'Já perdeu um prazo judicial?',
 'Já perdeu um prazo porque anotou no lugar errado? Aquele frio na barriga de lembrar em cima da hora. O Opera alerta 7 e 2 dias antes de cada vencimento. Você nunca mais é pego de surpresa.'),
('opera', 'opera_v3', 'novo',
 'O telefone toca no meio do cálculo',
 'Você está concentrado num cálculo e o telefone toca. É advogado pedindo orçamento. Atende e perde o raciocínio. Não atende e perde o cliente. O Opera tem um agente comercial IA que atende pelo WhatsApp 24h, entende a área, manda a proposta e só te chama quando precisa.'),
('opera', 'opera_v4', 'novo',
 'Quantos orçamentos fecharam?',
 'Quantos orçamentos você mandou este mês? E quantos fecharam? Se não sabe de cabeça, não tem como melhorar. O Opera mostra seu pipeline inteiro: quanto está em negociação, quanto já fechou, qual sua taxa de conversão.'),
('opera', 'opera_v5', 'novo',
 'Documento espalhado em três lugares',
 'Laudo no Google Drive, planilha no email, contrato no WhatsApp. Na hora de precisar, não acha nada. O Opera vincula cada documento ao processo certo. Tudo num lugar só, sempre acessível.'),
('opera', 'opera_v6', 'novo',
 'Depende só de nomeação?',
 'Você espera o juiz te nomear e torce pra chegar trabalho? O Opera te ajuda a construir um funil de clientes privados. Do primeiro contato ao fechamento, com etapas claras e acompanhamento automático.'),
('opera', 'opera_ex1', 'ex',
 'Seu pipeline parou',
 'Seu pipeline parou de ser atualizado. Os follow-ups automáticos, os alertas de prazo, o agente IA no WhatsApp. Tudo parado. O Opera continua pronto quando você quiser retomar.'),

-- ---------------- GALÁCTICOS IA (8) ----------------
('galacticos', 'galacticos_leo', 'novo',
 'Qual regra de transição se aplica?',
 'Você está revisando uma aposentadoria e precisa conferir qual regra de transição se aplica. Buraco Negro, Teto, IRSM. Cada uma com legislação diferente. Imagina ter alguém do lado que domina todas e te dá a resposta certa em segundos. Esse é o Leo.'),
('galacticos', 'galacticos_alby', 'novo',
 'Insegurança no cálculo trabalhista',
 'Horas extras, adicional noturno, reflexos em DSR. Você calcula na mão e depois fica inseguro se acertou tudo. O Alby já fez mais de 100 mil cálculos trabalhistas. Ele confere o seu em segundos e aponta o que falta.'),
('galacticos', 'galacticos_chip', 'novo',
 'Onde está o juro abusivo?',
 'O banco mandou o extrato e você precisa encontrar onde estão cobrando juros abusivos. Tabela Price, SAC, IOF. Leva horas analisando linha por linha. O Chip entende como cada banco calcula e encontra o erro exato. Você só valida.'),
('galacticos', 'galacticos_lex', 'novo',
 'Travou na hora de redigir o laudo',
 'Você fez o cálculo, mas na hora de redigir o laudo trava. Como estruturar? Como responder os quesitos sem deixar brecha? O Lex transforma seu cálculo num documento técnico impecável. Blindado pra qualquer contestação.'),
('galacticos', 'galacticos_axel', 'novo',
 'A fórmula deu erro e você não acha',
 'Sua planilha travou no meio de um cálculo. Ou a fórmula deu erro e você não acha onde. Ou precisa de um VBA que automatize aquele processo repetitivo. O Axel resolve em minutos o que consumiria horas do seu dia.'),
('galacticos', 'galacticos_stark', 'novo',
 'Cobra quanto pelo cálculo?',
 'Você sabe calcular, mas na hora de mandar a proposta de honorários fica inseguro. Cobra quanto? Como justificar o valor? O Stark monta a proposta pra você. Com script de prospecção, follow-up e precificação por tipo de cálculo.'),
('galacticos', 'galacticos_todos', 'novo',
 'Seis especialistas do seu lado',
 'Você estuda aqui. Aprende a teoria, pratica os cálculos. Mas na hora de aplicar num caso real, trabalha sozinho. Imagina ter 6 especialistas do seu lado, cada um dominando uma área, disponíveis 24h. Não é o futuro. Já existe.'),
('galacticos', 'galacticos_modos', 'novo',
 'Catorze modos de trabalho',
 'Calcular, redigir, revisar, impugnar, pesquisar. Cinco coisas que todo perito faz e que levam tempo. Os Galácticos fazem as cinco. E mais nove. São 14 modos de trabalho treinados com cálculos reais.'),
('galacticos', 'galacticos_ex1', 'ex',
 'Eles continuam aqui',
 'O Leo, o Alby, o Chip. Eles continuam aqui. Com mais modos de trabalho do que quando você saiu. E ainda resolvem em segundos.'),

-- ---------------- MH PONTO (5) ----------------
('ponto', 'ponto_v1', 'novo',
 'Mil batidas pra digitar',
 'Caiu na sua mesa um cartão ponto de 3 anos. Mais de mil batidas. Você vai digitar uma por uma? Aquela tarde inteira perdida em trabalho mecânico. O MH Ponto lê o PDF e devolve o Excel estruturado em 4 minutos. Você usa o tempo pra calcular.'),
('ponto', 'ponto_v2', 'novo',
 'Um número errado em oitocentos',
 'Digitou 800 batidas e uma ficou errada. Um "8" que era "3". Você nem percebeu, mas o cálculo inteiro saiu errado. O MH Ponto marca automaticamente batidas suspeitas e horários impossíveis antes de você exportar. O erro aparece antes de virar problema.'),
('ponto', 'ponto_v3', 'novo',
 'Cartão ponto ilegível',
 'Cartão ponto escaneado, torto, com carimbo em cima do horário. Você força a vista tentando decifrar cada número. A IA do MH Ponto lê qualquer formato: nativo, escaneado, múltiplas páginas. Se adapta ao layout de cada empresa.'),
('ponto', 'ponto_v4', 'novo',
 'Quantas horas digitando?',
 'Quanto tempo você gastou digitando cartão ponto no último mês? 2 horas? 6? 10? Agora multiplica isso por 12 meses. O MH Ponto devolveria todas essas horas pra você usar no que realmente importa: calcular, prospectar, viver.'),
('ponto', 'ponto_v5', 'novo',
 'Seu honorário por hora despenca',
 'Você cobra por um cálculo trabalhista e gasta 3 horas digitando cartão ponto. Seu honorário por hora despenca. O MH Ponto faz em 4 minutos. Suas 3 horas viram 3 horas de trabalho que paga.'),
('ponto', 'ponto_ex1', 'ex',
 'Quantas horas você economizou?',
 'Da última vez que você usou o MH Ponto, economizou quantas horas? Ele ainda lê qualquer PDF em 4 minutos.'),

-- ---------------- ACHE UM PERITO (6) ----------------
('ache_um_perito', 'ache_v1', 'novo',
 'Terminou o curso. E agora?',
 'Você terminou um curso, aprendeu o cálculo, e agora? Espera o telefone tocar? Torce pra cair uma nomeação? No Ache um Perito, advogados de 27 estados publicam demandas todos os dias. O trabalho vem até você.'),
('ache_um_perito', 'ache_v2', 'novo',
 'Quantos advogados sabem que você existe?',
 'Você sabe calcular. Mas quantos advogados sabem que você existe? Seu nome não aparece quando um escritório de SP precisa de um perito pra ontem. No Ache um Perito, seu perfil fica visível pra quem está procurando exatamente o que você faz.'),
('ache_um_perito', 'ache_v3', 'novo',
 'Já trabalhou e não recebeu?',
 'Já trabalhou e não recebeu? Entregou o cálculo e o advogado sumiu? No Ache um Perito, o valor fica retido na plataforma e só é liberado depois que você entrega. Você nunca mais trabalha de graça.'),
('ache_um_perito', 'ache_v4', 'novo',
 'Vinte peritos na mesma cidade',
 'Na sua cidade tem 20 peritos disputando as mesmas nomeações. Enquanto isso, em outros estados, advogados não acham perito pra contratar. O Ache um Perito te conecta com o Brasil inteiro. Sua área de atuação não precisa ter CEP.'),
('ache_um_perito', 'ache_v5', 'novo',
 'A demanda existe. Você está visível?',
 'Imagina atender 5 cálculos por mês a R$2.000 cada. São R$10.000. Agora imagina 10. Ou 15. No Ache um Perito, a demanda existe. A pergunta é: você está visível pra ela?'),
('ache_um_perito', 'ache_v6', 'novo',
 'Nenhum advogado te conhece ainda',
 'Você acabou de se formar e não tem rede de contatos. Nenhum advogado te conhece. Como conseguir os primeiros clientes? No Ache um Perito, você cria seu perfil e advogados te encontram pela sua especialidade. Não precisa de indicação.'),
('ache_um_perito', 'ache_ex1', 'ex',
 'Seu perfil está inativo',
 'Seu perfil no Ache um Perito está inativo. Advogados não estão te encontrando. As demandas continuam sendo publicadas todos os dias.'),

-- ---------------- BIBLIOTECA (5) ----------------
('biblioteca', 'biblioteca_v1', 'novo',
 'A tela vazia do Excel',
 'Aquela sensação de abrir o Excel e ver a tela vazia. Saber que precisa montar a estrutura inteira do zero: fórmulas, índices, layout. A Biblioteca tem centenas de planilhas prontas, validadas em milhares de processos reais. Você abre e já começa a preencher.'),
('biblioteca', 'biblioteca_v2', 'novo',
 'Será que a fórmula está certa?',
 'Você montou a planilha, mas fica inseguro. Será que a fórmula está certa? Será que o índice é esse mesmo? As planilhas da Biblioteca já passaram por centenas de processos reais. A estrutura, as fórmulas e a lógica pericial já foram validadas.'),
('biblioteca', 'biblioteca_v3', 'novo',
 'Horas montando o que já existe',
 'Cada vez que você monta uma planilha do zero, perde horas. Horas que podia usar pra calcular mais casos, prospectar mais clientes ou simplesmente descansar. A Biblioteca elimina o trabalho repetitivo. Você foca no cálculo, não na ferramenta.'),
('biblioteca', 'biblioteca_v4', 'novo',
 'Primeiro caso numa área nova',
 'Pegou um caso bancário pela primeira vez e não sabe por onde começar a planilha? A Biblioteca tem modelos prontos pra trabalhista, previdenciário, bancário, atuarial e tributário. Você não precisa inventar a roda.'),
('biblioteca', 'biblioteca_v5', 'novo',
 'Cinco clientes é diferente de trinta',
 'Atender 5 clientes por mês é uma coisa. Atender 30 é outra. Quem monta planilha do zero não escala. Quem usa planilha pronta multiplica. A diferença entre o perito que atende poucos e o que atende muitos não é talento. É ferramenta.'),
('biblioteca', 'biblioteca_ex1', 'ex',
 'As planilhas continuam atualizadas',
 'As planilhas que você usou continuam atualizadas. E tem novas desde a última vez que você acessou.')

on conflict (chave) do update set
  titulo = excluded.titulo,
  corpo = excluded.corpo,
  app = excluded.app,
  publico = excluded.publico;

-- ---------------- copies da tela de conteúdo bloqueado ----------------
insert into public.nexus_cta_bloqueio (alvo, corpo) values
('__padrao__',
 'Com o Nexus você acessa tudo: os 76 cursos, a Biblioteca de Planilhas, os Galácticos IA, o Opera CRM, o Financeiro MH, o MH Ponto e o Ache um Perito. Tudo conectado, tudo num lugar só.'),
('biblioteca',
 'A Biblioteca tem centenas de planilhas prontas, validadas em processos reais. Você abre e já começa a preencher. Faz parte do ecossistema MH Nexus.'),
('pje-calc-e-liquidacao-de-sentenca',
 'O PJE Calc é o curso que ensina liquidação de sentença na prática. Disponível no ecossistema MH Nexus.'),
('revisao-de-beneficio-previ',
 'A revisão PREVI é um dos nichos mais bem pagos da perícia. Pouquíssimos dominam. Disponível no ecossistema MH Nexus.')
on conflict (alvo) do update set corpo = excluded.corpo;

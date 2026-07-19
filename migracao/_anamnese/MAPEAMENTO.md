# Anamnese "Rota Personalizada para Viver de Perícia" — mapeamento

Extraído do console Ensinio (`GET /api/v1/console/anamnese/1`) em 2026-07-19. Fonte crua em `anamnese_bruto.json` / `trilhas_ensinio_bruto.json`. Documento só de leitura — nenhuma escrita foi feita no banco da Peritos Academy a partir daqui. A decisão final do de-para é do Marlos.

## Anamnese

- **Título**: Rota Personalizada para Viver de Perícia
- **Tipo**: `use_trails` (associação questão→opção→trilhas; sem lógica condicional, pesos ou tela de resultado separada — o Ensinio resolve a "rota" contando quantos votos cada trilha recebe pelas opções escolhidas)
- **Botão de ação**: "Descobrir minha rota"
- **Botão de recusa**: "Me lembre depois"
- **Descrição do modal**: Antes de começar sua jornada, vamos entender seu momento e seus objetivos. Com base nas suas respostas, vamos montar uma rota personalizada para que você aproveite ao máximo a plataforma e conquiste resultados reais com a perícia.
- **Total de questões**: 16

## De-para das trilhas (Ensinio → Peritos Academy)

Todas as 8 trilhas do Ensinio referenciadas na anamnese têm correspondência de **alta confiança** com uma das 13 trilhas atuais da Peritos Academy — nenhuma ⚠ nesta tabela-base (a ambiguidade, se houver, aparece nas questões abaixo quando uma opção referencia uma combinação pouco óbvia).

| ID Ensinio | Nome no Ensinio | Trilha equivalente na Peritos Academy | Confiança |
|---|---|---|---|
| 1 | Missão Perito | Trilha de Formação Pericial de Alta Performance | alta — descrição idêntica à do Ensinio (trilha obrigatória / selo de Excelência) |
| 6 | Caminho do Perito Judicial | Como se Tornar um Perito com Nomeações Judiciais | alta — tema idêntico (nomeações/perito judicial), sem concorrente |
| 7 | Construindo uma negócio pericial lucrativo | Negócios e Empreendedorismo Pericial | alta — descrição idêntica à do Ensinio (construir escritório lucrativo) |
| 5 | Plano de Aceleração Pericial | Plano de Automação Pericial | alta — descrição idêntica à do Ensinio ("Plano de Aceleração Pericial"), só o nome mudou na reconstrução |
| 8 | Ganhos rápidos e lucrativos na perícia | Teses lucrativas e de alto volume | alta — tema idêntico (ganhos rápidos, teses recorrentes, cálculos de massa); não confundir com "Planilhas de Cálculos Inteligentes e Automatizadas" (essa é sobre ferramenta, não sobre rota de carreira) |
| 4 | Perito Trabalhista Expert | Expert em Cálculos Trabalhistas | alta — único tema trabalhista entre as 13, nome equivalente ("Perito Trabalhista Expert") |
| 2 | Perito Previdenciário de Elite | Especialista em Cálculos Prevideniciários | alta — descrição idêntica à do Ensinio (INSS / Fazenda Pública) |
| 3 | Perito Bancário Profissional | Perito Bancário Profissional | alta — mesmo nome e descrição idêntica à do Ensinio |

As 5 trilhas da Peritos Academy sem trilha correspondente no Ensinio (criadas depois da migração, não existiam na anamnese original): **Cálculos Essenciais do Perito**, **Teses de Cálculos Tributários**, **Teses de Cálculos Atuariais**, **Planilhas de Cálculos Inteligentes e Automatizadas**, **MasterClass Exclusivas da Peritos Academy**.

## Questões

### Q1 — Em qual dessas situações você se encaixa hoje?

_id Ensinio: 1 · posição: 0_

| # | Opção | Trilhas Ensinio | Trilha equivalente na Peritos Academy |
|---|---|---|---|
| 1 | Nunca atuei com perícia e estou começando do zero. | 1 (Missão Perito) | Trilha de Formação Pericial de Alta Performance |
| 2 | Já estudei perícia, mas ainda não atuei profissionalmente. | 1 (Missão Perito), 5 (Plano de Aceleração Pericial) | Trilha de Formação Pericial de Alta Performance + Plano de Automação Pericial |
| 3 | Já atuei com cálculos e quero crescer nesse mercado. | 5 (Plano de Aceleração Pericial), 8 (Ganhos rápidos e lucrativos na perícia) | Plano de Automação Pericial + Teses lucrativas e de alto volume |
| 4 | Quero empreender com perícia, ter mais clientes e escalar meu negócio. | 7 (Construindo uma negócio pericial lucrativo) | Negócios e Empreendedorismo Pericial |
| 5 | Quero conquistar nomeações e atuar como perito judicial. | 6 (Caminho do Perito Judicial) | Como se Tornar um Perito com Nomeações Judiciais |
| 6 | Quero me especializar tecnicamente em uma área específica. | 4 (Perito Trabalhista Expert), 2 (Perito Previdenciário de Elite), 3 (Perito Bancário Profissional) | Expert em Cálculos Trabalhistas + Especialista em Cálculos Prevideniciários + Perito Bancário Profissional ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |

### Q2 — Qual seu principal objetivo ao entrar na Peritos Academy?

_id Ensinio: 2 · posição: 1_

| # | Opção | Trilhas Ensinio | Trilha equivalente na Peritos Academy |
|---|---|---|---|
| 1 | Iniciar uma nova carreira e viver de perícia. | 1 (Missão Perito) | Trilha de Formação Pericial de Alta Performance |
| 2 | Fazer meus primeiros cálculos e conseguir clientes. | 1 (Missão Perito), 5 (Plano de Aceleração Pericial) | Trilha de Formação Pericial de Alta Performance + Plano de Automação Pericial |
| 3 | Ganhar dinheiro rápido com teses práticas e planilhas automáticas. | 8 (Ganhos rápidos e lucrativos na perícia) | Teses lucrativas e de alto volume |
| 4 | Ja sou Perito e quero montar um negócio pericial atendendo empresas e advogados. | 7 (Construindo uma negócio pericial lucrativo) | Negócios e Empreendedorismo Pericial |
| 5 | Conseguir nomeações e atuar como perito do juízo. | 6 (Caminho do Perito Judicial), 3 (Perito Bancário Profissional) | Como se Tornar um Perito com Nomeações Judiciais + Perito Bancário Profissional |
| 6 | Me especializar tecnicamente em uma área específica. | 4 (Perito Trabalhista Expert), 2 (Perito Previdenciário de Elite), 3 (Perito Bancário Profissional) | Expert em Cálculos Trabalhistas + Especialista em Cálculos Prevideniciários + Perito Bancário Profissional ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |

### Q3 — Quanto tempo por semana você pode se dedicar aos estudos na plataforma?

_id Ensinio: 3 · posição: 2_

| # | Opção | Trilhas Ensinio | Trilha equivalente na Peritos Academy |
|---|---|---|---|
| 1 | Menos de 2 horas por semana. | 8 (Ganhos rápidos e lucrativos na perícia) | Teses lucrativas e de alto volume |
| 2 | De 2 a 4 horas por semana. | 5 (Plano de Aceleração Pericial), 8 (Ganhos rápidos e lucrativos na perícia) | Plano de Automação Pericial + Teses lucrativas e de alto volume |
| 3 | De 5 a 7 horas por semana. | 7 (Construindo uma negócio pericial lucrativo), 5 (Plano de Aceleração Pericial), 8 (Ganhos rápidos e lucrativos na perícia) | Negócios e Empreendedorismo Pericial + Plano de Automação Pericial + Teses lucrativas e de alto volume ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |
| 4 | De 8 a 10 horas por semana. | 6 (Caminho do Perito Judicial), 7 (Construindo uma negócio pericial lucrativo), 5 (Plano de Aceleração Pericial), 8 (Ganhos rápidos e lucrativos na perícia) | Como se Tornar um Perito com Nomeações Judiciais + Negócios e Empreendedorismo Pericial + Plano de Automação Pericial + Teses lucrativas e de alto volume ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |
| 5 | Mais de 10 horas por semana. | 4 (Perito Trabalhista Expert), 2 (Perito Previdenciário de Elite), 3 (Perito Bancário Profissional), 1 (Missão Perito) | Expert em Cálculos Trabalhistas + Especialista em Cálculos Prevideniciários + Perito Bancário Profissional + Trilha de Formação Pericial de Alta Performance ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |
| 6 | Mais de 10 horas por semana. | 3 (Perito Bancário Profissional), 4 (Perito Trabalhista Expert), 2 (Perito Previdenciário de Elite), 8 (Ganhos rápidos e lucrativos na perícia), 5 (Plano de Aceleração Pericial), 6 (Caminho do Perito Judicial), 7 (Construindo uma negócio pericial lucrativo), 1 (Missão Perito) | Perito Bancário Profissional + Expert em Cálculos Trabalhistas + Especialista em Cálculos Prevideniciários + Teses lucrativas e de alto volume + Plano de Automação Pericial + Como se Tornar um Perito com Nomeações Judiciais + Negócios e Empreendedorismo Pericial + Trilha de Formação Pericial de Alta Performance ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |

### Q4 — Qual dessas formas de atuação mais combina com o que você busca?

_id Ensinio: 4 · posição: 3_

| # | Opção | Trilhas Ensinio | Trilha equivalente na Peritos Academy |
|---|---|---|---|
| 1 | Quero ser nomeado pelo juízo e atuar oficialmente nos processos. | 6 (Caminho do Perito Judicial), 1 (Missão Perito) | Como se Tornar um Perito com Nomeações Judiciais + Trilha de Formação Pericial de Alta Performance |
| 2 | Quero atender diretamente advogados e empresas como prestador de serviços. | 1 (Missão Perito), 7 (Construindo uma negócio pericial lucrativo) | Trilha de Formação Pericial de Alta Performance + Negócios e Empreendedorismo Pericial |
| 3 | Quero aprender as duas formas, mas começar com o que gera resultado mais rápido. | 1 (Missão Perito), 6 (Caminho do Perito Judicial), 7 (Construindo uma negócio pericial lucrativo), 8 (Ganhos rápidos e lucrativos na perícia) | Trilha de Formação Pericial de Alta Performance + Como se Tornar um Perito com Nomeações Judiciais + Negócios e Empreendedorismo Pericial + Teses lucrativas e de alto volume ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |
| 4 | Quero atuar de forma independente e empreender com a perícia. | 7 (Construindo uma negócio pericial lucrativo), 5 (Plano de Aceleração Pericial), 8 (Ganhos rápidos e lucrativos na perícia) | Negócios e Empreendedorismo Pericial + Plano de Automação Pericial + Teses lucrativas e de alto volume ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |
| 5 | Ainda não sei exatamente, quero conhecer mais as possibilidades. | 1 (Missão Perito) | Trilha de Formação Pericial de Alta Performance |
| 6 | Já atuo em uma das formas, mas quero expandir para as duas. | 6 (Caminho do Perito Judicial), 7 (Construindo uma negócio pericial lucrativo), 5 (Plano de Aceleração Pericial), 8 (Ganhos rápidos e lucrativos na perícia), 3 (Perito Bancário Profissional), 4 (Perito Trabalhista Expert), 2 (Perito Previdenciário de Elite) | Como se Tornar um Perito com Nomeações Judiciais + Negócios e Empreendedorismo Pericial + Plano de Automação Pericial + Teses lucrativas e de alto volume + Perito Bancário Profissional + Expert em Cálculos Trabalhistas + Especialista em Cálculos Prevideniciários ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |

### Q5 — Em qual dessas áreas você tem mais interesse ou afinidade técnica?

_id Ensinio: 5 · posição: 4_

| # | Opção | Trilhas Ensinio | Trilha equivalente na Peritos Academy |
|---|---|---|---|
| 1 | Cálculos trabalhistas (horas extras, verbas, rescisão, etc.) | 4 (Perito Trabalhista Expert) | Expert em Cálculos Trabalhistas |
| 2 | Cálculos bancários (empréstimos, financiamentos, revisão de contratos) | 3 (Perito Bancário Profissional) | Perito Bancário Profissional |
| 3 | Cálculos previdenciários (INSS, RMI, atrasados, vida toda) | 2 (Perito Previdenciário de Elite) | Especialista em Cálculos Prevideniciários |
| 4 | Teses de massa com alto volume e faturamento rápido | 8 (Ganhos rápidos e lucrativos na perícia) | Teses lucrativas e de alto volume |
| 5 | Quero aprender todas as áreas e atuar de forma ampla | 3 (Perito Bancário Profissional), 2 (Perito Previdenciário de Elite), 4 (Perito Trabalhista Expert), 5 (Plano de Aceleração Pericial) | Perito Bancário Profissional + Especialista em Cálculos Prevideniciários + Expert em Cálculos Trabalhistas + Plano de Automação Pericial ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |
| 6 | Ainda estou explorando, não tenho certeza sobre qual seguir | 1 (Missão Perito) | Trilha de Formação Pericial de Alta Performance |

### Q6 — Você tem interesse em usar inteligência artificial ou automações na sua atuação como perito?

_id Ensinio: 6 · posição: 5_

| # | Opção | Trilhas Ensinio | Trilha equivalente na Peritos Academy |
|---|---|---|---|
| 1 | Sim, quero usar tudo o que puder para ganhar produtividade. | 8 (Ganhos rápidos e lucrativos na perícia), 5 (Plano de Aceleração Pericial) | Teses lucrativas e de alto volume + Plano de Automação Pericial |
| 2 | Sim, mas ainda não sei como isso pode me ajudar. | 5 (Plano de Aceleração Pericial), 8 (Ganhos rápidos e lucrativos na perícia) | Plano de Automação Pericial + Teses lucrativas e de alto volume |
| 3 | Tenho curiosidade, mas nunca usei. | 5 (Plano de Aceleração Pericial), 8 (Ganhos rápidos e lucrativos na perícia) | Plano de Automação Pericial + Teses lucrativas e de alto volume |
| 4 | Já uso planilhas automáticas ou ferramentas de produtividade. | 7 (Construindo uma negócio pericial lucrativo), 5 (Plano de Aceleração Pericial) | Negócios e Empreendedorismo Pericial + Plano de Automação Pericial |
| 5 | Uso eventualmente, mas quero ir além. | 7 (Construindo uma negócio pericial lucrativo), 4 (Perito Trabalhista Expert), 2 (Perito Previdenciário de Elite), 3 (Perito Bancário Profissional) | Negócios e Empreendedorismo Pericial + Expert em Cálculos Trabalhistas + Especialista em Cálculos Prevideniciários + Perito Bancário Profissional ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |
| 6 | Não tenho interesse no momento. | 1 (Missão Perito) | Trilha de Formação Pericial de Alta Performance |

### Q7 — Como está sua confiança em relação aos cálculos judiciais hoje?

_id Ensinio: 7 · posição: 6_

| # | Opção | Trilhas Ensinio | Trilha equivalente na Peritos Academy |
|---|---|---|---|
| 1 | Não me sinto seguro(a), quero aprender do zero. | 1 (Missão Perito) | Trilha de Formação Pericial de Alta Performance |
| 2 | Sei o básico, mas não sei se estou fazendo certo. | 1 (Missão Perito), 5 (Plano de Aceleração Pericial) | Trilha de Formação Pericial de Alta Performance + Plano de Automação Pericial |
| 3 | Já fiz alguns cálculos, mas tenho dúvidas técnicas. | 1 (Missão Perito), 5 (Plano de Aceleração Pericial) | Trilha de Formação Pericial de Alta Performance + Plano de Automação Pericial |
| 4 | Me sinto seguro em algumas áreas, mas quero aprofundar. | 8 (Ganhos rápidos e lucrativos na perícia), 4 (Perito Trabalhista Expert), 2 (Perito Previdenciário de Elite), 3 (Perito Bancário Profissional), 5 (Plano de Aceleração Pericial) | Teses lucrativas e de alto volume + Expert em Cálculos Trabalhistas + Especialista em Cálculos Prevideniciários + Perito Bancário Profissional + Plano de Automação Pericial ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |
| 5 | Tenho total confiança técnica, mas quero mais resultado no mercado. | 7 (Construindo uma negócio pericial lucrativo), 5 (Plano de Aceleração Pericial), 8 (Ganhos rápidos e lucrativos na perícia) | Negócios e Empreendedorismo Pericial + Plano de Automação Pericial + Teses lucrativas e de alto volume ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |
| 6 | Já domino os cálculos e quero crescer com escala e autoridade. | 7 (Construindo uma negócio pericial lucrativo), 5 (Plano de Aceleração Pericial), 8 (Ganhos rápidos e lucrativos na perícia) | Negócios e Empreendedorismo Pericial + Plano de Automação Pericial + Teses lucrativas e de alto volume ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |

### Q8 — Qual dessas frases mais representa sua realidade atual?

_id Ensinio: 8 · posição: 7_

| # | Opção | Trilhas Ensinio | Trilha equivalente na Peritos Academy |
|---|---|---|---|
| 1 | Preciso urgente de uma nova fonte de renda. | 1 (Missão Perito), 8 (Ganhos rápidos e lucrativos na perícia) | Trilha de Formação Pericial de Alta Performance + Teses lucrativas e de alto volume |
| 2 | Estou cansado do meu trabalho atual e quero mudar. | 1 (Missão Perito), 8 (Ganhos rápidos e lucrativos na perícia), 6 (Caminho do Perito Judicial) | Trilha de Formação Pericial de Alta Performance + Teses lucrativas e de alto volume + Como se Tornar um Perito com Nomeações Judiciais ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |
| 3 | Quero aprender uma nova habilidade com potencial de crescimento. | 1 (Missão Perito), 8 (Ganhos rápidos e lucrativos na perícia) | Trilha de Formação Pericial de Alta Performance + Teses lucrativas e de alto volume |
| 4 | Quero empreender com perícia e me destacar no mercado. | 5 (Plano de Aceleração Pericial), 8 (Ganhos rápidos e lucrativos na perícia), 7 (Construindo uma negócio pericial lucrativo) | Plano de Automação Pericial + Teses lucrativas e de alto volume + Negócios e Empreendedorismo Pericial ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |
| 5 | Já sou perito, mas ainda não consegui resultados relevantes. | 5 (Plano de Aceleração Pericial), 8 (Ganhos rápidos e lucrativos na perícia) | Plano de Automação Pericial + Teses lucrativas e de alto volume |
| 6 | Já atuo, mas quero escalar, dominar mais áreas e ser autoridade. | 7 (Construindo uma negócio pericial lucrativo), 5 (Plano de Aceleração Pericial), 8 (Ganhos rápidos e lucrativos na perícia), 4 (Perito Trabalhista Expert), 2 (Perito Previdenciário de Elite), 3 (Perito Bancário Profissional) | Negócios e Empreendedorismo Pericial + Plano de Automação Pericial + Teses lucrativas e de alto volume + Expert em Cálculos Trabalhistas + Especialista em Cálculos Prevideniciários + Perito Bancário Profissional ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |

### Q9 — Como está seu domínio do Excel atualmente?

_id Ensinio: 9 · posição: 8_

| # | Opção | Trilhas Ensinio | Trilha equivalente na Peritos Academy |
|---|---|---|---|
| 1 | Mal sei abrir uma planilha. | 1 (Missão Perito) | Trilha de Formação Pericial de Alta Performance |
| 2 | Sei o básico, mas tenho dificuldades. | 1 (Missão Perito) | Trilha de Formação Pericial de Alta Performance |
| 3 | Me viro bem, mas não uso fórmulas avançadas. | 1 (Missão Perito), 5 (Plano de Aceleração Pericial) | Trilha de Formação Pericial de Alta Performance + Plano de Automação Pericial |
| 4 | Tenho bom domínio, uso fórmulas e crio estruturas. | 5 (Plano de Aceleração Pericial) | Plano de Automação Pericial |
| 5 | Uso Excel diariamente em cálculos ou rotinas profissionais. | 5 (Plano de Aceleração Pericial), 4 (Perito Trabalhista Expert), 2 (Perito Previdenciário de Elite), 3 (Perito Bancário Profissional) | Plano de Automação Pericial + Expert em Cálculos Trabalhistas + Especialista em Cálculos Prevideniciários + Perito Bancário Profissional ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |
| 6 | Já automatizei planilhas ou usei VBA. | 5 (Plano de Aceleração Pericial), 4 (Perito Trabalhista Expert), 2 (Perito Previdenciário de Elite), 3 (Perito Bancário Profissional) | Plano de Automação Pericial + Expert em Cálculos Trabalhistas + Especialista em Cálculos Prevideniciários + Perito Bancário Profissional ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |

### Q10 — Qual tipo de conteúdo mais te interessa na plataforma?

_id Ensinio: 10 · posição: 9_

| # | Opção | Trilhas Ensinio | Trilha equivalente na Peritos Academy |
|---|---|---|---|
| 1 | Passo a passo para iniciar do zero. | 1 (Missão Perito), 6 (Caminho do Perito Judicial) | Trilha de Formação Pericial de Alta Performance + Como se Tornar um Perito com Nomeações Judiciais |
| 2 | Conteúdo técnico de cálculo e jurisprudência aplicada. | 4 (Perito Trabalhista Expert), 2 (Perito Previdenciário de Elite), 3 (Perito Bancário Profissional) | Expert em Cálculos Trabalhistas + Especialista em Cálculos Prevideniciários + Perito Bancário Profissional ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |
| 3 | Estratégias para captar clientes e crescer como perito. | 7 (Construindo uma negócio pericial lucrativo) | Negócios e Empreendedorismo Pericial |
| 4 | Planilhas automáticas, produtividade e atuação com volume. | 8 (Ganhos rápidos e lucrativos na perícia), 5 (Plano de Aceleração Pericial) | Teses lucrativas e de alto volume + Plano de Automação Pericial |
| 5 | Modelos prontos, laudos, petições e nomeações. | 6 (Caminho do Perito Judicial), 3 (Perito Bancário Profissional) | Como se Tornar um Perito com Nomeações Judiciais + Perito Bancário Profissional |
| 6 | Um pouco de tudo para me tornar referência completa. | 3 (Perito Bancário Profissional), 2 (Perito Previdenciário de Elite), 4 (Perito Trabalhista Expert) | Perito Bancário Profissional + Especialista em Cálculos Prevideniciários + Expert em Cálculos Trabalhistas ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |

### Q11 — O que te motivou a buscar a perícia nesse momento da sua vida?

_id Ensinio: 16 · posição: 10_

| # | Opção | Trilhas Ensinio | Trilha equivalente na Peritos Academy |
|---|---|---|---|
| 1 | Estou em um momento de transição e quero mudar de profissão. | 1 (Missão Perito) | Trilha de Formação Pericial de Alta Performance |
| 2 | Quero crescer financeiramente e ter mais liberdade. | 1 (Missão Perito), 7 (Construindo uma negócio pericial lucrativo), 8 (Ganhos rápidos e lucrativos na perícia) | Trilha de Formação Pericial de Alta Performance + Negócios e Empreendedorismo Pericial + Teses lucrativas e de alto volume ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |
| 3 | Estou cansado de não ser valorizado no meu trabalho atual. | 1 (Missão Perito), 6 (Caminho do Perito Judicial), 7 (Construindo uma negócio pericial lucrativo) | Trilha de Formação Pericial de Alta Performance + Como se Tornar um Perito com Nomeações Judiciais + Negócios e Empreendedorismo Pericial ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |
| 4 | Já tenho experiência, mas quero uma carreira com mais propósito. | 6 (Caminho do Perito Judicial), 4 (Perito Trabalhista Expert), 2 (Perito Previdenciário de Elite), 3 (Perito Bancário Profissional) | Como se Tornar um Perito com Nomeações Judiciais + Expert em Cálculos Trabalhistas + Especialista em Cálculos Prevideniciários + Perito Bancário Profissional ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |
| 5 | Vi na perícia uma chance real de construir algo meu. | 1 (Missão Perito), 7 (Construindo uma negócio pericial lucrativo), 6 (Caminho do Perito Judicial), 4 (Perito Trabalhista Expert), 2 (Perito Previdenciário de Elite), 3 (Perito Bancário Profissional) | Trilha de Formação Pericial de Alta Performance + Negócios e Empreendedorismo Pericial + Como se Tornar um Perito com Nomeações Judiciais + Expert em Cálculos Trabalhistas + Especialista em Cálculos Prevideniciários + Perito Bancário Profissional ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |
| 6 | Quero fazer diferença com meu conhecimento e ganhar bem por isso. | 3 (Perito Bancário Profissional), 2 (Perito Previdenciário de Elite), 4 (Perito Trabalhista Expert), 5 (Plano de Aceleração Pericial) | Perito Bancário Profissional + Especialista em Cálculos Prevideniciários + Expert em Cálculos Trabalhistas + Plano de Automação Pericial ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |

### Q12 — Como seria a sua vida ideal daqui a 12 meses?

_id Ensinio: 17 · posição: 11_

| # | Opção | Trilhas Ensinio | Trilha equivalente na Peritos Academy |
|---|---|---|---|
| 1 | Ter minha própria carteira de clientes e viver da perícia. | 1 (Missão Perito), 7 (Construindo uma negócio pericial lucrativo) | Trilha de Formação Pericial de Alta Performance + Negócios e Empreendedorismo Pericial |
| 2 | Ser nomeado judicialmente e reconhecido como perito. | 1 (Missão Perito), 6 (Caminho do Perito Judicial) | Trilha de Formação Pericial de Alta Performance + Como se Tornar um Perito com Nomeações Judiciais |
| 3 | Ter liberdade para trabalhar de onde eu quiser e ganhar bem. | 1 (Missão Perito), 8 (Ganhos rápidos e lucrativos na perícia) | Trilha de Formação Pericial de Alta Performance + Teses lucrativas e de alto volume |
| 4 | Trabalhar com algo que me dá orgulho e estabilidade. | 1 (Missão Perito), 4 (Perito Trabalhista Expert), 2 (Perito Previdenciário de Elite), 3 (Perito Bancário Profissional) | Trilha de Formação Pericial de Alta Performance + Expert em Cálculos Trabalhistas + Especialista em Cálculos Prevideniciários + Perito Bancário Profissional ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |
| 5 | Ter múltiplas fontes de renda com perícia. | 3 (Perito Bancário Profissional), 2 (Perito Previdenciário de Elite), 4 (Perito Trabalhista Expert), 1 (Missão Perito) | Perito Bancário Profissional + Especialista em Cálculos Prevideniciários + Expert em Cálculos Trabalhistas + Trilha de Formação Pericial de Alta Performance ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |
| 6 | Ser referência em uma área técnica e respeitado no meio jurídico. | 4 (Perito Trabalhista Expert), 2 (Perito Previdenciário de Elite), 3 (Perito Bancário Profissional) | Expert em Cálculos Trabalhistas + Especialista em Cálculos Prevideniciários + Perito Bancário Profissional ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |

### Q13 — Qual dessas frases mais se aproxima do que você sente hoje?

_id Ensinio: 18 · posição: 12_

| # | Opção | Trilhas Ensinio | Trilha equivalente na Peritos Academy |
|---|---|---|---|
| 1 | Sei que posso mais, mas não sei por onde começar. | 1 (Missão Perito) | Trilha de Formação Pericial de Alta Performance |
| 2 | Já tentei antes, mas faltou direcionamento. | 1 (Missão Perito), 6 (Caminho do Perito Judicial), 7 (Construindo uma negócio pericial lucrativo) | Trilha de Formação Pericial de Alta Performance + Como se Tornar um Perito com Nomeações Judiciais + Negócios e Empreendedorismo Pericial ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |
| 3 | Sou Perito e estou cansado de me sentir travado ou estagnado. | 7 (Construindo uma negócio pericial lucrativo), 8 (Ganhos rápidos e lucrativos na perícia) | Negócios e Empreendedorismo Pericial + Teses lucrativas e de alto volume |
| 4 | Tenho vontade, mas falta tempo e apoio. | 8 (Ganhos rápidos e lucrativos na perícia) | Teses lucrativas e de alto volume |
| 5 | Estou decidido a fazer dar certo dessa vez. | 1 (Missão Perito), 4 (Perito Trabalhista Expert), 2 (Perito Previdenciário de Elite), 3 (Perito Bancário Profissional) | Trilha de Formação Pericial de Alta Performance + Expert em Cálculos Trabalhistas + Especialista em Cálculos Prevideniciários + Perito Bancário Profissional ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |
| 6 | Não quero mais depender de outras pessoas para crescer. | 7 (Construindo uma negócio pericial lucrativo) | Negócios e Empreendedorismo Pericial |

### Q14 — Você sente apoio da sua família ou das pessoas próximas nessa decisão?

_id Ensinio: 19 · posição: 13_

| # | Opção | Trilhas Ensinio | Trilha equivalente na Peritos Academy |
|---|---|---|---|
| 1 | Sim, todos me apoiam e acreditam em mim. | 1 (Missão Perito), 6 (Caminho do Perito Judicial), 7 (Construindo uma negócio pericial lucrativo), 5 (Plano de Aceleração Pericial), 8 (Ganhos rápidos e lucrativos na perícia), 4 (Perito Trabalhista Expert), 2 (Perito Previdenciário de Elite), 3 (Perito Bancário Profissional) | Trilha de Formação Pericial de Alta Performance + Como se Tornar um Perito com Nomeações Judiciais + Negócios e Empreendedorismo Pericial + Plano de Automação Pericial + Teses lucrativas e de alto volume + Expert em Cálculos Trabalhistas + Especialista em Cálculos Prevideniciários + Perito Bancário Profissional ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |
| 2 | Nem todos entendem, mas sabem que é importante pra mim. | 1 (Missão Perito), 6 (Caminho do Perito Judicial), 8 (Ganhos rápidos e lucrativos na perícia) | Trilha de Formação Pericial de Alta Performance + Como se Tornar um Perito com Nomeações Judiciais + Teses lucrativas e de alto volume ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |
| 3 | Ainda não falei sobre isso com ninguém. | 1 (Missão Perito) | Trilha de Formação Pericial de Alta Performance |
| 4 | Algumas pessoas não acreditam que isso pode dar certo. | 1 (Missão Perito), 8 (Ganhos rápidos e lucrativos na perícia) | Trilha de Formação Pericial de Alta Performance + Teses lucrativas e de alto volume |
| 5 | Isso é por mim, vou fazer acontecer com ou sem apoio. | 1 (Missão Perito), 8 (Ganhos rápidos e lucrativos na perícia), 7 (Construindo uma negócio pericial lucrativo), 6 (Caminho do Perito Judicial) | Trilha de Formação Pericial de Alta Performance + Teses lucrativas e de alto volume + Negócios e Empreendedorismo Pericial + Como se Tornar um Perito com Nomeações Judiciais ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |

### Q15 — Por que você acredita que agora é a hora certa para entrar na perícia?

_id Ensinio: 20 · posição: 14_

| # | Opção | Trilhas Ensinio | Trilha equivalente na Peritos Academy |
|---|---|---|---|
| 1 | Porque eu decidi parar de adiar e agir. | 1 (Missão Perito), 6 (Caminho do Perito Judicial), 7 (Construindo uma negócio pericial lucrativo), 5 (Plano de Aceleração Pericial), 8 (Ganhos rápidos e lucrativos na perícia), 4 (Perito Trabalhista Expert), 2 (Perito Previdenciário de Elite), 3 (Perito Bancário Profissional) | Trilha de Formação Pericial de Alta Performance + Como se Tornar um Perito com Nomeações Judiciais + Negócios e Empreendedorismo Pericial + Plano de Automação Pericial + Teses lucrativas e de alto volume + Expert em Cálculos Trabalhistas + Especialista em Cálculos Prevideniciários + Perito Bancário Profissional ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |
| 2 | Porque preciso de resultado financeiro urgente. | 1 (Missão Perito), 8 (Ganhos rápidos e lucrativos na perícia) | Trilha de Formação Pericial de Alta Performance + Teses lucrativas e de alto volume |
| 3 | Porque quero crescer de verdade e viver com mais liberdade. | 1 (Missão Perito), 4 (Perito Trabalhista Expert), 2 (Perito Previdenciário de Elite), 3 (Perito Bancário Profissional), 7 (Construindo uma negócio pericial lucrativo) | Trilha de Formação Pericial de Alta Performance + Expert em Cálculos Trabalhistas + Especialista em Cálculos Prevideniciários + Perito Bancário Profissional + Negócios e Empreendedorismo Pericial ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |
| 4 | Porque quero crescer de verdade e viver com mais liberdade. | 5 (Plano de Aceleração Pericial), 4 (Perito Trabalhista Expert), 2 (Perito Previdenciário de Elite), 3 (Perito Bancário Profissional) | Plano de Automação Pericial + Expert em Cálculos Trabalhistas + Especialista em Cálculos Prevideniciários + Perito Bancário Profissional ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |
| 5 | Porque chegou minha hora de ser reconhecido. | 1 (Missão Perito), 6 (Caminho do Perito Judicial), 7 (Construindo uma negócio pericial lucrativo) | Trilha de Formação Pericial de Alta Performance + Como se Tornar um Perito com Nomeações Judiciais + Negócios e Empreendedorismo Pericial ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |

### Q16 — Quantas vezes você já adiou a vida que queria por medo, rotina ou cansaço e até quando vai continuar fazendo isso com você e com sua família?

_id Ensinio: 21 · posição: 15_

| # | Opção | Trilhas Ensinio | Trilha equivalente na Peritos Academy |
|---|---|---|---|
| 1 | Não quero mais viver assim. Estou pronto para mudar. | 1 (Missão Perito), 6 (Caminho do Perito Judicial), 7 (Construindo uma negócio pericial lucrativo), 5 (Plano de Aceleração Pericial), 8 (Ganhos rápidos e lucrativos na perícia), 4 (Perito Trabalhista Expert), 2 (Perito Previdenciário de Elite), 3 (Perito Bancário Profissional) | Trilha de Formação Pericial de Alta Performance + Como se Tornar um Perito com Nomeações Judiciais + Negócios e Empreendedorismo Pericial + Plano de Automação Pericial + Teses lucrativas e de alto volume + Expert em Cálculos Trabalhistas + Especialista em Cálculos Prevideniciários + Perito Bancário Profissional ⚠ (opção liga a 3+ trilhas — considerar se todas devem valer peso igual) |
| 2 | Ainda me sinto preso, mas sei que preciso fazer algo. | 1 (Missão Perito), 6 (Caminho do Perito Judicial) | Trilha de Formação Pericial de Alta Performance + Como se Tornar um Perito com Nomeações Judiciais |


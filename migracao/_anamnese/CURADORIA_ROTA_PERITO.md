# Curadoria final — "Minha Rota do Perito" (onboarding)

Curadoria aprovada pelo Marlos em 2026-07-19, feita sobre o material extraído do
console Ensinio (`anamnese_bruto.json`, `MAPEAMENTO.md`). **Este documento substitui
o de-para bruto do `MAPEAMENTO.md` como fonte dos vínculos de trilha** — o
`MAPEAMENTO.md` fica só como referência histórica do dado original do Ensinio.

Documento de especificação — nenhum schema, RPC ou UI foi criado a partir daqui
ainda. Serve de base para quando a feature for construída.

## 1. Estrutura das 16 questões — dois papéis distintos

### Q1–Q10 (posições 0-9) — DIAGNÓSTICAS
Geram votos de trilha conforme a tabela da seção 2.

### Q11–Q16 (posições 10-15) — EMOCIONAIS
**Voto zero em trilha.** Continuam existindo na anamnese (são a alma da
experiência), com as respostas gravadas em `anamnese_respostas` e usadas para:
- (a) personalizar a cena final (frase de espelho, seção 3);
- (b) segmentação de avatar pros emails — campo derivado no perfil:
  `avatar = 'iniciante_transicao' | 'perito_em_evolucao'`, inferido de **Q1 + Q13**;
- (c) copy futura (textos de email/comunidade calibrados por avatar).

### Fusões (duplicatas literais do Ensinio, corrigidas)
- **Q3**, opções 5 e 6 (ambas "Mais de 10 horas por semana.") → viram **uma opção só**.
- **Q15**, opções 3 e 4 (ambas "Porque quero crescer de verdade e viver com mais
  liberdade.") → viram **uma opção só**.

### Q3 não vota — calibra o prazo
"Quanto tempo por semana você pode se dedicar aos estudos na plataforma?" não gera
voto de trilha nenhum. A resposta alimenta o cálculo de prazo mostrado na revelação
do plano (seção 3, passo 4): `carga horária real das trilhas prescritas ÷ horas
semanais declaradas = "~X meses no seu ritmo"`, arredondado com folga honesta —
nunca promessa inflada.

### Q5 ganha 2 opções novas
"Em qual dessas áreas você tem mais interesse ou afinidade técnica?" tinha 6
opções no Ensinio; as trilhas criadas depois da migração (Tributárias, Atuariais)
não tinham porta de entrada nenhuma na anamnese original. Duas opções novas:
- **Opção 7 (nova)**: "Teses tributárias (recuperação de tributos para PF e PJ)"
- **Opção 8 (nova)**: "Cálculos atuariais e fundos de pensão"

### Regra do iniciante (Fase C.3)
Se a resposta de **Q1 for a opção 1 ou 2** ("Nunca atuei com perícia..." /
"Já estudei perícia, mas ainda não atuei profissionalmente."), a trilha **FOR**
(Trilha de Formação Pericial de Alta Performance) entra **sempre** como a
primeira trilha do plano, independente da pontuação de voto.

## 2. Tabela de votos (`anamnese_opcao_trilhas`)

Legenda (12 trilhas participam da votação; MasterClass fica de fora — é bônus,
não rota):

| Sigla | Trilha (nome real em `trilhas`) |
|---|---|
| FOR | Trilha de Formação Pericial de Alta Performance |
| NOM | Como se Tornar um Perito com Nomeações Judiciais |
| ESS | Cálculos Essenciais do Perito |
| TRAB | Expert em Cálculos Trabalhistas |
| PREV | Especialista em Cálculos Prevideniciários |
| BANC | Perito Bancário Profissional |
| LUCR | Teses lucrativas e de alto volume |
| TRIB | Teses de Cálculos Tributários |
| ATUA | Teses de Cálculos Atuariais |
| PLA | Planilhas de Cálculos Inteligentes e Automatizadas |
| AUT | Plano de Automação Pericial |
| NEG | Negócios e Empreendedorismo Pericial |
| — | MasterClass Exclusivas da Peritos Academy (fora da votação, bônus) |

### Q1 — "Em qual dessas situações você se encaixa hoje?"
| # | Opção | Votos |
|---|---|---|
| 1 | Nunca atuei com perícia e estou começando do zero. | FOR(2) |
| 2 | Já estudei perícia, mas ainda não atuei profissionalmente. | FOR(2) + ESS(1) |
| 3 | Já atuei com cálculos e quero crescer nesse mercado. | LUCR(2) + AUT(1) |
| 4 | Quero empreender com perícia, ter mais clientes e escalar meu negócio. | NEG(2) |
| 5 | Quero conquistar nomeações e atuar como perito judicial. | NOM(2) |
| 6 | Quero me especializar tecnicamente em uma área específica. | sem voto |

### Q2 — "Qual seu principal objetivo ao entrar na Peritos Academy?"
| # | Opção | Votos |
|---|---|---|
| 1 | Iniciar uma nova carreira e viver de perícia. | FOR(2) |
| 2 | Fazer meus primeiros cálculos e conseguir clientes. | ESS(2) + NOM(1) |
| 3 | Ganhar dinheiro rápido com teses práticas e planilhas automáticas. | LUCR(2) + PLA(1) |
| 4 | Já sou Perito e quero montar um negócio pericial atendendo empresas e advogados. | NEG(2) |
| 5 | Conseguir nomeações e atuar como perito do juízo. | NOM(2) |
| 6 | Me especializar tecnicamente em uma área específica. | sem voto |

### Q3 — "Quanto tempo por semana você pode se dedicar aos estudos na plataforma?"
Sem votos — calibra o prazo (seção 1). Opções 5+6 fundidas em "Mais de 10 horas
por semana."

### Q4 — "Qual dessas formas de atuação mais combina com o que você busca?"
| # | Opção | Votos |
|---|---|---|
| 1 | Quero ser nomeado pelo juízo e atuar oficialmente nos processos. | NOM(2) |
| 2 | Quero atender diretamente advogados e empresas como prestador de serviços. | NEG(2) |
| 3 | Quero aprender as duas formas, mas começar com o que gera resultado mais rápido. | LUCR(2) + NOM(1) |
| 4 | Quero atuar de forma independente e empreender com a perícia. | NEG(2) + AUT(1) |
| 5 | Ainda não sei exatamente, quero conhecer mais as possibilidades. | FOR(1) |
| 6 | Já atuo em uma das formas, mas quero expandir para as duas. | NEG(1) + AUT(1) |

### Q5 — "Em qual dessas áreas você tem mais interesse ou afinidade técnica?" (2 opções novas)
| # | Opção | Votos |
|---|---|---|
| 1 | Cálculos trabalhistas (horas extras, verbas, rescisão, etc.) | TRAB(3) |
| 2 | Cálculos bancários (empréstimos, financiamentos, revisão de contratos) | BANC(3) |
| 3 | Cálculos previdenciários (INSS, RMI, atrasados, vida toda) | PREV(3) |
| 4 | Teses de massa com alto volume e faturamento rápido | LUCR(3) |
| 5 | Quero aprender todas as áreas e atuar de forma ampla | BANC(1) + TRAB(1) + PREV(1) |
| 6 | Ainda estou explorando, não tenho certeza sobre qual seguir | FOR(1) + ESS(1) |
| 7 **(nova)** | Teses tributárias (recuperação de tributos para PF e PJ) | TRIB(3) |
| 8 **(nova)** | Cálculos atuariais e fundos de pensão | ATUA(3) |

### Q6 — "Você tem interesse em usar inteligência artificial ou automações na sua atuação como perito?"
| # | Opção | Votos |
|---|---|---|
| 1 | Sim, quero usar tudo o que puder para ganhar produtividade. | AUT(2) + PLA(1) |
| 2 | Sim, mas ainda não sei como isso pode me ajudar. | AUT(2) |
| 3 | Tenho curiosidade, mas nunca usei. | AUT(1) |
| 4 | Já uso planilhas automáticas ou ferramentas de produtividade. | PLA(2) |
| 5 | Uso eventualmente, mas quero ir além. | PLA(1) + AUT(1) |
| 6 | Não tenho interesse no momento. | sem voto |

### Q7 — "Como está sua confiança em relação aos cálculos judiciais hoje?"
| # | Opção | Votos |
|---|---|---|
| 1 | Não me sinto seguro(a), quero aprender do zero. | FOR(2) + ESS(1) |
| 2 | Sei o básico, mas não sei se estou fazendo certo. | ESS(2) |
| 3 | Já fiz alguns cálculos, mas tenho dúvidas técnicas. | ESS(2) |
| 4 | Me sinto seguro em algumas áreas, mas quero aprofundar. | sem voto |
| 5 | Tenho total confiança técnica, mas quero mais resultado no mercado. | NEG(1) + LUCR(1) |
| 6 | Já domino os cálculos e quero crescer com escala e autoridade. | NEG(2) + AUT(1) |

### Q8 — "Qual dessas frases mais representa sua realidade atual?"
| # | Opção | Votos |
|---|---|---|
| 1 | Preciso urgente de uma nova fonte de renda. | LUCR(2) |
| 2 | Estou cansado do meu trabalho atual e quero mudar. | FOR(1) + NOM(1) |
| 3 | Quero aprender uma nova habilidade com potencial de crescimento. | FOR(1) |
| 4 | Quero empreender com perícia e me destacar no mercado. | NEG(2) |
| 5 | Já sou perito, mas ainda não consegui resultados relevantes. | AUT(1) + LUCR(1) |
| 6 | Já atuo, mas quero escalar, dominar mais áreas e ser autoridade. | NEG(1) + AUT(1) |

### Q9 — "Como está seu domínio do Excel atualmente?"
| # | Opção | Votos |
|---|---|---|
| 1 | Mal sei abrir uma planilha. | FOR(1) |
| 2 | Sei o básico, mas tenho dificuldades. | FOR(1) |
| 3 | Me viro bem, mas não uso fórmulas avançadas. | ESS(1) |
| 4 | Tenho bom domínio, uso fórmulas e crio estruturas. | AUT(1) |
| 5 | Uso Excel diariamente em cálculos ou rotinas profissionais. | PLA(2) |
| 6 | Já automatizei planilhas ou usei VBA. | PLA(2) + AUT(1) |

### Q10 — "Qual tipo de conteúdo mais te interessa na plataforma?"
| # | Opção | Votos |
|---|---|---|
| 1 | Passo a passo para iniciar do zero. | FOR(1) + NOM(1) |
| 2 | Conteúdo técnico de cálculo e jurisprudência aplicada. | sem voto |
| 3 | Estratégias para captar clientes e crescer como perito. | NEG(2) |
| 4 | Planilhas automáticas, produtividade e atuação com volume. | PLA(2) + LUCR(1) |
| 5 | Modelos prontos, laudos, petições e nomeações. | NOM(2) |
| 6 | Um pouco de tudo para me tornar referência completa. | sem voto |

### Q11–Q16 — todas as opções, voto zero
Ver `MAPEAMENTO.md` pro texto integral das 6 questões emocionais (motivação,
visão de futuro, sentimento atual, apoio familiar, timing, urgência). Usadas
pra frase de espelho (seção 3) e segmentação de avatar, não pra votação de
trilha.

## 3. A cena final personalizada

A revelação do plano não é uma lista — é uma resposta pessoal. Sequência
animada (`prefers-reduced-motion` respeitado):

1. **Transição** "Montando sua rota..." (2-3s, animação de traçado/mapa no
   estilo da casa).
2. **Frase de espelho** — derivada de Q11 (motivação) + Q13 (sentimento),
   monta-se por template server-side. O aluno percebe que foi ouvido.
   - Ex. quem marcou Q13 opção 1 ("Sei que posso mais, mas não sei por onde
     começar.") lê algo como "Você disse que sabe que pode mais. A partir de
     hoje, existe um caminho com o seu nome."
   - Quem marcou Q11 opção 1 ("Estou em um momento de transição...") lê algo
     como "Você está em transição. Esta rota foi desenhada para transformar
     essa virada em profissão."
   - Quem marcou Q8 opção 1 ou Q15 opção 2 (urgência financeira) lê uma
     variação que reconhece a urgência e aponta o primeiro resultado prático.
   - 8-12 variações de template bastam (combinações dominantes), tom dos
     emails já aprovados, **sem travessão**. **Nunca** exibir a resposta crua
     do aluno de volta — sempre a versão elevada/reescrita.
3. **A rota revelada** — trilhas prescritas uma a uma (stagger sutil), cada
   uma com nome, nº de cursos e carga real; a primeira marcada como "Seu
   ponto de partida" (regra do iniciante, seção 1, quando aplicável).
4. **O prazo honesto** — "No seu ritmo de ~Xh por semana, esta rota leva
   cerca de Y meses" (cálculo real da seção 1; nunca promessa inflada).
5. **O primeiro XP** — crédito do gatilho `concluir_anamnese` (25 XP) dispara
   aqui, com o toast de celebração da Fase 1 aparecendo sobre a cena — o
   aluno descobre a gamificação no melhor momento possível.
6. **CTA único** "Começar minha rota" → primeira aula. Botão secundário
   discreto "Ver meu plano completo" → `/meu-plano`.

## 4. Nomenclatura

O plano do aluno se chama **"Minha Rota"** em toda a UI (nunca "plano" seco):
- Página `/meu-plano` exibe o título **"Minha Rota do Perito"**, com o
  degradê padrão da casa.
- Refazer a anamnese chama **"Refazer minha Rota"**.

# Relatório — recriação das 37 avaliações da Ensinio

Executado em 2026-07-14. Fluxo em duas fases (extração read-only da API da Ensinio + recriação idempotente no nosso banco), concluído em modo autônomo sem parar entre as fases porque a extração foi 100% bem-sucedida (37/37 quizzes, todos com questões e gabaritos válidos).

## Fase A — Extração

- **37/37 quiz_ids extraídos com sucesso** via `GET /console/quiz/{id}/questions`, 0 falhas de autenticação, 0 formatos inesperados, 0 quizzes vazios.
- JSONs crus salvos em `migracao/quizzes_brutos/quiz_{id}.json`.
- **297 questões** e **1132 alternativas** no total.
- Tipos de questão encontrados: `single` (291) e `multiple` (6) — nenhum outro tipo apareceu.
- **`difficulty`**: sem coluna equivalente no nosso schema — descartado. Distribuição encontrada: easy=288, medium=8, hard=1.
- **`is_required`**: sem conceito equivalente no nosso schema — descartado. 21 das 297 questões vieram com `is_required=0`.
- **`explanation`**: só **1 questão** (do quiz 38, "Avaliação de prova" — PJE Calc e Liquidação de Sentença) tinha o campo preenchido, e mesmo assim era `<p><br></p>` — um parágrafo vazio, sem conteúdo real. Nenhuma explanation com texto de fato foi encontrada nos 37 quizzes; nada foi perdido.

## Fase B — Recriação

### Contagens (banco == JSON bruto, conferido)
| Item | Extraído (bruto) | Inserido no banco |
|---|---:|---:|
| Avaliações | 37 | **37** |
| Questões | 297 | **297** |
| Alternativas | 1132 | **1132** |
| Questões puladas | — | **0** |
| Gabaritos inválidos (≠ 1 correta) | — | **0** |

Idempotência testada por chave natural `(curso_id, titulo)` — nenhuma das 37 avaliações existia antes da execução; rodar o script de novo pula todas (upsert/skip com log em `puladas_ja_existentes`).

### Amostra verificada campo a campo (enunciado + alternativas + gabarito + ordem)
- **Menor**: "Avaliação conhecimento 01" (Programa 02, 1 questão) — 1/1 ✅
- **Média**: "Prova Final" (Cálculos revisionais de Cheque Especial, 8 questões) — 8/8 ✅
- **Maior**: "Prova Final" (Aprenda a calcular... Programa I, 16 questões) — 16/16 ✅

Inspeção visual no admin em produção (avaliação "Prova Final" — Cálculos revisionais de Cheque Especial): enunciado, 3 alternativas e gabarito corretos conferidos na tela. Uma questão dessa avaliação tem duas alternativas com texto idêntico ("R$ 3.320.218,47") — **confirmado que é dado original da Ensinio**, não um erro da importação (preservado fielmente, sem "corrigir" o conteúdo fonte).

### Decisões de conversão aplicadas
- **`tipo` da avaliação**: todas as 37 como `'avaliacao'` — o schema só distingue `'avaliacao'`/`'prova'`, e `'prova'` exige `modulo_id IS NULL` (perderia o posicionamento por módulo). Isso inclui os títulos "Prova Final"/"Prova I"/"Prova II" etc., que ficaram como `'avaliacao'` com módulo vinculado em vez de `'prova'` solta no curso.
- **`publicado`**: `false` em todas — replica o comportamento real de `criarAvaliacao()` no admin (que força `publicado: false` na criação, mesmo o default da coluna sendo `true`), não o default cru da coluna.
- **Títulos contendo "Desafio"** (7 avaliações): sem distinção de tipo "desafio" no schema — importados como `'avaliacao'` normal:
- VOCÊ, Perito é! — "Desafio nº 01"
- VOCÊ, Perito é! — "Desafio nº 02"
- VOCÊ, Perito é! — "Desafio nº 03"
- VOCÊ, Perito é! — "Desafio nº 04"
- VOCÊ, Perito é! — "Desafio nº 05"
- Programa 03: Dá licença, agora sou Expert em cálculos trabalhistas! — "Primeiro desafio"
- Programa 03: Dá licença, agora sou Expert em cálculos trabalhistas! — "Segundo Desafio"
- **Questões tipo `'multiple'` com exatamente 1 alternativa correta** (6 questões): funcionalmente idênticas a `'single'` para efeito de gabarito — importadas normalmente como `multipla_escolha`, só registradas aqui por transparência (nenhuma questão `'multiple'` com mais de 1 correta apareceu, então nenhuma precisou ser pulada):
- VOCÊ, Perito é! — "Desafio nº 02" (questão Ensinio #67)
- Desvendando os segredos das instituições bancárias — "Sobre a Prova final" (questão Ensinio #279)
- Cálculos revisionais de Cheque Especial — "Avaliaçao de conhecimento I" (questão Ensinio #140)
- Cálculos revisionais de Cheque Especial — "Avaliaçao de conhecimento I" (questão Ensinio #142)
- Cálculos revisionais de Cheque Especial — "Prova Final" (questão Ensinio #153)
- Programa 01: Iniciando a caminhada nos cálculos trabalhistas — "Avaliação de conhecimento II" (questão Ensinio #179)
- **`peso`**: 1 em todas (calibragem fica pra sessão futura, já era decisão pré-tomada).
- **`explanation` → `parecer`**: campo correto identificado em `avaliacao_questoes.parecer` (mesmo campo que `AvaliacaoContent.tsx` exibe como "parecer do especialista" pós-correção). Nenhuma explanation com conteúdo real existia pra gravar (ver Fase A acima).
- **`aula_ref`/`aula_id`**: deixados `null` — a Ensinio não manda essa referência estruturada (só texto livre de "explanation", que estava vazio); não fabricado.

### Posicionamento — módulo vinculado corretamente, ordem fina a refinar no admin
`avaliacoes.modulo_id` foi setado corretamente pra todas as 37 (curso + módulo originais da Ensinio, resolvidos via `_import_plan.json`, 100% sem ambiguidade). O schema não tem uma coluna de "posição entre as aulas do módulo" — só `avaliacoes.ordem`, que **não é usado por nenhuma tela hoje** (nem a página do curso, nem a do aluno; só ordena a listagem interna do admin, e a própria função `criarAvaliacao()` do admin nunca a define, ficando sempre no default). Por isso `ordem` foi deixado no default, e a posição original de cada quiz na Ensinio fica registrada abaixo pra ajuste manual de quem for encaixar a avaliação entre as aulas do módulo:

| Curso | Módulo | Título | quiz_id (Ensinio) | Posição (Ensinio) |
|---|---|---|---|---|
| Leitura e interpretação de processos judiciais para cálculos | Importancia E Montagem De Sinteses Processuais | Avaliação de conhecimento | 1 | 2 |
| Leitura e interpretação de processos judiciais para cálculos | Passos Finais Do Dominio Da Leitura E Interpretacao | Prova Final | 2 | 0 |
| Aprenda a construir qualquer tabela de atualização monetária | Modulo Principal | Avaliação de conhecimento I | 3 | 5 |
| Aprenda a construir qualquer tabela de atualização monetária | Modulo Principal | Avaliação de conhecimento II | 4 | 9 |
| Aprenda a construir qualquer tabela de atualização monetária | Modulo Principal | Prova final | 5 | 11 |
| VOCÊ, Perito é! | Desafio Pericial No 01 | Desafio nº 01 | 6 | 2 |
| VOCÊ, Perito é! | Desafio Pericial No 02 | Desafio nº 02 | 7 | 1 |
| VOCÊ, Perito é! | Desafio Pericial No 03 | Desafio nº 03 | 8 | 1 |
| VOCÊ, Perito é! | Desafio Pericial No 04 | Desafio nº 04 | 9 | 1 |
| VOCÊ, Perito é! | Desafio Pericial No 05 | Desafio nº 05 | 10 | 1 |
| Desvendando os segredos das instituições bancárias | Principais Discussoes E Itens Relevantes De Um Contrato Bancario | Avaliação I | 32 | 4 |
| Desvendando os segredos das instituições bancárias | Mundo Dos Juros Bancarios | Avaliação II | 33 | 1 |
| Desvendando os segredos das instituições bancárias | Mundo Dos Juros Bancarios | Avaliação III | 34 | 3 |
| Desvendando os segredos das instituições bancárias | Sistemas De Amortizacao | Avaliação IV | 35 | 4 |
| Desvendando os segredos das instituições bancárias | Ocorrencias Da Capitalizacao E Modalidades De Contrato | Sobre a Prova final | 36 | 4 |
| Cálculos revisionais de Financiamento e Empréstimos | Iniciando Os Calculos E Entendimento Sobre O Criterio Dos Juros Simples | Avaliação de conhecimento | 18 | 2 |
| Cálculos revisionais de Financiamento e Empréstimos | Recalculo De Contratos Bancarios | Prova Final | 19 | 5 |
| Cálculos revisionais de Cheque Especial | Modulo De Calculos | Avaliaçao de conhecimento I | 15 | 3 |
| Cálculos revisionais de Cheque Especial | Modulo De Calculos | Prova Final | 17 | 11 |
| Cálculos revisionais de Cheque Especial | Modulo De Calculos | Avaliação de conhecimento II | 16 | 8 |
| Cálculos revisionais de Financiamento Habitacional (SFH) | Desafio Final | Prova final | 14 | 0 |
| Programa 01: Iniciando a caminhada nos cálculos trabalhistas | Interpretacao Do Tempo E Prescricao | Avaliação de Conhecimento I | 20 | 3 |
| Programa 01: Iniciando a caminhada nos cálculos trabalhistas | Ferias | Avaliação de conhecimento II | 21 | 2 |
| Programa 01: Iniciando a caminhada nos cálculos trabalhistas | Outras Verbas Trabalhistas E Verbas Acessorias Do Calculo | Avaliação de conhecimento III | 22 | 5 |
| Programa 01: Iniciando a caminhada nos cálculos trabalhistas | Desafio Final | Prova Final | 23 | 0 |
| Programa 02: Afiando o machado nos cálculos trabalhistas | Adic De Periculosidade Insalubridade E Transferencia | Avaliação conhecimento 01 | 24 | 4 |
| Programa 02: Afiando o machado nos cálculos trabalhistas | Verbas Rescisorias | Avaliação de conhecimento 02 | 25 | 2 |
| Programa 02: Afiando o machado nos cálculos trabalhistas | Desafios Dos Calculos Trabalhistas | Prova Final | 26 | 1 |
| Programa 03: Dá licença, agora sou Expert em cálculos trabalhistas! | Iniciando Os Calculos Das Horas Extras | Avaliação I | 27 | 3 |
| Programa 03: Dá licença, agora sou Expert em cálculos trabalhistas! | Calculo Do Imposto De Renda Nos Processos Trabalhistas | Avaliação de conhecimento II | 28 | 4 |
| Programa 03: Dá licença, agora sou Expert em cálculos trabalhistas! | A Trilha Final | Primeiro desafio | 29 | 0 |
| Programa 03: Dá licença, agora sou Expert em cálculos trabalhistas! | A Trilha Final | Segundo Desafio | 30 | 2 |
| Programa 03: Dá licença, agora sou Expert em cálculos trabalhistas! | A Trilha Final | O caminho sem volta | 31 | 4 |
| Aprenda a calcular todos os tipo de aposentadorias e benefícios - Programa I | Primeiros Passos Dos Calculos Judiciais | Prova Final | 11 | 4 |
| Domine todas as revisões previdenciárias - Programa II | Desafios De Calculo | Prova I | 12 | 0 |
| Domine todas as revisões previdenciárias - Programa II | Desafios De Calculo | Prova II | 13 | 2 |
| PJE Calc e Liquidação de Sentença | Prova Final | Avaliação de prova | 38 | 1 |

## Segurança — gabarito confirmado protegido
`avaliacao_questoes` e `avaliacao_opcoes` (as tabelas com `correta`/`parecer`) só têm policy de `SELECT` pra `super_admin`/`conteudo` — conferido direto em `pg_policies`, nenhuma policy nova foi criada nesta sessão. O aluno nunca lê essas tabelas diretamente; a correção passa pela RPC `submeter_avaliacao` (server-side), como já documentado no CLAUDE.md.

## Escopo
Nada além de `avaliacoes`/`avaliacao_questoes`/`avaliacao_opcoes` foi tocado. Nenhuma aula, gamificação, aluno ou assinatura foi alterada. Token da Ensinio usado só em memória (variável de ambiente da sessão do terminal) — nunca gravado em arquivo nem commitado.

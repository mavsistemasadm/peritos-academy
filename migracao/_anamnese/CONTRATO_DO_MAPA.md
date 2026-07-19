# Contrato de dados — camada visual da "Rota do Perito"

O motor (schema + RPCs) foi construído nesta sessão. Este documento descreve
a interface de dados que uma tarefa futura (o mapa SVG / cena final / Meu
plano) deve consumir — **sem duplicar nenhuma lógica de cálculo**: tudo abaixo
já vem pronto do banco.

## Fluxo

1. Cliente chama `anamnese_meu_progresso()` a cada tela pra saber que questão
   mostrar (`proxima_questao_ordem`) e permitir retomada.
2. Cliente lê `anamnese_questoes` + `anamnese_opcoes` (RLS pública pra
   `authenticated`) pra renderizar cada pergunta. **Nunca** lê
   `anamnese_opcao_trilhas` diretamente — RLS não permite (é o gabarito).
3. A cada resposta: `anamnese_responder(p_questao_ordem, p_opcao_ordem)`.
4. Ao responder a 16ª questão (ou em qualquer momento com as 16
   respondidas): `anamnese_gerar_prescricao()` — cria o `plano` + `plano_trilhas`,
   credita XP/insígnia, e já roda o cronograma internamente. É essa RPC que a
   cena final chama.
5. `anamnese_calcular_cronograma()` pode ser chamada de novo isoladamente se
   precisar recalcular sem regerar a prescrição (não recria plano/trilhas,
   só recalcula as datas do plano ativo).

## Forma do retorno (`anamnese_gerar_prescricao` já inclui o de `calcular_cronograma`)

```jsonc
// anamnese_gerar_prescricao()
{
  "ok": true,
  "plano_id": "uuid",
  "avatar": "iniciante_transicao" | "perito_em_evolucao",
  "regra_iniciante_aplicada": true | false
}

// anamnese_calcular_cronograma() — chamar depois, ou usar o resultado já
// persistido em `planos`/`plano_trilhas` via query direta (RLS própria)
{
  "ok": true,
  "plano_id": "uuid",
  "resumo": {
    "semanas_totais": 41,
    "meses_totais": 11,
    "excede_meta_meses": false,
    "horas_semana_declarada": 3,
    "horas_semana_sugerida_para_meta": 3
  },
  "trilhas": [
    {
      "ordem": 1,
      "trilha_id": "uuid",
      "trilha_nome": "Trilha de Formação Pericial de Alta Performance",
      "votos": 10,
      "forcada_regra_iniciante": true,
      "num_cursos": 9,
      "num_avaliacoes": 10,
      "carga_horas_video": 18.3,
      "carga_horas_avaliacoes": 10,
      "carga_efetiva_horas": 37.5,
      "semana_inicio": 1,
      "semana_fim": 13,
      "mes_inicio": 1,
      "mes_fim": 4
    }
    // ... até 5 trilhas, na ordem em que devem aparecer no mapa
  ]
}
```

## O que a camada visual precisa saber (e não recalcular)

- **Estações do mapa** = `resultado.trilhas`, já na ordem certa (`ordem`
  crescente). A primeira é sempre "Seu ponto de partida".
- **Faixa de meses de cada estação** = `mes_inicio`/`mes_fim` (convenção: 1
  mês = 4 semanas, arredondado pra cima — decisão de simplicidade/honestidade,
  não é mês de calendário exato).
- **Marcos de certificado** = fim de cada trilha (`mes_fim`/`semana_fim`);
  **"primeira avaliação aprovada"** como marco de meio-de-caminho, se a UI
  quiser, é `floor((semana_inicio + semana_fim) / 2)` — não persistido, é
  derivável.
- **Prazo honesto**: usar `resumo.meses_totais` diretamente. Se
  `resumo.excede_meta_meses = true`, o texto deve assumir o tom "e a jornada
  continua" em vez de comprimir; `resumo.horas_semana_sugerida_para_meta`
  já traz a sugestão de ritmo pra caber na meta (12 meses por padrão,
  configurável em `config_anamnese.meta_meses`).
- **Frase de espelho**: ler as respostas de Q11 (`questao_ordem=10`) e Q13
  (`questao_ordem=12`) via `anamnese_respostas` (RLS própria, cliente pode
  ler direto) e escolher o template conforme a combinação — texto elevado,
  nunca a resposta crua (regra da curadoria).
- **Gênero pra imagem do tesouro** (`c7-m.png`/`c7-f.png`): **não existe
  pergunta de gênero na anamnese** — isso não foi coberto nesta tarefa
  (schema/motor). Se a camada visual precisar disso, vai precisar de uma
  fonte separada (ex. campo já existente em `perfis`, se houver, ou uma nova
  pergunta) — decisão para a tarefa da apresentação.
- **Avatar** (`iniciante_transicao` / `perito_em_evolucao`) já fica salvo em
  `perfis.anamnese_avatar` — não precisa recalcular, só ler.

## O que NÃO existe ainda (fora do escopo desta tarefa)

- Nenhuma tela (`/anamnese`, `/meu-plano`) foi criada.
- Nenhum componente React, SVG ou animação.
- `plano_trilhas` não tem imagem de capa por trilha, nem paleta de cor —
  isso viria de `trilhas`/`cursos` já existentes, a critério da apresentação.

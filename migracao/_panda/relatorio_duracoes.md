# Relatório — preenchimento de `aulas.duracao_seg` via API do Panda Video

Executado em 2026-07-13.

## Método
1. `GET https://api-v2.pandavideo.com.br/videos` (paginado, `limit=200`) — listagem completa da conta em **4 requisições** (750 vídeos ao todo), em vez de uma chamada por aula. Campo de duração: `length`, em **segundos** (float, ex. `8167.2`) — arredondado pro inteiro mais próximo (`Math.round`) pra gravar em `duracao_seg` (coluna `integer`).
2. `video_external_id` de cada vídeo listado é o mesmo ID que aparece no `video_url` das aulas (`.../embed/?v={ID}`) — usado como chave de cruzamento.
3. 518 aulas com `video_url` do Panda (508 IDs únicos — alguns vídeos reaproveitados em mais de uma aula) cruzadas contra o mapa. `UPDATE` feito via PostgREST em lotes (service role), um `PATCH` por aula.

## Resultado
| Métrica | Valor |
|---|---|
| Aulas com `video_url` do Panda | 518 |
| Vídeos únicos no Panda referenciados | 508 |
| Aulas atualizadas com duração real | **518 (100%)** |
| Vídeos não encontrados (404) | **0** |
| Aulas com `duracao_seg = 0` restante | 86 |
| — das quais `tipo = 'material'` (esperado, sem vídeo) | 84 |
| — das quais `tipo = 'aula'` com vídeo fora do Panda (Vimeo) | 2 — já documentadas em `migracao/videos_a_resolver.md` |

Nenhum vídeo ficou de fora — não houve necessidade de lidar com casos de 404.

## Conteúdo total da plataforma
- **480.076 segundos = 133,4 horas** de vídeo (só nas 518 aulas com duração real; as 86 restantes são materiais/páginas sem player ou os 2 vídeos Vimeo pendentes).
- Cursos com mais conteúdo: "Programa 03: Dá licença, agora sou Expert em cálculos trabalhistas!" (11,3h), "PJE Calc e Liquidação de Sentença" (9h), "Programa 01: Iniciando a caminhada nos cálculos trabalhistas" (8,3h).

## Verificação em produção
Admin → Cursos → editor de curso → lista de módulos/aulas passou a exibir duração real (ex. "8min 7s", "33min 30s") em vez de "0min 0s". Páginas públicas de curso/aula não puderam ser testadas porque os 75 cursos importados continuam em rascunho (`publicado=false`, decisão deliberada da migração — ver `migracao/relatorio_importacao.md`); o layout que exibe a duração é o mesmo em ambas as telas.

## Escopo
Nada além de `aulas.duracao_seg` foi alterado no banco. Scripts auxiliares em `migracao/_panda/` (chave da API do Panda fica só em `.env.local`, gitignorado — os scripts leem de lá, nunca hardcoded).

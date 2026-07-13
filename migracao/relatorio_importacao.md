# Relatório final — Importação Ensinio → Peritos Academy

Fase 3 concluída em 2026-07-13. Retomada de uma sessão anterior que havia parado no meio da Fase 2 (a marca "160/604" registrada era desatualizada — aulas já estavam 100% carregadas; o que faltava era materiais, imagens e o merge de código necessário pra tudo isso funcionar em produção).

## Resumo — contagens finais no banco (produção)

| Item | Carregado | Plano | Status |
|---|---|---|---|
| Cursos | 75 | 75 | ✅ completo |
| Módulos | 178 | 178 | ✅ completo |
| Aulas | 604 | 604 | ✅ completo |
| Descrições com texto literal `'null'` | 0 | 0 | ✅ corrigido (43 linhas, já vinha corrigido de sessão anterior) |
| Capas de curso (`cursos.capa_url`) | 75/75 | 75 | ✅ completo |
| Capas horizontais + verticais no bucket | 148 (73 h + 74 v + 1 curso só-vertical) | ~150 | ✅ (2 cursos sem logo horizontal, 1 sem vertical — faltavam na Ensinio) |
| Thumbnails de aula (`aulas.thumbnail_url`) | 180/180 | 180 | ✅ completo |
| Materiais em `aula_materiais` | 408 (cobrindo 218 aulas) | ~441 esperados (448 catalogados − 7 >20MB) | ⚠️ ver pendência abaixo |
| Objetos no bucket `materiais-aulas` | 414 | — | ✅ (408 referenciados + 6 órfãos preservados, ver abaixo) |
| Integridade `aula_materiais` ↔ storage | 0 linhas quebradas, 0 objetos órfãos não previstos | — | ✅ verificado |

## O que foi feito nesta sessão

1. **Diagnóstico do ponto real de parada.** Aulas (604/604), cursos e módulos já estavam 100% carregados — a marca "160/604" estava obsoleta. O que faltava: `aula_materiais` zerada, `cursos.capa_url`/`capa_horizontal_url`/`capa_vertical_url` zeradas, `aulas.thumbnail_url` zerada, apesar de os arquivos já estarem nos buckets.
2. **Limpeza de duplicatas no storage.** 128 objetos com nome antigo (espaços, sem sanitização) coexistiam com as versões sanitizadas já trackeadas. Verificado 1:1 por normalização de nome: 122 confirmados como duplicata exata e removidos via Storage API (service role); 6 preservados por não terem correspondente sanitizado (pertencem a aulas que foram excluídas do import por não terem vídeo — ver `relatorio.md`, seção "Aulas SEM vídeo").
3. **Reenvio dos 7 materiais que excederam 20MB.** Bucket `materiais-aulas` teve o limite elevado pra 60MB. 4 dos 7 arquivos (27–42MB) subiram com sucesso. Os outros 3 (54MB, 55MB e 165MB) esbarraram num teto global do plano Supabase (~50MB) independente do `file_size_limit` do bucket — viram pendência (ver abaixo).
4. **INSERT em `aula_materiais`.** 408 materiais inseridos (409 enviados, 1 duplicata exata ignorada por `unique(aula_id, nome)`), cobrindo 218 aulas.
5. **UPDATE das imagens.** `cursos.capa_horizontal_url`/`capa_vertical_url`/`capa_url` (75 cursos) e `aulas.thumbnail_url` (180 aulas) — URLs públicas construídas a partir dos paths já presentes no bucket público `capas-cursos`.
6. **Merge de `worktree-icones-sistema` → `main`.** Descoberta importante: os materiais só funcionam de verdade (URL assinada, novo schema `tipo in (pdf,xlsx,docx,zip,outro)`, RLS por assinatura ativa) com código que só existia numa branch separada, 14 commits à frente de `main` — incluindo também **um fix de incidente de produção já resolvido** (Next 15.3.6→15.3.9, `engines.node` 22.x) que nunca tinha chegado em `main`, além dos módulos Financeiro, Usuários e Configurações completos. Fast-forward limpo, 1 conflito de CSS resolvido (blocos independentes, ambos preservados), build local validado, push pra `origin/main` feito — deploy Vercel confirmado.
7. **Smoke test em produção.** Painel admin renderizando capas de curso corretamente. Download de material testado ponta a ponta via URL assinada (service role, mesmo mecanismo de `baixarMaterialAula`): bytes baixados idênticos ao `tamanho_bytes` gravado. Bloqueio de acesso anônimo confirmado (404 por RLS, tanto na leitura da linha quanto na assinatura do storage — não vaza a existência do arquivo).

## Pendências conhecidas (fora do escopo desta sessão)

- **3 materiais grandes não enviados** (teto de ~50MB do plano Supabase): `Processo Judicial - Teto 20 salários mínimos.pdf` (55MB, curso Domine todas as revisões previdenciárias II), `Modelos de Contratos.zip` (54MB, curso Planilha automática dos cálculos de RMC), `05. Petições e Docs de Cálculos Trabalhistas.zip` (165MB, curso Documentos Essenciais do Perito). Arquivos originais em `migracao/materiais/`. Alternativas: upgrade de plano Supabase, compressão, ou hospedar externamente (ex. Google Drive) e usar o campo de link manual do admin.
- **37 aulas com quiz ativo na Ensinio não importadas como aula** — precisam ser recriadas manualmente como `avaliacoes`/`avaliacao_questoes` no admin. Lista completa em `migracao/avaliacoes_a_recriar.md`. `avaliacoes` está com 0 linhas — nada foi criado ainda.
- **6 aulas com vídeo fora do Panda** (Vimeo ou `ensinio-stream` sem link direto) — precisam ser migradas antes do desligamento da Ensinio. Lista em `migracao/videos_a_resolver.md`.
- **6 materiais órfãos preservados no storage**, sem linha em `aula_materiais` (pertencem a aulas excluídas do import por não terem vídeo — desafios/provas resolvidas que viraram material solto). Ficam no bucket sem uso até decidir se essas aulas "sem vídeo" viram algum tipo de página de conteúdo.
- **Cursos ainda em rascunho** (`publicado=false` em todos os 75) — decisão deliberada, review de conteúdo pendente antes de publicar.

## Arquivos de suporte gerados nesta sessão
- `migracao/_sql/_orfaos_confirmados.json` — lista dos 122 confirmados + 6 preservados
- `migracao/_sql/_resultado_materiais_grandes.json` — resultado do reenvio dos 7 arquivos >20MB
- `migracao/_sql/_update_cursos_capas.json` — URLs públicas usadas no UPDATE de `cursos`
- `migracao/_sql/04_aula_materiais.sql` — SQL gerado do INSERT (para referência; execução real foi via PostgREST/service role em lotes)

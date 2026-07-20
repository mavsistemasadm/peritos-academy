# Inventário — Biblioteca de Modelos de Planilhas (Ensinio → Peritos Academy)

Fase 1 (extração e inventário). Nada foi escrito no banco novo. Fonte crua completa em `planilhas_bruto.json`.

## Como foi extraído

O console do Ensinio (`membros.peritosacademy.com.br/console`) não expõe a API de dados via requisições visíveis diretamente no browser em todos os pontos — a maior parte da navegação é Next.js SSR. Mas a aba **Conteúdos** de um grupo faz chamadas CORS diretas e autenticadas (Bearer token) para `peritosacademy.ensinio.cloud/api/v1/console/...`. Usando o Claude in Chrome (sessão já logada do usuário), interceptei essas chamadas para descobrir os endpoints e capturei o token de autorização **apenas em memória da página** (nunca exibido, nunca salvo em disco/log/commit) para then buscar programaticamente:

- `GET /console/group-topics/{slug}/list` → lista de módulos (topics) do grupo
- `GET /console/group-lessons/{topic_id}/list?per_page=100` → aulas de cada módulo
- `GET /console/group-lessons/{lesson_id}` → detalhe de cada aula (descrição + materiais anexos com `file_address`, `file_size`)

## Total encontrado

**110 aulas** (= 110 "modelos" — cada aula da biblioteca é 1 arquivo baixável), em **8 módulos**, dentro de **1 único grupo**: "Biblioteca de Planilhas" (id 132, grupo restrito, "0/110" de progresso do aluno real que testou). A estimativa inicial de ~200 era superior ao real: **110 é o número exato**, confirmado por contagem em três lugares independentes (meta.total da API, soma dos `lessons_count` por módulo, e contagem direta dos itens extraídos).

**Confirmado: não há outro grupo-biblioteca.** Busquei nos 131 grupos totais da plataforma por nomes com "planilha/biblioteca/modelo/laudo/template/petição" — todos os outros matches (ex. "Planilha Automática de Cartão Ponto", "Combo de Planilhas Automáticas", "Construção de laudos periciais automáticos") são **cursos individuais já migrados** (aparecem em `migracao/materiais/`), não bibliotecas de arquivos avulsos.

## Organização por categoria (módulo no Ensinio)

| Módulo (Ensinio) | Aulas | Observação |
|---|---:|---|
| Instruções Gerais | 1 | 1 PDF de "termos de uso" — **não é um modelo de planilha**, é conteúdo institucional |
| Cálculos Trabalhistas | 23 | |
| Cálculos Previdenciários | 33 | maior módulo |
| Cálculos Bancários | 25 | |
| Cálculos Diversos | 17 | |
| Petições e Manifestações de cálculo | 1 | única peça no formato "petição" |
| Cálculos Tributários | 8 | |
| Laudos Periciais | 2 | únicas 2 peças no formato "laudo" |
| **Total** | **110** | |

## Arquivos e tamanhos

- **109 aulas têm exatamente 1 arquivo anexo**; **1 aula está sem nenhum arquivo** ("TRABALHISTA BANCÁRIO I CEF I CTVA", id 830, módulo Cálculos Trabalhistas) — flag de qualidade, provavelmente pendência do próprio Ensinio, não um erro da extração.
- **Extensões**: 105 `.zip` (a planilha real fica dentro do zip) + 4 `.pdf` (os 2 laudos, a 1 petição, e o PDF de instruções gerais).
- **Tamanho total: ~25,4 MB** — folga enorme sobre o limite de 60MB por arquivo do bucket.
- **Nenhum arquivo perto do limite de 60MB.** O maior é "CHEQUE ESPECIAL.zip" com 4,96 MB; em seguida "SFI I CREDITAS.zip" com 1,04 MB. Todo o resto está abaixo de 750 KB.
- **Duplicatas aparentes**: nenhuma por título exato. Vários nomes parecidos (ex. "Capital de Giro I BRADESCO", "Capital de Giro I BANCO ALPHA", "Capital de Giro I BANCO DO BRASIL") são variantes legítimas por banco, não duplicatas.

## O que já existe no site novo (auditado nesta sessão)

- **Página**: `/biblioteca` (`app/biblioteca/page.tsx` + `components/BibliotecaContent.tsx` + `lib/queries/biblioteca.ts` + `app/biblioteca/actions.ts`).
- **Tabelas**: `planilhas` (`id, area_id, nome, descricao, arquivo_path, formato, tamanho_kb, downloads_base, aula_slug, publicado, tipo` — `tipo` já é `'planilha'|'laudo'|'peticao'`, sem check constraint no banco) e `planilha_areas` (`id, slug, nome, ordem` — hoje só **3 áreas**: Bancária, Previdenciária, Tributária). Suporte: `planilha_downloads` (contagem real via RPC `planilha_downloads_contagem`), `planilha_favoritas`.
- **Storage**: bucket `planilhas` (privado), download via URL assinada (60s, mesmo padrão de `aula_materiais`).
- **Admin**: **não existe tela de CRUD** para a Biblioteca hoje — os itens só existem via `INSERT` direto (seed). Precisa ser construído na Fase 2 (ou pelo menos um formulário simples), já que a rotina de curadoria de conteúdo do admin não cobre isso ainda.

### Confirmado: os 10 itens atuais são 100% seed, sem nenhum arquivo real

- Os 10 registros em `planilhas` têm UUIDs no padrão fixo `dbdb0001-0000-4000-8000-00000000000N` (sequência artificial de seed) e uma coluna `downloads_base` (contador inicial fake para simular popularidade) — mesma assinatura de mock já removida em outras partes do site nesta sessão.
- **Inspecionei o bucket `planilhas` diretamente**: contém só um placeholder de pasta vazia (`bancaria/previdenciaria/tributaria/.emptyFolderPlaceholder`, 0 bytes) e a antiga foto de perfil (já migrada para o bucket `fotos-perfil`). **Nenhum dos 10 `arquivo_path` da tabela aponta pra um arquivo que existe de fato** — hoje, clicar em "baixar" em qualquer um dos 10 itens atuais geraria uma signed URL para um objeto inexistente. A feature está com a cara de "funcionando" mas é completamente não-funcional.
- **Recomendação**: apagar as 10 linhas seed na Fase 2, junto com a criação das novas.

## De-para proposto (Ensinio → schema novo)

| Módulo Ensinio | `planilha_areas` (nome) | `tipo` | Ação |
|---|---|---|---|
| Cálculos Trabalhistas (23) | **Trabalhista** (nova) | planilha | criar área |
| Cálculos Previdenciários (33) | Previdenciária (já existe) | planilha | reusar área |
| Cálculos Bancários (25) | Bancária (já existe) | planilha | reusar área |
| Cálculos Diversos (17) | **Diversos** (nova) | planilha | criar área |
| Cálculos Tributários (8) | Tributária (já existe) | planilha | reusar área |
| Petições e Manifestações de cálculo (1) | a definir (sugestão: Diversos) | **peticao** | `tipo` já cobre isso |
| Laudos Periciais (2) | a definir (sugestão: Tributária, ambos os laudos são de tese tributária) | **laudo** | `tipo` já cobre isso |
| Instruções Gerais (1) | **fora da Biblioteca** | — | não é modelo de planilha; sugestão: não importar, ou tratar como conteúdo institucional à parte (ex. um card fixo de "como usar" na própria página, não um item baixável na lista) |

**Formato do arquivo**: 105 dos 109 arquivos reais são `.zip` (a planilha de verdade — xlsx/xlsm — vive dentro do zip). O schema atual (`formato`) é texto livre, sem constraint, então `zip` é um valor válido — mas decisão de produto pendente pra Fase 2: manter como está (usuário baixa um `.zip` e extrai) ou baixar+extrair+re-subir só o arquivo de planilha real (mais fiel ao rótulo "planilha", mais trabalho de Fase 2, também precisaria decidir o que fazer quando o zip tiver mais de um arquivo dentro).

## Plano da Fase 2 (aguardando seu OK)

1. **Confirmar o de-para acima** (nomes das 2 áreas novas, destino de Petições/Laudos, decisão do zip).
2. **Apagar os 10 registros seed** de `planilhas` (e o placeholder vazio do bucket).
3. **Baixar os 109 arquivos reais** de `cdn.ensinio.com` (script Node, mesma lógica dos scripts de `migracao/materiais/`), salvando em `migracao/planilhas_arquivos/` como backup local antes do upload.
4. **Migração SQL**: criar as 2 áreas novas + inserir as 110 linhas em `planilhas` (UUIDs fixos, `ON CONFLICT DO UPDATE` — idempotente, mesmo padrão de todo o resto do projeto), com `descricao` já vinda do Ensinio, `publicado=false` até revisão (mesmo comportamento usado na migração de cursos).
5. **Upload dos 109 arquivos** pro bucket `planilhas` (paths por área, ex. `trabalhista/horas-extras-i-escalonamento-das-horas.zip`), depois `UPDATE` de `arquivo_path`/`tamanho_kb` nas linhas.
6. **Smoke test**: 1 download ponta a ponta por área (signed URL, bytes conferidos), confirmar bloqueio pra usuário sem `acesso_biblioteca`.
7. **Pendência que descobri e não estava no pedido original**: construir (ou pelo menos esboçar) uma tela simples de admin pra Biblioteca, já que hoje não existe nenhuma — sem isso, qualquer manutenção futura dos 110 itens exige SQL direto.

Não executo nada disso sem o seu ok.

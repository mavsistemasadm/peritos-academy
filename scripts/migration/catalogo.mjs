// scripts/migration/catalogo.mjs
// Catálogo de tradução: produto da Ensinio -> acesso na Peritos Academy.
//
// Vive em scripts/ (não em lib/) de propósito: é ferramental de importação,
// consumido só pelos scripts desta pasta. O app NUNCA lê este arquivo — o
// gate de acesso lê as linhas já gravadas em `acessos_conteudo`, então nada
// aqui entra no bundle do Next.
//
// Fonte da verdade é a matriz aprovada em
// migracao/prompt_migracao_peritos_academy.md. Conferido contra o arquivo
// real: os 13 produtos formam 13 triplas distintas
// `Produto/Plano :: Acesso na Plataforma Nova :: Regra de Vencimento`, ou seja
// o produto determina a regra sozinho — a coluna descritiva "Acesso na
// Plataforma Nova" é usada só como CONFERÊNCIA (validarCatalogo.mjs falha se
// ela discordar daqui), nunca como entrada parseada.

// ---------------------------------------------------------------------------
// Slugs reais dos cursos citados na matriz (conferidos contra o banco).
// ---------------------------------------------------------------------------
export const CURSO = {
  pasep: 'revisao-do-saldo-da-conta-pasep',
  pjeCalc: 'pje-calc-e-liquidacao-de-sentenca',
  superEndividamento: 'planilha-automatica-dos-calculos-de-rmc-copy',
  rmcRcc: 'planilha-automatica-dos-calculos-de-rmc',
  emailsQueVendem: 'modelos-e-estrategias-de-e-mails-que-vendem-milhoes',
  revisaoPrevi: 'revisao-de-beneficio-previ',
  lei14905: 'lei-149052024-e-os-calculos',
  jornadaTrabalho: 'planilha-automatica-de-apuracao-de-jornada',
  desapropriacao: 'calculo-desapropriacao',
  precatorios: 'atualizacao-de-precatorios-judiciais',
}

// ---------------------------------------------------------------------------
// Trilhas citadas na matriz. "MasterClass" não é um curso: é uma trilha
// inteira, e a exceção do Black Friday 2023 é da trilha — não de um curso
// dentro dela. Fica como referência à trilha (e não expandida nos cursos que
// ela tem hoje) pra regra continuar viva: curso novo publicado dentro da
// MasterClass já nasce excluído, sem script de correção.
// ---------------------------------------------------------------------------
export const TRILHA = {
  masterClass: 'masterclass-exclusivas-da-peritos-academy',
}

// Exceções do Black Friday 2023 — 9 itens na matriz, que se dividem em três
// naturezas diferentes:
//   7 cursos nomeados           -> EXCECOES_BF_CURSOS
//   1 trilha inteira ("MasterClass") -> EXCECOES_BF_TRILHAS
//   1 seção ("Biblioteca de Planilhas") -> campo `biblioteca: false` da regra
const EXCECOES_BF_CURSOS = [
  CURSO.pjeCalc,
  CURSO.revisaoPrevi,
  CURSO.lei14905,
  CURSO.jornadaTrabalho,
  CURSO.superEndividamento,
  CURSO.desapropriacao,
  CURSO.precatorios,
]
const EXCECOES_BF_TRILHAS = [TRILHA.masterClass]

/**
 * regra    : 'vitalicio' nunca vence; 'vencimento' usa a coluna `Validade`.
 * escopo   : 'total' = tudo (menos `cursos`/`trilhas`, que aí são EXCEÇÕES);
 *            'curso' = só os cursos listados em `cursos`.
 * trilhas  : trilhas excetuadas (só faz sentido em escopo 'total').
 * biblioteca: libera a Biblioteca de Planilhas (perfis.acesso_biblioteca).
 */
export const CATALOGO = [
  // ---------- acesso total vitalício ----------
  { produto: 'Membro Fundador Infinity',
    acessoEsperado: 'Acesso total',
    regra: 'vitalicio', escopo: 'total', cursos: [], trilhas: [], biblioteca: true },

  { produto: 'Grupo Antigo Infinity',
    acessoEsperado: 'Acesso total',
    regra: 'vitalicio', escopo: 'total', cursos: [], trilhas: [], biblioteca: true },

  // ---------- acesso total vitalício, com exceções ----------
  { produto: 'Black Friday 2023',
    acessoEsperado: 'Tudo EXCETO: PJE Calc, Biblioteca de Planilhas, Revisão PREVI, Lei 14905/2024, Planilhas Jornada de Trabalho, Super Endividamento, MasterClass, Desapropriação, Precatórios',
    regra: 'vitalicio', escopo: 'total', cursos: EXCECOES_BF_CURSOS,
    trilhas: EXCECOES_BF_TRILHAS, biblioteca: false },

  // ---------- acesso total até o vencimento ----------
  { produto: 'Assinatura Ultra Peritos Academy',
    acessoEsperado: 'Acesso total',
    regra: 'vencimento', escopo: 'total', cursos: [], trilhas: [], biblioteca: true },

  { produto: 'Assinatura Pro Peritos Academy',
    acessoEsperado: 'Acesso total',
    regra: 'vencimento', escopo: 'total', cursos: [], trilhas: [], biblioteca: true },

  // ---------- acesso total até o vencimento, sem biblioteca ----------
  { produto: 'Assinatura Premium Peritos Academy',
    acessoEsperado: 'Tudo EXCETO: Biblioteca de Planilhas',
    regra: 'vencimento', escopo: 'total', cursos: [], trilhas: [], biblioteca: false },

  { produto: 'Peritos Academy Experience - All in One',
    acessoEsperado: 'Tudo EXCETO: Biblioteca de Planilhas',
    regra: 'vencimento', escopo: 'total', cursos: [], trilhas: [], biblioteca: false },

  { produto: 'Desafio Viver de Perícia',
    acessoEsperado: 'Tudo EXCETO: Biblioteca de Planilhas',
    regra: 'vencimento', escopo: 'total', cursos: [], trilhas: [], biblioteca: false },

  // ---------- produto avulso: apenas um curso ----------
  { produto: 'Revisão do saldo da conta PASEP',
    acessoEsperado: 'Apenas: Curso PASEP',
    regra: 'vencimento', escopo: 'curso', trilhas: [], cursos: [CURSO.pasep], biblioteca: false },

  { produto: 'PJE Calc e Liquidação de Sentença',
    acessoEsperado: 'Apenas: Curso PJE Calc',
    regra: 'vencimento', escopo: 'curso', trilhas: [], cursos: [CURSO.pjeCalc], biblioteca: false },

  { produto: 'Planilha automática dos cálculos de Super Endividamento',
    acessoEsperado: 'Apenas: Planilha Super Endividamento',
    regra: 'vencimento', escopo: 'curso', trilhas: [], cursos: [CURSO.superEndividamento], biblioteca: false },

  { produto: 'Planilha automática dos cálculos de RMC e RCC',
    acessoEsperado: 'Apenas: Planilha RMC e RCC',
    regra: 'vencimento', escopo: 'curso', trilhas: [], cursos: [CURSO.rmcRcc], biblioteca: false },

  { produto: 'Modelos e estratégias de e-mails que vendem milhões',
    acessoEsperado: 'Apenas: Curso E-mails que Vendem Milhões',
    regra: 'vencimento', escopo: 'curso', trilhas: [], cursos: [CURSO.emailsQueVendem], biblioteca: false },
]

const PorProduto = new Map(CATALOGO.map((r) => [r.produto, r]))

/** Regra de um produto da Ensinio, ou null se o produto for desconhecido. */
export function regraDoProduto(produto) {
  return PorProduto.get(String(produto ?? '').trim()) ?? null
}

/** Todos os slugs de curso citados no catálogo (para validação). */
export function slugsCitados() {
  return [...new Set(Object.values(CURSO))]
}

/** Todos os slugs de trilha citados no catálogo (para validação). */
export function trilhasCitadas() {
  return [...new Set(Object.values(TRILHA))]
}

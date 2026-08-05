// scripts/migration/planejar.mjs
// Transforma o XLSX da Ensinio num PLANO de importação — estrutura pura, sem
// nenhum acesso a banco. O dry-run imprime este plano; a execução aplica
// exatamente este mesmo plano. Como os dois caminhos partem da mesma função,
// não existe a possibilidade de o dry-run mostrar uma coisa e a execução
// fazer outra.

import { lerXlsx } from './lerXlsx.mjs'
import { regraDoProduto } from './catalogo.mjs'

const COLUNAS = [
  'Grupo', 'Nome Completo', 'Primeiro Nome', 'Sobrenome', 'Email', 'Telefone',
  'Produto/Plano', 'Acesso na Plataforma Nova', 'Regra de Vencimento', 'Validade',
  'Tipo de Acesso', 'Valor Pago', 'Data da Compra', 'Origem',
  'Qtd Cursos Acessados', 'Cursos Acessados',
]

/** Converte "2024-06-21 16:46:51" em ISO com fuso de Brasília explícito. */
function dataCompraParaIso(valor) {
  const t = String(valor ?? '').trim()
  if (!t) return null
  const m = t.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/)
  // O Brasil não tem mais horário de verão desde 2019 e todo dado aqui é de
  // 2023+, então -03:00 vale para o arquivo inteiro.
  if (m) return `${m[1]}T${m[2]}-03:00`
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return `${t}T00:00:00-03:00`
  return null
}

function valorParaNumero(valor) {
  const t = String(valor ?? '').trim().replace(/\./g, '').replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function hojeIso() {
  // data local (America/Sao_Paulo) no formato YYYY-MM-DD
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

/**
 * @param {string} arquivo caminho do XLSX
 * @param {{ hoje?: string }} opcoes  `hoje` fixa a data de corte da vigência
 *   (default: hoje em Brasília). Passar explicitamente torna o plano
 *   reproduzível — o mesmo arquivo gera o mesmo plano em qualquer dia.
 */
export function planejar(arquivo, opcoes = {}) {
  const hoje = opcoes.hoje ?? hojeIso()
  const linhas = lerXlsx(arquivo)
  if (!linhas.length) throw new Error('planilha vazia')

  const cab = linhas[0]
  const faltando = COLUNAS.filter((c) => !cab.includes(c))
  if (faltando.length) throw new Error(`colunas ausentes no XLSX: ${faltando.join(', ')}`)
  const idx = Object.fromEntries(COLUNAS.map((c) => [c, cab.indexOf(c)]))

  const erros = []
  const registros = []

  linhas.slice(1).forEach((r, i) => {
    const linhaNum = i + 2 // 1-based + cabeçalho, pra bater com o Excel
    const email = String(r[idx['Email']] ?? '').trim().toLowerCase()
    const produto = String(r[idx['Produto/Plano']] ?? '').trim()

    if (!email) { erros.push({ linha: linhaNum, erro: 'email vazio' }); return }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      erros.push({ linha: linhaNum, erro: `email malformado: ${email}` }); return
    }

    const regra = regraDoProduto(produto)
    if (!regra) { erros.push({ linha: linhaNum, erro: `produto sem regra no catálogo: "${produto}"` }); return }

    // Conferência dupla: a coluna descritiva do arquivo tem que concordar com
    // o catálogo. Se divergir, é sinal de que o arquivo foi regerado com outra
    // regra — abortar é melhor que conceder acesso errado silenciosamente.
    const acessoArquivo = String(r[idx['Acesso na Plataforma Nova']] ?? '').trim()
    if (acessoArquivo !== regra.acessoEsperado) {
      erros.push({ linha: linhaNum, erro: `coluna de acesso divergente do catálogo para "${produto}"` }); return
    }

    const validadeBruta = String(r[idx['Validade']] ?? '').trim()
    let expiraEm = null
    if (regra.regra === 'vencimento') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(validadeBruta)) {
        erros.push({ linha: linhaNum, erro: `validade inválida "${validadeBruta}" (esperava YYYY-MM-DD)` }); return
      }
      expiraEm = validadeBruta
    }

    const vitalicio = regra.regra === 'vitalicio'
    const vigente = vitalicio || expiraEm >= hoje

    registros.push({
      linha: linhaNum,
      email,
      nomeCompleto: String(r[idx['Nome Completo']] ?? '').trim() || null,
      primeiroNome: String(r[idx['Primeiro Nome']] ?? '').trim() || null,
      sobrenome: String(r[idx['Sobrenome']] ?? '').trim() || null,
      telefone: String(r[idx['Telefone']] ?? '').trim() || null,
      grupo: String(r[idx['Grupo']] ?? '').trim() || null,
      produto,
      acessoConcedido: acessoArquivo,
      regraVencimento: String(r[idx['Regra de Vencimento']] ?? '').trim() || null,
      tipoAcesso: String(r[idx['Tipo de Acesso']] ?? '').trim() || null,
      valorPago: valorParaNumero(r[idx['Valor Pago']]),
      dataCompra: dataCompraParaIso(r[idx['Data da Compra']]),
      vitalicio,
      expiraEm,
      vigente,
      regra,
    })
  })

  // ---- agrupa por aluno ----
  const porEmail = new Map()
  for (const reg of registros) {
    if (!porEmail.has(reg.email)) porEmail.set(reg.email, [])
    porEmail.get(reg.email).push(reg)
  }

  const alunos = []
  const ignorados = []
  for (const [email, regs] of porEmail) {
    const vigentes = regs.filter((r) => r.vigente)
    const vencidos = regs.filter((r) => !r.vigente)

    if (vigentes.length === 0) {
      // Nenhum produto vigente: não cria usuário nem acesso (decisão de
      // produto — ver README). Fica só no histórico como não importado.
      ignorados.push({ email, motivo: 'todos os produtos vencidos', registros: regs })
      continue
    }

    // dados pessoais: usa a linha vigente mais recente como referência
    const ref = [...vigentes].sort((a, b) => String(b.dataCompra ?? '').localeCompare(String(a.dataCompra ?? '')))[0]

    // `||` e não `??`: um .join() devolve string vazia (não null) quando não
    // há nome nenhum, e string vazia tem que cair pro fallback seguinte —
    // senão o importador gravaria perfis.nome = ''.
    const nome =
      ref.nomeCompleto
      || [ref.primeiroNome, ref.sobrenome].filter(Boolean).join(' ')
      || email.split('@')[0]

    alunos.push({
      email,
      nome,
      telefone: regs.map((r) => r.telefone).find(Boolean) ?? null,
      // concessões a criar (uma por produto vigente, + biblioteca quando cabe)
      concessoes: vigentes.flatMap((reg) => montarConcessoes(reg)),
      registrosVigentes: vigentes,
      // produtos vencidos deste aluno ainda entram no histórico
      registrosVencidos: vencidos,
    })
  }

  return {
    hoje,
    totalLinhas: registros.length + erros.length,
    erros,
    alunos,
    ignorados,
    resumo: resumir(alunos, ignorados, registros, erros),
  }
}

/** Concessões geradas por um produto vigente. */
function montarConcessoes(reg) {
  const base = {
    vitalicio: reg.vitalicio,
    expiraEm: reg.expiraEm,
    observacao: `Migração Ensinio — ${reg.produto}`,
    registroLinha: reg.linha,
  }
  const out = []

  if (reg.regra.escopo === 'total') {
    out.push({
      ...base, escopo: 'total', cursoSlug: null,
      excecoes: reg.regra.cursos,
      excecoesTrilha: reg.regra.trilhas ?? [],
    })
  } else {
    // escopo 'curso': uma concessão por curso liberado (hoje sempre 1, mas o
    // formato do catálogo permite mais de um)
    for (const slug of reg.regra.cursos) {
      out.push({ ...base, escopo: 'curso', cursoSlug: slug, excecoes: [], excecoesTrilha: [] })
    }
  }

  if (reg.regra.biblioteca) {
    out.push({ ...base, escopo: 'biblioteca', cursoSlug: null, excecoes: [], excecoesTrilha: [] })
  }
  return out
}

function resumir(alunos, ignorados, registros, erros) {
  const porProdutoVigente = new Map()
  for (const a of alunos) {
    for (const r of a.registrosVigentes) {
      porProdutoVigente.set(r.produto, (porProdutoVigente.get(r.produto) ?? 0) + 1)
    }
  }
  const porProdutoIgnorado = new Map()
  for (const g of ignorados) {
    for (const r of g.registros) {
      porProdutoIgnorado.set(r.produto, (porProdutoIgnorado.get(r.produto) ?? 0) + 1)
    }
  }
  const concessoes = alunos.flatMap((a) => a.concessoes)
  return {
    linhasLidas: registros.length,
    linhasComErro: erros.length,
    alunosAImportar: alunos.length,
    alunosIgnorados: ignorados.length,
    concessoesTotal: concessoes.length,
    concessoesPorEscopo: {
      total: concessoes.filter((c) => c.escopo === 'total').length,
      curso: concessoes.filter((c) => c.escopo === 'curso').length,
      biblioteca: concessoes.filter((c) => c.escopo === 'biblioteca').length,
    },
    concessoesVitalicias: concessoes.filter((c) => c.vitalicio).length,
    concessoesComPrazo: concessoes.filter((c) => !c.vitalicio).length,
    porProdutoVigente: [...porProdutoVigente].sort((a, b) => b[1] - a[1]),
    porProdutoIgnorado: [...porProdutoIgnorado].sort((a, b) => b[1] - a[1]),
  }
}

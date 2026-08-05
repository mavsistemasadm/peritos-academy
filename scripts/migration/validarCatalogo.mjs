// scripts/migration/validarCatalogo.mjs
// Confere o catálogo contra (a) os cursos reais no banco e (b) o XLSX real.
// Roda sozinho: `node scripts/migration/validarCatalogo.mjs`
import { readFileSync } from 'node:fs'
import { lerXlsx } from './lerXlsx.mjs'
import { CATALOGO, CURSO, TRILHA, regraDoProduto } from './catalogo.mjs'
import { clienteServico } from './supabase.mjs'

const ARQUIVO = 'migracao/migracao_peritos_academy_FINAL.xlsx'
const sb = clienteServico()
let erros = 0
const falhar = (m) => { console.log('  ✗ ' + m); erros++ }

console.log('=== (a) slugs do catálogo x cursos no banco ===')
const { data: cursos, error } = await sb.from('cursos').select('slug,titulo,publicado')
if (error) { console.error('falha ao ler cursos:', error.message); process.exit(1) }
const porSlug = new Map(cursos.map((c) => [c.slug, c]))
for (const [chave, slug] of Object.entries(CURSO)) {
  const c = porSlug.get(slug)
  if (!c) falhar(`${chave}: slug inexistente no banco -> ${slug}`)
  else console.log(`  ✓ ${chave.padEnd(20)} ${c.publicado ? '   ' : '[rascunho]'} ${c.titulo}`)
}

console.log('\n=== (a2) slugs de trilha do catálogo x trilhas no banco ===')
const { data: trilhas, error: erroTrilhas } = await sb.from('trilhas').select('slug, nome')
if (erroTrilhas) { console.error('falha ao ler trilhas:', erroTrilhas.message); process.exit(1) }
const porTrilha = new Map(trilhas.map((t) => [t.slug, t]))
for (const [chave, slug] of Object.entries(TRILHA)) {
  const t = porTrilha.get(slug)
  if (!t) falhar(`${chave}: trilha inexistente no banco -> ${slug}`)
  else {
    // quantos cursos a trilha tem hoje (só informativo — a exceção é por
    // referência à trilha, então esse número pode crescer sem quebrar nada)
    const { data: membros } = await sb
      .from('etapa_missoes')
      .select('curso_id, etapas!inner(trilha_id, trilhas!inner(slug))')
      .eq('etapas.trilhas.slug', slug)
    const n = new Set((membros ?? []).map((m) => m.curso_id)).size
    console.log(`  ✓ ${chave.padEnd(20)} ${t.nome} (${n} curso(s) hoje)`)
  }
}

console.log('\n=== (b) produtos do catálogo x produtos do XLSX ===')
const [cab, ...dados] = lerXlsx(ARQUIVO)
const iPR = cab.indexOf('Produto/Plano')
const iAC = cab.indexOf('Acesso na Plataforma Nova')
const iRV = cab.indexOf('Regra de Vencimento')
if (iPR < 0 || iAC < 0 || iRV < 0) { console.error('colunas esperadas ausentes'); process.exit(1) }

const vistos = new Map()
for (const r of dados) vistos.set(r[iPR], { acesso: r[iAC], regra: r[iRV] })
for (const [produto, { acesso, regra }] of vistos) {
  const g = regraDoProduto(produto)
  if (!g) { falhar(`produto do arquivo sem regra no catálogo: "${produto}"`); continue }
  if (g.acessoEsperado !== acesso) {
    falhar(`"${produto}" — coluna de acesso divergente\n      catálogo: ${g.acessoEsperado}\n      arquivo : ${acesso}`)
    continue
  }
  const regraArquivo = regra === 'Vitalício' ? 'vitalicio' : 'vencimento'
  if (g.regra !== regraArquivo) {
    falhar(`"${produto}" — regra divergente: catálogo=${g.regra} arquivo=${regra}`)
    continue
  }
  console.log(`  ✓ ${produto}`)
}
for (const g of CATALOGO) {
  if (!vistos.has(g.produto)) console.log(`  ! catálogo tem produto ausente do arquivo: "${g.produto}"`)
}

console.log('\n=== (c) sanidade das exceções ===')
for (const g of CATALOGO) {
  for (const slug of g.cursos) {
    if (!porSlug.has(slug)) falhar(`"${g.produto}" cita slug de curso inexistente: ${slug}`)
  }
  for (const slug of g.trilhas ?? []) {
    if (!porTrilha.has(slug)) falhar(`"${g.produto}" cita slug de trilha inexistente: ${slug}`)
    if (g.escopo !== 'total') falhar(`"${g.produto}" tem exceção de trilha mas não é escopo 'total'`)
  }
  if (g.escopo === 'curso' && g.cursos.length === 0) falhar(`"${g.produto}" é escopo 'curso' mas não lista curso nenhum`)
}
if (erros === 0) console.log('  ✓ todas as exceções e escopos coerentes')

console.log(`\n${erros === 0 ? '✅ catálogo consistente com o banco e com o arquivo' : `❌ ${erros} divergência(s)`}`)
process.exit(erros === 0 ? 0 : 1)

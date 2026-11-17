#!/usr/bin/env node
// scripts/migration/importarAnexosAvaliacoes.mjs
//
// Traz da Ensinio os anexos das avaliações (os "autos do caso") para
// avaliacao_materiais. Na migração de conteúdo eles ficaram sem lugar: a
// avaliação da Ensinio era uma aula com anexos, e aqui virou `avaliacoes`,
// que até 17/11/2026 não tinha onde guardar arquivo.
//
//   node scripts/migration/importarAnexosAvaliacoes.mjs            (simulação)
//   node scripts/migration/importarAnexosAvaliacoes.mjs --executar
//
// Fonte: migracao/_import_plan.json → aulasQuiz[].materials (URL do CDN da
// Ensinio, título e tamanho). A avaliação daqui é achada por curso + título.
// Idempotente: anexo já gravado (mesma avaliação + mesmo nome) é pulado.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { clienteServico } from './supabase.mjs'

const EXECUTAR = process.argv.includes('--executar')
const BUCKET = 'materiais-aulas'
const LIMITE = 60 * 1024 * 1024 // file_size_limit do bucket

const norm = s => (s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const nomeArquivo = s => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/_+/g, '_')
const EXT = { pdf: 'pdf', xlsx: 'xlsx', xls: 'xlsx', xlsm: 'xlsx', docx: 'docx', doc: 'docx', zip: 'zip' }
const tipoDe = nome => EXT[nome.split('.').pop()?.toLowerCase() ?? ''] ?? 'outro'
const MIME = { pdf: 'application/pdf', zip: 'application/zip', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }

// Anexo que entrega a resposta não vai para dentro da prova. Na Ensinio o
// "Prova 01 resolvida.pdf" estava pendurado na própria Prova I (é o cálculo
// inteiro resolvido). Fica de fora e aparece no relatório para decisão.
const GABARITO = /resolvid/i

// HTML do editor da Ensinio → texto com parágrafos. Travessão de lista vira
// marcador (copy da plataforma não usa travessão).
function htmlParaTexto(html) {
  if (!html) return null
  const t = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .split('\n').map(l => l.replace(/[ \t ]+/g, ' ').trim().replace(/^[–—-]\s+/, '• ')).join('\n')
    .replace(/\n{3,}/g, '\n\n').trim()
  return t.length >= 15 ? t : null
}

const plano = JSON.parse(readFileSync('migracao/_import_plan.json', 'utf8'))
const sb = clienteServico()

const { data: avaliacoes, error: e1 } = await sb.from('avaliacoes').select('id, titulo, instrucoes, video_url, cursos!inner(slug)')
if (e1) throw e1
const porChave = new Map()
for (const a of avaliacoes) {
  const k = `${a.cursos.slug}::${norm(a.titulo)}`
  porChave.set(k, [...(porChave.get(k) ?? []), a])
}

const relatorio = []
const textos = []
// duas avaliações da Ensinio com o mesmo curso + título apontariam para a
// mesma daqui, e a segunda pisaria no texto da primeira: essas ficam de fora.
const repetidasNoPlano = new Map()
for (const q of plano.aulasQuiz) {
  const k = `${q.curso_slug}::${norm(q.aula_titulo)}`
  repetidasNoPlano.set(k, (repetidasNoPlano.get(k) ?? 0) + 1)
}
for (const quiz of plano.aulasQuiz) {
  const chave = `${quiz.curso_slug}::${norm(quiz.aula_titulo)}`
  const alvo = porChave.get(chave) ?? []

  // texto e vídeo de instruções: só preenche o que está vazio (não pisa em edição do admin)
  if (repetidasNoPlano.get(chave) > 1) {
    textos.push({ curso: quiz.curso_slug, avaliacao: quiz.aula_titulo, texto: !!htmlParaTexto(quiz.text_content), status: 'título repetido na Ensinio, conferir à mão' })
  } else if (alvo.length === 1) {
    const av = alvo[0]
    const instrucoes = htmlParaTexto(quiz.text_content)
    const video = quiz.media_tipo === 'panda' && quiz.media_link ? quiz.media_link : null
    const patch = {}
    if (instrucoes && !av.instrucoes) patch.instrucoes = instrucoes
    if (video && !av.video_url) patch.video_url = video
    const t = { curso: quiz.curso_slug, avaliacao: quiz.aula_titulo, texto: !!instrucoes, video: !!video, status: Object.keys(patch).length ? (EXECUTAR ? 'gravado' : 'seria gravado') : 'nada a gravar' }
    if (EXECUTAR && Object.keys(patch).length) {
      const { error } = await sb.from('avaliacoes').update(patch).eq('id', av.id)
      if (error) t.status = `falhou: ${error.message}`
    }
    textos.push(t)
  } else {
    textos.push({ curso: quiz.curso_slug, avaliacao: quiz.aula_titulo, status: 'avaliação não encontrada' })
  }

  if (!quiz.materials?.length) continue
  if (alvo.length !== 1) {
    for (const m of quiz.materials) relatorio.push({ curso: quiz.curso_slug, avaliacao: quiz.aula_titulo, arquivo: m.title, tamanho: m.file_size, status: alvo.length ? 'avaliação ambígua' : 'avaliação não encontrada' })
    continue
  }
  const av = alvo[0]
  const { data: existentes } = await sb.from('avaliacao_materiais').select('nome, ordem').eq('avaliacao_id', av.id)
  let ordem = Math.max(0, ...(existentes ?? []).map(x => x.ordem))
  const jaTem = new Set((existentes ?? []).map(x => x.nome))

  for (const m of quiz.materials) {
    const linha = { curso: quiz.curso_slug, avaliacao: quiz.aula_titulo, avaliacao_id: av.id, arquivo: m.title, tamanho: m.file_size }
    if (GABARITO.test(m.title)) { relatorio.push({ ...linha, status: 'separado (gabarito)' }); continue }
    if (jaTem.has(m.title)) { relatorio.push({ ...linha, status: 'já estava' }); continue }
    if (!EXECUTAR) { relatorio.push({ ...linha, status: 'seria importado' }); continue }

    const resp = await fetch(m.file_address)
    if (!resp.ok) { relatorio.push({ ...linha, status: `download falhou (${resp.status})` }); continue }
    const bytes = Buffer.from(await resp.arrayBuffer())
    if (bytes.length > LIMITE) { relatorio.push({ ...linha, status: `grande demais (${(bytes.length / 1048576).toFixed(1)} MB)` }); continue }

    const tipo = tipoDe(m.title)
    const path = `${quiz.curso_slug}/avaliacoes/${av.id}/${nomeArquivo(m.title)}`
    const { error: eUp } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: MIME[tipo] ?? 'application/octet-stream', upsert: true })
    if (eUp) { relatorio.push({ ...linha, status: `upload falhou: ${eUp.message}` }); continue }

    ordem += 1
    const { error: eIns } = await sb.from('avaliacao_materiais').insert({
      avaliacao_id: av.id, nome: m.title, tipo, arquivo_url: path, tamanho_bytes: bytes.length, ordem,
    })
    relatorio.push({ ...linha, status: eIns ? `gravação falhou: ${eIns.message}` : 'importado' })
    jaTem.add(m.title)
  }
}

mkdirSync('migracao/logs', { recursive: true })
const arq = `migracao/logs/anexos_avaliacoes_${EXECUTAR ? 'execucao' : 'simulacao'}_${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.json`
writeFileSync(arq, JSON.stringify({ anexos: relatorio, instrucoes: textos }, null, 2))
const ct = textos.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {})
console.log('instruções (texto/vídeo):', ct, `| com texto: ${textos.filter(t => t.texto).length} | com vídeo: ${textos.filter(t => t.video).length}`)

const cont = relatorio.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {})
console.log(EXECUTAR ? 'EXECUÇÃO' : 'SIMULAÇÃO (nada gravado; use --executar)')
for (const r of relatorio) console.log(`${r.status.padEnd(22)} | ${r.curso.slice(0, 40).padEnd(40)} | ${r.avaliacao.slice(0, 28).padEnd(28)} | ${r.arquivo} (${r.tamanho})`)
console.log('\nresumo:', cont, '\nlog:', arq)

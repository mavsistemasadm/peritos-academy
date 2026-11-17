// app/certificado/[numero]/pdf/route.ts
// O arquivo do certificado, gerado na hora (A4 deitado). Público como a página
// de verificação: quem tem o número tem o certificado.
//
// Fundo claro de propósito, ao contrário do resto da plataforma: certificado
// é impresso e anexado em processo, e fundo carvão gasta tinta e sai borrado.
// A marca entra pela linha em degradê do topo, a mesma dos e-mails.
import { PDFDocument, PDFString, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { carregarCertificadoPublico, detalhesDoCertificado } from '@/lib/queries/certificado-publico'
import { SITE_URL, SITE_HOST } from '@/lib/site'

export const dynamic = 'force-dynamic'

const W = 842
const H = 595

const CARVAO = rgb(0x07 / 255, 0x09 / 255, 0x08 / 255)
const CINZA = rgb(0x5f / 255, 0x66 / 255, 0x61 / 255)
const LINHA = rgb(0xd9 / 255, 0xdc / 255, 0xd2 / 255)
const VERDE_IMPRESSO = rgb(0x0e / 255, 0x8f / 255, 0x6d / 255)
const FUNDO = rgb(0xfc / 255, 0xfc / 255, 0xf7 / 255)

// verde → ciano → lima
const DEGRADE: [number, number, number][] = [
  [0x20, 0xd9, 0xa6],
  [0x36, 0xdc, 0xd1],
  [0xdd, 0xf7, 0x84],
]

/**
 * As fontes embutidas do PDF só conhecem o alfabeto WinAnsi (acentos do
 * português inclusos). Um caractere fora dele (emoji num nome, aspas
 * tipográficas raras) derrubaria a geração inteira; aqui ele vira a letra
 * sem acento, ou some.
 */
function seguro(fonte: PDFFont, texto: string): string {
  let saida = ''
  for (const ch of texto) {
    try {
      fonte.encodeText(ch)
      saida += ch
    } catch {
      const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '')
      try {
        if (base) { fonte.encodeText(base); saida += base }
      } catch { /* descarta */ }
    }
  }
  return saida
}

function centro(page: PDFPage, texto: string, y: number, fonte: PDFFont, tamanho: number, cor = CARVAO, espaco = 0) {
  const largura = fonte.widthOfTextAtSize(texto, tamanho) + espaco * Math.max(0, texto.length - 1)
  if (!espaco) {
    page.drawText(texto, { x: (W - largura) / 2, y, size: tamanho, font: fonte, color: cor })
    return
  }
  let x = (W - largura) / 2
  for (const ch of texto) {
    page.drawText(ch, { x, y, size: tamanho, font: fonte, color: cor })
    x += fonte.widthOfTextAtSize(ch, tamanho) + espaco
  }
}

/** Quebra em até `maxLinhas` linhas que cabem em `largura`. */
function quebrar(texto: string, fonte: PDFFont, tamanho: number, largura: number, maxLinhas: number): string[] {
  const palavras = texto.split(/\s+/).filter(Boolean)
  const linhas: string[] = []
  let atual = ''
  for (const p of palavras) {
    const teste = atual ? `${atual} ${p}` : p
    if (fonte.widthOfTextAtSize(teste, tamanho) <= largura) atual = teste
    else { if (atual) linhas.push(atual); atual = p }
  }
  if (atual) linhas.push(atual)
  if (linhas.length <= maxLinhas) return linhas
  const corte = linhas.slice(0, maxLinhas)
  corte[maxLinhas - 1] = corte[maxLinhas - 1].replace(/\s*\S*$/, '') + '...'
  return corte
}

async function carregarLogo(origem: string): Promise<Uint8Array | null> {
  try {
    const r = await fetch(new URL('/img/logo.png', origem), { cache: 'force-cache' })
    if (!r.ok) return null
    return new Uint8Array(await r.arrayBuffer())
  } catch {
    return null
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ numero: string }> }) {
  const { numero } = await params
  const c = await carregarCertificadoPublico(numero)
  if (!c) return new Response('Certificado não encontrado.', { status: 404 })

  const pdf = await PDFDocument.create()
  pdf.setTitle(`Certificado ${c.numero}`)
  pdf.setAuthor('Peritos Academy')
  pdf.setSubject(c.cursoTitulo)
  pdf.setCreator('Peritos Academy')

  const page = pdf.addPage([W, H])
  const normal = await pdf.embedFont(StandardFonts.Helvetica)
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold)

  // Fundo e moldura
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: FUNDO })
  page.drawRectangle({ x: 28, y: 28, width: W - 56, height: H - 56, borderColor: LINHA, borderWidth: 0.8 })

  // Linha em degradê no topo
  const passos = 120
  for (let i = 0; i < passos; i++) {
    const t = i / (passos - 1)
    const seg = t < 0.5 ? 0 : 1
    const local = t < 0.5 ? t * 2 : (t - 0.5) * 2
    const [a, b] = [DEGRADE[seg], DEGRADE[seg + 1]]
    const cor = rgb(
      (a[0] + (b[0] - a[0]) * local) / 255,
      (a[1] + (b[1] - a[1]) * local) / 255,
      (a[2] + (b[2] - a[2]) * local) / 255,
    )
    page.drawRectangle({ x: (W / passos) * i, y: H - 6, width: W / passos + 0.5, height: 6, color: cor })
  }

  // Logo
  const logoBytes = await carregarLogo(request.url)
  let yTopo = H - 72
  if (logoBytes) {
    try {
      const logo = await pdf.embedPng(logoBytes)
      const alt = 46
      const larg = (logo.width / logo.height) * alt
      page.drawImage(logo, { x: (W - larg) / 2, y: H - 58 - alt, width: larg, height: alt })
      yTopo = H - 58 - alt - 22
    } catch { /* sem logo, segue */ }
  }

  centro(page, 'PERITOS ACADEMY', yTopo, negrito, 9, CARVAO, 2.4)
  centro(page, 'CERTIFICADO DE CONCLUSÃO', yTopo - 42, negrito, 12, VERDE_IMPRESSO, 3)

  centro(page, 'Certificamos que', yTopo - 84, normal, 13, CINZA)

  // Nome: encolhe até caber numa linha
  const nome = seguro(negrito, c.nome)
  let tamNome = 34
  while (tamNome > 18 && negrito.widthOfTextAtSize(nome, tamNome) > 660) tamNome -= 1
  const yNome = yTopo - 128
  centro(page, nome, yNome, negrito, tamNome)
  const largNome = Math.min(660, negrito.widthOfTextAtSize(nome, tamNome))
  page.drawLine({
    start: { x: (W - largNome) / 2 - 20, y: yNome - 14 },
    end: { x: (W + largNome) / 2 + 20, y: yNome - 14 },
    thickness: 0.8, color: LINHA,
  })

  centro(page, 'concluiu com aproveitamento o curso', yNome - 44, normal, 13, CINZA)

  const linhasCurso = quebrar(seguro(negrito, c.cursoTitulo), negrito, 20, 640, 2)
  let yCurso = yNome - 80
  for (const l of linhasCurso) {
    centro(page, l, yCurso, negrito, 20)
    yCurso -= 26
  }

  const detalhes = [...detalhesDoCertificado(c), `Concluído em ${c.emitidoRotulo}`].join('  ·  ')
  centro(page, seguro(normal, detalhes), yCurso - 10, normal, 11.5, CINZA)

  // Rodapé: assinatura à esquerda, verificação à direita
  const yBase = 78
  page.drawLine({ start: { x: 80, y: yBase + 22 }, end: { x: 300, y: yBase + 22 }, thickness: 0.8, color: CARVAO })
  page.drawText('Marlos Henrique', { x: 80, y: yBase + 6, size: 11, font: negrito, color: CARVAO })
  page.drawText('Fundador, Peritos Academy', { x: 80, y: yBase - 8, size: 9, font: normal, color: CINZA })

  const linhaNum = `Certificado nº ${c.numero}`
  const linhaVer = `Verifique em ${SITE_HOST}/certificado/${c.numero}`
  const direita = W - 80
  page.drawText(linhaNum, { x: direita - negrito.widthOfTextAtSize(linhaNum, 10), y: yBase + 6, size: 10, font: negrito, color: CARVAO })
  page.drawText(linhaVer, { x: direita - normal.widthOfTextAtSize(linhaVer, 9), y: yBase - 8, size: 9, font: normal, color: CINZA })

  // O endereço impresso é clicável no leitor de PDF
  const xVer = direita - normal.widthOfTextAtSize(linhaVer, 9)
  const link = pdf.context.register(pdf.context.obj({
    Type: 'Annot', Subtype: 'Link', Border: [0, 0, 0],
    Rect: [xVer, yBase - 11, direita, yBase + 1],
    A: { Type: 'Action', S: 'URI', URI: PDFString.of(`${SITE_URL}/certificado/${c.numero}`) },
  }))
  page.node.addAnnot(link)

  const bytes = await pdf.save()
  return new Response(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Certificado-${c.numero}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

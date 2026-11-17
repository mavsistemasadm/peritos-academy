// app/certificado/[numero]/pdf/route.ts
// O arquivo do certificado: uma página A4 deitada com a arte de
// lib/certificados/arte.tsx ocupando tudo. Público como a página de
// verificação: quem tem o número tem o certificado.
import { PDFDocument, PDFString } from 'pdf-lib'
import { carregarCertificadoPublico } from '@/lib/queries/certificado-publico'
import { gerarArteCertificado, ARTE_LARGURA, ARTE_ALTURA } from '@/lib/certificados/arte'
import { SITE_URL } from '@/lib/site'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// A4 deitado, em pontos
const W = 842
const H = 595

export async function GET(request: Request, { params }: { params: Promise<{ numero: string }> }) {
  const { numero } = await params
  const c = await carregarCertificadoPublico(numero)
  if (!c) return new Response('Certificado não encontrado.', { status: 404 })

  let png: ArrayBuffer
  try {
    png = await gerarArteCertificado(c, request.url)
  } catch (e) {
    console.error('[certificado/pdf] arte falhou:', e)
    return new Response('Não foi possível gerar o certificado agora. Tente de novo em instantes.', { status: 503 })
  }

  const pdf = await PDFDocument.create()
  pdf.setTitle(`Certificado ${c.numero}`)
  pdf.setAuthor('Peritos Academy')
  pdf.setSubject(c.cursoTitulo)
  pdf.setCreator('Peritos Academy')

  const page = pdf.addPage([W, H])
  const imagem = await pdf.embedPng(png)
  page.drawImage(imagem, { x: 0, y: 0, width: W, height: H })

  // O "verifique em ..." do canto superior direito fica clicável.
  // Coordenadas da arte (1123 × 794, origem no topo) convertidas para pontos.
  const k = W / ARTE_LARGURA
  const [x1, x2, yTopo, yBase] = [660, ARTE_LARGURA - 104, 84, 120]
  const link = pdf.context.register(pdf.context.obj({
    Type: 'Annot', Subtype: 'Link', Border: [0, 0, 0],
    Rect: [x1 * k, H - (yBase * H) / ARTE_ALTURA, x2 * k, H - (yTopo * H) / ARTE_ALTURA],
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

// app/certificado/[numero]/imagem/route.ts
// A arte do certificado em PNG, para a página de verificação mostrar o
// certificado como ele é (a mesma imagem que vai dentro do PDF).
import { carregarCertificadoPublico } from '@/lib/queries/certificado-publico'
import { gerarArteCertificado } from '@/lib/certificados/arte'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(request: Request, { params }: { params: Promise<{ numero: string }> }) {
  const { numero } = await params
  const c = await carregarCertificadoPublico(numero)
  if (!c) return new Response('Certificado não encontrado.', { status: 404 })
  try {
    const png = await gerarArteCertificado(c, request.url)
    return new Response(png, {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=300' },
    })
  } catch (e) {
    console.error('[certificado/imagem] arte falhou:', e)
    return new Response('Indisponível.', { status: 503 })
  }
}

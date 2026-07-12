// app/perito/[slug]/page.tsx
// Perfil público do perito — acessível sem login.
import { notFound } from 'next/navigation'
import { carregarPeritoPublico } from '@/lib/queries/perito-publico'
import PeritoPublicoContent from '@/components/PeritoPublicoContent'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

export default async function PaginaPeritoPublico({ params }: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const dados = await carregarPeritoPublico(slug)
  if (!dados) notFound()

  const h = await headers()
  const host = h.get('host') ?? 'peritosacademy.com.br'
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const url = `${proto}://${host}/perito/${slug}`

  return <PeritoPublicoContent dados={dados} url={url} />
}

export async function generateMetadata({ params }: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const dados = await carregarPeritoPublico(slug)
  if (!dados) return { title: 'Perito não encontrado — Peritos Academy' }
  return {
    title: `${dados.perito.nome} · ${dados.nivel_label} — Peritos Academy`,
    description: dados.resumo,
    openGraph: {
      title: `${dados.perito.nome} · ${dados.nivel_label}`,
      description: dados.resumo,
      type: 'profile',
    },
  }
}
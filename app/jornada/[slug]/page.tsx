// app/jornada/[slug]/page.tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { carregarTrilhaPorSlug } from '@/lib/queries/jornada'
import { carregarNav } from '@/lib/queries/nav'
import TrilhaDetalheContent from '@/components/TrilhaDetalheContent'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const dados = await carregarTrilhaPorSlug(slug)
  if (!dados) return { title: 'Trilha · Peritos Academy' }
  return {
    title: `${dados.nome} · Peritos Academy`,
    description: dados.descricao ?? undefined,
  }
}

export default async function PaginaTrilhaDetalhe({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [dados, nav] = await Promise.all([carregarTrilhaPorSlug(slug), carregarNav()])
  if (!dados) notFound()
  return <TrilhaDetalheContent dados={dados} nav={nav} />
}

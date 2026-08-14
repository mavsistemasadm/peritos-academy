// app/jornada/[slug]/page.tsx
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { carregarTrilhaPorSlug } from '@/lib/queries/jornada'
import { carregarNav } from '@/lib/queries/nav'
import TrilhaDetalheContent from '@/components/TrilhaDetalheContent'
import { verificarAcessoConteudo } from '@/lib/acesso/verificar'
import AssinaturaNecessaria from '@/components/AssinaturaNecessaria'

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
  const nav = await carregarNav()
  if (!nav.logado) redirect('/login')

  // Mesma regra de /jornada. Gatear só a lista deixaria a trilha inteira
  // acessível por link direto, que é o furo clássico de gate por página.
  const acesso = await verificarAcessoConteudo()
  if (!acesso.permitido) return <AssinaturaNecessaria nav={nav} logado={acesso.logado} secao="A Jornada" />

  const dados = await carregarTrilhaPorSlug(slug)
  if (!dados) notFound()
  return <TrilhaDetalheContent dados={dados} nav={nav} />
}

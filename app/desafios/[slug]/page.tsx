// app/desafio/[slug]/page.tsx
import { notFound, redirect } from 'next/navigation'
import { carregarDesafio } from '@/lib/queries/desafio'
import { carregarNav } from '@/lib/queries/nav'
import DesafioContent from '@/components/DesafioContent'
import { verificarAcessoConteudo } from '@/lib/acesso/verificar'
import AssinaturaNecessaria from '@/components/AssinaturaNecessaria'

export const dynamic = 'force-dynamic'

export default async function PaginaDesafio({ params }: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const [dados, nav] = await Promise.all([carregarDesafio(slug), carregarNav()])
  if (!dados) redirect('/login')
  if (!dados.desafio) notFound()

  const acesso = await verificarAcessoConteudo()
  if (!acesso.permitido) return <AssinaturaNecessaria nav={nav} logado={acesso.logado} />

  return <DesafioContent dados={dados} nav={nav} />
}

export async function generateMetadata({ params }: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const dados = await carregarDesafio(slug)
  if (!dados?.desafio) return { title: 'Desafio — Peritos Academy' }
  return {
    title: `Desafio #${dados.desafio.numero} · ${dados.desafio.titulo} — Peritos Academy`,
    description: `Perícia sob pressão: ${dados.desafio.quesitos_total} quesitos, ${dados.desafio.prazo_dias} dias de prazo.`,
  }
}
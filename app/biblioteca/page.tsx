// app/biblioteca/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { carregarBiblioteca } from '@/lib/queries/biblioteca'
import { carregarNav } from '@/lib/queries/nav'
import { carregarBloqueioNexus } from '@/lib/nexus/servidor'
import BibliotecaContent from '@/components/BibliotecaContent'

export const metadata: Metadata = {
  title: 'Biblioteca · Peritos Academy',
}

export const dynamic = 'force-dynamic'

export default async function PaginaBiblioteca() {
  const [dados, nav] = await Promise.all([carregarBiblioteca(), carregarNav()])
  if (!dados.logado) redirect('/login')
  // Só busca a copy do Nexus quando o aluno NÃO tem acesso — é a única
  // situação em que ela é renderizada.
  const nexusBloqueio = dados.temAcesso ? null : await carregarBloqueioNexus('biblioteca')
  return <BibliotecaContent dados={dados} nav={nav} nexusBloqueio={nexusBloqueio} />
}
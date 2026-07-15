// app/biblioteca/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { carregarBiblioteca } from '@/lib/queries/biblioteca'
import { carregarNav } from '@/lib/queries/nav'
import BibliotecaContent from '@/components/BibliotecaContent'

export const metadata: Metadata = {
  title: 'Biblioteca · Peritos Academy',
}

export const dynamic = 'force-dynamic'

export default async function PaginaBiblioteca() {
  const [dados, nav] = await Promise.all([carregarBiblioteca(), carregarNav()])
  if (!dados.logado) redirect('/login')
  return <BibliotecaContent dados={dados} nav={nav} />
}
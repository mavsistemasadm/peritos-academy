// app/desafios/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { carregarDesafios } from '@/lib/queries/desafios'
import { carregarNav } from '@/lib/queries/nav'
import DesafiosContent from '@/components/DesafiosContent'

export const metadata: Metadata = {
  title: 'Desafios — Peritos Academy',
  description: 'Perícia sob pressão: leia os autos, monte a planilha e protocole seu laudo.',
}

export const dynamic = 'force-dynamic'

export default async function PaginaDesafios() {
  const [dados, nav] = await Promise.all([carregarDesafios(), carregarNav()])
  if (!dados.logado) redirect('/login')
  return <DesafiosContent dados={dados} nav={nav} />
}
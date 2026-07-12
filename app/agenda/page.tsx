// app/agenda/page.tsx
import type { Metadata } from 'next'
import { carregarAgenda } from '@/lib/queries/agenda'
import { carregarNav } from '@/lib/queries/nav'
import AgendaContent from '@/components/AgendaContent'

export const metadata: Metadata = {
  title: 'Agenda — Peritos Academy',
  description: 'Aulas ao vivo, plantões, mentorias e gravações.',
}

export const dynamic = 'force-dynamic'

export default async function PaginaAgenda() {
  const [dados, nav] = await Promise.all([carregarAgenda(), carregarNav()])
  return <AgendaContent dados={dados} nav={nav} />
}
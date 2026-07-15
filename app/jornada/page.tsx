// app/jornada/page.tsx
import type { Metadata } from 'next'
import { carregarJornada } from '@/lib/queries/jornada'
import { carregarNav } from '@/lib/queries/nav'
import JornadaContent from '@/components/JornadaContent'

export const metadata: Metadata = {
  title: 'Sua jornada · Peritos Academy',
  description: 'Cinco etapas entre você e o título de Perito de Elite.',
}

export const dynamic = 'force-dynamic'

export default async function PaginaJornada() {
  const [dados, nav] = await Promise.all([carregarJornada(), carregarNav()])
  return <JornadaContent dados={dados} nav={nav} />
}
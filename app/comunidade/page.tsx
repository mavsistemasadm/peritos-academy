// app/comunidade/page.tsx
import type { Metadata } from 'next'
import { carregarComunidade } from '@/lib/queries/comunidade'
import { carregarNav } from '@/lib/queries/nav'
import ComunidadeContent from '@/components/ComunidadeContent'

export const metadata: Metadata = {
  title: 'Comunidade — Peritos Academy',
  description: 'Casos reais, dúvidas respondidas e vitórias dos peritos.',
}

export const dynamic = 'force-dynamic'

export default async function PaginaComunidade() {
  const [dados, nav] = await Promise.all([carregarComunidade(), carregarNav()])
  return <ComunidadeContent dados={dados} nav={nav} />
}
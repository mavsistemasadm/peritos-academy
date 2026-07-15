// app/guia/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { carregarGuia } from '@/lib/queries/guia'
import { carregarNav } from '@/lib/queries/nav'
import GuiaContent from '@/components/GuiaContent'

export const metadata: Metadata = {
  title: 'Guia da plataforma · Peritos Academy',
  description: 'Documentação viva da plataforma: jornada, aulas, gamificação, comunidade, desafios, agenda, certificados e conta.',
}

export const dynamic = 'force-dynamic'

export default async function PaginaGuia() {
  const [nav, dados] = await Promise.all([carregarNav(), carregarGuia()])
  if (!nav.logado) redirect('/login')
  return <GuiaContent dados={dados} nav={nav} />
}

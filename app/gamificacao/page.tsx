// app/gamificacao/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { carregarGamificacaoJornada } from '@/lib/queries/gamificacao-jornada'
import { carregarNav } from '@/lib/queries/nav'
import GamificacaoJornadaContent from '@/components/GamificacaoJornadaContent'

export const metadata: Metadata = {
  title: 'Como funciona sua jornada · Peritos Academy',
  description: 'Os 10 níveis, como você ganha XP, a regra de conclusão de aula e o sistema de sequência (streak), explicados de ponta a ponta.',
}

export const dynamic = 'force-dynamic'

export default async function PaginaGamificacaoJornada() {
  const [nav, dados] = await Promise.all([carregarNav(), carregarGamificacaoJornada()])
  if (!nav.logado) redirect('/login')
  return <GamificacaoJornadaContent dados={dados} nav={nav} />
}

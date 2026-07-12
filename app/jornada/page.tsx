// app/jornada/page.tsx
import type { Metadata } from 'next'
import { carregarJornada } from '@/lib/queries/jornada'
import JornadaContent from '@/components/JornadaContent'

export const metadata: Metadata = {
  title: 'Sua jornada — Peritos Academy',
  description: 'Cinco etapas entre você e o título de Perito de Elite.',
}

// o estado das etapas deriva do perfil de quem está logado — sem cache
export const dynamic = 'force-dynamic'

export default async function PaginaJornada() {
  const dados = await carregarJornada()
    console.log('>>> tipo do JornadaContent:', typeof JornadaContent)
  return <JornadaContent dados={dados} />
}
// app/anamnese/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { carregarNav } from '@/lib/queries/nav'
import {
  getAnamneseQuestoes,
  getAnamneseProgresso,
  getAnamneseTextosGerais,
  getAnamneseTerritorios,
  getSonsConquista,
} from '@/lib/queries/anamnese'
import AnamneseContent from '@/components/AnamneseContent'

export const metadata: Metadata = {
  title: 'A Rota do Perito · Peritos Academy',
  description: 'Responda 16 perguntas e receba sua rota de estudos personalizada, traçada no mapa do perito.',
}

export const dynamic = 'force-dynamic'

export default async function PaginaAnamnese() {
  const nav = await carregarNav()
  if (!nav.logado) redirect('/login')

  const [questoes, progresso, textos, territorios, sonsConquista] = await Promise.all([
    getAnamneseQuestoes(),
    getAnamneseProgresso(),
    getAnamneseTextosGerais(),
    getAnamneseTerritorios(),
    getSonsConquista(),
  ])

  return (
    <AnamneseContent
      questoes={questoes}
      progressoInicial={progresso}
      textos={textos}
      territorios={territorios}
      sonsConquista={sonsConquista}
    />
  )
}

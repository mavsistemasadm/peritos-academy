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
import { verificarAcessoConteudo } from '@/lib/acesso/verificar'
import AssinaturaNecessaria from '@/components/AssinaturaNecessaria'

export const metadata: Metadata = {
  title: 'A Rota do Perito · Peritos Academy',
  description: 'Responda 16 perguntas e receba sua rota de estudos personalizada, traçada no mapa do perito.',
}

export const dynamic = 'force-dynamic'

export default async function PaginaAnamnese() {
  const nav = await carregarNav()
  if (!nav.logado) redirect('/login')

  // A cerimônia da Rota do Perito é do plano completo: ela desenha um caminho
  // por cima do catálogo inteiro, e traçar rota sobre cursos que a pessoa não
  // pode abrir é uma promessa que a plataforma não cumpre na aula seguinte.
  const acesso = await verificarAcessoConteudo()
  if (!acesso.permitido) return <AssinaturaNecessaria nav={nav} logado={acesso.logado} secao="A Rota do Perito" />

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

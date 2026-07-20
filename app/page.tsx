// app/page.tsx
import { redirect } from 'next/navigation'
import { carregarHome } from '@/lib/queries/home'
import { carregarNav } from '@/lib/queries/nav'
import { getPlanoVivo } from '@/lib/queries/meuPlano'
import { getAnamneseProgresso, getAnamneseTextosGerais, getAnamneseTerritorios } from '@/lib/queries/anamnese'
import HomeContent from '@/components/HomeContent'

export const dynamic = 'force-dynamic'

export default async function PaginaHome() {
  const [dados, nav, plano, progressoRota, textosRota, territoriosRota] = await Promise.all([
    carregarHome(),
    carregarNav(),
    getPlanoVivo(),
    getAnamneseProgresso(),
    getAnamneseTextosGerais(),
    getAnamneseTerritorios(),
  ])
  if (!dados) redirect('/login')
  return (
    <HomeContent
      dados={dados} nav={nav} plano={plano} progressoRota={progressoRota}
      textosRota={textosRota} territoriosRota={territoriosRota}
    />
  )
}
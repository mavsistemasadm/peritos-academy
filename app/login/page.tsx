// app/login/page.tsx
import type { Metadata } from 'next'
import { criarClienteServidor } from '@/lib/supabase/server'
import { carregarConfigPlataforma } from '@/lib/queries/config-plataforma'
import { carregarMetricasComunidade } from '@/lib/queries/comunidade-metricas'
import LoginContent from '@/components/LoginContent'

export const metadata: Metadata = {
  title: 'Entrar · Peritos Academy',
}

export const dynamic = 'force-dynamic'

export default async function PaginaLogin() {
  const supabase = await criarClienteServidor()

  const [{ data: etapas }, plataforma, metricas] = await Promise.all([
    supabase.from('jornada_etapas').select('missoes_total'),
    carregarConfigPlataforma(),
    carregarMetricasComunidade(),
  ])

  const selos = {
    membros: metricas.totalPeritos,
    missoes: (etapas ?? []).reduce((s, e) => s + (e.missoes_total ?? 0), 0),
    casos: metricas.casosResolvidosSemana,
  }

  return (
    <LoginContent
      selos={selos}
      nomePlataforma={plataforma.nomePlataforma}
      logoUrl={plataforma.logoUrl}
      paginaInicialPosLogin={plataforma.paginaInicialPosLogin}
    />
  )
}
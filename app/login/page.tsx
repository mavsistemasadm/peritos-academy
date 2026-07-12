// app/login/page.tsx
import type { Metadata } from 'next'
import { criarClienteServidor } from '@/lib/supabase/server'
import LoginContent from '@/components/LoginContent'

export const metadata: Metadata = {
  title: 'Entrar — Peritos Academy',
}

export const dynamic = 'force-dynamic'

export default async function PaginaLogin() {
  const supabase = await criarClienteServidor()

  const [{ data: config }, { data: etapas }] = await Promise.all([
    supabase.from('comunidade_config').select('membros_total, casos_semana').eq('id', 1).maybeSingle(),
    supabase.from('jornada_etapas').select('missoes_total'),
  ])

  const selos = {
    membros: config?.membros_total ?? 0,
    missoes: (etapas ?? []).reduce((s, e) => s + (e.missoes_total ?? 0), 0),
    casos: config?.casos_semana ?? 0,
  }

  return <LoginContent selos={selos} />
}
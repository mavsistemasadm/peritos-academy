// app/perfil/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { carregarPerfil } from '@/lib/queries/perfil'
import { carregarNav } from '@/lib/queries/nav'
import PerfilContent from '@/components/PerfilContent'

export const metadata: Metadata = {
  title: 'Meu perfil · Peritos Academy',
  description: 'Sua evolução: XP, constância, insígnias e certificados.',
}

// sequência, heatmap e atividade dependem de now() — sem cache estático
export const dynamic = 'force-dynamic'

export default async function PaginaPerfil() {
  const [dados, nav] = await Promise.all([carregarPerfil(), carregarNav()])
  if (!dados) redirect('/login')   // perfil sem dono não existe
  return <PerfilContent dados={dados} nav={nav} />
}
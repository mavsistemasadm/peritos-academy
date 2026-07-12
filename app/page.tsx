// app/page.tsx
import { redirect } from 'next/navigation'
import { carregarHome } from '@/lib/queries/home'
import { carregarNav } from '@/lib/queries/nav'
import HomeContent from '@/components/HomeContent'

export const dynamic = 'force-dynamic'

export default async function PaginaHome() {
  const [dados, nav] = await Promise.all([carregarHome(), carregarNav()])
  if (!dados) redirect('/login')
  return <HomeContent dados={dados} nav={nav} />
}
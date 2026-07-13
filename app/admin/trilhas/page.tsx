// app/admin/trilhas/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'
import { carregarTrilhasAdmin } from '@/lib/queries/admin-trilhas'
import AdminTrilhasContent from '@/components/AdminTrilhasContent'

export const metadata: Metadata = {
  title: 'Trilhas — Admin Peritos Academy',
}

export const dynamic = 'force-dynamic'

export default async function PaginaAdminTrilhas() {
  const admin = await obterAdminAtual()
  if (!temPermissao(admin, 'trilhas')) redirect('/acesso-negado')

  const trilhas = await carregarTrilhasAdmin()
  return <AdminTrilhasContent trilhas={trilhas} />
}

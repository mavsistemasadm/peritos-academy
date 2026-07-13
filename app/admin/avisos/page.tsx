// app/admin/avisos/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'
import { carregarNovidadesAdmin } from '@/lib/queries/admin-avisos'
import AdminAvisosContent from '@/components/AdminAvisosContent'

export const metadata: Metadata = {
  title: 'Avisos — Admin Peritos Academy',
}

export const dynamic = 'force-dynamic'

export default async function PaginaAdminAvisos() {
  const admin = await obterAdminAtual()
  if (!temPermissao(admin, 'avisos')) redirect('/acesso-negado')

  const novidades = await carregarNovidadesAdmin()
  return <AdminAvisosContent novidades={novidades} />
}

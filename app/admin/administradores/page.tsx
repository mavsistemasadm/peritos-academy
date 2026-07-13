// app/admin/administradores/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'
import { carregarAdministradores } from '@/lib/queries/admin-usuarios'
import AdminAdministradoresContent from '@/components/AdminAdministradoresContent'

export const metadata: Metadata = {
  title: 'Administradores — Peritos Academy',
}

export const dynamic = 'force-dynamic'

export default async function PaginaAdministradores() {
  const admin = await obterAdminAtual()
  if (!temPermissao(admin, 'administradores')) redirect('/acesso-negado')

  const administradores = await carregarAdministradores()
  return <AdminAdministradoresContent administradores={administradores} />
}

// app/admin/layout.tsx
import { redirect } from 'next/navigation'
import { obterAdminAtual } from '@/lib/admin/auth'
import { carregarNav } from '@/lib/queries/nav'
import NavPlataforma from '@/components/NavPlataforma'
import AdminShell from '@/components/AdminShell'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [admin, nav] = await Promise.all([obterAdminAtual(), carregarNav()])
  if (!admin) redirect('/acesso-negado')

  return (
    <div className="pagina-admin">
      <NavPlataforma dados={nav} />
      <AdminShell admin={admin}>{children}</AdminShell>
    </div>
  )
}

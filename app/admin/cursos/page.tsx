// app/admin/cursos/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'
import { carregarCursosAdmin } from '@/lib/queries/admin-cursos'
import AdminCursosContent from '@/components/AdminCursosContent'

export const metadata: Metadata = {
  title: 'Cursos — Admin Peritos Academy',
}

export const dynamic = 'force-dynamic'

export default async function PaginaAdminCursos() {
  const admin = await obterAdminAtual()
  if (!temPermissao(admin, 'cursos')) redirect('/acesso-negado')

  const cursos = await carregarCursosAdmin()
  return <AdminCursosContent cursos={cursos} />
}

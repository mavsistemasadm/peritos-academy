// app/admin/desafios/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'
import { carregarDesafiosAdmin, carregarCategoriasAdmin } from '@/lib/queries/admin-desafios'
import AdminDesafiosContent from '@/components/AdminDesafiosContent'

export const metadata: Metadata = {
  title: 'Desafios — Admin Peritos Academy',
}

export const dynamic = 'force-dynamic'

export default async function PaginaAdminDesafios() {
  const admin = await obterAdminAtual()
  if (!temPermissao(admin, 'desafios')) redirect('/acesso-negado')

  const [desafios, categorias] = await Promise.all([carregarDesafiosAdmin(), carregarCategoriasAdmin()])
  return <AdminDesafiosContent desafios={desafios} categorias={categorias} />
}

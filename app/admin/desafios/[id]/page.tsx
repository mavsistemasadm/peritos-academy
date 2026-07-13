// app/admin/desafios/[id]/page.tsx
import type { Metadata } from 'next'
import { redirect, notFound } from 'next/navigation'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'
import { carregarDesafioAdmin, carregarCategoriasAdmin, carregarEntregasDesafio } from '@/lib/queries/admin-desafios'
import AdminDesafioEditorContent from '@/components/AdminDesafioEditorContent'

export const metadata: Metadata = {
  title: 'Editar desafio — Admin Peritos Academy',
}

export const dynamic = 'force-dynamic'

export default async function PaginaAdminDesafioEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = await obterAdminAtual()
  if (!temPermissao(admin, 'desafios')) redirect('/acesso-negado')

  const desafio = await carregarDesafioAdmin(id)
  if (!desafio) notFound()

  const [categorias, entregas] = await Promise.all([carregarCategoriasAdmin(), carregarEntregasDesafio(id)])

  return <AdminDesafioEditorContent desafio={desafio} categorias={categorias} entregas={entregas} />
}

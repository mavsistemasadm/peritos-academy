// app/admin/cursos/[id]/page.tsx
import type { Metadata } from 'next'
import { redirect, notFound } from 'next/navigation'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'
import { carregarCursoAdmin } from '@/lib/queries/admin-cursos'
import AdminCursoEditorContent from '@/components/AdminCursoEditorContent'

export const metadata: Metadata = {
  title: 'Editar curso — Admin Peritos Academy',
}

export const dynamic = 'force-dynamic'

export default async function PaginaAdminCursoEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = await obterAdminAtual()
  if (!temPermissao(admin, 'cursos')) redirect('/acesso-negado')

  const dados = await carregarCursoAdmin(id)
  if (!dados) notFound()

  return <AdminCursoEditorContent curso={dados.curso} modulos={dados.modulos} />
}

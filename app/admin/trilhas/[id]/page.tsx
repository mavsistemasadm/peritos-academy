// app/admin/trilhas/[id]/page.tsx
import type { Metadata } from 'next'
import { redirect, notFound } from 'next/navigation'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'
import { carregarTrilhaAdmin, carregarCursosParaPicker } from '@/lib/queries/admin-trilhas'
import AdminTrilhaEditorContent from '@/components/AdminTrilhaEditorContent'

export const metadata: Metadata = {
  title: 'Editar trilha · Admin Peritos Academy',
}

export const dynamic = 'force-dynamic'

export default async function PaginaAdminTrilhaEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = await obterAdminAtual()
  if (!temPermissao(admin, 'trilhas')) redirect('/acesso-negado')

  const [dados, cursos] = await Promise.all([carregarTrilhaAdmin(id), carregarCursosParaPicker(id)])
  if (!dados) notFound()

  return <AdminTrilhaEditorContent trilha={dados.trilha} etapas={dados.etapas} cursos={cursos} />
}

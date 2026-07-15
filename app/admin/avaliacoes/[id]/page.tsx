// app/admin/avaliacoes/[id]/page.tsx
import type { Metadata } from 'next'
import { redirect, notFound } from 'next/navigation'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'
import { carregarAvaliacaoAdmin, carregarModulosDoCurso } from '@/lib/queries/admin-avaliacoes'
import AdminAvaliacaoEditorContent from '@/components/AdminAvaliacaoEditorContent'

export const metadata: Metadata = {
  title: 'Editar avaliação · Admin Peritos Academy',
}

export const dynamic = 'force-dynamic'

export default async function PaginaAdminAvaliacaoEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = await obterAdminAtual()
  if (!temPermissao(admin, 'avaliacoes')) redirect('/acesso-negado')

  const dados = await carregarAvaliacaoAdmin(id)
  if (!dados) notFound()

  const modulos = await carregarModulosDoCurso(dados.avaliacao.cursoId)

  return <AdminAvaliacaoEditorContent avaliacao={dados.avaliacao} questoes={dados.questoes} modulos={modulos} />
}

// app/admin/comunidade/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'
import { carregarPostsAdmin, carregarComentariosAdmin, carregarDuvidasAulaAdmin } from '@/lib/queries/admin-comunidade'
import AdminComunidadeContent from '@/components/AdminComunidadeContent'

export const metadata: Metadata = {
  title: 'Comunidade · Admin Peritos Academy',
}

export const dynamic = 'force-dynamic'

export default async function PaginaAdminComunidade() {
  const admin = await obterAdminAtual()
  if (!temPermissao(admin, 'comunidade')) redirect('/acesso-negado')

  const [posts, comentarios, duvidas] = await Promise.all([
    carregarPostsAdmin(), carregarComentariosAdmin(), carregarDuvidasAulaAdmin(),
  ])

  return <AdminComunidadeContent posts={posts} comentarios={comentarios} duvidas={duvidas} />
}

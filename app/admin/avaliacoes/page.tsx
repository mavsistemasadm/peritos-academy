// app/admin/avaliacoes/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'
import { carregarAvaliacoesAdmin } from '@/lib/queries/admin-avaliacoes'
import { carregarCursosParaPicker } from '@/lib/queries/admin-trilhas'
import AdminAvaliacoesContent from '@/components/AdminAvaliacoesContent'

export const metadata: Metadata = {
  title: 'Avaliações · Admin Peritos Academy',
}

export const dynamic = 'force-dynamic'

export default async function PaginaAdminAvaliacoes({
  searchParams,
}: {
  searchParams: Promise<{ curso?: string }>
}) {
  const { curso } = await searchParams
  const admin = await obterAdminAtual()
  if (!temPermissao(admin, 'avaliacoes')) redirect('/acesso-negado')

  const [avaliacoes, cursos] = await Promise.all([
    carregarAvaliacoesAdmin(curso || undefined),
    carregarCursosParaPicker(),
  ])

  return <AdminAvaliacoesContent avaliacoes={avaliacoes} cursos={cursos} cursoFiltro={curso ?? ''} />
}

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'
import {
  listarAcessos,
  listarCursosParaAcesso,
  acessosPorPagina,
  type Escopo,
  type StatusAcesso,
} from '@/lib/queries/admin-acessos'
import AdminAcessosContent from '@/components/AdminAcessosContent'

export const metadata: Metadata = {
  title: 'Acessos · Admin Peritos Academy',
}

export const dynamic = 'force-dynamic'

type Params = {
  busca?: string
  escopo?: string
  curso?: string
  status?: string
  pagina?: string
}

export default async function PaginaAdminAcessos({ searchParams }: { searchParams: Promise<Params> }) {
  const admin = await obterAdminAtual()
  if (!temPermissao(admin, 'acessos')) redirect('/acesso-negado')

  const sp = await searchParams
  const pagina = Math.max(1, Number(sp.pagina) || 1)

  const [{ linhas, total }, cursos] = await Promise.all([
    listarAcessos({
      busca: sp.busca,
      escopo: (sp.escopo as Escopo) || undefined,
      cursoId: sp.curso || undefined,
      status: (sp.status as StatusAcesso) || 'vigentes',
      pagina,
    }),
    listarCursosParaAcesso(),
  ])

  return (
    <AdminAcessosContent
      acessos={linhas}
      total={total}
      pagina={pagina}
      porPagina={acessosPorPagina}
      cursos={cursos}
      filtros={sp}
    />
  )
}

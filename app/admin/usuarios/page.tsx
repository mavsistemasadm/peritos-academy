// app/admin/usuarios/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'
import { listarUsuariosAdmin, usuariosPorPagina, type StatusConta, type StatusAssinaturaAluno } from '@/lib/queries/admin-suporte'
import AdminUsuariosContent from '@/components/AdminUsuariosContent'

export const metadata: Metadata = {
  title: 'Usuários · Admin Peritos Academy',
}

export const dynamic = 'force-dynamic'

type Params = {
  busca?: string
  status?: string
  assinatura?: string
  nivel?: string
  ativos?: string
  ordenar?: string
  dir?: string
  pagina?: string
}

export default async function PaginaAdminUsuarios({ searchParams }: { searchParams: Promise<Params> }) {
  const admin = await obterAdminAtual()
  if (!temPermissao(admin, 'usuarios')) redirect('/acesso-negado')

  const sp = await searchParams
  const pagina = Math.max(1, Number(sp.pagina) || 1)

  const { linhas, totalCount } = await listarUsuariosAdmin({
    busca: sp.busca,
    statusConta: (sp.status as StatusConta) || undefined,
    statusAssinatura: (sp.assinatura as StatusAssinaturaAluno) || undefined,
    nivel: sp.nivel ? Number(sp.nivel) : undefined,
    ativosDias: sp.ativos ? Number(sp.ativos) : undefined,
    ordenarPor: (sp.ordenar as any) || undefined,
    ordenarDir: (sp.dir as any) || undefined,
    pagina,
  })

  return (
    <AdminUsuariosContent
      usuarios={linhas}
      totalCount={totalCount}
      pagina={pagina}
      porPagina={usuariosPorPagina}
      filtrosAtuais={sp}
    />
  )
}

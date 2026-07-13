// app/admin/usuarios/[id]/page.tsx
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'
import {
  carregarFichaUsuario, carregarExtratoUsuario, carregarComunidadeUsuario,
  carregarAuditoriaUsuario, carregarCursosParaCertificado,
} from '@/lib/queries/admin-suporte'
import AdminUsuarioFichaContent from '@/components/AdminUsuarioFichaContent'

export const metadata: Metadata = {
  title: 'Ficha do aluno — Admin Peritos Academy',
}

export const dynamic = 'force-dynamic'

export default async function PaginaAdminUsuarioFicha({ params }: { params: Promise<{ id: string }> }) {
  const admin = await obterAdminAtual()
  if (!temPermissao(admin, 'usuarios')) redirect('/acesso-negado')

  const { id } = await params

  let ficha
  try {
    ficha = await carregarFichaUsuario(id)
  } catch {
    notFound()
  }

  const [extrato, comunidade, auditoria, cursos] = await Promise.all([
    carregarExtratoUsuario(id, 1),
    carregarComunidadeUsuario(id),
    carregarAuditoriaUsuario(id),
    carregarCursosParaCertificado(),
  ])

  return (
    <AdminUsuarioFichaContent
      ficha={ficha}
      extratoInicial={extrato}
      comunidade={comunidade}
      auditoria={auditoria}
      cursos={cursos}
    />
  )
}

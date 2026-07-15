// app/admin/certificados/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'
import { carregarCertificadosAdmin, carregarCursosCertificaveis } from '@/lib/queries/admin-certificados'
import AdminCertificadosContent from '@/components/AdminCertificadosContent'

export const metadata: Metadata = {
  title: 'Certificados · Admin Peritos Academy',
}

export const dynamic = 'force-dynamic'

export default async function PaginaAdminCertificados() {
  const admin = await obterAdminAtual()
  if (!temPermissao(admin, 'certificados')) redirect('/acesso-negado')

  const [certificados, cursos] = await Promise.all([carregarCertificadosAdmin(), carregarCursosCertificaveis()])
  return <AdminCertificadosContent certificados={certificados} cursos={cursos} />
}

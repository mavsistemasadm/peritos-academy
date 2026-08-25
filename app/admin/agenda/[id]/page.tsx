// app/admin/agenda/[id]/page.tsx
import type { Metadata } from 'next'
import { redirect, notFound } from 'next/navigation'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'
import { carregarEventoAdmin } from '@/lib/queries/admin-agenda'
import { carregarCursosParaPicker } from '@/lib/queries/admin-trilhas'
import AdminEventoEditorContent from '@/components/AdminEventoEditorContent'
import { carregarConfigPlataforma } from '@/lib/queries/config-plataforma'

export const metadata: Metadata = {
  title: 'Editar evento · Admin Peritos Academy',
}

export const dynamic = 'force-dynamic'

export default async function PaginaAdminEventoEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = await obterAdminAtual()
  if (!temPermissao(admin, 'agenda')) redirect('/acesso-negado')

  const evento = await carregarEventoAdmin(id)
  if (!evento) notFound()

  const cursos = await carregarCursosParaPicker()
  // A imagem padrão entra aqui só para o card de divulgação poder dizer, com
  // certeza, se a prévia do WhatsApp vai sair com figura ou só com texto.
  const config = await carregarConfigPlataforma()
  return <AdminEventoEditorContent evento={evento} cursos={cursos} ogImagePadrao={config.ogImageUrl} />
}

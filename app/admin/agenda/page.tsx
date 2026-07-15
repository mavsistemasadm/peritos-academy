// app/admin/agenda/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'
import { carregarEventosAdmin } from '@/lib/queries/admin-agenda'
import AdminAgendaContent from '@/components/AdminAgendaContent'

export const metadata: Metadata = {
  title: 'Agenda · Admin Peritos Academy',
}

export const dynamic = 'force-dynamic'

export default async function PaginaAdminAgenda() {
  const admin = await obterAdminAtual()
  if (!temPermissao(admin, 'agenda')) redirect('/acesso-negado')

  const eventos = await carregarEventosAdmin()
  return <AdminAgendaContent eventos={eventos} />
}

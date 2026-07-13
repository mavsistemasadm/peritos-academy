// app/agenda/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { carregarAgenda } from '@/lib/queries/agenda'
import { carregarNav } from '@/lib/queries/nav'
import AgendaContent from '@/components/AgendaContent'
import { EXIGE_ASSINATURA_COMUNIDADE_E_AGENDA } from '@/lib/acesso/config'
import { verificarAcessoConteudo } from '@/lib/acesso/verificar'
import AssinaturaNecessaria from '@/components/AssinaturaNecessaria'

export const metadata: Metadata = {
  title: 'Agenda — Peritos Academy',
  description: 'Aulas ao vivo, plantões, mentorias e gravações.',
}

export const dynamic = 'force-dynamic'

export default async function PaginaAgenda() {
  const nav = await carregarNav()
  // Defesa dupla com o toggle de módulo em config_plataforma.
  if (!nav.agendaAtiva) redirect('/')
  if (EXIGE_ASSINATURA_COMUNIDADE_E_AGENDA) {
    const acesso = await verificarAcessoConteudo()
    if (!acesso.permitido) return <AssinaturaNecessaria nav={nav} logado={acesso.logado} />
  }
  const dados = await carregarAgenda()
  return <AgendaContent dados={dados} nav={nav} />
}
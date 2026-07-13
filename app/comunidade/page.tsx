// app/comunidade/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { carregarComunidade } from '@/lib/queries/comunidade'
import { carregarNav } from '@/lib/queries/nav'
import ComunidadeContent from '@/components/ComunidadeContent'
import { EXIGE_ASSINATURA_COMUNIDADE_E_AGENDA } from '@/lib/acesso/config'
import { verificarAcessoConteudo } from '@/lib/acesso/verificar'
import AssinaturaNecessaria from '@/components/AssinaturaNecessaria'

export const metadata: Metadata = {
  title: 'Comunidade — Peritos Academy',
  description: 'Casos reais, dúvidas respondidas e vitórias dos peritos.',
}

export const dynamic = 'force-dynamic'

export default async function PaginaComunidade() {
  const nav = await carregarNav()
  // Defesa dupla com o toggle de módulo em config_plataforma — o link já
  // some do NavPlataforma, mas a rota também precisa recusar acesso direto.
  if (!nav.comunidadeAtiva) redirect('/')
  if (EXIGE_ASSINATURA_COMUNIDADE_E_AGENDA) {
    const acesso = await verificarAcessoConteudo()
    if (!acesso.permitido) return <AssinaturaNecessaria nav={nav} logado={acesso.logado} />
  }
  const dados = await carregarComunidade()
  return <ComunidadeContent dados={dados} nav={nav} />
}
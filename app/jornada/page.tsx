// app/jornada/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { carregarJornada } from '@/lib/queries/jornada'
import { carregarNav } from '@/lib/queries/nav'
import JornadaContent from '@/components/JornadaContent'
import { verificarAcessoConteudo } from '@/lib/acesso/verificar'
import AssinaturaNecessaria from '@/components/AssinaturaNecessaria'

export const metadata: Metadata = {
  title: 'Sua jornada · Peritos Academy',
  description: 'Cinco etapas entre você e o título de Perito de Elite.',
}

export const dynamic = 'force-dynamic'

export default async function PaginaJornada() {
  const nav = await carregarNav()
  if (!nav.logado) redirect('/login')

  // A jornada é o mapa da formação completa. Quem comprou um curso avulso vê o
  // convite, não o mapa — ele é boa parte do que se está vendendo.
  const acesso = await verificarAcessoConteudo()
  if (!acesso.permitido) return <AssinaturaNecessaria nav={nav} logado={acesso.logado} secao="A Jornada" />

  const dados = await carregarJornada()
  return <JornadaContent dados={dados} nav={nav} />
}
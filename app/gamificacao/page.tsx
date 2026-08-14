// app/gamificacao/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { carregarGamificacaoJornada } from '@/lib/queries/gamificacao-jornada'
import { carregarNav } from '@/lib/queries/nav'
import GamificacaoJornadaContent from '@/components/GamificacaoJornadaContent'
import { verificarAcessoConteudo } from '@/lib/acesso/verificar'
import AssinaturaNecessaria from '@/components/AssinaturaNecessaria'

export const metadata: Metadata = {
  title: 'Como funciona sua jornada · Peritos Academy',
  description: 'Os 10 níveis, como você ganha XP, a regra de conclusão de aula e o sistema de sequência (streak), explicados de ponta a ponta.',
}

export const dynamic = 'force-dynamic'

export default async function PaginaGamificacaoJornada() {
  const nav = await carregarNav()
  if (!nav.logado) redirect('/login')

  // A gamificação é a régua da formação inteira — níveis, insígnias, ranking
  // sobre um catálogo que o comprador avulso não abre. Deixá-la aberta seria
  // mostrar a ele uma pontuação que ele não tem como subir.
  const acesso = await verificarAcessoConteudo()
  if (!acesso.permitido) return <AssinaturaNecessaria nav={nav} logado={acesso.logado} secao="A gamificação" />

  const dados = await carregarGamificacaoJornada()
  return <GamificacaoJornadaContent dados={dados} nav={nav} />
}

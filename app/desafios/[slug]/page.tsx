// app/desafios/[slug]/page.tsx
import { notFound, redirect } from 'next/navigation'
import { carregarDesafio } from '@/lib/queries/desafio'
import { carregarNav } from '@/lib/queries/nav'
import DesafioContent from '@/components/DesafioContent'
import { verificarAcessoConteudo } from '@/lib/acesso/verificar'
import AssinaturaNecessaria from '@/components/AssinaturaNecessaria'

export const dynamic = 'force-dynamic'

export default async function PaginaDesafio({ params }: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const [dados, nav] = await Promise.all([carregarDesafio(slug), carregarNav()])
  // carregarDesafio devolve null tanto sem login quanto sem desafio visível. Desafio
  // restrito para quem não foi convidado some pela RLS: logado, isso é 404, não login.
  if (!dados) {
    if (!nav.logado) redirect('/login')
    notFound()
  }

  // No desafio restrito o convite é o acesso: a RLS só entrega a linha a quem está
  // na lista, e o candidato da seleção não precisa ser assinante.
  if (!dados.desafio.restrito) {
    const acesso = await verificarAcessoConteudo()
    if (!acesso.permitido) return <AssinaturaNecessaria nav={nav} logado={acesso.logado} />
  }

  return <DesafioContent dados={dados} nav={nav} />
}

export async function generateMetadata({ params }: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const dados = await carregarDesafio(slug)
  if (!dados?.desafio) return { title: 'Desafio · Peritos Academy' }
  const entrega = dados.desafio.correcao_manual ? 'laudo e planilha' : `${dados.desafio.quesitos_total} quesitos`
  return {
    title: `Desafio #${dados.desafio.numero} · ${dados.desafio.titulo} · Peritos Academy`,
    description: `Perícia sob pressão: ${entrega}, ${dados.desafio.prazo_dias} dias de prazo.`,
  }
}

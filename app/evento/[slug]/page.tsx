// ══════════════════════════════════════════════════════════════════
// app/evento/[slug]/page.tsx — A PORTA DO CONVITE
//
// Rota pública, sem login: é o endereço que se cola no WhatsApp da turma.
// Ver lib/queries/evento-publico.ts para o que é público e o que não é (o
// link da sala não é).
// ══════════════════════════════════════════════════════════════════
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { carregarEventoPublico } from '@/lib/queries/evento-publico'
import EventoPublicoContent from '@/components/EventoPublicoContent'
import { SITE_URL } from '@/lib/site'

export const dynamic = 'force-dynamic'

export default async function PaginaEventoPublico({ params }: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const ev = await carregarEventoPublico(slug)
  if (!ev) notFound()
  return <EventoPublicoContent ev={ev} />
}

/**
 * ⚠️ ESTA FUNÇÃO É A METADE DO RECURSO.
 *
 * Link colado em conversa de WhatsApp não é lido: é *visto*. O que decide se
 * alguém clica é o cartão que o aplicativo monta sozinho — título, uma linha
 * de descrição e a imagem. Sem estas tags o convite chega como uma tira de
 * texto azul escrito "evolua.peritosacademy.com.br", que some no meio da
 * conversa e não diz nem que dia é o evento.
 *
 * Por isso a descrição começa pela DATA, e não pelo texto do evento: é a
 * primeira linha que o cartão mostra e quase sempre a única que cabe.
 *
 * As URLs são absolutas de propósito — o robô que monta a prévia não tem
 * origem para resolver caminho relativo, e uma imagem relativa simplesmente
 * não aparece. Vêm de SITE_URL, a única linha que sabe o endereço.
 */
export async function generateMetadata({ params }: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const ev = await carregarEventoPublico(slug)
  if (!ev) return { title: 'Evento não encontrado · Peritos Academy' }

  const quando = ev.iniciaEm
    ? maiusculaInicial(
        new Intl.DateTimeFormat('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          weekday: 'long', day: 'numeric', month: 'long',
          hour: '2-digit', minute: '2-digit',
        }).format(new Date(ev.iniciaEm)).replace(',', ' ·'),
      ) + ' (Brasília)'
    : null

  const descricao = cortarEmPalavra(
    [quando, ev.descricao?.trim() || (ev.apresentadorNome ? `Com ${ev.apresentadorNome}.` : null)]
      .filter(Boolean).join(' · '),
    190,
  )

  const url = `${SITE_URL}/evento/${ev.slug}`
  // A figura do cartão: a do evento; na falta dela, a da plataforma. Sem
  // nenhuma das duas o WhatsApp monta um cartão só de texto — funciona, mas
  // rende muito menos clique. O admin avisa disso ao copiar o link.
  const imagem = ev.imagemUrl ?? ev.imagemPadraoUrl ?? null

  return {
    title: `${ev.titulo} · ${ev.nomePlataforma}`,
    description: descricao,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      siteName: ev.nomePlataforma,
      title: ev.titulo,
      description: descricao,
      locale: 'pt_BR',
      ...(imagem ? { images: [{ url: imagem }] } : {}),
    },
    twitter: {
      card: imagem ? 'summary_large_image' : 'summary',
      title: ev.titulo,
      description: descricao,
      ...(imagem ? { images: [imagem] } : {}),
    },
  }
}

function maiusculaInicial(t: string) {
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/**
 * Corta no espaço anterior ao limite, e não no caractere exato.
 * O cartão do WhatsApp é lido de relance: terminar em "onde a capita" faz o
 * convite parecer quebrado, que é a leitura mais cara possível para um link
 * que a pessoa ainda não decidiu se abre.
 */
function cortarEmPalavra(texto: string, limite: number) {
  if (texto.length <= limite) return texto
  const corte = texto.slice(0, limite)
  const espaco = corte.lastIndexOf(' ')
  return (espaco > limite * 0.6 ? corte.slice(0, espaco) : corte).replace(/[\s,.;:·-]+$/, '') + '…'
}

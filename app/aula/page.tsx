// ══════════════════════════════════════════════════════════════════
// app/aula — O ENDEREÇO QUE NÃO MUDA
//
// Cada quarta é um evento próprio, com slug próprio (ver `repetirEvento`, e o
// porquê de não existir evento recorrente neste banco). A consequência
// operacional é ruim: o link muda toda semana, e um e-mail, um anúncio ou a bio
// do Instagram não podem depender de alguém trocar a URL sete dias por vez.
//
// `evolua.peritosacademy.com.br/aula` resolve isso: ele leva sempre ao próximo
// encontro aberto. Uma vez colado, vale para sempre.
//
// ⚠️ Ele NÃO é uma segunda página de evento. É um desvio para a de sempre —
// duas telas descrevendo o mesmo encontro divergiriam no dia em que alguém
// editasse uma só.
// ══════════════════════════════════════════════════════════════════
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { criarClienteServico } from '@/lib/supabase/servico'

export const dynamic = 'force-dynamic'

/**
 * ⚠️ FORA DO ÍNDICE, de propósito.
 *
 * O conteúdo desta URL muda toda semana. Indexada, o Google guardaria o
 * resumo do encontro de agosto e o mostraria em outubro — e quem clicasse
 * chegaria esperando outra coisa. Quem tem que estar no índice é
 * `/evento/<slug>`, que descreve um encontro e não muda mais.
 */
export const metadata: Metadata = {
  title: 'A próxima aula ao vivo · Peritos Academy',
  robots: { index: false, follow: true },
}

export default async function PaginaProximaAula() {
  const supabase = criarClienteServico()
  const agora = new Date().toISOString()

  // ⚠️ O corte é por `inicia_em >= agora`, e não pelo fim do encontro.
  //
  // Parece mais generoso incluir a live que começou há dez minutos — e é, se
  // houver só ela. Mas com o próximo encontro já marcado, quem clica às 11h05
  // precisa cair na sala que está NO AR, não na da semana que vem. Por isso a
  // busca do que está acontecendo agora vem primeiro, e separada.
  const emAndamento = await supabase
    .from('eventos')
    .select('slug, inicia_em, duracao_seg')
    .eq('publicado', true)
    .eq('aberto_ao_publico', true)
    .lte('inicia_em', agora)
    .order('inicia_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  const ev = emAndamento.data
  if (ev?.slug && ev.inicia_em) {
    const fim = +new Date(ev.inicia_em) + (ev.duracao_seg ?? 3600) * 1000
    if (Date.now() < fim) redirect(`/evento/${ev.slug}`)
  }

  const { data: proximo } = await supabase
    .from('eventos')
    .select('slug')
    .eq('publicado', true)
    .eq('aberto_ao_publico', true)
    .gte('inicia_em', agora)
    .order('inicia_em', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (proximo?.slug) redirect(`/evento/${proximo.slug}`)

  // ── Não há próxima marcada ──
  //
  // ⚠️ Cair no encontro PASSADO seria pior que esta tela. A página de um
  // evento encerrado não mostra o formulário de reserva: quem veio pelo e-mail
  // de hoje encontraria um convite de duas semanas atrás, sem nada para
  // clicar, e concluiria que a live acabou para sempre. Aqui pelo menos a
  // frase é verdadeira e há para onde ir.
  return (
    <div className="pagina-evento">
      <div className="grao" aria-hidden="true"></div>
      <main className="ev-corpo">
        <div className="ev-wrap">
          <article className="ev-cartao">
            <div className="ev-info">
              <h1>A próxima aula ainda não está marcada.</h1>
              <p className="ev-desc">
                Os encontros ao vivo acontecem toda semana. Assim que o próximo estiver com data,
                ele aparece aqui — e neste mesmo endereço.
              </p>
              <div className="ev-porta-acao">
                <a className="btn btn-primario" href="https://www.nexuspericial.com.br/inicio" target="_blank" rel="noreferrer">
                  Conhecer o Nexxus Pericial
                </a>
                <a className="btn btn-fantasma" href="/login">Já sou aluno, quero entrar</a>
              </div>
            </div>
          </article>
        </div>
      </main>
    </div>
  )
}

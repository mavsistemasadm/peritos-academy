'use client'

// ══════════════════════════════════════════════════════════════════
// components/PainelDuvidasDaLive.tsx — AS DÚVIDAS NA TELA DE QUEM CONDUZ
//
// Pedido do dono (18/10/2026): ao abrir o link da live logado como admin, as
// dúvidas estão ali, com os anexos e a baixa, sem ir procurar no /admin.
// Durante a live é ESTA a página aberta (o mesmo motivo do interruptor da
// oferta). Para quem conduz, ocupa o lugar do formulário "Mande sua dúvida".
//
// As dúvidas vêm por action (listarDuvidas), nunca na carga da página: a
// página do evento é pública e cacheável por natureza, e o texto e o email de
// quem perguntou não podem viajar no HTML dela.
// ══════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from 'react'
import { listarDuvidas, marcarDuvida, linkDoAnexo, type DuvidaDoPainel } from '@/app/admin/agenda/[id]/duvidas/actions'
import { IconeCheck, IconePaperclip } from '@/components/Icones'

const hora = (iso: string) => new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
}).format(new Date(iso)).replace(',', ' às')
const tamanho = (b: number) => b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`

export default function PainelDuvidasDaLive({ eventoId }: { eventoId: string }) {
  const [duvidas, setDuvidas] = useState<DuvidaDoPainel[] | null>(null)
  const [erro, setErro] = useState('')
  const [verRespondidas, setVerRespondidas] = useState(false)
  const [ocupado, setOcupado] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    const r = await listarDuvidas(eventoId)
    if (r.ok) { setDuvidas(r.duvidas); setErro('') } else setErro(r.erro)
  }, [eventoId])

  // Dúvida continua chegando com a live no ar: a lista se atualiza sozinha.
  useEffect(() => {
    carregar()
    const t = setInterval(() => { if (!document.hidden) carregar() }, 20_000)
    return () => clearInterval(t)
  }, [carregar])

  async function alternar(d: DuvidaDoPainel) {
    const alvo = !d.respondida
    setDuvidas(l => l?.map(x => x.id === d.id ? { ...x, respondida: alvo } : x) ?? null)
    const r = await marcarDuvida(d.id, alvo)
    if (!r.ok) { setErro(r.erro); carregar() }
  }

  async function abrir(id: string) {
    // A aba abre ANTES do await: aberta depois, o navegador trata como popup
    // e bloqueia, e o clique no anexo parece não fazer nada.
    const aba = window.open('', '_blank')
    setOcupado(id)
    const r = await linkDoAnexo(id)
    setOcupado(null)
    if (!r.ok) { aba?.close(); setErro(r.erro); return }
    if (aba) aba.location.href = r.url
    else window.location.href = r.url
  }

  const abertas = duvidas?.filter(d => !d.respondida) ?? []
  const respondidas = duvidas?.filter(d => d.respondida) ?? []
  const lista = verRespondidas ? respondidas : abertas

  return (
    <section id="duvida" className="ev-duvidas ev-painel-duv">
      <span className="ev-duvidas-eyebrow">Só você vê · quem conduz a live</span>
      <h2>Dúvidas recebidas</h2>
      <p className="ev-duvidas-sub">
        {duvidas === null
          ? 'Carregando…'
          : <><b>{abertas.length}</b> para responder · {respondidas.length} respondida{respondidas.length === 1 ? '' : 's'}. Atualiza sozinho a cada 20 segundos.</>}
      </p>

      <div className="ev-painel-abas" role="tablist">
        <button type="button" role="tab" aria-selected={!verRespondidas} className={!verRespondidas ? 'ativo' : ''} onClick={() => setVerRespondidas(false)}>Para responder ({abertas.length})</button>
        <button type="button" role="tab" aria-selected={verRespondidas} className={verRespondidas ? 'ativo' : ''} onClick={() => setVerRespondidas(true)}>Respondidas ({respondidas.length})</button>
      </div>

      {erro && <p className="ev-erro" role="alert">{erro}</p>}

      {duvidas !== null && lista.length === 0 && (
        <p className="ev-nota">
          {verRespondidas ? 'Nenhuma respondida ainda.' : duvidas.length ? 'Tudo respondido. As novas aparecem aqui sozinhas.' : 'Nenhuma dúvida ainda. Quando chegar, aparece aqui.'}
        </p>
      )}

      <ol className="ev-painel-lista">
        {lista.map(d => (
          <li key={d.id} className={d.respondida ? 'respondida' : ''}>
            <div className="ev-painel-topo">
              <span className="ev-painel-num">#{d.numero}</span>
              <b>{d.nome}</b>
              <span className={`ev-painel-selo${d.ehAluno ? ' aluno' : ''}`}>{d.ehAluno ? 'Aluno' : 'Convidado'}</span>
              <span className="ev-painel-meta">{d.email} · {hora(d.criadaEm)}</span>
            </div>
            <p className="ev-painel-texto">{d.texto}</p>
            <div className="ev-painel-acoes">
              {d.anexo && (
                <button type="button" className="btn btn-fantasma" disabled={ocupado === d.id} onClick={() => abrir(d.id)}>
                  <IconePaperclip size={14} strokeWidth={2} /> {ocupado === d.id ? 'Abrindo…' : `${d.anexo.nome} · ${tamanho(d.anexo.bytes)}`}
                </button>
              )}
              <button type="button" className={`btn ${d.respondida ? 'btn-fantasma' : 'btn-primario'}`} onClick={() => alternar(d)}>
                {d.respondida ? 'Reabrir' : <><IconeCheck size={14} strokeWidth={2.6} /> Respondida</>}
              </button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

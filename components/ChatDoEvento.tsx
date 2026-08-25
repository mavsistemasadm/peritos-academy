// ══════════════════════════════════════════════════════════════════
// components/ChatDoEvento.tsx — O CHAT DA CASA
//
// Substitui o chat do YouTube, que tinha um defeito fatal para o caso desta
// plataforma: para ESCREVER nele é preciso estar logado numa conta do Google,
// e dentro de um iframe esse login costuma nem funcionar. O convidado que
// deixou nome e email para assistir podia ler e não podia falar — justamente a
// pessoa que a live aberta existe para converter.
//
// Aqui fala quem está na página: aluno pela sessão, convidado pela inscrição.
//
// ── PRIMEIRO USO DE REALTIME NESTE PROJETO ──
//
// A tabela entrou na publicação `supabase_realtime` (ver a migração). O canal
// assina INSERT e UPDATE de `evento_mensagens` filtrado pelo evento, e o
// navegador de quem não tem conta consegue assinar porque a policy de leitura
// é pública para evento publicado.
//
// ⚠️ O UPDATE é assinado por causa da moderação: sem ele, uma mensagem
// escondida pelo apresentador continuaria na tela de quem já estava
// assistindo, que é exatamente de quem se quis esconder.
// ══════════════════════════════════════════════════════════════════
'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { criarClienteBrowser } from '@/lib/supabase/client'
import { enviarMensagemEvento } from '@/app/evento/[slug]/actions'
import type { MensagemEvento } from '@/lib/queries/evento-chat'
import { IconeMessageCircle, IconeSend } from '@/components/Icones'

const fmtHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit',
})

type Props = {
  eventoId: string
  inicial: MensagemEvento[]
  /** Quem não pode falar ainda vê tudo: ler é público, escrever é que exige. */
  podeFalar: boolean
  /** O que dizer a quem não pode falar. */
  motivoBloqueio: string
}

export default function ChatDoEvento({ eventoId, inicial, podeFalar, motivoBloqueio }: Props) {
  const [mensagens, setMensagens] = useState<MensagemEvento[]>(inicial)
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState('')
  const [pendente, start] = useTransition()
  const fim = useRef<HTMLDivElement>(null)
  const lista = useRef<HTMLDivElement>(null)
  // Só rola sozinho se a pessoa já estava no fim. Puxar a tela de volta de
  // alguém que subiu para reler é o jeito mais rápido de tornar o chat inútil
  // no momento em que ele fica movimentado.
  const coladoNoFim = useRef(true)

  useEffect(() => {
    const supabase = criarClienteBrowser()
    const canal = supabase
      .channel(`evento-chat-${eventoId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'evento_mensagens', filter: `evento_id=eq.${eventoId}` },
        payload => {
          const m = payload.new as Record<string, unknown>
          if (m.oculta_em) return
          setMensagens(atual => atual.some(x => x.id === m.id)
            ? atual
            : [...atual, {
                id: String(m.id),
                autorNome: String(m.autor_nome),
                ehApresentador: !!m.eh_apresentador,
                texto: String(m.texto),
                criadoEm: String(m.criado_em),
                minha: false,
              }])
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'evento_mensagens', filter: `evento_id=eq.${eventoId}` },
        payload => {
          const m = payload.new as Record<string, unknown>
          if (m.oculta_em) setMensagens(atual => atual.filter(x => x.id !== m.id))
        })
      .subscribe()

    return () => { supabase.removeChannel(canal) }
  }, [eventoId])

  useEffect(() => {
    if (coladoNoFim.current) fim.current?.scrollIntoView({ block: 'end' })
  }, [mensagens])

  function aoRolar() {
    const el = lista.current
    if (!el) return
    coladoNoFim.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    const conteudo = texto.trim()
    if (!conteudo) return
    setErro('')
    // Limpa o campo antes da resposta: num chat, o texto continuar lá depois de
    // apertar enter parece que não enviou, e a pessoa manda de novo.
    setTexto('')
    coladoNoFim.current = true
    start(async () => {
      const r = await enviarMensagemEvento(eventoId, conteudo)
      if (r.ok) {
        // O Realtime devolve a própria mensagem, mas com atraso de rede. Ela
        // entra aqui na hora e o INSERT que chegar depois é descartado pelo id.
        setMensagens(atual => atual.some(x => x.id === r.id) ? atual : [...atual, {
          id: r.id, autorNome: r.autorNome, ehApresentador: r.ehApresentador,
          texto: conteudo, criadoEm: new Date().toISOString(), minha: true,
        }])
      } else {
        setErro(r.erro)
        setTexto(conteudo)   // devolve o que a pessoa escreveu, para não perder
      }
    })
  }

  return (
    <div className="ev-chat">
      <div className="ev-chat-cab">
        <IconeMessageCircle size={13} strokeWidth={2} /> Chat da transmissão
        {mensagens.length > 0 && <span className="ev-chat-n num">{mensagens.length}</span>}
      </div>

      <div className="ev-chat-lista" ref={lista} onScroll={aoRolar}>
        {mensagens.length === 0 ? (
          <p className="ev-chat-vazio">Ninguém falou ainda. Pode começar.</p>
        ) : mensagens.map(m => (
          <div key={m.id} className={`ev-msg${m.minha ? ' minha' : ''}${m.ehApresentador ? ' apresentador' : ''}`}>
            <span className="ev-msg-quem">
              {m.autorNome}
              {m.ehApresentador && <i>apresentador</i>}
              <time>{fmtHora.format(new Date(m.criadoEm))}</time>
            </span>
            <span className="ev-msg-texto">{m.texto}</span>
          </div>
        ))}
        <div ref={fim} />
      </div>

      {podeFalar ? (
        <form className="ev-chat-forma" onSubmit={enviar}>
          <input
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder="Escreva sua pergunta"
            maxLength={500}
            aria-label="Sua mensagem"
          />
          <button type="submit" disabled={pendente || !texto.trim()} aria-label="Enviar">
            <IconeSend size={15} strokeWidth={2} />
          </button>
        </form>
      ) : (
        <p className="ev-chat-bloqueio">{motivoBloqueio}</p>
      )}
      {erro && <p className="ev-chat-erro" role="alert">{erro}</p>}
    </div>
  )
}

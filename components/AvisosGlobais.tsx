// components/AvisosGlobais.tsx
// Sistema global de avisos: popup de novidades (abre sozinho quando
// há novidade não lida) + sino flutuante com as notificações pessoais.
'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import {
  marcarTodasNovidadesLidas,
  marcarNotificacaoLida,
  marcarTodasNotificacoesLidas,
  buscarMaisNotificacoes,
} from '@/app/avisos/actions'
import type { DadosAvisos, Notificacao } from '@/lib/queries/avisos'
import { IconeBell, IconeClose, IconeMegaphone, IconeMessageCircle, IconeCalendar, IconeMap, IconeCheck, IconeSend, IconeStar } from '@/components/Icones'
import { Trofeu, Certificado, FogoStreak, XP, SeloNivel } from '@/components/Emblemas'

const fmtData = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
})
function dataCurta(iso: string) {
  // "sáb., 11 de jul., 2026" -> "Sáb, 11 Jul 2026"
  return fmtData.format(new Date(iso))
    .replace(/\./g, '').replace(/ de /g, ' ')
    .replace(/^\w/, c => c.toUpperCase())
    .replace(/ (\w)(\w{2}) /, (m, a, b) => ` ${a.toUpperCase()}${b} `)
}
function tempoRelativo(iso: string) {
  const min = Math.floor((Date.now() - +new Date(iso)) / 60000)
  if (min < 60) return min <= 1 ? 'agora' : `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  return d === 1 ? 'ontem' : `há ${d} dias`
}

const ICONE_NOTIF: Record<string, typeof IconeBell> = {
  comunidade: IconeMessageCircle, evento: IconeCalendar, jornada: IconeMap,
  modulo_concluido: IconeCheck, desafio_entrega: IconeSend,
  comunidade_resposta: IconeMessageCircle, duvida_respondida: IconeMessageCircle,
  comunidade_melhor_resposta: IconeStar,
}

// Conquista/status usa Nível 2 (Emblemas, variante mono); ação/navegação usa Nível 1 (Icones) — regra já documentada no CLAUDE.md.
function iconeNotificacao(n: Notificacao) {
  const nivelOrdem = typeof n.dados?.nivel_ordem === 'number' ? n.dados.nivel_ordem : undefined
  switch (n.emblema ?? n.tipo) {
    case 'selo_nivel':
    case 'nivel_up':
      return <SeloNivel variante="mono" size={14} nivel={nivelOrdem} />
    case 'trofeu':
    case 'avaliacao_aprovada':
      return <Trofeu variante="mono" size={14} />
    case 'certificado':
    case 'curso_concluido':
    case 'certificado_disponivel':
      return <Certificado variante="mono" size={14} />
    case 'fogo_streak':
    case 'streak':
      return <FogoStreak variante="mono" size={14} />
    case 'xp':
    case 'primeira_aula':
      return <XP variante="mono" size={14} />
    default: {
      const IconeTipo = ICONE_NOTIF[n.tipo] ?? IconeBell
      return <IconeTipo size={14} />
    }
  }
}

export default function AvisosGlobais({ dados }: { dados: DadosAvisos }) {
  const [popupAberto, setPopupAberto] = useState(false)
  const [sinoAberto, setSinoAberto] = useState(false)
  const [notifs, setNotifs] = useState<Notificacao[]>(dados.notificacoes)
  const [novidadesLidas, setNovidadesLidas] = useState(false)
  const [temMaisNotifs, setTemMaisNotifs] = useState(dados.notificacoes.length >= 12)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [, start] = useTransition()
  const areaSino = useRef<HTMLDivElement>(null)

  // popup automático: uma vez por carregamento, se houver novidade não lida
useEffect(() => {
    if (dados.temNovidadeNaoLida) {
      setPopupAberto(true)
      marcarTodasNovidadesLidas().catch(() => {})
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // fecha o dropdown do sino ao clicar fora / Esc
  useEffect(() => {
    if (!sinoAberto) return
    const fora = (e: MouseEvent) => {
      if (!areaSino.current?.contains(e.target as Node)) setSinoAberto(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setSinoAberto(false) }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [sinoAberto])

  if (!dados.logado) return null

  const novidadesNaoLidas = novidadesLidas ? 0 : dados.novidades.filter(n => !n.lida).length
  const notifsNaoLidas = notifs.filter(n => !n.lida).length
  const contador = novidadesNaoLidas + notifsNaoLidas

  function fecharPopup() { setPopupAberto(false) }

  function marcarTodasLidas() {
    setNovidadesLidas(true)   // otimista
    setPopupAberto(false)
    start(async () => { await marcarTodasNovidadesLidas() })
  }

  function clicarNotificacao(n: Notificacao) {
    if (!n.lida) {
      setNotifs(ns => ns.map(x => x.id === n.id ? { ...x, lida: true } : x))
      start(async () => { await marcarNotificacaoLida(n.id) })
    }
    if (n.link_url) location.href = n.link_url
  }

  function limparNotificacoes() {
    setNotifs(ns => ns.map(x => ({ ...x, lida: true })))
    start(async () => { await marcarTodasNotificacoesLidas() })
  }

  async function carregarMaisNotifs() {
    setCarregandoMais(true)
    const res = await buscarMaisNotificacoes(notifs.length)
    if (res.ok) {
      setNotifs(ns => [...ns, ...res.notificacoes])
      if (res.notificacoes.length < 12) setTemMaisNotifs(false)
    } else {
      setTemMaisNotifs(false)
    }
    setCarregandoMais(false)
  }

  return (
    <div className="avisos-globais">

      {/* ============ SINO FLUTUANTE ============ */}
      <div className="sino-area" ref={areaSino}>
        {sinoAberto && (
          <div className="sino-painel" role="menu" aria-label="Notificações">
            <div className="sino-cab">
              <b>Notificações</b>
              {notifsNaoLidas > 0 && (
                <button className="limpar" onClick={limparNotificacoes}>Marcar todas como lidas</button>
              )}
            </div>
            <ul className="sino-lista">
              {notifs.length === 0 && (
                <li className="sino-vazio">Nada por aqui — você está em dia.</li>
              )}
              {notifs.map(n => (
                <li key={n.id}>
                  <button className={`notif${n.lida ? '' : ' nao-lida'}`} onClick={() => clicarNotificacao(n)}>
                    <span className="notif-ico" aria-hidden="true">{iconeNotificacao(n)}</span>
                    <span className="notif-txt">
                      <span>{n.prefixo}<b>{n.destaque}</b>{n.sufixo}</span>
                      <small className="num">{tempoRelativo(n.criado_em)}</small>
                    </span>
                    {!n.lida && <span className="notif-ponto" aria-hidden="true"></span>}
                  </button>
                </li>
              ))}
            </ul>
            {temMaisNotifs && notifs.length > 0 && (
              <button className="sino-carregar-mais" onClick={carregarMaisNotifs} disabled={carregandoMais}>
                {carregandoMais ? 'Carregando…' : 'Carregar mais'}
              </button>
            )}
            {dados.novidades.length > 0 && (
              <button className="sino-novidades" onClick={() => { setSinoAberto(false); setPopupAberto(true) }}>
                <IconeMegaphone size={14} /> Ver últimas novidades
              </button>
            )}
          </div>
        )}

        <button
          className="sino-btn"
          data-tour="sino-notificacoes"
          aria-label={`Notificações${contador ? ` — ${contador} não lidas` : ''}`}
          aria-expanded={sinoAberto}
          onClick={() => setSinoAberto(a => !a)}
        >
          <IconeBell size={18} strokeWidth={2} />
          {contador > 0 && <span className="sino-badge num">{contador > 9 ? '9+' : contador}</span>}
        </button>
      </div>

      {/* ============ POPUP DE NOVIDADES ============ */}
      {popupAberto && (
        <div className="nov-overlay" role="dialog" aria-modal="true" aria-label="Últimas novidades" onClick={e => { if (e.target === e.currentTarget) fecharPopup() }}>
          <div className="nov-modal">
            <div className="nov-cab">
              <span className="nov-titulo"><IconeMegaphone size={16} /> Últimas novidades</span>
              <button className="nov-fechar" aria-label="Fechar" onClick={fecharPopup}><IconeClose size={14} /></button>
            </div>

            <div className="nov-corpo">
              {dados.novidades.map(n => (
                <article className="nov-item" key={n.id}>
                  <div className="nov-item-cab">
                    <h3>{n.titulo}{!n.lida && !novidadesLidas && n.selo === 'novo' && <span className="nov-selo">Novo</span>}</h3>
                    <time className="num">{dataCurta(n.criado_em)}</time>
                  </div>
                  {n.corpo.map((p, i) => <p key={i}>{p}</p>)}
                  {n.imagem_url && <img src={n.imagem_url} alt="" className="nov-img" />}
                  {n.link_url && (
                    <a className="nov-link" href={n.link_url}>
                      {n.link_rotulo ?? 'Saiba mais'} →
                    </a>
                  )}
                </article>
              ))}
            </div>

            <div className="nov-rodape">
              <button className="btn btn-fantasma" onClick={fecharPopup}>Fechar</button>
              <button className="btn btn-primario" onClick={marcarTodasLidas}>Marcar todas como lidas</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
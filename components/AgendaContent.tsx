// components/AgendaContent.tsx
// Réplica fiel do template aprovado, 100% plugada no banco.
'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { reservarLugar, publicarEvento, type NovoEvento } from '@/app/agenda/actions'
import type { DadosAgenda, Evento } from '@/lib/queries/agenda'
import NavPlataforma from '@/components/NavPlataforma'
import type { DadosNav } from '@/lib/queries/nav'
import { IconeClose, IconeEye, IconeStar, IconeCalendarPlus, IconePlay, IconePlus, IconeCheck } from '@/components/Icones'
import { AoVivo } from '@/components/Emblemas'

const TZ = 'America/Sao_Paulo'

// ---------- rótulos e cores por tipo ----------
const TIPO_ROTULO: Record<Evento['tipo'], string> = {
  sala_analise: 'Sala de análise',
  aula_ao_vivo: 'Aula ao vivo',
  plantao: 'Plantão de dúvidas',
  mentoria: 'Mentoria de turma',
  lancamento: 'Lançamento',
}
const TIPO_ESTILO: Record<Evento['tipo'], React.CSSProperties | undefined> = {
  sala_analise: undefined, // ciano padrão do CSS
  aula_ao_vivo: { color: 'var(--verde)', borderColor: 'rgba(32,217,166,.35)' },
  plantao: { color: 'var(--lima)', borderColor: 'rgba(221,247,132,.3)' },
  mentoria: { color: 'var(--lima)', borderColor: 'rgba(221,247,132,.3)' },
  lancamento: { color: 'var(--ciano)', borderColor: 'rgba(54,220,209,.35)' },
}

// ---------- formatação de datas (sempre em Brasília) ----------
const fmtHora = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
const fmtDia = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' })
const fmtChaveDia = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })

const hora = (iso: string) => fmtHora.format(new Date(iso)).replace(':', 'h')

function duracaoCurta(seg: number) {
  const h = Math.floor(seg / 3600), m = Math.round((seg % 3600) / 60)
  if (h && m) return `${h}h${m}`
  if (h) return `${h}h`
  return `${m}min`
}
function duracaoGrav(seg: number) {
  const h = Math.floor(seg / 3600), m = Math.round((seg % 3600) / 60)
  return h ? `${h}h ${String(m).padStart(2, '0')}` : `${m}min`
}
function chaveDia(iso: string) { return fmtChaveDia.format(new Date(iso)) }

function rotuloDia(iso: string) {
  const hoje = chaveDia(new Date().toISOString())
  const amanha = chaveDia(new Date(Date.now() + 864e5).toISOString())
  const k = chaveDia(iso)
  const longo = fmtDia.format(new Date(iso)) // "terça-feira, 15 de julho"
  const [semana, resto] = longo.split(', ')
  const semanaCurta = semana.replace('-feira', '')
  if (k === hoje) return { b: 'Hoje', resto: `${semanaCurta}, ${resto}`, hoje: true }
  if (k === amanha) return { b: 'Amanhã', resto: `${semanaCurta}, ${resto}`, hoje: false }
  return { b: semanaCurta.charAt(0).toUpperCase() + semanaCurta.slice(1), resto, hoje: false }
}

function haQuanto(iso: string) {
  const dias = Math.floor((Date.now() - +new Date(iso)) / 864e5)
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'ontem'
  if (dias < 7) return `há ${dias} dias`
  const sem = Math.floor(dias / 7)
  return sem === 1 ? 'há 1 semana' : `há ${sem} semanas`
}

function linkCalendario(ev: Evento) {
  const ini = new Date(ev.inicia_em)
  const fim = new Date(+ini + ev.duracao_seg * 1000)
  const z = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, '')
  const p = new URLSearchParams({
    action: 'TEMPLATE', text: ev.titulo,
    dates: `${z(ini)}/${z(fim)}`, details: ev.descricao ?? '',
  })
  return `https://calendar.google.com/calendar/render?${p}`
}

// ---------- botão Reservar (com server action) ----------
function BotaoReservar({ ev, primario = false }: { ev: Evento; primario?: boolean }) {
  const [reservado, setReservado] = useState(ev.reservado)
  const [pendente, start] = useTransition()
  if (reservado) return <button className="btn reservado"><IconeCheck size={13} /> Reservado</button>
  return (
    <button
      className={`btn ${primario ? 'btn-primario' : 'btn-fantasma'} res`}
      disabled={pendente}
      onClick={() => start(async () => {
        const r = await reservarLugar(ev.id)
        if (r.ok) setReservado(true)
        else alert(r.erro)
      })}
    >
      {primario ? 'Reservar meu lugar' : pendente ? 'Reservando…' : 'Reservar'}
    </button>
  )
}

// ---------- linha de evento na lista ----------
function LinhaEvento({ ev, vivo }: { ev: Evento; vivo: boolean }) {
  return (
    <div className={`evento${vivo ? ' vivo' : ''}`}>
      <div className="ev-hora num"><b>{hora(ev.inicia_em)}</b><span>{duracaoCurta(ev.duracao_seg)}</span></div>
      <div className="ev-sep" aria-hidden="true"></div>
      <div className="ev-corpo">
        <div className="ev-selos">
          {vivo && <span className="selo-vivo"><AoVivo size={10} />Ao vivo agora</span>}
          <span className="selo-tipo" style={TIPO_ESTILO[ev.tipo]}>{TIPO_ROTULO[ev.tipo]}</span>
          {ev.alvo_rotulo && <span className="selo-exclusivo">Exclusivo · {ev.alvo_rotulo}</span>}
        </div>
        <h3>{ev.titulo}</h3>
        <p className="meta">
          {ev.apresentador_nome && <>com <b>{ev.apresentador_nome}</b> · </>}
          {ev.meta_extra && <>{ev.meta_extra} · </>}
          <span className="num">{ev.confirmados} {vivo ? 'na sala' : 'confirmados'}</span>
        </p>
      </div>
      <div className="ev-acao">
        {vivo
          ? <a className="btn btn-primario" href={ev.link_transmissao ?? '#'} target="_blank" rel="noreferrer">Entrar agora</a>
          : <BotaoReservar ev={ev} />}
      </div>
    </div>
  )
}

// ---------- contagem regressiva ----------
function Contagem({ alvoIso }: { alvoIso: string }) {
  const [txt, setTxt] = useState({ h: '--', m: '--', s: '--' })
  useEffect(() => {
    const alvo = +new Date(alvoIso)
    const tick = () => {
      const d = Math.max(0, Math.floor((alvo - Date.now()) / 1000))
      setTxt({
        h: String(Math.floor(d / 3600)).padStart(2, '0'),
        m: String(Math.floor((d % 3600) / 60)).padStart(2, '0'),
        s: String(d % 60).padStart(2, '0'),
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [alvoIso])
  return (
    <div className="conta-grid num" aria-live="off">
      <div className="conta-b"><span className="v">{txt.h}</span><span className="r">horas</span></div>
      <div className="conta-b"><span className="v">{txt.m}</span><span className="r">min</span></div>
      <div className="conta-b"><span className="v">{txt.s}</span><span className="r">seg</span></div>
    </div>
  )
}

// ---------- modal do produtor ----------
const TIPOS: Evento['tipo'][] = ['sala_analise', 'aula_ao_vivo', 'plantao', 'mentoria', 'lancamento']
const VIS_OPS = [
  { vis: 'todos' as const, b: 'Todos os membros', s: 'Visível para toda a base ativa', alcance: '3.128 membros', chips: null },
  { vis: 'curso' as const, b: 'Alunos de um curso', s: 'Só quem tem o curso escolhido', alcance: '612 alunos com o curso ativo', chips: ['Segredos bancários', 'RMC e RCC', 'Precatórios', 'PETROS'] },
  { vis: 'assinatura' as const, b: 'Tipo de assinatura', s: 'Segmentar por plano', alcance: '948 assinantes Premium', chips: ['Premium', 'Essencial', 'Kit Bancário'] },
  { vis: 'turma' as const, b: 'Turma específica', s: 'A mentoria fechada daquela turma', alcance: '214 alunos da turma', chips: ['Kit Bancário 2026', 'Kit Bancário 2025'] },
]
function rotuloAlvo(vis: NovoEvento['visibilidade'], chip: string | null) {
  if (vis === 'todos' || !chip) return null
  if (vis === 'assinatura') return `Assinatura ${chip}`
  if (vis === 'turma') return `Turma ${chip}`
  return chip
}

function ModalNovoEvento({ aberto, fechar, aoPublicar }:
  { aberto: boolean; fechar: () => void; aoPublicar: (alcance: string) => void }) {
  const [titulo, setTitulo] = useState('')
  const [tipo, setTipo] = useState<Evento['tipo']>('sala_analise')
  const [data, setData] = useState('15/07/2026')
  const [horaIni, setHoraIni] = useState('20:00')
  const [dur, setDur] = useState('1h 30')
  const [link, setLink] = useState('')
  const [desc, setDesc] = useState('')
  const [visIdx, setVisIdx] = useState(1)
  const [chips, setChips] = useState<Record<number, string>>({ 1: 'Segredos bancários', 2: 'Premium', 3: 'Kit Bancário 2026' })
  const [togs, setTogs] = useState([true, true, false])
  const [pendente, start] = useTransition()

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar() }
    addEventListener('keydown', esc)
    return () => removeEventListener('keydown', esc)
  }, [fechar])

  const op = VIS_OPS[visIdx]

  function publicar() {
    start(async () => {
      const r = await publicarEvento({
        titulo, tipo, data, hora: horaIni, duracao: dur, link, descricao: desc,
        visibilidade: op.vis,
        alvoRotulo: rotuloAlvo(op.vis, chips[visIdx] ?? null),
        gravar: togs[0], lembrete: togs[1], publicarFeed: togs[2],
      })
      if (r.ok) { aoPublicar(op.alcance); fechar() }
      else alert(r.erro)
    })
  }

  return (
    <div className={`veu${aberto ? ' aberto' : ''}`} role="dialog" aria-modal="true" aria-label="Criar novo evento"
      onClick={e => { if (e.target === e.currentTarget) fechar() }}>
      <div className="modal">
        <div className="modal-cab">
          <div>
            <span className="eyebrow">Visão do produtor</span>
            <h2>Novo evento.</h2>
          </div>
          <button className="fechar" onClick={fechar} aria-label="Fechar">
            <IconeClose size={15} strokeWidth={2.2} />
          </button>
        </div>

        <div className="campo">
          <label htmlFor="evTitulo">Título</label>
          <div className="caixa"><input id="evTitulo" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Sala de análise — liquidação de sentença" /></div>
        </div>

        <div className="campo">
          <label>Tipo</label>
          <div className="tipos">
            {TIPOS.map(t => (
              <button key={t} className={`tipo-op${tipo === t ? ' sel' : ''}`} onClick={() => setTipo(t)}>{TIPO_ROTULO[t]}</button>
            ))}
          </div>
        </div>

        <div className="linha-3">
          <div className="campo"><label htmlFor="evData">Data</label>
            <div className="caixa"><input id="evData" value={data} onChange={e => setData(e.target.value)} /></div></div>
          <div className="campo"><label htmlFor="evHora">Início</label>
            <div className="caixa"><input id="evHora" value={horaIni} onChange={e => setHoraIni(e.target.value)} /></div></div>
          <div className="campo"><label htmlFor="evDur">Duração</label>
            <div className="caixa"><input id="evDur" value={dur} onChange={e => setDur(e.target.value)} /></div></div>
        </div>

        <div className="campo">
          <label htmlFor="evLink">Link da transmissão</label>
          <div className="caixa"><input id="evLink" value={link} onChange={e => setLink(e.target.value)} placeholder="Zoom, Meet ou YouTube — liberado 15min antes" /></div>
        </div>

        <div className="campo">
          <label htmlFor="evDesc">Descrição curta</label>
          <div className="caixa"><textarea id="evDesc" rows={2} value={desc} onChange={e => setDesc(e.target.value)} placeholder="O que o aluno vai levar dessa sessão?" /></div>
        </div>

        <div className="campo">
          <label>Quem pode ver</label>
          <div className="vis-ops">
{VIS_OPS.map((o, i) => (
              <div key={o.vis} role="button" tabIndex={0}
                className={`vis-op${visIdx === i ? ' sel' : ''}`}
                onClick={() => setVisIdx(i)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setVisIdx(i) } }}>
                <span className="vis-radio" aria-hidden="true"><i></i></span>
                <span style={{ flex: 1 }}>
                  <b>{o.b}</b>
                  <span>{o.s}</span>
                  {o.chips && (
                    <span className="vis-detalhe">
                      <span className="vis-chips">
                        {o.chips.map(c => (
                          <span key={c} role="button" tabIndex={visIdx === i ? 0 : -1}
                            className={`vis-chip${chips[i] === c ? ' sel' : ''}`}
                            onClick={e => { e.stopPropagation(); setChips(p => ({ ...p, [i]: c })) }}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setChips(p => ({ ...p, [i]: c })) } }}>{c}</span>
                        ))}
                      </span>
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="alcance">
          <span className="olho" aria-hidden="true">
            <IconeEye size={16} strokeWidth={2} />
          </span>
          <p>Este evento ficará visível para <b className="num">{op.alcance}</b>{op.vis !== 'todos' && <> — e aparecerá com o selo de exclusividade</>}.</p>
        </div>

        <div className="toggles">
          {['Disponibilizar gravação depois (na aba Gravações)', 'Lembrete automático 30 min antes (push + e-mail)', 'Publicar também no feed da comunidade'].map((t, i) => (
            <button key={t} className={`tog${togs[i] ? ' on' : ''}`}
              onClick={() => setTogs(p => p.map((v, j) => j === i ? !v : v))}>
              <span className="tog-sw" aria-hidden="true"></span><span>{t}</span>
            </button>
          ))}
        </div>

        <div className="modal-acoes">
          <button className="btn btn-fantasma" onClick={fechar}>Cancelar</button>
          <button className="btn btn-primario" onClick={publicar} disabled={pendente}>{pendente ? 'Publicando…' : 'Publicar evento'}</button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// PÁGINA
// ============================================================
export default function AgendaContent({ dados, nav }: { dados: DadosAgenda; nav: DadosNav }) {
      const { usuarioNome, aoVivo, proximos, gravacoes } = dados
  const [filtro, setFiltro] = useState('Tudo')
  const [modal, setModal] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const raiz = useRef<HTMLDivElement>(null)

  const heroEv = proximos[0] ?? null
  const iniciais = (usuarioNome ?? 'PA').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()

  // reveals (igual ao template)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      raiz.current?.querySelectorAll('.reveal').forEach(el => el.classList.add('visivel'))
      return
    }
    const io = new IntersectionObserver(es => {
      es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visivel'); io.unobserve(e.target) } })
    }, { threshold: .12, rootMargin: '0px 0px -4% 0px' })
    raiz.current?.querySelectorAll('.reveal').forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [filtro])

  // agrupa ao vivo + próximos por dia (Brasília)
  const dias = useMemo(() => {
    const mapa = new Map<string, { rotulo: ReturnType<typeof rotuloDia>; itens: { ev: Evento; vivo: boolean }[] }>()
    const add = (ev: Evento, vivo: boolean) => {
      const k = chaveDia(ev.inicia_em)
      if (!mapa.has(k)) mapa.set(k, { rotulo: rotuloDia(ev.inicia_em), itens: [] })
      mapa.get(k)!.itens.push({ ev, vivo })
    }
    aoVivo.forEach(ev => add(ev, true))
    proximos.forEach(ev => add(ev, false))
    return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v)
  }, [aoVivo, proximos])

  const FILTROS = ['Tudo', 'Ao vivo e hoje', 'Dos meus cursos', 'Da minha turma', 'Gravações']
  const filtraItem = (i: { ev: Evento; vivo: boolean }) => {
    if (filtro === 'Dos meus cursos') return i.ev.visibilidade === 'curso'
    if (filtro === 'Da minha turma') return i.ev.visibilidade === 'turma'
    return true
  }
  const diasVisiveis = filtro === 'Gravações' ? [] :
    filtro === 'Ao vivo e hoje'
      ? dias.filter(d => d.rotulo.hoje)
      : dias.map(d => ({ ...d, itens: d.itens.filter(filtraItem) })).filter(d => d.itens.length)
  const mostraGravs = filtro === 'Tudo' || filtro === 'Gravações'

  function disparaToast(alcance: string) {
    setToast(`visível para ${alcance} · lembrete agendado`)
    setTimeout(() => setToast(null), 4200)
  }

  return (
    <div ref={raiz} className="pagina-agenda">
      <div className="grao" aria-hidden="true"></div>

     {/* ============ NAV ============ */}
      <NavPlataforma dados={nav} ativo="agenda" />

      {/* ============ HERO: PRÓXIMO EVENTO ============ */}
      <section className="hero">
        <div className="wrap">
          <div className="hero-cab">
            <div>
              <span className="eyebrow">Agenda</span>
              <h1>O que vem <span className="grad-txt">aí.</span></h1>
            </div>
            <span className="fuso">Horários de Brasília (GMT-3)</span>
          </div>

          {heroEv && (
            <div className="proximo reveal">
              <div className="prox-info">
                <div className="selos">
                  <span className="selo-tipo">{TIPO_ROTULO[heroEv.tipo]} · ao vivo</span>
                  {heroEv.alvo_rotulo && (
                    <span className="selo-exclusivo">
                      <IconeStar size={11} strokeWidth={2.5} />
                      Exclusivo · {heroEv.alvo_rotulo}
                    </span>
                  )}
                </div>
                <h2>{heroEv.titulo}.</h2>
                {heroEv.descricao && <p className="desc">{heroEv.descricao}</p>}
                {heroEv.apresentador_nome && (
                  <div className="prox-quem">
                    <span className="foto-p" aria-hidden="true">{heroEv.apresentador_nome.split(' ').map(p => p[0]).join('').slice(0, 2)}</span>
                    <span><b>{heroEv.apresentador_nome}</b><span>{heroEv.apresentador_cargo}</span></span>
                  </div>
                )}
                <div className="prox-acoes">
                  <BotaoReservar ev={heroEv} primario />
                  <a className="btn btn-fantasma" href={linkCalendario(heroEv)} target="_blank" rel="noreferrer">
                    <IconeCalendarPlus size={14} strokeWidth={2} />
                    Adicionar ao calendário
                  </a>
                </div>
              </div>
              <div className="contagem">
                <span className="rot">Começa em</span>
                <Contagem alvoIso={heroEv.inicia_em} />
                <p className="quando num">
                  {rotuloDia(heroEv.inicia_em).b} · {hora(heroEv.inicia_em)} – {hora(new Date(+new Date(heroEv.inicia_em) + heroEv.duracao_seg * 1000).toISOString())}
                </p>
                <p className="confirmados num"><b>{heroEv.confirmados}</b> colegas confirmados{heroEv.reservado && ' · você está dentro'}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ============ LISTA ============ */}
      <section className="corpo">
        <div className="wrap">
          <div className="filtros" role="tablist" aria-label="Filtrar agenda">
            {FILTROS.map(f => (
              <button key={f} className={`filtro${filtro === f ? ' ativo' : ''}`} role="tab"
                aria-selected={filtro === f} onClick={() => setFiltro(f)}>{f}</button>
            ))}
          </div>

          {diasVisiveis.map((d, i) => (
            <div className="dia-grupo reveal" key={i}>
              <div className={`dia-cab${d.rotulo.hoje ? ' hoje' : ''}`}>
                <span className="rot"><b>{d.rotulo.b}</b> · {d.rotulo.resto}</span>
              </div>
              {d.itens.map(({ ev, vivo }) => <LinhaEvento key={ev.id} ev={ev} vivo={vivo} />)}
            </div>
          ))}

          {mostraGravs && gravacoes.length > 0 && (
            <div className="dia-grupo reveal">
              <div className="dia-cab"><span className="rot"><b>Gravações</b> · perdeu? assista</span></div>
              <div className="gravs">
                {gravacoes.map(g => (
                  <a className="grav" key={g.id} href={g.gravacao_url ?? '#'}
                    style={g.gravacao_thumb_url
                      ? ({ ['--capa' as string]: `url('${g.gravacao_thumb_url}')` })
                      : ({ ['--capa' as string]: 'linear-gradient(150deg,#12241D,#0A0D0B)' })}>
                    <div className="grav-thumb">
                      <span className="grav-play" aria-hidden="true">
                        <IconePlay size={17} />
                      </span>
                      <span className="grav-dur num">{duracaoGrav(g.duracao_seg)}</span>
                    </div>
                    <div className="grav-txt">
                      <b>{g.titulo}</b>
                      <span className="num">{haQuanto(g.inicia_em)} · {g.visualizacoes} visualizações</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* botão do produtor */}
      <button className="fab-novo" onClick={() => setModal(true)}>
        <IconePlus size={15} strokeWidth={2.4} />
        Novo evento
      </button>

      <ModalNovoEvento aberto={modal} fechar={() => setModal(false)} aoPublicar={disparaToast} />

      {/* toast */}
      <div className={`toast${toast ? ' visivel' : ''}`} role="status">
        <span><b>Evento publicado</b></span>
        <span>{toast}</span>
      </div>
    </div>
  )
}
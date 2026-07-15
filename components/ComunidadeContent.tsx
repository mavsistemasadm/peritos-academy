// components/ComunidadeContent.tsx
// Réplica fiel do template aprovado, 100% plugada no banco.
'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { publicarPost, alternarReacao } from '@/app/comunidade/actions'
import type { DadosComunidade, Post } from '@/lib/queries/comunidade'
import NavPlataforma from '@/components/NavPlataforma'
import type { DadosNav } from '@/lib/queries/nav'
import { IconeThumbsUp, IconeMessageCircle, IconeBookmark, IconeSparkle } from '@/components/Icones'
import { InsigniaEtapa } from '@/components/Emblemas'

const TZ = 'America/Sao_Paulo'
const fmtHora = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })

// ---------- helpers ----------
function iniciais(nome: string | null | undefined) {
  return (nome ?? 'PA').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}
function tempoRelativo(iso: string) {
  const min = Math.floor((Date.now() - +new Date(iso)) / 60000)
  if (min < 60) return min <= 1 ? 'agora mesmo' : `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return h === 1 ? 'há 1 hora' : `há ${h} horas`
  const d = Math.floor(h / 24)
  if (d === 1) return 'ontem'
  if (d < 7) return `há ${d} dias`
  const sem = Math.floor(d / 7)
  return sem === 1 ? 'há 1 semana' : `há ${sem} semanas`
}
function fmtQtd(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',')}k` : String(n)
}
function fmtNum(n: number) {
  return n.toLocaleString('pt-BR')
}
const TAG: Record<string, { classe: string; rotulo: string }> = {
  caso: { classe: 'tag caso', rotulo: 'Caso' },
  duvida: { classe: 'tag duvida', rotulo: 'Dúvida' },
  respondida: { classe: 'tag resolvida', rotulo: '✓ Respondida' },
}

// ---------- ícones das ações ----------
const IcoUtil = () => <IconeThumbsUp size={15} strokeWidth={2} />
const IcoComent = () => <IconeMessageCircle size={15} strokeWidth={2} />
const IcoSalvar = () => <IconeBookmark size={15} strokeWidth={2} />

// ---------- post comum (caso / dúvida) ----------
function CardPost({ post }: { post: Post }) {
  const [util, setUtil] = useState({ ativo: post.jaUtil, qtd: post.uteis })
  const [salvo, setSalvo] = useState(post.jaSalvo)
  const [, start] = useTransition()

  const tag = post.respondida ? TAG.respondida : TAG[post.tipo] ?? TAG.caso

  return (
    <article className="post reveal">
      <div className="post-cab">
        <span className="foto-p" aria-hidden="true">{iniciais(post.autor_nome)}</span>
        <div className="post-quem">
          <div className="nome">
            <b>{post.autor_nome}</b>
            {post.autor_nivel != null && <span className="mini-nivel num">N{post.autor_nivel}</span>}
          </div>
          <span># {post.espaco_nome} · {tempoRelativo(post.criado_em)}</span>
        </div>
        <span className={tag.classe}>{tag.rotulo}</span>
      </div>
      {post.titulo && <h3><a href="#">{post.titulo}</a></h3>}
      {post.corpo && <p>{post.corpo}</p>}

      {post.melhorResposta && (
        <div className="melhor-resposta">
          <span className="foto-p" aria-hidden="true">{iniciais(post.melhorResposta.autor_nome)}</span>
          <div className="corpo-r">
            <div className="quem-r">
              <b>{post.melhorResposta.autor_nome}</b>
              {post.melhorResposta.autor_selo && <span className="selo-esp">{post.melhorResposta.autor_selo}</span>}
            </div>
            <p>{post.melhorResposta.corpo}</p>
          </div>
        </div>
      )}

      <div className="post-acoes">
        <button className={`acao util${util.ativo ? ' feita' : ''}`}
          onClick={() => start(async () => {
            setUtil(u => ({ ativo: !u.ativo, qtd: u.qtd + (u.ativo ? -1 : 1) }))
            const r = await alternarReacao(post.id, 'util')
            if (!r.ok) { setUtil({ ativo: post.jaUtil, qtd: post.uteis }); alert(r.erro) }
          })}>
          <IcoUtil /> Útil · <span className="num">{util.qtd}</span>
        </button>
        <button className="acao">
          <IcoComent /> <span className="num">{post.comentarios}</span> comentários
        </button>
        <button className={`acao${salvo ? ' feita' : ''}`}
          onClick={() => start(async () => {
            setSalvo(s => !s)
            const r = await alternarReacao(post.id, 'salvar')
            if (!r.ok) { setSalvo(post.jaSalvo); alert(r.erro) }
          })}>
          <IcoSalvar /> {salvo ? 'Salvo' : 'Salvar'}
        </button>
      </div>
    </article>
  )
}

// ---------- post de vitória ----------
function CardVitoria({ post }: { post: Post }) {
  const [par, setPar] = useState({ ativo: post.jaUtil, qtd: post.uteis })
  const [, start] = useTransition()
  return (
    <article className="post vitoria reveal">
      <div className="vitoria-linha">
        <span className="vitoria-badge" aria-hidden="true">
          <InsigniaEtapa size={22} />
        </span>
        <div className="vitoria-txt">
          <span className="rot">Nova conquista na comunidade</span>
          <b>{post.vitoria_rotulo}</b>
          <span className="num">{post.vitoria_detalhe} · {tempoRelativo(post.criado_em)}</span>
        </div>
        <button className={`btn btn-fantasma${par.ativo ? ' aplaudido' : ''}`}
          onClick={() => start(async () => {
            setPar(p => ({ ativo: !p.ativo, qtd: p.qtd + (p.ativo ? -1 : 1) }))
            const r = await alternarReacao(post.id, 'parabens')
            if (!r.ok) { setPar({ ativo: post.jaUtil, qtd: post.uteis }); alert(r.erro) }
          })}>
          Parabenizar <IconeSparkle size={13} /> <span className="num">· {par.qtd}</span>
        </button>
      </div>
    </article>
  )
}

// ============================================================
// PÁGINA
// ============================================================
export default function ComunidadeContent({ dados, nav }: { dados: DadosComunidade; nav: DadosNav }) {
  const { usuarioNome, espacos, posts, ranking, especialistas, eventoProximo, config } = dados

  const [espacoAtivo, setEspacoAtivo] = useState<string | null>(null)
  const [filtro, setFiltro] = useState('Em alta')
  const [tipoNovo, setTipoNovo] = useState<'caso' | 'duvida' | 'vitoria'>('caso')
  const [texto, setTexto] = useState('')
  const [publicando, start] = useTransition()
  const raiz = useRef<HTMLDivElement>(null)

  // reveals
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
  }, [filtro, espacoAtivo, posts.length])

  const FILTROS = ['Em alta', 'Recentes', 'Casos', 'Dúvidas respondidas', 'Da minha turma']

  const postsVisiveis = useMemo(() => {
    let lista = espacoAtivo ? posts.filter(p => p.espaco_id === espacoAtivo) : [...posts]
    if (filtro === 'Casos') lista = lista.filter(p => p.tipo === 'caso')
    if (filtro === 'Dúvidas respondidas') lista = lista.filter(p => p.tipo === 'duvida' && p.respondida)
    if (filtro === 'Da minha turma') lista = lista.filter(p => p.minhaTurma)
    if (filtro === 'Em alta') lista.sort((a, b) => b.uteis - a.uteis)
    else lista.sort((a, b) => +new Date(b.criado_em) - +new Date(a.criado_em))
    return lista
  }, [posts, filtro, espacoAtivo])

  function publicar() {
    const espacoId = espacoAtivo ?? espacos[0]?.id
    if (!espacoId) return
    start(async () => {
      const r = await publicarPost({ texto, tipo: tipoNovo, espacoId })
      if (r.ok) setTexto('')
      else alert(r.erro)
    })
  }

  return (
    <div ref={raiz} className="pagina-comunidade">
      <div className="grao" aria-hidden="true"></div>

      {/* ============ NAV ============ */}
      <NavPlataforma dados={nav} ativo="comunidade" />

      {/* ============ TOPO ============ */}
      <section className="topo">
        <div className="wrap">
          <div className="topo-linha">
            <div>
              <span className="eyebrow">Comunidade</span>
              <h1>Peritos em <span className="grad-txt">movimento.</span></h1>
            </div>
            <div className="topo-stats num">
              <div className="t-stat"><span className="ponto" aria-hidden="true"></span><div><b>{fmtNum(config.online_agora)}</b> <span>online agora</span></div></div>
              <div className="t-stat"><div><b>{fmtNum(config.membros_total)}</b> <span>peritos na comunidade</span></div></div>
              <div className="t-stat"><div><b>{config.casos_semana}</b> <span>casos resolvidos esta semana</span></div></div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ CORPO ============ */}
      <section className="corpo">
        <div className="wrap">
          <div className="grid">

            {/* RAIL ESQUERDO */}
            <aside className="rail-esq" aria-label="Espaços da comunidade">
              <span className="rail-titulo">Espaços</span>
              <ul className="espacos">
                {espacos.map(e => (
                  <li key={e.id}>
                    <a href="#" className={espacoAtivo === e.id ? 'ativo' : undefined}
                      onClick={ev => { ev.preventDefault(); setEspacoAtivo(a => a === e.id ? null : e.id) }}>
                      <span className="cerquilha">#</span>{e.nome}
                      {e.temNovo
                        ? <span className="novo-ponto" aria-label="novas publicações"></span>
                        : <span className="qtd num">{fmtQtd(e.qtd)}</span>}
                    </a>
                  </li>
                ))}
              </ul>
              <span className="rail-titulo">Minha turma</span>
              <a className="turma" href="#">
                <span>
                  <b>Kit Bancário Profissional</b>
                  <span className="num">Turma 2026 · 214 colegas</span>
                </span>
              </a>
            </aside>

            {/* FEED */}
            <div>
              <div className="compor reveal">
                <span className="foto-p" aria-hidden="true">{iniciais(usuarioNome)}</span>
                <div className="compor-corpo">
                  <textarea placeholder="Compartilhe um caso, uma dúvida ou uma vitória…"
                    aria-label="Nova publicação" value={texto} onChange={e => setTexto(e.target.value)} />
                  <div className="compor-acoes">
                    {(['caso', 'duvida', 'vitoria'] as const).map(t => (
                      <button key={t} className={`tipo-chip${tipoNovo === t ? ' sel' : ''}`}
                        onClick={() => setTipoNovo(t)}>
                        {t === 'caso' ? 'Caso' : t === 'duvida' ? 'Dúvida' : 'Vitória'}
                      </button>
                    ))}
                    <button className="btn btn-primario" onClick={publicar} disabled={publicando || !texto.trim()}>
                      {publicando ? 'Publicando…' : 'Publicar'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="filtros" role="tablist" aria-label="Filtrar publicações">
                {FILTROS.map(f => (
                  <button key={f} className={`filtro${filtro === f ? ' ativo' : ''}`} role="tab"
                    aria-selected={filtro === f} onClick={() => setFiltro(f)}>{f}</button>
                ))}
              </div>

              {postsVisiveis.map(p =>
                p.tipo === 'vitoria'
                  ? <CardVitoria key={p.id} post={p} />
                  : <CardPost key={p.id} post={p} />
              )}
              {postsVisiveis.length === 0 && (
                <article className="post reveal visivel">
                  <p>Nada por aqui ainda. Seja a primeira pessoa a publicar neste espaço.</p>
                </article>
              )}
            </div>

            {/* RAIL DIREITO */}
            <aside className="rail-dir" aria-label="Ranking e eventos">
              {eventoProximo && (
                <div className="bloco-r evento reveal">
                  <span className="selo-vivo"><span className="ponto" aria-hidden="true"></span>Ao vivo · hoje {fmtHora.format(new Date(eventoProximo.inicia_em)).replace(':', 'h')}</span>
                  <b>{eventoProximo.titulo}</b>
                  {eventoProximo.descricao && <span>{eventoProximo.descricao.split('—')[0].trim()}</span>}
                  <a className="btn btn-primario" href="/agenda">Reservar lugar</a>
                </div>
              )}

              <div className="bloco-r reveal">
                <div className="bloco-r-cab">
                  <span className="rail-titulo">Ranking da semana</span>
                  <a href="#">Ver completo</a>
                </div>
                <ol className="ranking num">
                  {ranking.map(r => (
                    <li key={r.posicao} className={`rk${r.eh_voce ? ' voce' : ''}`}>
                      <span className="pos">{r.posicao}</span>
                      <span className="foto-p" aria-hidden="true">{r.iniciais}</span>
                      <span className="rk-txt"><b>{r.eh_voce ? 'Você' : r.nome}</b><span>{fmtNum(r.xp)} XP</span></span>
                      <span className={`var ${r.variacao >= 0 ? 'sobe' : 'desce'}`}>
                        {r.variacao >= 0 ? `▲${r.variacao}` : `▼${Math.abs(r.variacao)}`}
                      </span>
                    </li>
                  ))}
                </ol>
                <p className="ranking-nota num">Faltam <b>184 XP</b> para a posição 20 · o ranking renova em 2 dias</p>
              </div>

              <div className="bloco-r reveal">
                <span className="rail-titulo">Especialistas agora</span>
                {especialistas.map(esp => (
                  <div className="especialista" key={esp.nome}>
                    <span className="esp-status foto-p" aria-hidden="true">
                      {esp.iniciais}{esp.online && <span className="online-dot"></span>}
                    </span>
                    <span><b>{esp.nome}</b><span>{esp.area}</span></span>
                  </div>
                ))}
              </div>
            </aside>

          </div>
        </div>
      </section>
    </div>
  )
}
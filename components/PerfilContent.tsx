// components/PerfilContent.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import type { DadosPerfil } from '@/lib/queries/perfil'
import NavPlataforma from '@/components/NavPlataforma'
import type { DadosNav } from '@/lib/queries/nav'
import { salvarPerfil } from '@/app/perfil/actions'

const fmtNum = (n: number) => n.toLocaleString('pt-BR')

function iniciais(nome: string) {
  return nome.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

function nomeCurto(nome: string) {
  return nome.split(' ').slice(0, 2).join(' ')
}

const TZ = 'America/Sao_Paulo'
const fmtHoraDia = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
const fmtSemana = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'long' })
function quandoAtividade(iso: string) {
  const d = new Date(iso)
  const dias = Math.floor((Date.now() - +d) / 864e5)
  const hora = fmtHoraDia.format(d).replace(':', 'h')
  if (dias <= 0) return `hoje, ${hora}`
  if (dias === 1) return `ontem, ${hora}`
  if (dias < 7) return fmtSemana.format(d)
  return 'semana passada'
}

const ICONE_INS: Record<string, React.ReactNode> = {
  check: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5 9.5 18 20 6.5" /></svg>,
  doc: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3v6h6M6 3h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" /></svg>,
  raio: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h7l-1 8 10-12h-7z" /></svg>,
  cadeado: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>,
}
const ICONE_ATV: Record<string, React.ReactNode> = {
  comunidade: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-3-.4-4.2-1L3 21l1.5-5.3c-.6-1.2-1-2.6-1-4.2A8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 9z" /></svg>,
  anotacao: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>,
  ranking: <>▲</>,
}
const IcoCert = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="9" r="6" /><path d="m8.5 14-2 7 5.5-3 5.5 3-2-7" /></svg>
)

export default function PerfilContent({ dados, nav }: { dados: DadosPerfil; nav: DadosNav }) {
  const [publico, setPublico] = useState(false)
  const [copiado, setCopiado] = useState<string | null>(null)
  const raiz = useRef<HTMLDivElement>(null)
  const [editando, setEditando] = useState(false)
  const [salvandoPerfil, setSalvandoPerfil] = useState(false)
  const [msgSalvo, setMsgSalvo] = useState<string | null>(null)

  useEffect(() => {
    const anima = (el: Element | Document) =>
      el.querySelectorAll<HTMLElement>('i[data-fill]').forEach(i => { i.style.width = i.dataset.fill ?? '0%' })
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      raiz.current?.querySelectorAll('.reveal').forEach(el => el.classList.add('visivel'))
      if (raiz.current) anima(raiz.current)
      return
    }
    const io = new IntersectionObserver(es => {
      es.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visivel'); anima(e.target); io.unobserve(e.target) }
      })
    }, { threshold: .12, rootMargin: '0px 0px -4% 0px' })
    raiz.current?.querySelectorAll('.reveal').forEach(el => io.observe(el))
    const hero = raiz.current?.querySelector('.hero-perfil')
    if (hero) anima(hero)
    return () => io.disconnect()
  }, [publico])

  async function copiar(texto: string, chave: string) {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(chave)
      setTimeout(() => setCopiado(null), 2000)
    } catch { /* clipboard bloqueado */ }
  }

  async function handleSalvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSalvandoPerfil(true)
    setMsgSalvo(null)
    const fd = new FormData(e.currentTarget)
    const r = await salvarPerfil(fd)
    setSalvandoPerfil(false)
    if (r.ok) {
      setMsgSalvo('Perfil salvo!')
      setTimeout(() => { setMsgSalvo(null); setEditando(false) }, 1500)
    } else {
      setMsgSalvo(r.erro ?? 'Erro ao salvar.')
    }
  }

  const d = dados

  return (
    <div ref={raiz} className={`pagina-perfil${publico ? ' publico' : ''}`}>
      <div className="grao" aria-hidden="true"></div>
      <NavPlataforma dados={nav} />

      {publico && (
        <div className="faixa-publica" role="status">
          Você está vendo seu perfil como o público vê ·{' '}
          <button style={{ textDecoration: 'underline', fontWeight: 700 }} onClick={() => setPublico(false)}>
            voltar à visão completa
          </button>
        </div>
      )}

      {/* ============ HERO ============ */}
      <section className="hero-perfil">
        <div className="wrap">
          <div className="perfil-linha">
            <div className="avatar-grande" aria-hidden="true">
              {iniciais(d.nome)}
              <span className="nivel-chip num">{d.nivel}</span>
            </div>
            <div className="perfil-quem">
              <span className="titulo-nivel">{d.titulo} · Nível {d.nivel}</span>
              <h1>{nomeCurto(d.nome)}.</h1>
              <p className="meta num">
                Na jornada desde <b>{d.iniciouRotulo}</b> · Etapa {String(d.etapa).padStart(2, '0')} de {String(d.etapaTotal).padStart(2, '0')} · <b>{d.etapaNome}</b>
              </p>
            </div>
            <div className="perfil-acoes">
              <button className="btn btn-fantasma privado" onClick={() => setEditando(v => !v)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
                {editando ? 'Fechar edição' : 'Editar perfil'}
              </button>
              <button className="btn btn-fantasma privado" onClick={() => { setPublico(true); scrollTo({ top: 0, behavior: 'smooth' }) }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
                Ver como o público vê
              </button>
              <button className="btn btn-primario" onClick={() => copiar(location.href, 'perfil')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3h4v4M21 3l-9 9M9 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" /></svg>
                {copiado === 'perfil' ? 'Link copiado ✓' : 'Compartilhar perfil'}
              </button>
            </div>
          </div>
          <div className="xp-linha privado">
            <div className="topo num">
              <b>{fmtNum(d.xp)} XP</b>
              <span>faltam {fmtNum(Math.max(0, d.xpProximoNivel - d.xp))} para o Nível {d.nivel + 1}</span>
            </div>
            <div className="barra" role="progressbar" aria-valuenow={d.progressoPct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso para o próximo nível">
              <i data-fill={`${d.progressoPct}%`}></i>
            </div>
          </div>

          {/* ============ PAINEL DE EDIÇÃO ============ */}
          {editando && (
            <div className="perfil-edicao reveal visivel">
              <form onSubmit={handleSalvar}>
                <h2>Editar perfil</h2>
                <div className="pe-grid">
                  <div className="pe-campo pe-full">
                    <label>Nome completo</label>
                    <input name="nome" defaultValue={d.nome} required minLength={3} />
                  </div>
                  <div className="pe-campo pe-full">
                    <label>Bio</label>
                    <textarea name="bio" defaultValue={d.bio ?? ''} rows={3} placeholder="Perito contábil especializado em..." />
                  </div>
                  <div className="pe-campo">
                    <label>Cidade</label>
                    <input name="cidade" defaultValue={d.cidade ?? ''} placeholder="São Paulo" />
                  </div>
                  <div className="pe-campo">
                    <label>Estado</label>
                    <input name="estado" defaultValue={d.estado ?? ''} placeholder="SP" maxLength={2} />
                  </div>
                  <div className="pe-campo">
                    <label>Email público</label>
                    <input name="email_publico" type="email" defaultValue={d.email_publico ?? ''} placeholder="contato@perito.com" />
                  </div>
                  <div className="pe-campo">
                    <label>Telefone</label>
                    <input name="telefone" defaultValue={d.telefone ?? ''} placeholder="(48) 99999-0000" />
                  </div>
                </div>
                <div className="pe-toggles">
                  <label className="pe-toggle">
                    <input type="checkbox" name="mostrar_email" defaultChecked={d.mostrar_email} />
                    <span>Mostrar email no perfil público</span>
                  </label>
                  <label className="pe-toggle">
                    <input type="checkbox" name="mostrar_tel" defaultChecked={d.mostrar_tel} />
                    <span>Mostrar telefone no perfil público</span>
                  </label>
                  <label className="pe-toggle">
                    <input type="checkbox" name="perfil_publico" defaultChecked={d.perfil_publico} />
                    <span>Perfil público ativo</span>
                  </label>
                </div>
                {d.slug && d.perfil_publico && (
                  <p className="pe-link-publico">
                    Seu perfil público: <a href={`/perito/${d.slug}`} target="_blank" rel="noopener">/perito/{d.slug}</a>
                  </p>
                )}
                <div className="pe-acoes">
                  <button type="submit" className="btn btn-primario" disabled={salvandoPerfil}>
                    {salvandoPerfil ? 'Salvando…' : '✓ Salvar alterações'}
                  </button>
                  <button type="button" className="btn btn-fantasma" onClick={() => setEditando(false)}>Cancelar</button>
                  {msgSalvo && <span className="pe-msg">{msgSalvo}</span>}
                </div>
              </form>
            </div>
          )}
        </div>
      </section>

      {/* ============ CORPO ============ */}
      <section className="corpo">
        <div className="wrap">
          <div className="secao privado reveal">
            <div className="numeros num">
              <div className="n-item">
                <span className="v gd">{fmtNum(d.xp)}</span>
                <span className="r">XP total</span>
                <span className="sub"><b>+{d.xpSemana}</b> esta semana</span>
              </div>
              <div className="n-item">
                <span className="v">{d.estudoHoras.split('h')[0]}<small>h</small></span>
                <span className="r">de estudo</span>
                <span className="sub"><b>+{d.estudoSemana}</b> esta semana</span>
              </div>
              <div className="n-item">
                <span className="v">{d.missoesFeitas}<small>/{d.missoesTotal}</small></span>
                <span className="r">missões da jornada</span>
                <span className="sub">Etapa {String(d.etapa).padStart(2, '0')} em andamento</span>
              </div>
              {d.rankingPos != null && (
                <div className="n-item">
                  <span className="v">#{d.rankingPos}</span>
                  <span className="r">ranking da semana</span>
                  <span className="sub"><b>{(d.rankingVar ?? 0) >= 0 ? `▲${d.rankingVar}` : `▼${Math.abs(d.rankingVar ?? 0)}`}</b> posições</span>
                </div>
              )}
              <div className="n-item">
                <span className="v">{d.anotacoes}</span>
                <span className="r">anotações feitas</span>
                <span className="sub">nas suas aulas</span>
              </div>
            </div>
          </div>

          <div className="secao privado reveal">
            <div className="secao-cab">
              <h2>Constância.</h2>
              <span className="meta">últimas 16 semanas</span>
            </div>
            <div className="constancia">
              <div className="heat">
                <div className="heat-grid num" aria-label="Mapa de estudo dos últimos dias">
                  {d.heatmap.map((n, i) => (
                    <span key={i} className={`dia${n > 0 ? ` n${n}` : ''}`}></span>
                  ))}
                </div>
                <div className="heat-legenda">
                  menos
                  <span className="dia"></span><span className="dia n1"></span><span className="dia n2"></span><span className="dia n3"></span><span className="dia n4"></span>
                  mais
                </div>
              </div>
              <div className="constancia-txt">
                <p>
                  Você estudou em <b>{d.diasEstudados} dos últimos {d.diasJanela} dias</b>
                  {d.ritmoSubiu && <> — e nas últimas 4 semanas o ritmo subiu</>}. {d.diasFortes}
                </p>
                <span className="sequencia">
                  <span className="chama" aria-hidden="true">🔥</span>
                  Sequência atual: <b className="num">{d.sequenciaAtual} {d.sequenciaAtual === 1 ? 'dia' : 'dias'}</b> · recorde: {d.recorde}
                </span>
              </div>
            </div>
          </div>

          <div className="secao reveal">
            <div className="secao-cab">
              <h2>Insígnias.</h2>
              <span className="meta num"><b>{d.insignias.filter(i => i.conquistada).length} conquistadas</b> · próxima a 3 missões</span>
            </div>
            <div className="insignias">
              {d.insignias.map(ins => (
                <div key={ins.nome} className={`ins${ins.conquistada ? '' : ' travada'}`}>
                  <span className="ins-badge" aria-hidden="true">{ICONE_INS[ins.icone] ?? ICONE_INS.check}</span>
                  <b>{ins.nome}</b>
                  <span>{ins.descricao}</span>
                  {ins.quando_rotulo && <span className="quando num">{ins.quando_rotulo}</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="secao reveal">
            <div className="secao-cab">
              <h2>Certificados.</h2>
              <span className="meta num"><b>{d.certificados.filter(c => c.emitido).length} emitidos</b> · verificáveis publicamente</span>
            </div>
            <div className="certs">
              {d.certificados.map(c => c.emitido ? (
                <div className="cert" key={c.numero}>
                  <span className="cert-selo" aria-hidden="true"><IcoCert /></span>
                  <div className="cert-txt">
                    <span className="eyebrow">Certificado · nº {c.numero}</span>
                    <b>{c.curso_titulo}</b>
                    <p className="meta num">Emitido em {c.emitido_rotulo} · nota final {c.nota?.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} · {c.carga_horas}h</p>
                    <div className="cert-acoes">
                      <button className="mini-btn" onClick={() => copiar(`${location.origin}/certificado/${c.numero}`, c.numero!)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></svg>
                        {copiado === c.numero ? 'Copiado ✓' : 'Copiar link de verificação'}
                      </button>
                      <button className="mini-btn">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16" /></svg>
                        PDF
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="cert proximo privado" key={c.curso_titulo}>
                  <span className="cert-selo" aria-hidden="true"><IcoCert /></span>
                  <div className="cert-txt">
                    <span className="eyebrow">Próximo certificado</span>
                    <b>{c.curso_titulo}</b>
                    <p className="meta num">{c.faltam_txt} · você está a {c.progresso_pct}%</p>
                    <div className="cert-acoes">
                      <a className="mini-btn" href={c.curso_slug ? `/curso/${c.curso_slug}` : '#'}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>
                        Continuar curso
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="secao privado reveal">
            <div className="secao-cab">
              <h2>Atividade recente.</h2>
            </div>
            <ul className="atv-lista">
              {d.atividades.map((a, i) => (
                <li key={i} className={`atv${a.xp != null ? ' xp' : ''}`}>
                  <span className="atv-ponto" aria-hidden="true">
                    {a.xp != null ? '✓' : (ICONE_ATV[a.tipo] ?? '·')}
                  </span>
                  <div className="atv-txt">
                    <p>
                      {a.prefixo}<b>{a.destaque}</b>{a.sufixo}
                      {a.xp != null && <> · <span className="gd num">+{a.xp} XP</span></>}
                    </p>
                    <time>{quandoAtividade(a.quando)}</time>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}
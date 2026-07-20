// components/PeritoPublicoContent.tsx
// Perfil público do perito — acessível sem login.
'use client'

import { useState } from 'react'
import type { DadosPeritoPublico } from '@/lib/queries/perito-publico'
import { IconeMapPin, IconeCalendar, IconeMail, IconePhone, IconeCheck, IconeClipboard } from '@/components/Icones'
import { Certificado, XP, SeloNivel } from '@/components/Emblemas'

const fmtNum = (n: number) => n.toLocaleString('pt-BR')

function fmtData(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(iso))
}

function tempoGasto(seg: number) {
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  if (h > 0) return `${h}h ${m}min`
  return `${m}min`
}

// radar chart SVG simples
function RadarChart({ competencias }: { competencias: { nome: string; valor: number }[] }) {
  const n = competencias.length
  if (n < 3) return null
const cx = 160, cy = 160, r = 90
const angulo = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2

  const pontosMax = competencias.map((_, i) => {
    const a = angulo(i)
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
  }).join(' ')

  const pontosValor = competencias.map((c, i) => {
    const a = angulo(i)
    const rv = (c.valor / 100) * r
    return `${cx + rv * Math.cos(a)},${cy + rv * Math.sin(a)}`
  }).join(' ')

  return (
    <div className="pp-radar">
      <svg viewBox="0 0 300 300" aria-hidden="true">
        <defs>
          <linearGradient id="radarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#20D9A6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#DDF784" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        {/* grades */}
        {[0.25, 0.5, 0.75, 1].map(pct => (
          <polygon key={pct} points={competencias.map((_, i) => {
            const a = angulo(i); const rv = pct * r
            return `${cx + rv * Math.cos(a)},${cy + rv * Math.sin(a)}`
          }).join(' ')} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="1" />
        ))}
        {/* eixos */}
        {competencias.map((_, i) => {
          const a = angulo(i)
          return <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(a)} y2={cy + r * Math.sin(a)} stroke="rgba(255,255,255,.06)" strokeWidth="1" />
        })}
        {/* área preenchida */}
        <polygon points={pontosValor} fill="url(#radarGrad)" stroke="#20D9A6" strokeWidth="2" />
        {/* pontos */}
        {competencias.map((c, i) => {
          const a = angulo(i); const rv = (c.valor / 100) * r
          return <circle key={i} cx={cx + rv * Math.cos(a)} cy={cy + rv * Math.sin(a)} r="4" fill="#20D9A6" />
        })}
        {/* labels */}
        {competencias.map((c, i) => {
          const a = angulo(i); const lr = r + 18
          const x = cx + lr * Math.cos(a); const y = cy + lr * Math.sin(a)
          const anchor = Math.abs(Math.cos(a)) < 0.1 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end'
          return <text key={i} x={x} y={y} textAnchor={anchor} dominantBaseline="central" fill="#B9BFB8" fontSize="11" fontWeight="600">{c.nome}</text>
        })}
      </svg>
      <div className="pp-radar-lista">
        {competencias.map(c => (
          <div className="pp-radar-item" key={c.nome}>
            <span className="pp-radar-nome">{c.nome}</span>
            <div className="pp-radar-barra"><i style={{ width: `${c.valor}%` }}></i></div>
            <span className="pp-radar-val num">{c.valor}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PeritoPublicoContent({ dados, url }: { dados: DadosPeritoPublico; url: string }) {
  const { perito: p, stats, score, nivel_label, competencias, certificados, desafios, resumo } = dados
  const [copiado, setCopiado] = useState(false)
  const [fotoErro, setFotoErro] = useState(false)

  function copiarResumo() {
    navigator.clipboard.writeText(resumo + `\n\nVerifique: ${url}`)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  const scoreCor = score >= 80 ? '#20D9A6' : score >= 50 ? '#36DCD1' : score >= 20 ? '#DDF784' : '#989E99'
  const scoreLabel = score >= 80 ? 'ELITE' : score >= 50 ? 'QUALIFICADO' : score >= 20 ? 'EM FORMAÇÃO' : 'INICIANTE'

  return (
    <div className="pagina-perito-pub">
      <div className="grao" aria-hidden="true"></div>

      {/* nav simples pública */}
      <header className="pp-nav">
        <div className="pp-nav-inner">
          <a className="pp-logo" href="/" aria-label="Peritos Academy">
            <span>peritos<small>academy</small></span>
          </a>
          <span className="pp-nav-selo">Perfil verificado</span>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section className="pp-hero">
        <div className="pp-wrap">
          <div className="pp-hero-card">
            <div className="pp-hero-info">
              <div className="pp-avatar" aria-hidden="true">
                {p.fotoUrl && !fotoErro ? (
                  <img src={p.fotoUrl} alt="" className="pp-avatar-foto" onError={() => setFotoErro(true)} />
                ) : (
                  p.iniciais
                )}
              </div>
              <div className="pp-hero-dados">
                <h1>{p.nome}</h1>
                <p className="pp-bio">{p.bio}</p>
                <div className="pp-meta">
                  {p.cidade && <span><IconeMapPin size={13} /> {p.cidade}{p.estado ? `, ${p.estado}` : ''}</span>}
                  <span><XP size={13} /> {fmtNum(p.xp)} XP</span>
                  <span><SeloNivel size={13} nivel={p.nivel} /> Nível {p.nivel}</span>
                  <span><IconeCalendar size={13} /> Membro desde {fmtData(p.membro_desde)}</span>
                </div>
                <div className="pp-contato">
                  {p.email_publico && <a href={`mailto:${p.email_publico}`}><IconeMail size={13} /> {p.email_publico}</a>}
                  {p.telefone && <a href={`tel:${p.telefone}`}><IconePhone size={13} /> {p.telefone}</a>}
                </div>
              </div>
            </div>
            <div className="pp-score">
              <div className="pp-score-numero num" style={{ color: scoreCor }}>{score}</div>
              <span className="pp-score-label">SCORE PERICIAL</span>
              <span className="pp-score-tier" style={{ borderColor: scoreCor, color: scoreCor }}>{scoreLabel}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============ INDICADORES ============ */}
      <section className="pp-stats">
        <div className="pp-wrap">
          <div className="pp-stats-grade">
            <div className="pp-stat"><span className="pp-stat-v num">{stats.cursos_concluidos}</span><span className="pp-stat-r">CURSOS CONCLUÍDOS</span></div>
            <div className="pp-stat"><span className="pp-stat-v num">{stats.certificados}</span><span className="pp-stat-r">CERTIFICADOS</span></div>
            <div className="pp-stat"><span className="pp-stat-v num">{stats.desafios_completos}</span><span className="pp-stat-r">DESAFIOS PERICIAIS</span></div>
            <div className="pp-stat"><span className="pp-stat-v num">{stats.provas_aprovadas}</span><span className="pp-stat-r">PROVAS APROVADAS</span></div>
            <div className="pp-stat"><span className="pp-stat-v num">{stats.planilhas_entregues}</span><span className="pp-stat-r">PLANILHAS ENTREGUES</span></div>
            <div className="pp-stat destaque"><span className="pp-stat-v num">{stats.media_notas?.toFixed(1).replace('.', ',') ?? '—'}</span><span className="pp-stat-r">MÉDIA DE NOTAS</span></div>
          </div>
        </div>
      </section>

      {/* ============ COMPETÊNCIAS ============ */}
      <section className="pp-competencias">
        <div className="pp-wrap">
          <h2 className="pp-titulo-secao">Mapa de competências</h2>
          <RadarChart competencias={competencias} />
        </div>
      </section>

      {/* ============ CERTIFICADOS ============ */}
      {certificados.length > 0 && (
        <section className="pp-certs">
          <div className="pp-wrap">
            <h2 className="pp-titulo-secao">Certificados emitidos</h2>
            <div className="pp-certs-lista">
              {certificados.map(c => (
                <a className="pp-cert" key={c.numero} href={`/certificado/${c.numero}`}>
                  <div className="pp-cert-info">
                    <b>{c.curso_titulo}</b>
                    <span className="num">{c.emitido_rotulo ?? fmtData(c.emitido_em)}{c.carga_horas ? ` · ${c.carga_horas}h` : ''}</span>
                  </div>
                  <div className="pp-cert-dir">
                    {c.nota !== null && <span className="pp-cert-nota num">{c.nota.toFixed(1).replace('.', ',')}</span>}
                    <span className="pp-cert-num num">{c.numero}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============ DESAFIOS ============ */}
      {desafios.length > 0 && (
        <section className="pp-desafios">
          <div className="pp-wrap">
            <h2 className="pp-titulo-secao">Desafios periciais completados</h2>
            <div className="pp-desafios-lista">
              {desafios.map((d, i) => (
                <div className="pp-desafio" key={i}>
                  <span className="pp-desafio-num num">#{d.numero}</span>
                  <div className="pp-desafio-info">
                    <b>{d.titulo}</b>
                    <span>{d.categoria_nome}{d.tempo_seg ? ` · ${tempoGasto(d.tempo_seg)}` : ''}</span>
                  </div>
                  {d.nota !== null && <span className="pp-desafio-nota num">{d.nota.toFixed(1).replace('.', ',')}</span>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============ RESUMO PRO ADVOGADO ============ */}
      <section className="pp-resumo">
        <div className="pp-wrap">
          <h2 className="pp-titulo-secao">Resumo profissional</h2>
          <div className="pp-resumo-card">
            <p>{resumo}</p>
            <div className="pp-resumo-acoes">
              <button className="pp-btn-copiar" onClick={copiarResumo}>
                {copiado ? <><IconeCheck size={13} /> Copiado!</> : <><IconeClipboard size={13} /> Copiar resumo</>}
              </button>
              <span className="pp-resumo-dica">Cole em petições, propostas de honorários ou currículos</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============ VERIFICAÇÃO + QR ============ */}
      <section className="pp-verificacao">
        <div className="pp-wrap">
          <div className="pp-verif-card">
            <div className="pp-verif-selo">
              <Certificado size={24} />
              <div>
                <b>Perfil verificado</b>
                <span>Emitido e verificado pela Peritos Academy</span>
              </div>
            </div>
            <div className="pp-verif-qr">
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(url)}&bgcolor=070908&color=F1F2DF`} alt="QR Code de verificação" width="120" height="120" />
              <span className="pp-verif-url num">{url.replace('https://', '')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* footer */}
      <footer className="pp-footer">
        <div className="pp-wrap">
          <span>© 2026 Peritos Academy · Perfil público verificado</span>
          <a href="/">Conheça a Peritos Academy →</a>
        </div>
      </footer>
    </div>
  )
}
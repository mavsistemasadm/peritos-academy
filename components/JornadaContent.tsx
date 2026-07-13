// components/JornadaContent.tsx
// Réplica fiel do template aprovado, 100% plugada no banco.
'use client'

import { useEffect, useRef } from 'react'
import type { DadosJornada, Etapa, Missao } from '@/lib/queries/jornada'
import NavPlataforma from '@/components/NavPlataforma'
import type { DadosNav } from '@/lib/queries/nav'
import { IconeCheck, IconeLock, IconePlay } from '@/components/Icones'
import { InsigniaEtapa, Certificado } from '@/components/Emblemas'

const fmtNum = (n: number) => n.toLocaleString('pt-BR')
const pad2 = (n: number) => String(n).padStart(2, '0')

// ---------- missão ----------
function LinhaMissao({ m, etapa }: { m: Missao; etapa: Etapa['estado'] }) {
  const href = m.curso_slug ? `/curso/${m.curso_slug}` : '#'
  const concluida = m.nota != null

  return (
    <a className="missao" href={href}>
      <span className="missao-txt">
        <b>{m.titulo}</b>
        {etapa === 'travada' ? (
          <span>{m.info}</span>
        ) : (
          <>
            <span className="barra"><i data-fill={`${concluida ? 100 : m.progresso_pct}%`}></i></span>
            {concluida ? (
              <span className="feito-tag">Concluída · nota {m.nota!.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}</span>
            ) : m.progresso_pct > 0 ? (
              <span className="num">{m.progresso_pct}% · continuar daqui</span>
            ) : (
              <span className="novo-tag">Começar{m.info ? ` · ${m.info}` : ''}</span>
            )}
          </>
        )}
      </span>
    </a>
  )
}

// ---------- etapa ----------
function CardEtapa({ e }: { e: Etapa }) {
  return (
    <div className={`etapa ${e.estado} reveal`}>
      <div className={`etapa-no${e.estado === 'feita' ? '' : ' num'}`} aria-hidden="true">
        {e.estado === 'feita' ? <IconeCheck size={13} /> : pad2(e.numero)}
      </div>
      <div className="etapa-corpo">
        <span className="fantasma num" aria-hidden="true">{pad2(e.numero)}</span>
        <div className="etapa-cab">
          <span className="rotulo-etapa">
            Etapa {pad2(e.numero)}
            {e.estado === 'feita' && e.concluida_rotulo && <> · {e.concluida_rotulo.replace(/^Concluída/i, 'Concluída')}</>}
            {e.estado === 'atual' && <> · Você está aqui · {e.missoes_feitas} de {e.missoes_total} missões</>}
          </span>
          <h2>{e.nome}</h2>
          <p className="desc">{e.descricao}</p>
        </div>
        <div className="missoes">
          {e.missoes.map(m => <LinhaMissao key={m.titulo} m={m} etapa={e.estado} />)}
        </div>
        <div className="etapa-rodape">
          {e.estado === 'feita' && e.recompensa_nome && (
            <span className="recompensa ganha">
              <span className="mini-selo" aria-hidden="true">
                <IconeCheck size={13} strokeWidth={2.6} />
              </span>
              Insígnia {e.recompensa_nome} · +{e.recompensa_xp} XP recebidos
            </span>
          )}
          {e.estado === 'atual' && e.recompensa_nome && (
            <span className="recompensa">
              <span className="mini-selo" aria-hidden="true">
                <InsigniaEtapa size={14} />
              </span>
              Ao concluir: Insígnia <b style={{ margin: '0 4px' }}>{e.recompensa_nome}</b> · +{e.recompensa_xp} XP
            </span>
          )}
          {e.estado === 'travada' && e.trava_txt && (
            <span className="trava">
              <IconeLock size={14} strokeWidth={2} />
              {e.trava_txt}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// PÁGINA
// ============================================================
export default function JornadaContent({ dados, nav }: { dados: DadosJornada; nav: DadosNav }) {
  const d = dados
  const raiz = useRef<HTMLDivElement>(null)

  // fio de leitura + espinha que se desenha + reveals + barras
  useEffect(() => {
    const rm = matchMedia('(prefers-reduced-motion: reduce)').matches
    const fio = raiz.current?.querySelector<HTMLElement>('.fio')
    const etapasEl = raiz.current?.querySelector<HTMLElement>('.etapas')
    const espinhaFio = raiz.current?.querySelector<HTMLElement>('.espinha-fio')
    const anima = (el: Element) =>
      el.querySelectorAll<HTMLElement>('i[data-fill]').forEach(i => { i.style.width = i.dataset.fill ?? '0%' })

    const aoRolar = () => {
      const h = document.documentElement
      if (fio) fio.style.width = (h.scrollTop / (h.scrollHeight - h.clientHeight) * 100) + '%'
      if (etapasEl && espinhaFio) {
        const r = etapasEl.getBoundingClientRect()
        const p = Math.min(Math.max((innerHeight * .62 - r.top) / r.height, 0), 1)
        espinhaFio.style.height = (p * 100) + '%'
      }
    }
    addEventListener('scroll', aoRolar, { passive: true })

    if (rm) {
      raiz.current?.querySelectorAll('.reveal').forEach(el => el.classList.add('visivel'))
      if (raiz.current) anima(raiz.current)
      if (espinhaFio) espinhaFio.style.height = '100%'
    } else {
      const io = new IntersectionObserver(es => {
        es.forEach(e => {
          if (e.isIntersecting) { e.target.classList.add('visivel'); anima(e.target); io.unobserve(e.target) }
        })
      }, { threshold: .14, rootMargin: '0px 0px -5% 0px' })
      raiz.current?.querySelectorAll('.reveal').forEach(el => io.observe(el))
      aoRolar()
    }
    return () => removeEventListener('scroll', aoRolar)
  }, [])

  return (
    <div ref={raiz} className="pagina-jornada">
      <div className="grao" aria-hidden="true"></div>
      <div className="fio" aria-hidden="true"></div>

      {/* ============ NAV ============ */}
      <NavPlataforma dados={nav} ativo="trilhas" />

      {/* ============ HERO ============ */}
      <section className="hero" aria-label="Sua jornada">
        <div className="wrap">
          <span className="eyebrow">Sua jornada · Trilha principal</span>
          <h1>Do conhecimento à <span className="grad-txt">autoridade.</span></h1>
          <p className="sub">Cinco etapas entre você e o título de Perito de Elite. Cada missão concluída destrava a próxima — e deixa um rastro verificável da sua evolução.</p>
          <div className="hero-stats">
            <div className="stat destaque">
              <span className="grande num">{pad2(d.etapaAtual)}<small>/{pad2(d.etapaTotal)}</small></span>
              <span className="rot">etapa atual</span>
            </div>
            <div className="stat">
              <span className="grande num">{d.missoesEtapaFeitas}<small>/{d.missoesEtapaTotal}</small></span>
              <span className="rot">missões da etapa</span>
            </div>
            <div className="stat">
              <span className="grande num">{d.missoesJornadaFeitas}<small>/{d.missoesJornadaTotal}</small></span>
              <span className="rot">missões na jornada</span>
            </div>
            <div className="stat">
              <span className="grande num">{fmtNum(d.xp)}</span>
              <span className="rot">XP acumulado</span>
            </div>
            <div className="stat">
              <span className="grande num">~{d.ritmoSemanas} <small>sem</small></span>
              <span className="rot">no seu ritmo atual</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============ MAPA ============ */}
      <section className="mapa">
        <div className="aurora" aria-hidden="true" style={{ top: 900, left: -180 }}></div>
        <div className="wrap">
          <div className="etapas">
            <div className="espinha" aria-hidden="true"><div className="espinha-fio"></div></div>

            {d.etapas.map(e => <CardEtapa key={e.numero} e={e} />)}

            {/* MARCO FINAL */}
            <div className="marco reveal">
              <div className="marco-no" aria-hidden="true">
                <Certificado size={22} />
              </div>
              <div className="marco-cartao">
                <span className="rotulo-etapa">Marco final · Certificação</span>
                <h2>Perito de Elite.</h2>
                <p>O título que resume a jornada: certificação verificável, com registro público e QR de autenticidade — pronta para o seu perfil profissional e para os autos.</p>
                <div className="marco-itens">
                  <span className="marco-item"><span className="ok" aria-hidden="true"><IconeCheck size={13} /></span>Certificado verificável com registro público</span>
                  <span className="marco-item"><span className="ok" aria-hidden="true"><IconeCheck size={13} /></span>Insígnia máxima no perfil e no ranking</span>
                  <span className="marco-item"><span className="ok" aria-hidden="true"><IconeCheck size={13} /></span>Selo Perito de Elite na comunidade</span>
                </div>
                <a className="btn btn-primario" href="/curso/segredos-bancarios">
                  <IconePlay size={13} />
                  Continuar a jornada
                </a>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ============ OUTRAS TRILHAS ============ */}
      <section className="outras" aria-label="Outras trilhas">
        <div className="wrap">
          <div className="outras-cab reveal">
            <div>
              <span className="eyebrow">Explorar</span>
              <h2>Outras trilhas para o seu arsenal.</h2>
            </div>
            <a className="link-secao" href="/biblioteca">Ver biblioteca completa →</a>
          </div>
          <div className="trilhas-grid">
            {d.trilhas.map(t => (
              <a className="trilha-card reveal" href="#" key={t.nome}>
                <span className="eyebrow">{t.missoes_qtd} missões · {t.horas}h</span>
                <h3>{t.nome}</h3>
                <p>{t.descricao}</p>
                <span className="meta num"><b>{fmtNum(t.alunos)} peritos</b> nesta trilha</span>
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
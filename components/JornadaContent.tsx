// components/JornadaContent.tsx
// Redesenho seguindo docs/mockups/mockup_jornada_final.html e
// mockup_jornada_pos_missao.html — 100% plugado em dados reais
// (lib/queries/jornada.ts). Nenhuma trilha é travada.
'use client'

import { useEffect, useRef } from 'react'
import type { DadosJornada, Marco, PainelTrilha, Territorio } from '@/lib/queries/jornada'
import NavPlataforma from '@/components/NavPlataforma'
import type { DadosNav } from '@/lib/queries/nav'
import { IconePlay, IconeCheck, IconeShield, IconeFileText } from '@/components/Icones'
import { SeloExcelencia } from '@/components/Emblemas'

const fmtNum = (n: number) => n.toLocaleString('pt-BR')
const fmtDataLonga = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'long', year: 'numeric' })
function formatarDataSelo(iso: string | null): string | null {
  if (!iso) return null
  return fmtDataLonga.format(new Date(iso))
}

function Anel({ pct, size, largura, children }: { pct: number; size: number; largura: number; children: React.ReactNode }) {
  const r = (size - largura) / 2
  const c = 2 * Math.PI * r
  const offset = c - (Math.max(0, Math.min(100, pct)) / 100) * c
  return (
    <div className="anel-wrap" style={{ width: size, height: size }}>
      <svg className="anel-svg" viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle className="anel-bg" cx={size / 2} cy={size / 2} r={r} strokeWidth={largura} />
        <circle className="anel-fill" cx={size / 2} cy={size / 2} r={r} strokeWidth={largura}
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div className="anel-label">{children}</div>
    </div>
  )
}

function TimelineMarcos({ marcos }: { marcos: Marco[] }) {
  const feitos = marcos.filter(m => m.estado === 'feita').length
  const pct = marcos.length ? (feitos / marcos.length) * 100 : 0
  return (
    <div className="marcos-wrap">
      <div className="marcos-linha">
        <div className="marcos-fio"><i style={{ width: `${pct}%` }}></i></div>
        {marcos.map(m => (
          <div className={`marco-item ${m.estado}`} key={m.id}>
            <div className="marco-bola">
              {m.estado === 'feita' ? <IconeCheck size={16} strokeWidth={2.8} /> : String(m.ordem + 1).padStart(2, '0')}
            </div>
            {m.estado === 'atual' && <span className="marco-sub">Em andamento</span>}
            <span className="marco-nome">{m.nome}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PainelCard({ painel, icone, corAneL = 'verde' }: { painel: PainelTrilha; icone: 'formacao' | 'territorio'; corAneL?: string }) {
  return (
    <div className="missao reveal">
      <div className="missao-corpo">
        <span className="missao-tag">{painel.tag}</span>
        <div className="missao-cab">
          <div className="missao-icone">
            {icone === 'formacao' ? <IconeShield size={28} strokeWidth={1.5} /> : <IconeFileText size={28} strokeWidth={1.5} />}
          </div>
          <div>
            <h2>{painel.nome}</h2>
            {painel.descricao && <p className="desc">{painel.descricao}</p>}
          </div>
        </div>

        {painel.marcos.length > 0 && <TimelineMarcos marcos={painel.marcos} />}

        <div className="missao-rodape">
          {painel.continuarHref ? (
            <a className="btn-grad" href={painel.continuarHref}>
              <IconePlay size={13} />
              {icone === 'formacao' ? 'Continuar missão' : 'Continuar especialização'}
            </a>
          ) : (
            <span className="btn-grad" style={{ opacity: 0.5, pointerEvents: 'none' }}>Sem conteúdo ainda</span>
          )}
          {painel.proximoTexto && (
            <div className="proximo-curso">
              <small>{painel.proximoRotulo}</small>
              <strong>{painel.proximoTexto}</strong>
            </div>
          )}
          {icone === 'territorio' && (
            <a className="trocar-trilha" href="#territorios">Explorar outros territórios →</a>
          )}
        </div>
      </div>

      <div className="missao-progresso">
        <div className="prog-topo"><span>{icone === 'formacao' ? 'Seu progresso' : 'Território'}</span><span className="ativo">Em curso</span></div>
        <Anel pct={painel.progressoPct} size={180} largura={6}>
          <span className="grande num">{painel.marcosFeitos}<small>/{painel.marcosTotal}</small></span>
          <span className="rotulo">{icone === 'formacao' ? 'Etapas' : 'Cursos'}</span>
        </Anel>
        <div className="prog-info">
          <p><strong>{painel.progressoPct}%</strong> {icone === 'formacao' ? 'da base concluída' : 'do território dominado'}</p>
          <div className="prog-barra"><i style={{ width: `${painel.progressoPct}%` }}></i></div>
          <small>Ao concluir: {painel.marcoFinalRotulo}.</small>
        </div>
      </div>
    </div>
  )
}

function CardTerritorio({ t }: { t: Territorio }) {
  const estadoTxt = t.estado === 'em-curso' ? 'Em curso' : t.estado === 'concluida' ? 'Concluída' : 'Aberta'
  const offset = 176 - (Math.max(0, Math.min(100, t.progressoPct)) / 100) * 176
  return (
    <a className="card-b reveal" href={t.slug ? `/jornada/${t.slug}` : '#'}>
      <div className="lado-info">
        <span className="estado">{estadoTxt}</span>
        <h3>{t.nome}</h3>
        {t.descricao && <p className="desc">{t.descricao}</p>}
        <div className="stats">
          <div className="stat"><b>{t.totalCursos}</b><span>Cursos</span></div>
          <div className="stat"><b>{t.horas}h</b><span>Conteúdo</span></div>
          <div className="stat"><b>{t.cursosConcluidos}</b><span>Concluído</span></div>
        </div>
      </div>
      <div className="lado-anel">
        <div className="anel">
          <svg viewBox="0 0 64 64"><circle className="abg" cx="32" cy="32" r="28" /><circle className="afg" cx="32" cy="32" r="28" style={{ strokeDashoffset: offset }} /></svg>
          <b>{t.progressoPct}%</b>
        </div>
        <span className="anel-rot">Progresso</span>
      </div>
    </a>
  )
}

function CardTambemEmAndamento({ t }: { t: Territorio }) {
  return (
    <a className="tea-card reveal" href={t.slug ? `/jornada/${t.slug}` : '#'}>
      <span className="tea-nome">{t.nome}</span>
      <div className="tea-barra"><i style={{ width: `${t.progressoPct}%` }}></i></div>
      <span className="tea-pct num">{t.progressoPct}% · {t.cursosConcluidos}/{t.totalCursos} cursos</span>
    </a>
  )
}

export default function JornadaContent({ dados, nav }: { dados: DadosJornada; nav: DadosNav }) {
  const d = dados
  const raiz = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const anima = (el: Element) =>
      el.querySelectorAll<HTMLElement>('i[data-fill]').forEach(i => { i.style.width = i.dataset.fill ?? '0%' })
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      raiz.current?.querySelectorAll('.reveal').forEach(el => el.classList.add('visivel'))
      if (raiz.current) anima(raiz.current)
      return
    }
    const io = new IntersectionObserver(es => {
      es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visivel'); anima(e.target); io.unobserve(e.target) } })
    }, { threshold: .12, rootMargin: '0px 0px -4% 0px' })
    raiz.current?.querySelectorAll('.reveal').forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])

  const dataSelo = formatarDataSelo(d.seloConquistadoEm)

  return (
    <div ref={raiz} className="pagina-jornada">
      <div className="grao" aria-hidden="true"></div>

      <NavPlataforma dados={nav} ativo="trilhas" />

      {/* ============ HERO ============ */}
      <section className="hero">
        <div className="aurora a1" aria-hidden="true"></div>
        <div className="aurora a2" aria-hidden="true"></div>
        <div className="wrap">
          <div className="hero-grid">
            <div>
              <span className="eyebrow">Jornada profissional</span>
              <h1>Seu mapa para se tornar um <span className="grad-txt">perito impossível de ignorar.</span></h1>
            </div>
            <div className="hero-aside">
              <p className="sub">Não é uma coleção de cursos. É uma progressão desenhada para transformar repertório em resultado, reconhecimento e autoridade.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="wrap">
        <hr className="linha-grad" />

        <div className="palco">
          {/* ============ SELO CONQUISTADO ============ */}
          {d.seloConquistado && (
            <div className="selo-card reveal">
              <div className="brilho" aria-hidden="true"></div>
              <div className="selo-icone"><SeloExcelencia size={34} /></div>
              <div className="selo-info">
                <span className="selo-tag">Selo de Excelência conquistado</span>
                <h3>{d.trilhaPrincipalNome ?? 'Formação Pericial de Alta Performance'} concluída</h3>
                <p>Formação completa{dataSelo ? ` · Concluída em ${dataSelo}` : ''} · Insígnia permanente no seu perfil</p>
              </div>
              {d.trilhaPrincipalSlug && (
                <div className="selo-acao">
                  <a href={`/jornada/${d.trilhaPrincipalSlug}`}>Rever cursos da formação</a>
                </div>
              )}
            </div>
          )}

          {/* ============ PAINEL PRINCIPAL (formação em curso OU protagonista) ============ */}
          {d.painelFormacao && <PainelCard painel={d.painelFormacao} icone="formacao" />}

          {!d.painelFormacao && d.seloConquistado && d.painelProtagonista && (
            <PainelCard painel={d.painelProtagonista} icone="territorio" />
          )}

          {!d.painelFormacao && d.seloConquistado && !d.painelProtagonista && (
            <div className="convite reveal">
              <h2>Seu selo está garantido. <span className="grad-txt">Onde sua autoridade vai crescer agora?</span></h2>
              <a className="btn-grad" href="#territorios">Explorar territórios <span className="seta">↗</span></a>
            </div>
          )}

          {!d.painelFormacao && !d.seloConquistado && (
            <div className="vazio reveal">
              <p>A {d.trilhaPrincipalNome ?? 'Formação Pericial de Alta Performance'} está sendo estruturada. Volte em breve para começar sua missão.</p>
            </div>
          )}

          {/* ============ STATS RAIL ============ */}
          <div className="stats-rail reveal">
            <div className="stat-item"><span className="stat-num">{String(nav.nivel).padStart(2, '0')}</span><div className="stat-txt"><small>Nível atual</small><strong>{nav.titulo}</strong></div></div>
            <div className="stat-item"><span className="stat-num accent">+{fmtNum(nav.faltaXp)}</span><div className="stat-txt"><small>XP para o próximo</small><strong>{nav.proximoNivelNome ?? 'Nível máximo'}</strong></div></div>
            <div className="stat-item"><span className="stat-num">{nav.sequenciaDias}</span><div className="stat-txt"><small>Dias em movimento</small><strong>Sua sequência atual</strong></div></div>
            <div className="stat-item"><span className="stat-num">{fmtNum(d.aulasConcluidas)}</span><div className="stat-txt"><small>Aulas concluídas</small><strong>Rastro verificável</strong></div></div>
          </div>

          {/* ============ TAMBÉM EM ANDAMENTO ============ */}
          {d.tambemEmAndamento.length > 0 && (
            <div className="tambem-em-andamento reveal">
              <span className="eyebrow">Também em andamento</span>
              <div className="tea-grid">
                {d.tambemEmAndamento.map(t => <CardTambemEmAndamento t={t} key={t.id} />)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============ TERRITÓRIOS ============ */}
      <section className="especializacoes" id="territorios">
        <div className="aurora" aria-hidden="true"></div>
        <div className="wrap">
          <div className="esp-header reveal">
            <div>
              <span className="eyebrow">Territórios de especialização</span>
              <h2>Escolha onde sua <span className="grad-txt">autoridade vai crescer.</span></h2>
            </div>
            <p className="sub">Cada território é uma carreira possível. Você avança no seu ritmo, mas nunca sem direção. Todos os territórios estão abertos.</p>
          </div>

          {d.territorios.length > 0 ? (
            <div className="esp-grid">
              {d.territorios.map(t => <CardTerritorio t={t} key={t.id} />)}
            </div>
          ) : (
            <p className="vazio-txt">Os territórios de especialização estão sendo cadastrados — volte em breve.</p>
          )}
        </div>
      </section>

      {/* ============ FECHAMENTO ============ */}
      <section className="fechamento">
        <span className="eyebrow">Peritos Academy · Jornada</span>
        <h2>Conhecimento não é o destino.<br /><span className="grad-txt">Autoridade é.</span></h2>
        <a className="btn-grad" href="/cursos">Explorar todos os cursos <span className="seta">↗</span></a>
      </section>
    </div>
  )
}

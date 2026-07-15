// components/HomeContent.tsx
// O dashboard: réplica fiel do template aprovado, plugada na query da home.
'use client'

import { useEffect, useRef } from 'react'
import type { DadosHome, CursoCard } from '@/lib/queries/home'
import NavPlataforma from '@/components/NavPlataforma'
import type { DadosNav } from '@/lib/queries/nav'
import { IconePlay, IconeCheck } from '@/components/Icones'
import { AoVivo } from '@/components/Emblemas'
import TourGuiado from '@/components/TourGuiado'

const fmtNum = (n: number) => n.toLocaleString('pt-BR')

// ---------- card de curso (vitrines) ----------
function CardCurso({ c }: { c: CursoCard }) {
  const emAndamento = c.progressoPct > 0 && c.progressoPct < 100
  return (
    <a className="card-curso" href={c.href} role="listitem">
      <div className="card-capa" style={c.capa_url ? { backgroundImage: `url(${c.capa_url})` } : undefined}>
        <span className="acao btn-quieto">{c.motivo}</span>
      </div>
      <div className="card-info">
        <span className="titulo">{c.titulo}</span>
        <div className="meta-linha">
          {emAndamento ? (
            <>
              <div className="barra"><i style={{ width: `${c.progressoPct}%` }}></i></div>
              <span className="pct num">{c.progressoPct}%</span>
            </>
          ) : c.novo ? (
            <span className="estado-novo">Novo</span>
          ) : (
            <span className="pct num">{c.aulas > 0 ? `${c.aulas} aulas` : 'Em breve'}</span>
          )}
        </div>
      </div>
    </a>
  )
}

export default function HomeContent({ dados, nav }: { dados: DadosHome; nav: DadosNav }) {
  const d = dados
  const raiz = useRef<HTMLDivElement>(null)
  const trilhoFeitas = d.trilho.filter(e => e.estado === 'feita').length
  const trilhoPct = d.trilho.length ? Math.round((trilhoFeitas / d.trilho.length) * 100) : 0

  // reveals + barras
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

  return (
    <div ref={raiz} className="pagina-home">
      <div className="grao" aria-hidden="true"></div>

      <TourGuiado mostrarInicial={d.mostrarTourInicial} primeiraAulaHref={d.tourPrimeiraAulaHref} />

      {/* ============ NAV ============ */}
      <NavPlataforma dados={nav} ativo="inicio" />

      {/* ============ HERO ============ */}
      <section className="hero" aria-label="Sua próxima missão">
        <div className="hero-bg" aria-hidden="true"></div>
        <div className="hero-conteudo wrap">
          <div className="hero-saudacao">
            <span className="ponto" aria-hidden="true"></span>
            <span className="eyebrow">{d.dataHoje} · {d.saudacao}, {d.primeiroNome}</span>
          </div>
          <h1 className="display">{d.tituloHero}</h1>
          <p className="sub">
            {d.continuarCurso
              ? <>Você está em <strong>{d.continuarCurso.titulo}</strong>. Continue de onde parou e mantenha o ritmo.</>
              : <>Sua jornada está pronta. Comece a primeira missão e construa sua autoridade.</>}
          </p>
          <div className="hero-ctas">
            <a className="btn btn-primario" data-tour="hero-cta" href={d.continuarCurso ? d.continuarCurso.href : '/jornada'}>
<IconePlay size={13} />
              {d.continuarCurso && d.continuarCurso.progressoPct > 0 ? 'Continuar de onde parei' : 'Começar agora'}
            </a>
            <a className="btn btn-fantasma" href="/jornada">Ver minha jornada</a>
          </div>
          <div className="hero-missao">
            <div className="hero-missao-topo">
              <span className="nome">{d.missaoAtualNome}</span>
              <span className="pct num">{d.missaoAtualPct}%</span>
            </div>
            <div className="barra" role="progressbar" aria-valuenow={d.missaoAtualPct} aria-valuemin={0} aria-valuemax={100}>
              <i style={{ width: `${d.missaoAtualPct}%` }}></i>
            </div>
            {d.proximaAulaNome && <p className="prox">Continue por · <b>{d.proximaAulaNome}</b></p>}
          </div>
        </div>
      </section>

      {/* ============ INDICADORES ============ */}
      <section className="indicadores" aria-label="Resumo de hoje">
        <div className="wrap">
          <div className="ind-grid reveal">
            <div className="ind">
              <span className="rotulo">Meta semanal</span>
              <span className="valor num">{d.metaDias}</span>
              <span className="detalhe">Estude hoje para manter a sequência</span>
            </div>
            <div className="ind">
              <span className="rotulo">Próxima conquista</span>
              <span className="valor">{d.proximaConquista}</span>
              <span className="detalhe num">{d.proximaConquistaFalta}</span>
            </div>
            {d.eventoHoje && (
              <div className="ind">
                <span className="rotulo">Hoje · {d.eventoHoje.hora}</span>
                <span className="valor">{d.eventoHoje.titulo}</span>
                <span className="detalhe"><a href="#aovivo">Reservar lugar</a></span>
              </div>
            )}
            <div className="ind">
              <span className="rotulo">Moedas acumuladas</span>
              <span className="valor num">{fmtNum(d.moedas)}</span>
              <span className="detalhe">Troque por recompensas em breve</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============ JORNADA (trilho) ============ */}
      <section className="jornada" id="jornada" aria-label="Sua jornada">
        <div className="wrap">
          <div className="secao-cab reveal">
            <div>
              <span className="eyebrow">Sua evolução</span>
              <h2 className="h2">{d.evolucaoTitulo}</h2>
              {d.evolucaoDescricao && <p className="sub">{d.evolucaoDescricao}</p>}
            </div>
            <a className="link-secao" href="/jornada">Explorar todas as trilhas <span className="seta">→</span></a>
          </div>
          <div className="trilho reveal">
            <div className="trilho-linha" aria-hidden="true"><i style={{ width: `${trilhoPct}%` }}></i></div>
            <ol className="etapas" style={{ listStyle: 'none' }}>
              {d.trilho.map(e => (
                <li key={e.numero} className={`etapa${e.estado === 'feita' ? ' feita' : e.estado === 'atual' ? ' atual' : ''}`}>
                  <span className="no" aria-hidden="true">{e.estado === 'feita' ? <IconeCheck size={13} /> : String(e.numero).padStart(2, '0')}</span>
                  <div><div className="nome" title={e.nome}>{e.nome}</div><div className={`estado${e.estado === 'atual' ? ' num' : ''}`}>{e.detalhe}</div></div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ============ VITRINE ============ */}
      <section className="vitrine" id="vitrine" aria-label="Escolhido para o seu momento">
        <div className="wrap">
          <div className="secao-cab reveal">
            <div>
              <span className="eyebrow">Para você</span>
              <h2 className="h2">Escolhido para o seu momento.</h2>
            </div>
            <a className="link-secao" href="/cursos">Ver biblioteca completa <span className="seta">→</span></a>
          </div>
        </div>
        <div className="wrap">
          <div className="carrossel reveal" role="list">
            {d.vitrine.map(c => <CardCurso key={c.slug} c={c} />)}
          </div>
        </div>
      </section>

      {/* ============ MEU PLANO ============ */}
      <section className="plano" aria-label="Meu plano de estudo">
        <div className="wrap">
          <div className="secao-cab reveal">
            <div>
              <span className="eyebrow">Organize seus estudos</span>
              <h2 className="h2">Meu plano.</h2>
              <p className="sub">Agrupe cursos por objetivo e siga no seu ritmo.</p>
            </div>
          </div>
          <div className="plano-grid reveal">
            <button className="plano-novo">
              <span className="mais" aria-hidden="true">+</span>
              <b>Criar novo plano</b>
              <span>Monte uma sequência de cursos e acompanhe o avanço até o seu objetivo.</span>
            </button>
          </div>
        </div>
      </section>

      {/* ============ AO VIVO + COMUNIDADE ============ */}
      <section className="duo" id="aovivo" aria-label="Ao vivo e comunidade">
        <div className="wrap">
          <div className="duo-grid">
            {d.eventoLive && (
              <article className="painel painel-live reveal">
                <span className="selo-vivo"><AoVivo size={10} />{d.eventoLive.horaRotulo}</span>
                <span className="eyebrow" style={{ marginTop: 'var(--s-6)' }}>Sala de análise</span>
                <h3>{d.eventoLive.titulo}</h3>
                {d.eventoLive.descricao && <p className="sub">{d.eventoLive.descricao}</p>}
                <div className="painel-live-rodape">
                  <div className="prof">
                    <span className="foto" aria-hidden="true">{d.eventoLive.apresentadorIniciais}</span>
                    <span className="quem"><b>{d.eventoLive.apresentador}</b>{d.eventoLive.horaRotulo}</span>
                  </div>
                  <a className="btn btn-primario" href="/agenda">Reservar lugar</a>
                </div>
              </article>
            )}
            <aside className="painel painel-com reveal">
              <div className="cab">
                <h3>Peritos em movimento.</h3>
                {d.online > 0 && <span className="online num"><span className="ponto" aria-hidden="true"></span>{d.online} online</span>}
              </div>
              {d.movimento.length > 0 ? (
                <ul className="mov">
                  {d.movimento.map((m, i) => (
                    <li key={i}><a href={m.link}>
                      <span className="foto" aria-hidden="true">{m.iniciais}</span>
                      <span className="txt">
                        <b>{m.titulo}</b>
                        <span>{m.detalhe}</span>
                        <time>{m.quando}</time>
                      </span>
                    </a></li>
                  ))}
                </ul>
              ) : (
                <p className="sub" style={{ padding: 'var(--s-4) 0' }}>A comunidade está começando — seja o primeiro a compartilhar.</p>
              )}
              <a className="btn btn-fantasma" href="/comunidade">Entrar na comunidade</a>
            </aside>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="footer">
        <div className="wrap">
          <p className="footer-tag reveal">Conhecimento aplicado. Autoridade construída.</p>
          <div className="footer-baixo">
            <div className="footer-logo"><span>peritos academy</span></div>
            <nav className="footer-links" aria-label="Links do rodapé">
              <a href="#">Suporte</a>
              <a href="#">Privacidade</a>
              <a href="/perfil">Certificados</a>
            </nav>
            <span className="footer-copy">© 2026 Peritos Academy</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
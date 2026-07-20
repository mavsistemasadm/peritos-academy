// components/HomeContent.tsx
// O dashboard: réplica fiel do template aprovado, plugada na query da home.
'use client'

import { useEffect, useRef, useState } from 'react'
import type { DadosHome, CursoCard } from '@/lib/queries/home'
import NavPlataforma from '@/components/NavPlataforma'
import type { DadosNav } from '@/lib/queries/nav'
import type { PlanoVivo } from '@/lib/queries/meuPlano'
import type { AnamneseProgresso, Territorio } from '@/lib/queries/anamnese'
import { IconePlay, IconeCheck } from '@/components/Icones'
import { AoVivo } from '@/components/Emblemas'
import TourGuiado from '@/components/TourGuiado'
import { caminhoCurvo } from '@/lib/rota/caminhoCurvo'

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

type Props = {
  dados: DadosHome
  nav: DadosNav
  plano: PlanoVivo
  progressoRota: AnamneseProgresso
  textosRota: Record<string, string>
  territoriosRota: Territorio[]
}

export default function HomeContent({ dados, nav, plano, progressoRota, textosRota, territoriosRota }: Props) {
  const d = dados
  const raiz = useRef<HTMLDivElement>(null)
  const [heroCapaErro, setHeroCapaErro] = useState(false)
  const trilhoFeitas = d.trilho.filter(e => e.estado === 'feita').length
  const trilhoPct = d.trilho.length ? Math.round((trilhoFeitas / d.trilho.length) * 100) : 0
  const estacaoAtualRota = plano.estacoes.find(e => e.estado === 'atual') ?? null

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
        <div className="hero-bg" aria-hidden="true">
          {d.heroCapaUrl && !heroCapaErro && (
            <img
              src={d.heroCapaUrl}
              alt=""
              className="hero-capa-img"
              onError={() => setHeroCapaErro(true)}
            />
          )}
        </div>
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

      {/* ============ ROTA DO PERITO ============ */}
      <section className="rota" aria-label="Sua Rota do Perito">
        <div className="wrap">
          <div className="secao-cab reveal">
            <div>
              <span className="eyebrow">Sua rota</span>
              <h2 className="h2 grad-txt">Minha Rota do Perito</h2>
            </div>
            {plano.temPlano && <a className="link-secao" href="/meu-plano">Ver mapa completo <span className="seta">→</span></a>}
          </div>

          {!plano.temPlano && progressoRota.questoesRespondidas === 0 && (
            <div className="rota-convite reveal">
              <div className="rota-convite-bg" aria-hidden="true" />
              <div className="rota-convite-vinheta" aria-hidden="true" />
              <div className="rota-convite-conteudo">
                <h3>{textosRota.convite_titulo}</h3>
                <p>{textosRota.meu_plano_convite_linha}</p>
                <a className="btn btn-primario" href="/anamnese">{textosRota.convite_botao_acao}</a>
              </div>
            </div>
          )}

          {!plano.temPlano && progressoRota.questoesRespondidas > 0 && (
            <div className="rota-retomar reveal">
              <h3>{textosRota.meu_plano_retomar_titulo}</h3>
              <p className="rota-retomar-sub">
                Pergunta {Math.min(progressoRota.questoesRespondidas + 1, progressoRota.totalQuestoes)} de {progressoRota.totalQuestoes}
              </p>
              <div className="rota-retomar-barra">
                <i style={{ width: `${Math.round((progressoRota.questoesRespondidas / progressoRota.totalQuestoes) * 100)}%` }} />
              </div>
              <a className="btn btn-primario" href="/anamnese">{textosRota.meu_plano_retomar_cta}</a>
            </div>
          )}

          {plano.temPlano && (
            <div className="rota-compacto reveal">
              <a href="/meu-plano" className="rota-mapa-fundo" aria-label="Ver mapa completo da minha Rota do Perito">
                <img src="/rota/mesa-perito.png" alt="Mapa da minha Rota do Perito" className="rota-mapa-img" />

                <svg className="rota-mapa-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {plano.estacoes.map((e, i) => {
                    const de = i === 0 ? { x: plano.entradaXPct, y: plano.entradaYPct } : { x: plano.estacoes[i - 1].xPct, y: plano.estacoes[i - 1].yPct }
                    const percorrido = e.estado === 'concluida' || e.estado === 'atual'
                    return (
                      <path
                        key={e.trilhaId}
                        d={caminhoCurvo(de.x, de.y, e.xPct, e.yPct, i)}
                        fill="none"
                        stroke={percorrido ? 'url(#rota-grad-linha-home)' : 'rgba(255,255,255,.18)'}
                        strokeWidth="0.6"
                        strokeLinecap="round"
                        strokeDasharray={percorrido ? undefined : '2,2'}
                      />
                    )
                  })}
                  <defs>
                    <linearGradient id="rota-grad-linha-home" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#20D9A6" />
                      <stop offset="100%" stopColor="#36DCD1" />
                    </linearGradient>
                  </defs>
                </svg>

                {estacaoAtualRota && (
                  <span className="rota-marcador" style={{ left: `${estacaoAtualRota.xPct}%`, top: `${estacaoAtualRota.yPct}%` }}>
                    <b>{textosRota.microcopy_marcador_inicial}</b>
                  </span>
                )}

                {territoriosRota.map(t => {
                  const estacao = plano.estacoes.find(e => e.trilhaId === t.trilhaId)
                  const naRota = !!estacao
                  return (
                    <div
                      key={t.trilhaId}
                      className={`rota-territorio${naRota ? ` na-rota ${estacao!.estado}` : ' fora-rota'}`}
                      style={{ left: `${t.xPct}%`, top: `${t.yPct}%` }}
                      title={t.descricaoCurta}
                    >
                      <span className="rota-territorio-ponto" />
                      {estacao?.estado === 'atual' && <span className="rota-anel-pulsante" />}
                      <div className="rota-territorio-rotulo">
                        <b>{t.trilhaNome}</b>
                        {!naRota && <em className="rota-tag-explorar">{textosRota.microcopy_territorio_explorar}</em>}
                      </div>
                    </div>
                  )
                })}
              </a>
              <div className="rota-compacto-info">
                {estacaoAtualRota ? (
                  <>
                    <div className="rota-compacto-txt">
                      <span className="rota-compacto-nome">{estacaoAtualRota.trilhaNome}</span>
                      <span className="rota-compacto-pct num">{estacaoAtualRota.progressoPct}% concluído</span>
                    </div>
                    {estacaoAtualRota.continuarHref && (
                      <a className="btn btn-primario" href={estacaoAtualRota.continuarHref}>Continuar</a>
                    )}
                  </>
                ) : (
                  <>
                    <div className="rota-compacto-txt">
                      <span className="rota-compacto-nome">Rota concluída</span>
                      <span className="rota-compacto-pct num">100%</span>
                    </div>
                    <a className="btn btn-primario" href="/meu-plano">Ver mapa completo</a>
                  </>
                )}
              </div>
            </div>
          )}
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
                <p className="sub" style={{ padding: 'var(--s-4) 0' }}>A comunidade está começando. Seja o primeiro a compartilhar.</p>
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
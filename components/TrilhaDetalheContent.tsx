// components/TrilhaDetalheContent.tsx
// /jornada/[slug] — espinha vertical com as etapas expandidas em cursos,
// reaproveitando o layout original da jornada, 100% plugado em dados reais.
// Nenhuma etapa é travada: só feita/atual/pendente, todas acessíveis.
'use client'

import { useEffect, useRef } from 'react'
import type { TrilhaDetalhe, EtapaDetalhe, CursoDetalhe } from '@/lib/queries/jornada'
import NavPlataforma from '@/components/NavPlataforma'
import type { DadosNav } from '@/lib/queries/nav'
import { IconeCheck } from '@/components/Icones'
import { InsigniaEtapa, SeloExcelencia } from '@/components/Emblemas'

const pad2 = (n: number) => String(n).padStart(2, '0')

function LinhaCurso({ c }: { c: CursoDetalhe }) {
  const href = `/curso/${c.slug}`
  return (
    <a className="missao" href={href}>
      {c.capaUrl && <img src={c.capaUrl} alt="" />}
      <span className="missao-txt">
        <b>{c.titulo}</b>
        <span className="barra"><i style={{ width: `${c.completo ? 100 : c.progressoPct}%` }}></i></span>
        {c.completo ? (
          <span className="feito-tag">Concluída{c.notaMedia != null ? ` · nota ${c.notaMedia.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}` : ''}</span>
        ) : c.progressoPct > 0 ? (
          <span className="num">{c.progressoPct}% · continuar daqui</span>
        ) : (
          <span className="novo-tag">Começar{c.totalAulas ? ` · ${c.totalAulas} aulas` : ''}</span>
        )}
      </span>
    </a>
  )
}

function CardEtapa({ e, numero }: { e: EtapaDetalhe; numero: number }) {
  const feitos = e.cursos.filter(c => c.completo).length
  return (
    <div className={`etapa ${e.estado} reveal`}>
      <div className="etapa-no" aria-hidden="true">
        {e.estado === 'feita' ? <IconeCheck size={13} /> : pad2(numero)}
      </div>
      <div className="etapa-corpo">
        <span className="fantasma" aria-hidden="true">{pad2(numero)}</span>
        <div className="etapa-cab">
          <span className="rotulo-etapa">
            Etapa {pad2(numero)}
            {e.estado === 'feita' && <> · Concluída</>}
            {e.estado === 'atual' && <> · Você está aqui · {feitos} de {e.cursos.length} cursos</>}
          </span>
          <h2>{e.nome}</h2>
          {e.descricao && <p className="desc">{e.descricao}</p>}
        </div>
        {e.cursos.length > 0 ? (
          <div className="missoes">
            {e.cursos.map(c => <LinhaCurso key={c.id} c={c} />)}
          </div>
        ) : (
          <p className="vazio-txt">Cursos desta etapa ainda sendo cadastrados.</p>
        )}
        {e.estado === 'feita' && (
          <div className="etapa-rodape">
            <span className="recompensa ganha">
              <span className="mini-selo" aria-hidden="true"><IconeCheck size={13} strokeWidth={2.6} /></span>
              Etapa concluída
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TrilhaDetalheContent({ dados, nav }: { dados: TrilhaDetalhe; nav: DadosNav }) {
  const d = dados
  const raiz = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const rm = matchMedia('(prefers-reduced-motion: reduce)').matches
    const fio = raiz.current?.querySelector<HTMLElement>('.fio')
    const etapasEl = raiz.current?.querySelector<HTMLElement>('.etapas')
    const espinhaFio = raiz.current?.querySelector<HTMLElement>('.espinha-fio')

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
      if (espinhaFio) espinhaFio.style.height = '100%'
    } else {
      const io = new IntersectionObserver(es => {
        es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visivel'); io.unobserve(e.target) } })
      }, { threshold: .14, rootMargin: '0px 0px -5% 0px' })
      raiz.current?.querySelectorAll('.reveal').forEach(el => io.observe(el))
      aoRolar()
    }
    return () => removeEventListener('scroll', aoRolar)
  }, [])

  const progressoPct = d.etapasTotal ? Math.round((d.etapasFeitas / d.etapasTotal) * 100) : 0

  return (
    <div ref={raiz} className="pagina-trilha-detalhe">
      <div className="grao" aria-hidden="true"></div>
      <div className="fio" aria-hidden="true"></div>

      <NavPlataforma dados={nav} ativo="trilhas" />

      {/* ============ HERO ============ */}
      <section className={`hero${d.principal ? ' dourado' : ''}`}>
        <div className="wrap">
          <a className="voltar" href="/jornada">← Voltar para a jornada</a>
          <span className="eyebrow">{d.principal ? 'Trilha obrigatória · Formação' : 'Território de especialização'}</span>
          <h1>{d.nome}</h1>
          {d.descricao && <p className="sub">{d.descricao}</p>}
          <div className="hero-stats">
            <div className="stat destaque">
              <span className="grande num">{d.etapasFeitas}<small>/{d.etapasTotal}</small></span>
              <span className="rot">etapas concluídas</span>
            </div>
            <div className="stat">
              <span className="grande num">{progressoPct}%</span>
              <span className="rot">do progresso</span>
            </div>
            <div className="stat">
              <span className="grande num">{d.horas}h</span>
              <span className="rot">de conteúdo</span>
            </div>
            {d.alunos > 0 && (
              <div className="stat">
                <span className="grande num">{d.alunos.toLocaleString('pt-BR')}</span>
                <span className="rot">peritos nesta trilha</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ============ MAPA ============ */}
      <section className="mapa">
        <div className="wrap">
          {d.etapas.length > 0 ? (
            <div className="etapas">
              <div className="espinha" aria-hidden="true"><div className="espinha-fio"></div></div>

              {d.etapas.map((e, i) => <CardEtapa key={e.id} e={e} numero={i + 1} />)}

              {/* MARCO FINAL */}
              <div className={`marco reveal${d.principal ? ' dourado' : ''}`}>
                <div className="marco-no" aria-hidden="true">
                  {d.principal ? <SeloExcelencia size={22} /> : <InsigniaEtapa size={22} />}
                </div>
                <div className="marco-cartao">
                  <span className="rotulo-etapa">Marco final</span>
                  <h2>{d.marcoFinalNome}.</h2>
                  <p>
                    {d.principal
                      ? 'Ao concluir todas as etapas desta formação, você conquista o Selo de Excelência, insígnia permanente no seu perfil.'
                      : `Ao concluir: insígnia ${d.nome} no seu perfil.`}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="vazio-txt">Esta trilha ainda está sendo estruturada. As etapas aparecem aqui assim que forem cadastradas.</p>
          )}
        </div>
      </section>
    </div>
  )
}

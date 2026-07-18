// components/CursosBibliotecaContent.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import NavPlataforma from '@/components/NavPlataforma'
import type { DadosNav } from '@/lib/queries/nav'
import type { CursoCard, DadosBibliotecaCursos, TrilhaSecao } from '@/lib/queries/cursos-biblioteca'
import { IconeSearch, IconeClose, IconeBookOpen } from '@/components/Icones'

function fmtDuracao(seg: number) {
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  if (h > 0) return `${h}h ${m}min`
  return `${m}min`
}

function metaTxt(c: CursoCard) {
  if (c.aulasCount === 0) return null
  const aulasTxt = `${c.aulasCount} ${c.aulasCount === 1 ? 'aula' : 'aulas'}`
  return c.duracaoSeg > 0 ? `${aulasTxt} · ${fmtDuracao(c.duracaoSeg)}` : aulasTxt
}

function normalizar(s: string) {
  return s
    .normalize('NFD')
    .split('')
    .filter(ch => {
      const code = ch.charCodeAt(0)
      return code < 0x0300 || code > 0x036f
    })
    .join('')
    .toLowerCase()
}

function CardCurso({ c }: { c: CursoCard }) {
  const meta = metaTxt(c)
  return (
    <a className="bc-card" href={`/curso/${c.slug}`}>
      <div className="bc-card-capa">
        {c.capa_url ? (
          <img src={c.capa_url} alt="" loading="lazy" />
        ) : (
          <div className="bc-card-placeholder">
            <span>{c.titulo.slice(0, 2).toUpperCase()}</span>
          </div>
        )}
        {c.nivel && <span className="bc-card-nivel" data-nivel={c.nivel.toLowerCase()}>{c.nivel}</span>}
        {c.progresso !== null && c.progresso > 0 && (
          <div className="bc-card-barra-wrap"><i style={{ width: `${c.progresso}%` }}></i></div>
        )}
      </div>
      <div className="bc-card-body">
        <h3>{c.titulo}</h3>
        {c.subtitulo && <p className="bc-card-sub">{c.subtitulo}</p>}
        {meta && <div className="bc-card-meta num"><span>{meta}</span></div>}
      </div>
    </a>
  )
}

export default function CursosBibliotecaContent({ dados, nav }: { dados: DadosBibliotecaCursos; nav: DadosNav }) {
  const { continuar, trilhas, totalCursos } = dados
  const [buscaInput, setBuscaInput] = useState('')
  const [busca, setBusca] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setBusca(buscaInput), 150)
    return () => clearTimeout(t)
  }, [buscaInput])

  const buscaNorm = normalizar(busca.trim())

  const trilhasFiltradas: TrilhaSecao[] = useMemo(() => {
    if (!buscaNorm) return trilhas
    return trilhas
      .map(t => ({
        ...t,
        cursos: t.cursos.filter(c =>
          normalizar(c.titulo).includes(buscaNorm) ||
          (c.subtitulo && normalizar(c.subtitulo).includes(buscaNorm))
        ),
      }))
      .filter(t => t.cursos.length > 0)
  }, [trilhas, buscaNorm])

  return (
    <div className="pagina-bib-cursos">
      <div className="grao" aria-hidden="true"></div>
      <NavPlataforma dados={nav} ativo="trilhas" />

      <div className="wrap">
        <div className="bc-topo-simples">
          <h1>Biblioteca de <span className="grad-txt">cursos</span></h1>
          <p className="bc-topo-sub">{totalCursos} cursos disponíveis · Evolua do fundamento à autoridade</p>
        </div>

        {continuar.length > 0 && (
          <section className="bc-continuar">
            <h2>Continue de onde parou</h2>
            <div className="bc-grade">
              {continuar.map(c => <CardCurso key={c.id} c={c} />)}
            </div>
          </section>
        )}

        {trilhas.length === 0 ? (
          <div className="bc-vazio-geral">
            <IconeBookOpen size={28} />
            <p>Ainda não há cursos publicados. Volte em breve.</p>
          </div>
        ) : (
          <>
            <div className="bc-busca">
              <IconeSearch size={16} strokeWidth={2} />
              <input
                type="text"
                placeholder="Buscar curso por título ou descrição..."
                value={buscaInput}
                onChange={e => setBuscaInput(e.target.value)}
              />
              {buscaInput && (
                <button type="button" className="bc-busca-limpar" onClick={() => setBuscaInput('')} aria-label="Limpar busca">
                  <IconeClose size={14} />
                </button>
              )}
            </div>

            {trilhasFiltradas.length === 0 ? (
              <div className="bc-vazio">
                <p>Nenhum curso encontrado para &quot;{busca}&quot;.</p>
                <button type="button" className="btn btn-fantasma" onClick={() => setBuscaInput('')}>Limpar busca</button>
              </div>
            ) : (
              trilhasFiltradas.map(t => (
                <section className="bc-trilha-secao" id={`trilha-${t.slug}`} key={t.slug}>
                  <div className="bc-trilha-cab">
                    <div className="bc-trilha-marker"></div>
                    <div className="bc-trilha-textos">
                      <div className="bc-trilha-topo">
                        <h2>{t.nome}</h2>
                        <span className="bc-trilha-count num">{t.cursos.length} {t.cursos.length === 1 ? 'curso' : 'cursos'}</span>
                      </div>
                      {t.descricao && <p className="bc-trilha-desc">{t.descricao}</p>}
                    </div>
                  </div>

                  <div className="bc-grade">
                    {t.cursos.map(c => <CardCurso key={c.id} c={c} />)}
                  </div>
                </section>
              ))
            )}
          </>
        )}
      </div>
    </div>
  )
}

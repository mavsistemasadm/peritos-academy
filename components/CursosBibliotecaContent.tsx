// components/CursosBibliotecaContent.tsx
'use client'

import { useState } from 'react'
import NavPlataforma from '@/components/NavPlataforma'
import type { DadosNav } from '@/lib/queries/nav'
import type { DadosBibliotecaCursos, TrilhaAgrupada } from '@/lib/queries/cursos-biblioteca'

function fmtDuracao(seg: number) {
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  if (h > 0) return `${h}h ${m}min`
  return `${m}min`
}

export default function CursosBibliotecaContent({ dados, nav }: { dados: DadosBibliotecaCursos; nav: DadosNav }) {
  const { trilhas, totalCursos } = dados
  const [trilhaAtiva, setTrilhaAtiva] = useState<string>(trilhas[0]?.slug ?? '')
  const [busca, setBusca] = useState('')

  const trilhaSel = trilhas.find(t => t.slug === trilhaAtiva) ?? trilhas[0]

  // filtra por busca
  const etapasFiltradas = trilhaSel
    ? trilhaSel.etapas.map(e => ({
        ...e,
        cursos: e.cursos.filter(c =>
          !busca.trim() ||
          c.titulo.toLowerCase().includes(busca.toLowerCase()) ||
          (c.subtitulo ?? '').toLowerCase().includes(busca.toLowerCase())
        ),
      })).filter(e => e.cursos.length > 0)
    : []

  return (
    <div className="pagina-bib-cursos">
      <div className="grao" aria-hidden="true"></div>
      <NavPlataforma dados={nav} ativo="trilhas" />

      <div className="bc-hero">
        <div className="wrap">
          <span className="eyebrow">PARA VOCÊ</span>
          <h1>Escolhido para o seu momento.</h1>
          <p className="bc-hero-sub">{totalCursos} cursos disponíveis · Evolua do fundamento à autoridade</p>
        </div>
      </div>

      <div className="wrap">
        {/* abas de trilhas */}
        <div className="bc-trilhas-nav">
          {trilhas.map(t => (
            <button
              key={t.slug}
              className={`bc-trilha-tab${t.slug === trilhaAtiva ? ' ativa' : ''}`}
              onClick={() => setTrilhaAtiva(t.slug)}
            >
              {t.nome}
              <span className="bc-trilha-count num">{t.etapas.reduce((s, e) => s + e.cursos.length, 0)}</span>
            </button>
          ))}
        </div>

{/* descrição da trilha */}
        {trilhaSel?.descricao && (
          <p className="bc-trilha-desc">{trilhaSel.descricao}</p>
        )}

        {/* busca */}
        <div className="bc-busca">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          <input
            type="text"
            placeholder="Buscar curso..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>

        {/* etapas e cursos */}
        {etapasFiltradas.length === 0 ? (
          <p className="bc-vazio">Nenhum curso encontrado{busca ? ` para "${busca}"` : ''}.</p>
        ) : (
          etapasFiltradas.map(etapa => (
            <section className="bc-etapa" key={etapa.nome}>
           <div className="bc-etapa-cab">
                <div className="bc-etapa-marker"></div>
                <div className="bc-etapa-textos">
                  <div className="bc-etapa-topo">
                    <h2>{etapa.nome}</h2>
                    <span className="bc-etapa-count num">{etapa.cursos.length} {etapa.cursos.length === 1 ? 'curso' : 'cursos'}</span>
                  </div>
                  {etapa.descricao && <p className="bc-etapa-desc">{etapa.descricao}</p>}
                </div>
              </div>

              <div className="bc-grade">
                {etapa.cursos.map(c => (
                  <a className="bc-card" key={c.id} href={`/curso/${c.slug}`}>
                    <div className="bc-card-capa">
                      {c.capa_url ? (
                        <img src={c.capa_url} alt="" loading="lazy" />
                      ) : (
                        <div className="bc-card-placeholder">
                          <span>{c.titulo.slice(0, 2).toUpperCase()}</span>
                        </div>
                      )}
                      {c.progresso !== null && c.progresso > 0 && (
                        <div className="bc-card-progresso">
                          <div className="bc-card-barra"><i style={{ width: `${c.progresso}%` }}></i></div>
                          <span className="num">{c.progresso}%</span>
                        </div>
                      )}
{c.nivel && <span className="bc-card-nivel" data-nivel={c.nivel.toLowerCase()}>{c.nivel}</span>}
                    </div>
                    <div className="bc-card-body">
                      <h3>{c.titulo}</h3>
                      {c.subtitulo && <p className="bc-card-sub">{c.subtitulo}</p>}
                      <div className="bc-card-meta num">
                        {c.duracao_seg > 0 && <span>⏱ {fmtDuracao(c.duracao_seg)}</span>}
                        {c.instrutor_nome && <span>👤 {c.instrutor_nome}</span>}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  )
}
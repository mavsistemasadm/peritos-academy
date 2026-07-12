// components/DesafiosContent.tsx
// Galeria de desafios: abas por categoria, cards com prazo, recompensas, participantes.
'use client'

import { useMemo, useState } from 'react'
import NavPlataforma from '@/components/NavPlataforma'
import type { DadosNav } from '@/lib/queries/nav'
import type { DadosDesafios, DesafioCard } from '@/lib/queries/desafios'

const fmtNum = (n: number) => n.toLocaleString('pt-BR')

function CardDesafio({ d }: { d: DesafioCard }) {
  const statusRotulo = d.jaEntregou
    ? `Nota ${d.nota?.toFixed(1).replace('.', ',') ?? '—'}`
    : d.jaAceitou
      ? 'Em andamento'
      : null

  return (
    <a className="des-card" href={`/desafios/${d.slug}`}>
      <div className="des-capa" style={d.capa_url ? { backgroundImage: `url(${d.capa_url})` } : undefined}>
        <div className="des-capa-selos">
          <span className={`selo-plano ${d.plano}`}>{d.plano === 'free' ? 'FREE' : 'PREMIUM'}</span>
          <span className="selo-part num">👥 {fmtNum(d.participantes)} participantes</span>
        </div>
      </div>
      <div className="des-corpo">
        <span className="des-cat">{d.categoria_nome}</span>
        <h3><span className="des-num num">#{d.numero}</span> {d.titulo}</h3>
        <div className="des-meta num">
          <span>⚡ {fmtNum(d.xp)} XP</span>
          <span>🪙 {fmtNum(d.moedas)} moedas</span>
          <span>📋 {d.quesitos} quesitos</span>
          <span>⏱️ {d.prazo_dias} {d.prazo_dias === 1 ? 'dia' : 'dias'}</span>
        </div>
        <div className="des-rodape">
          {statusRotulo ? (
            <span className={`des-status${d.jaEntregou ? ' entregue' : ' andamento'}`}>{statusRotulo}</span>
          ) : (
            <span className="des-cta">Aceitar nomeação →</span>
          )}
        </div>
      </div>
    </a>
  )
}

export default function DesafiosContent({ dados, nav }: { dados: DadosDesafios; nav: DadosNav }) {
  const [abaAtiva, setAbaAtiva] = useState<string>('todos')
  const [busca, setBusca] = useState('')

  const visiveis = useMemo(() => {
    let lista = dados.desafios
    if (abaAtiva !== 'todos') lista = lista.filter(d => d.categoria_slug === abaAtiva)
    if (busca.trim()) {
      const q = busca.trim().toLowerCase()
      lista = lista.filter(d => d.titulo.toLowerCase().includes(q) || d.numero.includes(q))
    }
    return lista
  }, [dados.desafios, abaAtiva, busca])

  return (
    <div className="pagina-desafios">
      <div className="grao" aria-hidden="true"></div>
      <NavPlataforma dados={nav} />

      {/* ============ HERO ============ */}
      <header className="des-hero">
        <div className="wrap">
          <span className="eyebrow">Perícia sob pressão</span>
          <h1>Desafios <span className="grad-txt">periciais.</span></h1>
          <p className="sub">Leia os autos, monte a planilha do zero, responda os quesitos e protocole seu laudo — com prazo correndo e a IA avaliando cada resposta.</p>
          <div className="des-selos num">
            <div className="selo"><b>{dados.totalDesafios}</b><span>disponíveis</span></div>
            <div className="selo"><b>{dados.totalEntregas}</b><span>suas entregas</span></div>
          </div>
        </div>
      </header>

      {/* ============ FILTROS ============ */}
      <main className="wrap des-corpo-pagina">
        <div className="des-filtros">
          <div className="abas" role="tablist" aria-label="Categorias">
            <button role="tab" aria-selected={abaAtiva === 'todos'} className={abaAtiva === 'todos' ? 'ativa' : ''} onClick={() => setAbaAtiva('todos')}>
              Todos <small className="num">{dados.totalDesafios}</small>
            </button>
            {dados.categorias.map(c => (
              <button key={c.slug} role="tab" aria-selected={abaAtiva === c.slug} className={abaAtiva === c.slug ? 'ativa' : ''} onClick={() => setAbaAtiva(c.slug)}>
                {c.nome} <small className="num">{c.qtd}</small>
              </button>
            ))}
          </div>
          <label className="des-busca">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input type="search" placeholder="Buscar por título ou número…" value={busca} onChange={e => setBusca(e.target.value)} />
          </label>
        </div>

        {/* ============ GRADE ============ */}
        {visiveis.length === 0 ? (
          <p className="des-vazio">Nenhum desafio encontrado — tente outra categoria ou busca.</p>
        ) : (
          <div className="des-grade">
            {visiveis.map(d => <CardDesafio key={d.slug} d={d} />)}
          </div>
        )}
      </main>

      <footer className="des-footer">
        <div className="wrap">
          <span>© 2026 Peritos Academy · Desafios periciais</span>
        </div>
      </footer>
    </div>
  )
}
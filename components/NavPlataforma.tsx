// components/NavPlataforma.tsx
// Nav única da plataforma: barra de nível + moedas + foguinho (streak).
// Usada por todas as páginas via <NavPlataforma dados={nav} ativo="..." />.
'use client'

import { useEffect, useRef, useState } from 'react'
import type { DadosNav } from '@/lib/queries/nav'

const fmtNum = (n: number) => n.toLocaleString('pt-BR')

type Aba = 'inicio' | 'trilhas' | 'biblioteca' | 'comunidade' | 'agenda' | 'desafios'

export default function NavPlataforma({ dados, ativo }: { dados: DadosNav; ativo?: Aba }) {
  const d = dados
  const [pop, setPop] = useState(false)
  const area = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!pop) return
    const fora = (e: MouseEvent) => { if (!area.current?.contains(e.target as Node)) setPop(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setPop(false) }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc) }
  }, [pop])

  return (
    <header className="nav-plat">
      <div className="np-inner">
        <a className="np-logo" href="/" aria-label="Peritos Academy — Início">
          <span>peritos<small>academy</small></span>
        </a>

        <nav className="np-links" aria-label="Navegação principal">
          <a href="/" className={ativo === 'inicio' ? 'ativo' : undefined} aria-current={ativo === 'inicio' ? 'page' : undefined}>Início</a>
          <a href="/jornada" className={ativo === 'trilhas' ? 'ativo' : undefined} aria-current={ativo === 'trilhas' ? 'page' : undefined}>Trilhas</a>
          <a href="/biblioteca" className={ativo === 'biblioteca' ? 'ativo' : undefined} aria-current={ativo === 'biblioteca' ? 'page' : undefined}>Biblioteca</a>
            <a href="/comunidade" className={ativo === 'comunidade' ? 'ativo' : undefined} aria-current={ativo === 'comunidade' ? 'page' : undefined}>Comunidade</a>
            <a href="/agenda" className={ativo === 'agenda' ? 'ativo' : undefined} aria-current={ativo === 'agenda' ? 'page' : undefined}>Agenda</a>
            <a href="/desafios" className={ativo === 'desafios' ? 'ativo' : undefined} aria-current={ativo === 'desafios' ? 'page' : undefined}>Desafios</a>
        </nav>

        <div className="np-acoes">
          {d.logado ? (
            <>
              {/* barra de nível: insígnia + XP + progresso */}
              <div className="np-nivel-wrap" ref={area}>
                <button className="np-nivel" aria-expanded={pop} onClick={() => setPop(v => !v)}
                  aria-label={`Nível ${d.nivel} — ${fmtNum(d.xp)} de ${fmtNum(d.xpProximo)} XP`}>
                  <span className="np-insignia num" aria-hidden="true">{d.nivel}</span>
                  <span className="np-nivel-info">
                    <span className="np-xp-linha num"><b>{fmtNum(d.xp)}</b><small>/{fmtNum(d.xpProximo)} XP</small></span>
                    <span className="np-barra"><i style={{ width: `${d.progressoPct}%` }}></i></span>
                  </span>
                </button>

                {pop && (
                  <div className="np-pop" role="dialog" aria-label="Seu painel de evolução">
                    <div className="np-pop-cab">
                      <span className="np-insignia grande num" aria-hidden="true">{d.nivel}</span>
                      <div className="np-pop-txt">
                        <b>{d.titulo}</b>
                        <span className="num">Nível {d.nivel}</span>
                      </div>
                    </div>
                    <span className="np-barra alta"><i style={{ width: `${d.progressoPct}%` }}></i></span>
                    <p className="np-pop-meta num"><b>{fmtNum(d.xp)}</b> / {fmtNum(d.xpProximo)} XP · faltam <b>{fmtNum(d.faltaXp)}</b> para subir de nível</p>
                    <ul className="np-pop-lista">
                      <li><span>🔥 Sequência</span><b className="num">{d.sequenciaDias} {d.sequenciaDias === 1 ? 'dia' : 'dias'}</b></li>
                      <li><span>🪙 Moedas</span><b className="num">{fmtNum(d.moedas)} · <a href="#">Loja</a></b></li>
                    </ul>
                    <a className="np-pop-btn" href="/perfil">Ver todas as conquistas</a>
                  </div>
                )}
              </div>

              {/* pílula de moedas */}
              <button className="np-pilula" aria-label={`${fmtNum(d.moedas)} moedas`}>
                <span className="np-moeda" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9 9.5h4a1.5 1.5 0 0 1 0 3H9m0 0h4.5" strokeLinecap="round" /></svg>
                </span>
                <b className="num">{fmtNum(d.moedas)}</b>
              </button>

              {/* pílula do foguinho (streak) */}
              <button className="np-pilula fogo" aria-label={`Sequência de ${d.sequenciaDias} dias`}>
                <span aria-hidden="true">🔥</span>
                <b className="num">{d.sequenciaDias} {d.sequenciaDias === 1 ? 'dia' : 'dias'}</b>
              </button>

              <a className="np-avatar" href="/perfil" aria-label={`Perfil de ${d.nome}`}>{d.iniciais}</a>
            </>
          ) : (
            <a className="np-entrar" href="/login">Entrar</a>
          )}
        </div>
      </div>
    </header>
  )
}
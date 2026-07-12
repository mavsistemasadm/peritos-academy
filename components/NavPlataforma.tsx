// components/NavPlataforma.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import type { DadosNav } from '@/lib/queries/nav'

const fmtNum = (n: number) => n.toLocaleString('pt-BR')

type Aba = 'inicio' | 'trilhas' | 'biblioteca' | 'comunidade' | 'agenda' | 'desafios' | 'cursos'

export default function NavPlataforma({ dados, ativo }: { dados: DadosNav; ativo?: Aba }) {
  const d = dados
  const [pop, setPop] = useState(false)
  const [menuAvatar, setMenuAvatar] = useState(false)
  const [menuConteudos, setMenuConteudos] = useState(false)
  const area = useRef<HTMLDivElement>(null)
  const avatarRef = useRef<HTMLDivElement>(null)
  const conteudosRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (pop && !area.current?.contains(e.target as Node)) setPop(false)
      if (menuAvatar && !avatarRef.current?.contains(e.target as Node)) setMenuAvatar(false)
      if (menuConteudos && !conteudosRef.current?.contains(e.target as Node)) setMenuConteudos(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setPop(false); setMenuAvatar(false); setMenuConteudos(false) }
    }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc) }
  }, [pop, menuAvatar, menuConteudos])

  const conteudosAtivo = ativo === 'trilhas' || ativo === 'biblioteca' || ativo === 'cursos'

  return (
    <header className="nav-plat">
      <div className="np-inner">
        <a className="np-logo" href="/" aria-label="Peritos Academy — Início">
          <span>peritos<small>academy</small></span>
        </a>

        <nav className="np-links" aria-label="Navegação principal">
          <a href="/" className={ativo === 'inicio' ? 'ativo' : undefined} aria-current={ativo === 'inicio' ? 'page' : undefined}>Início</a>

          <div className="np-dropdown" ref={conteudosRef}>
            <button className={`np-dropdown-btn${conteudosAtivo ? ' ativo' : ''}`} onClick={() => setMenuConteudos(v => !v)} aria-expanded={menuConteudos}>
              Conteúdos
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
            </button>
            {menuConteudos && (
              <div className="np-dropdown-menu">
                <a href="/jornada" onClick={() => setMenuConteudos(false)}>
                  <span className="np-dm-ico">🗺️</span>
                  <div><b>Trilhas</b><span>Sua jornada passo a passo</span></div>
                </a>
                <a href="/cursos" onClick={() => setMenuConteudos(false)}>
                  <span className="np-dm-ico">📚</span>
                  <div><b>Biblioteca de cursos</b><span>Todos os cursos por trilha</span></div>
                </a>
                <a href="/biblioteca" onClick={() => setMenuConteudos(false)}>
                  <span className="np-dm-ico">📊</span>
                  <div><b>Planilhas e modelos</b><span>Ferramentas pra perícia</span></div>
                </a>
              </div>
            )}
          </div>

          <a href="/comunidade" className={ativo === 'comunidade' ? 'ativo' : undefined} aria-current={ativo === 'comunidade' ? 'page' : undefined}>Comunidade</a>
          <a href="/agenda" className={ativo === 'agenda' ? 'ativo' : undefined} aria-current={ativo === 'agenda' ? 'page' : undefined}>Agenda</a>
          <a href="/desafios" className={ativo === 'desafios' ? 'ativo' : undefined} aria-current={ativo === 'desafios' ? 'page' : undefined}>Desafios</a>
        </nav>

        <div className="np-acoes">
          {d.logado ? (
            <>
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
                      <li><span>🪙 Moedas</span><b className="num">{fmtNum(d.moedas)}</b></li>
                    </ul>
                    <a className="np-pop-btn" href="/perfil">Ver todas as conquistas</a>
                  </div>
                )}
              </div>

              <button className="np-pilula" aria-label={`${fmtNum(d.moedas)} moedas`}>
                <span className="np-moeda" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9 9.5h4a1.5 1.5 0 0 1 0 3H9m0 0h4.5" strokeLinecap="round" /></svg>
                </span>
                <b className="num">{fmtNum(d.moedas)}</b>
              </button>

              <button className="np-pilula fogo" aria-label={`Sequência de ${d.sequenciaDias} dias`}>
                <span aria-hidden="true">🔥</span>
                <b className="num">{d.sequenciaDias} {d.sequenciaDias === 1 ? 'dia' : 'dias'}</b>
              </button>

              <div className="np-avatar-wrap" ref={avatarRef}>
                <button className="np-avatar" onClick={() => setMenuAvatar(v => !v)} aria-label={`Menu de ${d.nome}`} aria-expanded={menuAvatar}>
                  {d.iniciais}
                </button>
                {menuAvatar && (
                  <div className="np-avatar-menu">
                    <div className="np-am-cab">
                      <span className="np-am-nome">{d.nome}</span>
                      <span className="np-am-nivel num">Nível {d.nivel} · {fmtNum(d.xp)} XP</span>
                    </div>
<div className="np-am-sep"></div>
                    <a href="/perfil" className="np-am-item" onClick={() => setMenuAvatar(false)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>
                      Meu perfil
                    </a>
                    <a href="/perfil#certificados" className="np-am-item" onClick={() => setMenuAvatar(false)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="m8.5 14-2 7 5.5-3 5.5 3-2-7"/></svg>
                      Meus certificados
                    </a>
                    <a href={`/perito/${d.slug ?? ''}`} className="np-am-item" onClick={() => setMenuAvatar(false)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                      Perfil público
                    </a>
                    <div className="np-am-sep"></div>
                    <form action="/api/auth/logout" method="POST">
                      <button type="submit" className="np-am-item np-am-sair">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                        Sair
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </>
          ) : (
            <a className="np-entrar" href="/login">Entrar</a>
          )}
        </div>
      </div>
    </header>
  )
}
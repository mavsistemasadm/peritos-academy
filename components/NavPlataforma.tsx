// components/NavPlataforma.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import type { DadosNav } from '@/lib/queries/nav'
import { IconeChevronDown, IconeMap, IconeBookOpen, IconeBarChart, IconeUser, IconeGlobe, IconeShield, IconeLogOut, IconeAlertTriangle, IconeCompass, IconeZap } from '@/components/Icones'
import { FogoStreak, Moeda, Certificado } from '@/components/Emblemas'
import { sair } from '@/lib/auth/sair'
import StreakPopover from '@/components/streak/StreakPopover'

const fmtNum = (n: number) => n.toLocaleString('pt-BR')

type Aba = 'inicio' | 'trilhas' | 'biblioteca' | 'comunidade' | 'agenda' | 'desafios' | 'cursos'

export default function NavPlataforma({ dados, ativo }: { dados: DadosNav; ativo?: Aba }) {
  const d = dados
  const [pop, setPop] = useState(false)
  const [fotoErro, setFotoErro] = useState(false)
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
      {d.modoManutencao && d.isAdmin && (
        <div className="np-banner-manutencao">
          <IconeAlertTriangle size={14} /> Modo manutenção ativo. Visitantes não-admin estão vendo a página de manutenção.
        </div>
      )}
      <div className="np-inner">
        <a className="np-logo" href="/" aria-label={`${d.nomePlataforma} · Início`}>
          {d.logoUrl ? (
            <img src={d.logoUrl} alt={d.nomePlataforma} className="np-logo-img" />
          ) : (
            <span>peritos<small>academy</small></span>
          )}
        </a>

        <nav className="np-links" aria-label="Navegação principal">
          <a href="/" className={ativo === 'inicio' ? 'ativo' : undefined} aria-current={ativo === 'inicio' ? 'page' : undefined}>Início</a>

          <div className="np-dropdown" ref={conteudosRef}>
            <button className={`np-dropdown-btn${conteudosAtivo ? ' ativo' : ''}`} onClick={() => setMenuConteudos(v => !v)} aria-expanded={menuConteudos}>
              Conteúdos
              <IconeChevronDown size={10} strokeWidth={2.5} />
            </button>
            {menuConteudos && (
              <div className="np-dropdown-menu">
                <a href="/jornada" onClick={() => setMenuConteudos(false)}>
                  <span className="np-dm-ico"><IconeMap size={18} /></span>
                  <div><b>Trilhas</b><span>Sua jornada passo a passo</span></div>
                </a>
                <a href="/cursos" onClick={() => setMenuConteudos(false)}>
                  <span className="np-dm-ico"><IconeBookOpen size={18} /></span>
                  <div><b>Biblioteca de cursos</b><span>Todos os cursos por trilha</span></div>
                </a>
                <a href="/biblioteca" onClick={() => setMenuConteudos(false)}>
                  <span className="np-dm-ico"><IconeBarChart size={18} /></span>
                  <div><b>Planilhas e modelos</b><span>Ferramentas pra perícia</span></div>
                </a>
              </div>
            )}
          </div>

          {d.comunidadeAtiva && (
            <a href="/comunidade" data-tour="nav-comunidade" className={ativo === 'comunidade' ? 'ativo' : undefined} aria-current={ativo === 'comunidade' ? 'page' : undefined}>Comunidade</a>
          )}
          {d.agendaAtiva && (
            <a href="/agenda" data-tour="nav-agenda" className={ativo === 'agenda' ? 'ativo' : undefined} aria-current={ativo === 'agenda' ? 'page' : undefined}>Agenda</a>
          )}
          {d.desafiosAtivos && (
            <a href="/desafios" className={ativo === 'desafios' ? 'ativo' : undefined} aria-current={ativo === 'desafios' ? 'page' : undefined}>Desafios</a>
          )}
        </nav>

        <div className="np-acoes">
          {d.logado ? (
            <>
              <div className="np-nivel-wrap" data-tour="nav-gamificacao" ref={area}>
                <button className="np-nivel" aria-expanded={pop} onClick={() => setPop(v => !v)}
                  aria-label={`Nível ${d.nivel}: ${fmtNum(d.xp)} de ${fmtNum(d.xpProximo)} XP`}>
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
                      <li><span><FogoStreak size={14} /> Sequência</span><b className="num">{d.sequenciaDias} {d.sequenciaDias === 1 ? 'dia' : 'dias'}</b></li>
                      <li><span><Moeda size={14} /> Moedas</span><b className="num">{fmtNum(d.moedas)}</b></li>
                    </ul>
                    <a className="np-pop-btn" href="/perfil">Ver todas as conquistas</a>
                  </div>
                )}
              </div>

              <button className="np-pilula" aria-label={`${fmtNum(d.moedas)} moedas`}>
                <span className="np-moeda" aria-hidden="true">
                  <Moeda size={14} />
                </span>
                <b className="num">{fmtNum(d.moedas)}</b>
              </button>

              <StreakPopover sequenciaDias={d.sequenciaDias} recorde={d.streakRecorde} protecoesRestantes={d.streakProtecoesRestantes} />

              <div className="np-avatar-wrap" ref={avatarRef}>
                <button className="np-avatar" onClick={() => setMenuAvatar(v => !v)} aria-label={`Menu de ${d.nome}`} aria-expanded={menuAvatar}>
                  {d.fotoUrl && !fotoErro ? (
                    <img src={d.fotoUrl} alt="" className="np-avatar-foto" onError={() => setFotoErro(true)} />
                  ) : (
                    d.iniciais
                  )}
                </button>
                {menuAvatar && (
                  <div className="np-avatar-menu">
                    <div className="np-am-cab">
                      <span className="np-am-nome">{d.nome}</span>
                      <span className="np-am-nivel num">Nível {d.nivel} · {fmtNum(d.xp)} XP</span>
                    </div>
<div className="np-am-sep"></div>
                    <a href="/perfil" className="np-am-item" onClick={() => setMenuAvatar(false)}>
                      <IconeUser size={16} strokeWidth={1.8} />
                      Meu perfil
                    </a>
                    <a href="/perfil#certificados" className="np-am-item" onClick={() => setMenuAvatar(false)}>
                      <Certificado size={16} variante="mono" />
                      Meus certificados
                    </a>
                    <a href={`/perito/${d.slug ?? ''}`} className="np-am-item" onClick={() => setMenuAvatar(false)}>
                      <IconeGlobe size={16} strokeWidth={1.8} />
                      Perfil público
                    </a>
                    <a href="/gamificacao" className="np-am-item" onClick={() => setMenuAvatar(false)}>
                      <IconeZap size={16} strokeWidth={1.8} />
                      Como funciona sua jornada
                    </a>
                    <a href="/guia" className="np-am-item" onClick={() => setMenuAvatar(false)}>
                      <IconeCompass size={16} strokeWidth={1.8} />
                      Guia da plataforma
                    </a>
                    {d.isAdmin && (
                      <a href="/admin" className="np-am-item" onClick={() => setMenuAvatar(false)}>
                        <IconeShield size={16} strokeWidth={1.8} />
                        Painel Admin
                      </a>
                    )}
                    <div className="np-am-sep"></div>
                    <form action={sair}>
                      <button type="submit" className="np-am-item np-am-sair">
                        <IconeLogOut size={16} strokeWidth={1.8} />
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
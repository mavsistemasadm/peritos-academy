// components/ComemoracaoSelo.tsx
// A maior comemoração da plataforma: o Selo de Excelência (Formação Pericial de
// Alta Performance concluída). Réplica fiel do protótipo aprovado pelo dono em
// 19/10/2026: a arte de vidro surge do escuro com desfoque e escala, clarão de
// luz em ~1,9s, faixa de brilho varrendo o vidro, aurora cônica girando,
// partículas em órbita (canvas), três rajadas de confete nas cores da marca,
// título em degradê, números da formação e dois botões. Depois a arte flutua.
//
// Montado pelo ConquistaToast (prioridade máxima). Os dados e a marca de
// "vista" vêm de abrirComemoracaoSelo() (app/actions.ts), chamada aqui ao abrir.
'use client'

import { useEffect, useRef, useState } from 'react'
import { abrirComemoracaoSelo, type DadosComemoracaoSelo } from '@/app/actions'
import { SELO_HERO, linkedinCompartilharUrl } from '@/lib/selo'
import { tocarSom } from '@/lib/sons'
import { pararFanfarraSelo } from '@/lib/sons/selo'
import { IconeClose } from '@/components/Icones'

const CORES = ['#20D9A6', '#36DCD1', '#DDF784', '#F1F2DF', '#E8C468']

type Orb = { a: number; r: number; v: number; s: number; c: string; tw: number; e: number }
type Conf = { x: number; y: number; vx: number; vy: number; r: number; c: string; rot: number; vr: number; l: number; q: boolean }

export default function ComemoracaoSelo({ som, onFechar }: { som: boolean; onFechar: () => void }) {
  const [dados, setDados] = useState<DadosComemoracaoSelo | null>(null)
  const [saindo, setSaindo] = useState(false)
  const partRef = useRef<HTMLCanvasElement>(null)
  const confRef = useRef<HTMLCanvasElement>(null)
  const fecharRef = useRef<HTMLButtonElement>(null)
  const fechouRef = useRef(false)

  // Carrega os dados e marca como vista. Sem selo (ou erro), não abre nada.
  useEffect(() => {
    let vivo = true
    abrirComemoracaoSelo()
      .then(d => { if (!vivo) return; if (d) setDados(d); else onFechar() })
      .catch(() => { if (vivo) onFechar() })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function fechar() {
    if (fechouRef.current) return
    fechouRef.current = true
    pararFanfarraSelo()
    setSaindo(true)
    setTimeout(onFechar, 450)
  }

  // Som, ESC, foco e trava de rolagem: só depois de os dados chegarem.
  useEffect(() => {
    if (!dados) return
    if (som) tocarSom('selo_excelencia')
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar() }
    window.addEventListener('keydown', aoTeclar)
    const overflowAntes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    fecharRef.current?.focus({ preventScroll: true })
    return () => {
      window.removeEventListener('keydown', aoTeclar)
      document.body.style.overflow = overflowAntes
      pararFanfarraSelo()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados])

  // Partículas em órbita + confete. Com movimento reduzido: nada disso.
  useEffect(() => {
    if (!dados) return
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduzido) return
    const pc = partRef.current, cc = confRef.current
    if (!pc || !cc) return
    const px = pc.getContext('2d'), cx2 = cc.getContext('2d')
    if (!px || !cx2) return

    const dpr = window.devicePixelRatio || 1
    const dim = () => {
      for (const c of [pc, cc]) { c.width = innerWidth * dpr; c.height = innerHeight * dpr }
    }
    dim()
    window.addEventListener('resize', dim)

    const orb: Orb[] = Array.from({ length: 160 }, (_, i) => ({
      a: Math.random() * 6.28, r: .22 + Math.random() * .38,
      v: (.0015 + Math.random() * .004) * (Math.random() < .5 ? 1 : -1),
      s: .6 + Math.random() * 2.2, c: CORES[i % 4], tw: Math.random() * 6.28, e: .35 + Math.random() * .3,
    }))
    let pe: Conf[] = []
    let t0 = 0
    let rafOrb = 0, rafConf = 0

    const orbita = (t: number) => {
      if (!t0) t0 = t
      const k = Math.min(1, (t - t0) / 2500), W = pc.width, H = pc.height, cx = W / 2, cy = H * .41, R = Math.min(W, H)
      px.clearRect(0, 0, W, H)
      for (const o of orb) {
        o.a += o.v * (1 + 3 * (1 - k)); o.tw += .05
        const x = cx + Math.cos(o.a) * o.r * R, y = cy + Math.sin(o.a) * o.r * R * o.e
        px.globalAlpha = k * (.45 + .55 * Math.abs(Math.sin(o.tw)))
        px.fillStyle = o.c
        px.beginPath(); px.arc(x, y, o.s * dpr, 0, 7); px.fill()
      }
      rafOrb = requestAnimationFrame(orbita)
    }
    rafOrb = requestAnimationFrame(orbita)

    const conf = () => {
      cx2.clearRect(0, 0, cc.width, cc.height)
      for (const p of pe) {
        p.vy += .2; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.l++
        cx2.save(); cx2.translate(p.x * dpr, p.y * dpr); cx2.rotate(p.rot)
        cx2.globalAlpha = Math.max(0, 1 - p.l / 240); cx2.fillStyle = p.c
        if (p.q) cx2.fillRect(-p.r * dpr / 2, -p.r * dpr / 4, p.r * dpr, p.r * dpr / 2)
        else { cx2.beginPath(); cx2.arc(0, 0, p.r * dpr / 2.3, 0, 7); cx2.fill() }
        cx2.restore()
      }
      pe = pe.filter(p => p.l < 250)
      rafConf = pe.length ? requestAnimationFrame(conf) : 0
    }
    const burst = (x: number, y: number, n: number, f = 1) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.28, v = (4 + Math.random() * 11) * f
        pe.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 7, r: 4 + Math.random() * 7, c: CORES[i % 5], rot: Math.random() * 6, vr: (Math.random() - .5) * .35, l: 0, q: Math.random() < .55 })
      }
      if (!rafConf) rafConf = requestAnimationFrame(conf)
    }
    const w = innerWidth, h = innerHeight
    const timers = [
      setTimeout(() => burst(w / 2, h * .4, 170, 1.15), 1950),
      setTimeout(() => { burst(w * .15, h * .75, 80); burst(w * .85, h * .75, 80) }, 2500),
      setTimeout(() => burst(w / 2, h * .15, 100), 3200),
    ]

    return () => {
      timers.forEach(clearTimeout)
      cancelAnimationFrame(rafOrb); cancelAnimationFrame(rafConf)
      window.removeEventListener('resize', dim)
    }
  }, [dados])

  if (!dados) return null

  const linkedin = dados.perfilPublicoUrl ? linkedinCompartilharUrl(dados.perfilPublicoUrl) : null

  return (
    <div
      className={`comemoracao-selo${saindo ? ' saindo' : ''}`}
      role="dialog" aria-modal="true" aria-labelledby="cs-titulo-selo"
    >
      <div className="cena go">
        <div className="aurora" aria-hidden="true" />
        <canvas ref={partRef} aria-hidden="true" />
        <div className="hero" aria-hidden="true"><img src={SELO_HERO} alt="" /></div>
        <div className="flash" aria-hidden="true" />
        <canvas ref={confRef} aria-hidden="true" />
        <div className="txt">
          <div className="sobre">Formação Pericial de Alta Performance concluída</div>
          <h2 className="titulo" id="cs-titulo-selo">Selo de Excelência</h2>
          <p className="frase">{dados.primeiroNome}, poucos peritos chegam aqui. Você chegou sem pular etapa.</p>
          <div className="nums">
            <div><b>{dados.cursos}</b><small>cursos</small></div>
            <div><b>{dados.aulas}</b><small>aulas</small></div>
            <div><b>{dados.horas}h</b><small>de estudo</small></div>
          </div>
          <div className="bts">
            <a className="bt p" href="/perfil#selo-excelencia" onClick={() => pararFanfarraSelo()}>Ver meu Selo no perfil</a>
            {linkedin
              ? <a className="bt s" href={linkedin} target="_blank" rel="noopener noreferrer">Compartilhar no LinkedIn</a>
              : <a className="bt s" href="/perfil#selo-excelencia" onClick={() => pararFanfarraSelo()}>Torne seu perfil público para compartilhar no LinkedIn</a>}
          </div>
        </div>
      </div>
      <button ref={fecharRef} type="button" className="fechar" onClick={fechar} aria-label="Fechar comemoração">
        <IconeClose size={20} />
      </button>
    </div>
  )
}

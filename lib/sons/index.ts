// lib/sons/index.ts
// Sons de conquista sintetizados via Web Audio API — sem arquivos de áudio.
// Interface estável (tocarSom(tipo)) pra poder trocar por arquivo de áudio no
// futuro só mexendo no corpo de cada tocarXxx() em lib/sons/*.ts.
'use client'

import { tocarFanfarraNivel } from './nivel'
import { tocarAcordeAvaliacao } from './avaliacao'
import { tocarAplausoCurso } from './curso'
import { tocarWhooshStreak } from './streak'
import { tocarNotaPrimeiraAula } from './primeiraAula'

export type TipoSom = 'nivel_up' | 'avaliacao_aprovada' | 'curso_concluido' | 'streak' | 'primeira_aula'

const VOLUME_MESTRE = 0.4

let ctx: AudioContext | null = null
let master: GainNode | null = null
let desbloqueioRegistrado = false

function obterContexto(): { ctx: AudioContext; master: GainNode } | null {
  if (typeof window === 'undefined') return null
  try {
    if (!ctx || !master) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      ctx = new Ctor()
      master = ctx.createGain()
      master.gain.value = VOLUME_MESTRE
      master.connect(ctx.destination)
    }
    if (!desbloqueioRegistrado) {
      desbloqueioRegistrado = true
      const desbloquear = () => { ctx?.resume().catch(() => {}) }
      window.addEventListener('pointerdown', desbloquear, { once: true })
      window.addEventListener('keydown', desbloquear, { once: true })
    }
    return { ctx, master }
  } catch {
    return null
  }
}

/** Toca o som de um tipo de conquista. Falha sempre silenciosa — nunca lança, nunca bloqueia o toast visual. */
export function tocarSom(tipo: TipoSom) {
  try {
    const audio = obterContexto()
    if (!audio) return
    if (audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {})

    switch (tipo) {
      case 'nivel_up': tocarFanfarraNivel(audio.ctx, audio.master); break
      case 'avaliacao_aprovada': tocarAcordeAvaliacao(audio.ctx, audio.master); break
      case 'curso_concluido': tocarAplausoCurso(audio.ctx, audio.master); break
      case 'streak': tocarWhooshStreak(audio.ctx, audio.master); break
      case 'primeira_aula': tocarNotaPrimeiraAula(audio.ctx, audio.master); break
    }
  } catch {
    // autoplay bloqueado ou qualquer outra falha de áudio — o toast nunca depende do som
  }
}

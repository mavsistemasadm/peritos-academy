// lib/sons/streak.ts — whoosh + crepitar sutil (~1s) pros marcos de sequência
import { tocarRuido } from './util'

export function tocarWhooshStreak(ctx: AudioContext, destino: AudioNode) {
  // whoosh: ruído passa-banda com frequência subindo (simulado em duas rajadas)
  tocarRuido(ctx, destino, 0, 0.4, { volume: 0.22, filtro: { tipo: 'bandpass', freq: 500, q: 0.5 } })
  tocarRuido(ctx, destino, 0.15, 0.35, { volume: 0.2, filtro: { tipo: 'bandpass', freq: 2200, q: 0.6 } })
  // crepitar: estalos curtos e esparsos
  for (let i = 0; i < 6; i++) {
    tocarRuido(ctx, destino, 0.35 + Math.random() * 0.5, 0.03, {
      volume: 0.15,
      filtro: { tipo: 'highpass', freq: 3500 },
    })
  }
}

// lib/sons/carimbo.ts — baque seco de carimbo (~250ms): thud grave + clique de impacto
import { tocarTom, tocarRuido } from './util'

export function tocarBaqueCarimbo(ctx: AudioContext, destino: AudioNode) {
  tocarTom(ctx, destino, 90, 0, 0.22, { tipo: 'sine', volume: 0.6, freqFinal: 45 })
  tocarRuido(ctx, destino, 0, 0.05, { volume: 0.35, filtro: { tipo: 'lowpass', freq: 1800 } })
}

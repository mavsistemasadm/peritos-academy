// lib/sons/nivel.ts — fanfarra ascendente curta (~2s) pro toast de subida de nível
import { tocarTom } from './util'

export function tocarFanfarraNivel(ctx: AudioContext, destino: AudioNode) {
  const notas = [523.25, 659.25, 783.99, 1046.5] // C5 E5 G5 C6
  notas.forEach((freq, i) => {
    tocarTom(ctx, destino, freq, i * 0.16, 0.55, { tipo: 'triangle', volume: 0.55 })
  })
  // brilho final sustentado
  tocarTom(ctx, destino, 1046.5, 0.48, 1.3, { tipo: 'sine', volume: 0.3, freqFinal: 1318.5 })
}

// lib/sons/primeiraAula.ts — nota única brilhante (~0.5s) pra primeira aula concluída
import { tocarTom } from './util'

export function tocarNotaPrimeiraAula(ctx: AudioContext, destino: AudioNode) {
  tocarTom(ctx, destino, 1046.5, 0, 0.5, { tipo: 'sine', volume: 0.45, freqFinal: 1318.5 })
}

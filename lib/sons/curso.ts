// lib/sons/curso.ts — aplauso (ruído filtrado) + sino (~1.5s) pra curso concluído
import { tocarTom, tocarRuido } from './util'

export function tocarAplausoCurso(ctx: AudioContext, destino: AudioNode) {
  // aplauso: rajadas curtas de ruído passa-banda, sobrepostas e aleatorizadas
  for (let i = 0; i < 10; i++) {
    const inicio = Math.random() * 0.5
    tocarRuido(ctx, destino, inicio, 0.12 + Math.random() * 0.08, {
      volume: 0.18,
      filtro: { tipo: 'bandpass', freq: 1800 + Math.random() * 1500, q: 0.7 },
    })
  }
  // sino de fechamento
  tocarTom(ctx, destino, 987.77, 0.55, 0.9, { tipo: 'sine', volume: 0.4 })
  tocarTom(ctx, destino, 1975.5, 0.58, 0.7, { tipo: 'sine', volume: 0.2 })
}

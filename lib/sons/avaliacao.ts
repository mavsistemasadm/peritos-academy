// lib/sons/avaliacao.ts — acorde de vitória grave e curto (~1s) pra avaliação aprovada
import { tocarTom } from './util'

export function tocarAcordeAvaliacao(ctx: AudioContext, destino: AudioNode) {
  const acorde = [261.63, 329.63, 392.0] // Dó maior grave
  acorde.forEach(freq => {
    tocarTom(ctx, destino, freq, 0, 0.9, { tipo: 'triangle', volume: 0.4 })
  })
}

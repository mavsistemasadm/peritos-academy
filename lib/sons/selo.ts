// lib/sons/selo.ts
// O único som de conquista que é ARQUIVO, e não síntese: a fanfarra do Selo de
// Excelência. "Grand brass fanfare", Mixkit (sfx 631), baixado para
// public/sons/selo-excelencia.mp3. Licença Mixkit Free Sound Effects: uso
// comercial liberado, sem atribuição exigida. Falha sempre silenciosa.
'use client'

import { SELO_SOM } from '@/lib/selo'

let atual: HTMLAudioElement | null = null

export function tocarFanfarraSelo() {
  try {
    if (typeof window === 'undefined') return
    pararFanfarraSelo()
    atual = new Audio(SELO_SOM)
    atual.volume = 0.7
    atual.play().catch(() => {})
  } catch {
    // autoplay bloqueado: a comemoração visual nunca depende do som
  }
}

export function pararFanfarraSelo() {
  try { atual?.pause() } catch { /* nada */ }
  atual = null
}

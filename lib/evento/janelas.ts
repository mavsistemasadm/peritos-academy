// ══════════════════════════════════════════════════════════════════
// lib/evento/janelas.ts — QUANDO CADA LEMBRETE SAI
//
// Só conta de tempo, sem banco e sem rede. Mora aqui, e não dentro do route
// do cron, por dois motivos: a regra de "quando avisar" é do domínio do
// evento, não da rota HTTP que por acaso a dispara; e assim ela pode ser
// testada de mesa (scripts/testarJanelasEvento.mts), o que importa porque
// **esta é a parte que erra por uma hora sem dar erro nenhum**. O cron roda em
// UTC, o evento é marcado no relógio de Brasília, e o sintoma de um engano
// seria a live acontecer sem ninguém aparecer.
//
// ── AS JANELAS SÃO MAIORES QUE O INTERVALO ENTRE DUAS PASSAGENS ──
//
// De propósito. Cron que atrasa alguns minutos é normal, e uma janela justa
// faria o lembrete simplesmente não sair. O risco oposto, mandar duas vezes,
// é coberto pelo dedupe por (endereço, tipo, evento) em enviarConvidado.ts.
// Errar para o lado de tentar de novo é barato; errar para o lado de não
// mandar é invisível.
// ══════════════════════════════════════════════════════════════════
import type { MomentoEvento } from '../email/templates/evento'
import type { TipoEmailConvidado } from '../email/enviarConvidado'

const MIN = 60_000
const HORA = 60 * MIN

/** Brasil não tem horário de verão desde 2019: o desvio é fixo. */
const OFFSET_BRASILIA = 3 * HORA

/** Faixa de horas de Brasília em que o email "é hoje" pode sair. */
const MANHA_DE = 7
const MANHA_ATE = 9

/**
 * O "é hoje" não pode sair em cima da hora.
 *
 * Numa live das 8h30, a passagem das 7h mandaria "é hoje, organize seu dia" e
 * a das 7h30 mandaria "começa daqui a uma hora" — dois emails com trinta
 * minutos de diferença, um deles pedindo calma. Abaixo desta folga, o de uma
 * hora antes já diz tudo, e o da manhã só atrapalha.
 */
const FOLGA_MINIMA_DA_MANHA = 3 * HORA

export type Janela = {
  momento: MomentoEvento
  tipo: TipoEmailConvidado
  /**
   * Recorte de `inicia_em` relativo a agora, em milissegundos.
   * `null` = esta janela não vale nesta passagem do cron.
   */
  faixa: (agora: number) => { de: number; ate: number } | null
}

export const JANELAS: Janela[] = [
  {
    momento: 'hoje',
    tipo: 'evento_hoje',
    // Depende da HORA DO DIA, e não de uma distância até o evento: o que se
    // promete é "de manhã", e manhã é um lugar no relógio, não uma contagem.
    faixa: agora => {
      const sp = new Date(agora - OFFSET_BRASILIA)
      const horaSp = sp.getUTCHours()
      if (horaSp < MANHA_DE || horaSp > MANHA_ATE) return null
      // Meia-noite do dia seguinte em Brasília, de volta para tempo real. É
      // este `+ OFFSET_BRASILIA` que faz a vira-noite não escorregar um dia.
      const fimDoDia = Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), sp.getUTCDate() + 1, 0, 0, 0) + OFFSET_BRASILIA
      return { de: FOLGA_MINIMA_DA_MANHA, ate: fimDoDia - agora }
    },
  },
  {
    momento: 'comecando',
    tipo: 'evento_comecando',
    faixa: () => ({ de: 30 * MIN, ate: 90 * MIN }),
  },
  {
    momento: 'ao_vivo',
    tipo: 'evento_ao_vivo',
    // Negativo: já começou. É o `de` menor que zero que faz esta janela
    // apanhar o evento no ar, e não o que ainda vai começar.
    faixa: () => ({ de: -20 * MIN, ate: 0 }),
  },
]

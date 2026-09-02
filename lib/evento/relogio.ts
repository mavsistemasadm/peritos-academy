// ══════════════════════════════════════════════════════════════════
// lib/evento/relogio.ts — O RELÓGIO DE BRASÍLIA, NOS DOIS SENTIDOS
//
// `<input type="datetime-local">` entrega uma string SEM fuso: "2026-10-06T19:00".
// Ela não é um instante, é um relógio de parede — e o que faltava era dizer de
// qual parede.
//
// ⚠️ **O bug que originou este arquivo.** `new Date("2026-10-06T19:00")` usa o
// fuso de QUEM EXECUTA. No Mac do dev isso é Brasília e tudo parecia certo; na
// Vercel é UTC. Então "19:00" virava 19:00Z, que é 16:00 em Brasília: o evento
// nascia três horas mais cedo do que o digitado.
//
// E era pior que uma vez só. O editor lia o valor de volta com o relógio do
// NAVEGADOR (Brasília), mostrando 16:00 no campo; salvar de novo gravava
// 16:00Z, e a tela passava a mostrar 13:00. **Cada salvamento andava três horas
// para trás**, em silêncio. Medido em 01/09/2026: dos 5 eventos da base, um
// tinha derrapado uma vez, um duas, um três — as horas guardadas eram 19, 16,
// 13 e 10, todas descendo de três em três a partir do mesmo 19h digitado.
//
// ── A REGRA ──────────────────────────────────────────────────────
//
// **O que se digita no admin é hora de Brasília, sempre.** Não é a hora do
// navegador de quem edita: o produto inteiro anuncia "horário de Brasília" para
// o aluno (`quandoPorExtenso`, os emails, os lembretes), e um admin viajando
// não pode mover a live de todo mundo sem tocar em nada.
//
// ⚠️ O desvio é MEDIDO por data, não assumido como -3. O Brasil não tem horário
// de verão desde 2019, mas isso é lei, não física: se voltar, uma constante
// fixa moveria toda a agenda em uma hora sem nada acusando — e uma hora de
// diferença numa live é o tipo de erro que só aparece quando ninguém entra.
// (`lib/evento/janelas.ts` ainda usa a constante fixa para calcular JANELAS
// relativas, onde uma hora de folga não muda o resultado. Aqui, muda.)
// ══════════════════════════════════════════════════════════════════

const FUSO = 'America/Sao_Paulo'

const PARTES = new Intl.DateTimeFormat('en-US', {
  timeZone: FUSO,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false,
})

function partesEmBrasilia(instante: Date) {
  const p = Object.fromEntries(PARTES.formatToParts(instante).map(x => [x.type, x.value])) as Record<string, string>
  // `hour12:false` pode devolver "24" para a meia-noite em alguns runtimes.
  return {
    ano: p.year, mes: p.month, dia: p.day,
    hora: String(Number(p.hour) % 24).padStart(2, '0'),
    minuto: p.minute, segundo: p.second,
  }
}

/** Quantos minutos Brasília está ATRÁS de UTC naquele instante (180 hoje). */
function atrasoEmMinutos(instante: Date): number {
  const b = partesEmBrasilia(instante)
  const comoSeFosseUtc = Date.UTC(+b.ano, +b.mes - 1, +b.dia, +b.hora, +b.minuto, +b.segundo)
  return (instante.getTime() - comoSeFosseUtc) / 60_000
}

/**
 * `"2026-10-06T19:00"` (relógio de Brasília) → instante ISO em UTC.
 *
 * Devolve `null` para entrada vazia ou malformada, que é o que o chamador já
 * tratava como "sem data".
 */
export function deBrasiliaParaISO(local: string | null | undefined): string | null {
  const m = String(local ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)
  if (!m) return null
  const [, ano, mes, dia, hora, minuto] = m
  const relogio = Date.UTC(+ano, +mes - 1, +dia, +hora, +minuto)

  // Duas passadas: a primeira mede o desvio com um palpite, a segunda o
  // confirma já perto do instante certo. É o que acerta a hora que cai em cima
  // de uma virada de horário de verão, onde o desvio antes e depois difere.
  let ts = relogio + atrasoEmMinutos(new Date(relogio)) * 60_000
  ts = relogio + atrasoEmMinutos(new Date(ts)) * 60_000
  return new Date(ts).toISOString()
}

/**
 * Instante ISO → `"2026-10-06T19:00"` no relógio de Brasília.
 *
 * É o valor de `<input type="datetime-local">`. Precisa ser o par exato de
 * `deBrasiliaParaISO`: se um lado usasse o relógio do navegador, o valor
 * andaria a cada salvamento, que é exatamente o defeito que este arquivo
 * conserta.
 */
export function deISOParaBrasilia(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const b = partesEmBrasilia(d)
  return `${b.ano}-${b.mes}-${b.dia}T${b.hora}:${b.minuto}`
}

/** Como o evento aparece nas telas de admin. Sempre com o fuso dito em voz alta. */
export function formatarEmBrasilia(iso: string | null | undefined): string {
  if (!iso) return 'sem data'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'sem data'
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(d)
}

/**
 * `iso` + N semanas, PRESERVANDO A HORA DE PAREDE de Brasília.
 *
 * ⚠️ Somar `7 * 24 * 60 * 60 * 1000` seria mais curto e está errado por um
 * motivo que este arquivo já explica em cima: somar milissegundos preserva o
 * INSTANTE relativo a UTC, não o relógio. O Brasil não tem horário de verão
 * desde 2019 — mas isso é lei, não física, e no dia em que voltar a aula das
 * 11h passaria a nascer às 10h ou às 12h, uma vez só, sem nada acusando. Ir e
 * voltar pelo par de conversões deste arquivo põe 11:00 em 11:00 sempre.
 */
export function somarSemanasEmBrasilia(iso: string | null | undefined, semanas: number): string | null {
  const parede = deISOParaBrasilia(iso)
  if (!parede) return null
  const [data, hora] = parede.split('T')
  const [ano, mes, dia] = data.split('-').map(Number)
  // Date.UTC aqui é só aritmética de calendário sobre a DATA — a hora de
  // parede volta intocada na linha seguinte. Não é um instante.
  const d = new Date(Date.UTC(ano, mes - 1, dia + semanas * 7))
  const nova = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  return deBrasiliaParaISO(`${nova}T${hora}`)
}

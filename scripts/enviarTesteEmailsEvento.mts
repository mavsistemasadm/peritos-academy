// Manda TODOS os emails de uma live para um endereço, para conferir na caixa
// de entrada de verdade: anúncio, confirmação, véspera, é hoje, uma hora
// antes, ao vivo, e as duas versões "convite" (véspera e é hoje para quem
// ainda não reservou, desde 18/10/2026). O assunto ganha [TESTE n/8].
//
//   node --experimental-strip-types scripts/enviarTesteEmailsEvento.mts <email>
//
// Usa o MESMO template e a MESMA injeção de link de descadastro do envio real
// (lib/email/templates/evento.ts e o replace de enviarConvidado.ts), para o
// que chega na caixa ser byte a byte o que o aluno receberia. O que ele não
// usa é o dedupe e o optout do enviarConvidado, de propósito: aqui o objetivo
// é mandar os quatro de uma vez, e o dedupe existe justamente para impedir
// isso. Aqueles dois já foram testados pelo cron.
//
// ⚠️ Manda email de verdade. Só rodar com um endereço próprio.
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'
import { emailEvento, type MomentoEvento } from '../lib/email/templates/evento.ts'

const destino = process.argv[2]
if (!destino) {
  console.error('uso: node --experimental-strip-types scripts/enviarTesteEmailsEvento.mts <email>')
  process.exit(1)
}

const env = Object.fromEntries(
  readFileSync('env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    }),
)

const SITE = 'https://evolua.peritosacademy.com.br'
// Uma página de live que existe, para os botões abrirem algo de verdade.
const SLUG = 'plantao-do-perito-01-duvidas-de-calculo-e-pericia-ao-vivo'

// Mesmo token do envio real, para o link de descadastro do rodapé funcionar
// de verdade se você clicar nele.
function tokenEmail(email: string) {
  const payload = Buffer.from('e:' + email.trim().toLowerCase(), 'utf8').toString('base64url')
  const assinatura = createHmac('sha256', env.CRON_SECRET).update(payload).digest('base64url')
  return `${payload}.${assinatura}`
}

function injetarDescadastro(html: string, email: string) {
  const url = `${SITE}/email/cancelar?token=${tokenEmail(email)}`
  return html.replace(
    'Não quero mais receber estes e-mails',
    `<a href="${url}" style="color:#A3ABA6;text-decoration:underline;">Não quero mais receber estes e-mails</a>`,
  )
}

const dados = {
  primeiroNome: 'Marlos',
  titulo: 'Plantão do Perito: dúvidas de cálculo e perícia, ao vivo',
  quando: 'Quinta-feira, 22 de outubro, às 11h00, horário de Brasília',
  dia: 'Quinta-feira, 22 de outubro',
  horario: '11h00',
  duracao: '1h',
  apresentador: 'Marlos Henrique',
  descricao: null,
  tipoRotulo: 'Plantão de dúvidas',
  url: `${SITE}/evento/${SLUG}`,
  linkCalendario: 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Sala+de+an%C3%A1lise',
}

const MOMENTOS: [MomentoEvento, boolean, string][] = [
  ['anuncio', false, 'convite'],
  ['confirmacao', false, 'inscrição confirmada'],
  ['vespera', false, 'véspera, quem reservou'],
  ['vespera', true, 'véspera, quem não reservou'],
  ['hoje', false, 'é hoje, quem reservou'],
  ['hoje', true, 'é hoje, quem não reservou'],
  ['comecando', false, '1 hora antes'],
  ['ao_vivo', false, 'ao vivo'],
]

const ids: [string, string][] = []

for (const [n, [momento, convite, nome]] of MOMENTOS.entries()) {
  const { assunto: a, html } = emailEvento(momento, dados as never, { convite })
  const assunto = `[TESTE ${n + 1}/${MOMENTOS.length} · ${nome}] ${a}`
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Peritos Academy <noreply@mkt.peritosacademy.com.br>',
      replyTo: 'marlos@peritosacademy.com.br',
      to: destino,
      subject: assunto,
      html: injetarDescadastro(html, destino),
    }),
  })
  const corpo = await r.json() as { id?: string; message?: string }
  console.log(`${nome.padEnd(28)} ${r.ok ? corpo.id : 'FALHOU · ' + corpo.message}`)
  if (corpo.id) ids.push([nome, corpo.id])
  // O Resend limita a 2 requisições por segundo; sem a pausa, o terceiro
  // e o quarto voltam 429 e o teste "passa" com dois emails a menos.
  await new Promise(r => setTimeout(r, 700))
}

// Confirma a ENTREGA, e não só o aceite: o Resend responde 200 antes de saber
// se vai conseguir, e foi exatamente isso que escondeu três semanas de falha.
console.log('\naguardando a confirmação de entrega de cada um…')
await new Promise(r => setTimeout(r, 12_000))
for (const [momento, id] of ids) {
  const r = await fetch(`https://api.resend.com/emails/${id}`, {
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` },
  })
  const d = await r.json() as { last_event?: string }
  console.log(`${momento.padEnd(28)} ${d.last_event}`)
}

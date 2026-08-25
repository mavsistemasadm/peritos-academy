// Manda os quatro emails de um encontro para um endereço, para conferir na
// caixa de entrada de verdade.
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
const SLUG = 'teste-sala-de-analise-leitura-de-extrato-e-capitalizacao'

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
  titulo: 'Sala de análise: leitura de extrato e capitalização',
  quando: 'Sábado, 5 de setembro, às 20h00, horário de Brasília',
  dia: 'Sábado, 5 de setembro',
  horario: '20h00',
  duracao: '1h30',
  apresentador: 'Marlos Henrique',
  url: `${SITE}/evento/${SLUG}`,
  linkCalendario: 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Sala+de+an%C3%A1lise',
}

const MOMENTOS: MomentoEvento[] = ['confirmacao', 'hoje', 'comecando', 'ao_vivo']

for (const momento of MOMENTOS) {
  const { assunto, html } = emailEvento(momento, dados)
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Peritos Academy <noreply@peritosacademy.com.br>',
      replyTo: 'marlos@peritosacademy.com.br',
      to: destino,
      subject: `[${momento}] ${assunto}`,
      html: injetarDescadastro(html, destino),
    }),
  })
  const corpo = await r.json() as { id?: string; message?: string }
  console.log(`${momento.padEnd(12)} ${r.ok ? 'enviado  ' + corpo.id : 'FALHOU · ' + corpo.message}`)
  // O Resend limita a 2 requisições por segundo; sem a pausa, o terceiro
  // e o quarto voltam 429 e o teste "passa" com dois emails a menos.
  await new Promise(r => setTimeout(r, 700))
}

// ══════════════════════════════════════════════════════════════════
// app/api/webhooks/resend — O QUE ACONTECEU DEPOIS DO "200 OK"
//
// Esta rota existe por causa de um incidente de 25/08/2026: o domínio
// remetente saiu do ar como verificado no Resend e **nenhum email da
// plataforma foi entregue por três semanas**, sem uma linha de log em lugar
// nenhum. 624 emails gravados como enviados, zero recebidos.
//
// A causa de a falha ser invisível é que a API do Resend responde 200 com um
// id no ato do envio e só descobre o problema DEPOIS, de forma assíncrona.
// Quem chama vê sucesso. A única forma de saber o que de fato aconteceu é
// esta: o Resend avisa.
//
// ⚠️ Sem esta rota configurada no painel do Resend, tudo continua parecendo
// certo do lado de cá. A rota não conserta entrega nenhuma — ela conserta a
// cegueira, que é o que fez três semanas passarem.
//
// ── POR QUE ELA RECUSA QUANDO O SEGREDO NÃO ESTÁ CONFIGURADO ──
//
// O webhook do Asaas, nesta mesma base, aceita qualquer chamada quando a env
// não existe, e isso está registrado no CLAUDE.md como pendência. Aqui não dá
// para repetir: esta rota **apaga marcação de dedupe**. Aberta, ela vira um
// botão público de "reenviar tudo" — qualquer um dispara em laço e a
// plataforma bombardeia a base inteira, do próprio domínio, até ser bloqueada.
// Recusar em voz alta é a única opção honesta.
// ══════════════════════════════════════════════════════════════════
import { NextResponse, type NextRequest } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { criarClienteServico } from '@/lib/supabase/servico'

/** Eventos que dizem "este email não chegou e não vai chegar". */
const FRACASSOS = new Set(['email.bounced', 'email.failed'])
/** Eventos que confirmam a entrega. */
const SUCESSOS = new Set(['email.delivered'])
/**
 * Reclamação de spam. Não é falha de entrega: chegou, e a pessoa não queria.
 * Reenviar seria a pior reação possível, então ele fica como `entregue` e o
 * endereço entra no descadastro.
 */
const RECLAMACOES = new Set(['email.complained'])

/**
 * O Resend assina pelo esquema do Svix: HMAC-SHA256 de
 * `id.timestamp.corpo`, com o segredo em base64 depois do prefixo `whsec_`.
 * Feito à mão, sem lib nova, pelo mesmo motivo que lib/email/token.ts é à mão.
 */
function assinaturaConfere(segredo: string, id: string, timestamp: string, corpo: string, cabecalho: string) {
  const chave = Buffer.from(segredo.replace(/^whsec_/, ''), 'base64')
  const esperado = createHmac('sha256', chave).update(`${id}.${timestamp}.${corpo}`).digest('base64')

  // O cabeçalho pode trazer várias assinaturas (rotação de segredo), separadas
  // por espaço, cada uma no formato "v1,<base64>".
  return cabecalho.split(' ').some(parte => {
    const valor = parte.split(',')[1]
    if (!valor) return false
    const a = Buffer.from(valor)
    const b = Buffer.from(esperado)
    return a.length === b.length && timingSafeEqual(a, b)
  })
}

export async function POST(request: NextRequest) {
  const segredo = process.env.RESEND_WEBHOOK_SECRET
  if (!segredo) {
    console.error('[webhook resend] RESEND_WEBHOOK_SECRET ausente: recusando. Ver o cabeçalho deste arquivo.')
    return NextResponse.json({ erro: 'webhook não configurado' }, { status: 500 })
  }

  const corpo = await request.text()
  const id = request.headers.get('svix-id')
  const timestamp = request.headers.get('svix-timestamp')
  const assinatura = request.headers.get('svix-signature')

  if (!id || !timestamp || !assinatura || !assinaturaConfere(segredo, id, timestamp, corpo, assinatura)) {
    return NextResponse.json({ erro: 'assinatura inválida' }, { status: 401 })
  }

  let evento: { type?: string; data?: { email_id?: string; to?: string[] | string } }
  try {
    evento = JSON.parse(corpo)
  } catch {
    return NextResponse.json({ erro: 'corpo inválido' }, { status: 400 })
  }

  const tipo = evento.type ?? ''
  const emailId = evento.data?.email_id
  if (!emailId) return NextResponse.json({ ok: true, ignorado: 'sem email_id' })

  const supabase = criarClienteServico()

  const estado = FRACASSOS.has(tipo) ? 'falhou'
    : SUCESSOS.has(tipo) || RECLAMACOES.has(tipo) ? 'entregue'
    : null

  // Aberturas e cliques também chegam aqui e não mudam nada.
  if (!estado) return NextResponse.json({ ok: true, ignorado: tipo })

  // O id pode estar em qualquer uma das duas tabelas; atualizar as duas é mais
  // barato que descobrir antes de qual delas ele é.
  for (const tabela of ['email_enviados', 'email_convidados_enviados']) {
    await supabase.from(tabela)
      .update({ estado, detalhe: tipo })
      .eq('resend_id', emailId)
  }

  if (estado === 'falhou') {
    console.error(`[webhook resend] ${tipo} · ${emailId}. A linha volta a ser retentável.`)
  }

  // Reclamação de spam desliga o endereço, sempre. Não é preferência, é
  // obrigação: continuar mandando para quem denunciou é o caminho mais curto
  // para o domínio inteiro ser bloqueado.
  if (RECLAMACOES.has(tipo)) {
    const destino = Array.isArray(evento.data?.to) ? evento.data.to[0] : evento.data?.to
    if (destino) {
      await supabase.from('email_optout_publico')
        .upsert({ email: destino.trim().toLowerCase() }, { onConflict: 'email' })
      console.error(`[webhook resend] denúncia de spam de ${destino}: endereço descadastrado.`)
    }
  }

  return NextResponse.json({ ok: true })
}

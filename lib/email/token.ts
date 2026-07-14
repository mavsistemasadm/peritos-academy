// lib/email/token.ts
// Token de cancelamento de inscrição de email: UUID do usuário assinado com
// HMAC-SHA256 (CRON_SECRET) — sem lib externa (jsonwebtoken/jose), sem
// expiração (link de "cancelar inscrição" precisa funcionar indefinidamente).
import { createHmac, timingSafeEqual } from 'crypto'

function assinar(payload: string): string {
  const secret = process.env.CRON_SECRET
  if (!secret) throw new Error('CRON_SECRET não configurado')
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function gerarTokenCancelamento(usuarioId: string): string {
  const payload = Buffer.from(usuarioId, 'utf8').toString('base64url')
  return `${payload}.${assinar(payload)}`
}

/** Retorna o usuarioId se o token for válido, ou null. */
export function verificarTokenCancelamento(token: string): string | null {
  const secret = process.env.CRON_SECRET
  if (!secret) return null

  const [payload, assinatura] = token.split('.')
  if (!payload || !assinatura) return null

  let esperado: string
  try {
    esperado = assinar(payload)
  } catch {
    return null
  }

  const a = Buffer.from(assinatura)
  const b = Buffer.from(esperado)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    return Buffer.from(payload, 'base64url').toString('utf8')
  } catch {
    return null
  }
}

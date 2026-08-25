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
  // Ver PREFIXO_EMAIL no fim do arquivo: id de usuário nunca leva prefixo.
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

// ── TOKENS DE ENDEREÇO (convidado de live aberta) ────────────────
//
// O convidado de uma live pública não tem conta, então não há uuid para
// assinar: o que o identifica é o email. Mesmo HMAC, mesma chave, sem
// expiração — o link de cancelar precisa valer para sempre.
//
// ⚠️ O prefixo 'e:' existe para que um token de email NUNCA seja aceito onde
// se espera um id de usuário, e vice-versa. Sem ele, os dois formatos seriam
// indistinguíveis depois de verificados, e um token de descadastro de
// convidado passaria por token de usuário — apontando para um uuid que não
// existe, silenciosamente, sem nada falhando.
const PREFIXO_EMAIL = 'e:'

export function gerarTokenEmail(email: string): string {
  const payload = Buffer.from(PREFIXO_EMAIL + email.trim().toLowerCase(), 'utf8').toString('base64url')
  return `${payload}.${assinar(payload)}`
}

/** Retorna o email se o token for válido e for de email, ou null. */
export function verificarTokenEmail(token: string): string | null {
  const bruto = verificarTokenCancelamento(token)
  if (!bruto || !bruto.startsWith(PREFIXO_EMAIL)) return null
  return bruto.slice(PREFIXO_EMAIL.length)
}

#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════
// scripts/reenviarApagao.mjs — REENVIA O QUE FICOU PELO CAMINHO
//
// Entre 06/08 e 25/08/2026 o domínio remetente parou de entregar no Resend e
// nada aqui percebeu: 624 emails foram gravados como enviados sem terem
// chegado a ninguém. Este script reenvia a parte que ainda faz sentido.
//
//   node scripts/reenviarApagao.mjs              → só mostra o que faria
//   node scripts/reenviarApagao.mjs --executar   → reenvia de verdade
//
// Simulação por padrão, como o resto do ferramental de scripts/migration.
//
// ── POR QUE NÃO REENVIAR OS 624 ──
//
// ⚠️ A maior parte daqueles emails APODRECEU. "Sua primeira semana" para quem
// entrou há um mês, o resumo quinzenal de um período que acabou, "sentimos sua
// falta, faz 7 dias" para quem voltou faz duas semanas: chegando hoje, cada um
// deles diz uma coisa falsa. Reenviar seria pior do que a falha original, e
// ainda por cima despejaria centenas de mensagens de uma vez sobre um domínio
// de envio criado hoje — que é o jeito mais rápido de queimar o domínio novo.
//
// Reenvia só o que continua verdadeiro independentemente da data:
//
//   carta_pessoal   · não tem uma única referência a tempo no texto (conferido)
//   curso_concluido · "você terminou o curso X" não deixa de ser verdade
//
// Fica de fora, de propósito: primeira_semana, resumo_quinzenal, inatividade_7
// e inatividade_21.
// ══════════════════════════════════════════════════════════════════
import { clienteServico, carregarEnv } from './migration/supabase.mjs'

const EXECUTAR = process.argv.includes('--executar')
const TIPOS = ['carta_pessoal', 'curso_concluido']
const INICIO_DO_APAGAO = '2026-08-06'

const env = carregarEnv()
const SITE = 'https://evolua.peritosacademy.com.br'
const SEGREDO = env.EMAIL_INTERNAL_SECRET

if (!SEGREDO) {
  console.error('EMAIL_INTERNAL_SECRET ausente no env.local.')
  process.exit(1)
}

const supabase = clienteServico()

const { data: linhas, error } = await supabase
  .from('email_enviados')
  .select('id, usuario_id, tipo, ref_id, criado_em')
  .in('tipo', TIPOS)
  .eq('estado', 'aceito')
  .gte('criado_em', INICIO_DO_APAGAO)
  .order('criado_em')

if (error) {
  console.error('não consegui ler email_enviados:', error.message)
  process.exit(1)
}

const porTipo = {}
for (const l of linhas) porTipo[l.tipo] = (porTipo[l.tipo] ?? 0) + 1

console.log(`\nlinhas do apagão elegíveis a reenvio (desde ${INICIO_DO_APAGAO}):`)
for (const [tipo, n] of Object.entries(porTipo)) console.log(`  ${tipo.padEnd(18)} ${n}`)
console.log(`  ${'TOTAL'.padEnd(18)} ${linhas.length}`)

if (!EXECUTAR) {
  console.log('\nSIMULAÇÃO. Nada foi enviado. Use --executar para reenviar de verdade.\n')
  process.exit(0)
}

let reenviados = 0, pulados = 0
for (const l of linhas) {
  // Marcar como `falhou` ANTES de tentar é o que libera a vaga no índice
  // parcial de dedupe; sem isso o novo registro estouraria o índice depois de
  // o email já ter saído, deixando um envio sem registro.
  await supabase.from('email_enviados').update({ estado: 'falhou', detalhe: 'apagao_06_08_a_25_08' }).eq('id', l.id)

  const r = await fetch(`${SITE}/api/internal/email-evento`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SEGREDO}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo: l.tipo, usuario_id: l.usuario_id, ref_id: l.ref_id }),
  })
  const corpo = await r.json().catch(() => ({}))
  if (corpo?.enviado) { reenviados++ } else { pulados++; console.log(`  pulado ${l.tipo} ${l.usuario_id}: ${corpo?.motivo ?? r.status}`) }

  // O Resend aceita 2 por segundo. Sem a pausa, metade volta 429 e o script
  // "termina" tendo mandado metade.
  await new Promise(res => setTimeout(res, 700))
}

console.log(`\nreenviados: ${reenviados} · pulados: ${pulados}\n`)

#!/usr/bin/env node
// ══════════════════════════════════════════════════════
// O ENDEREÇO PÚBLICO DE QUEM NUNCA SALVOU O PERFIL
//
// Uso:
//   node scripts/backfill-slugs-perfis.mjs            # simulação (padrão)
//   node scripts/backfill-slugs-perfis.mjs --aplicar   # grava
//
// `perfis.slug` só nascia dentro de `salvarPerfil` — ou seja, quando a pessoa
// abria o perfil e clicava em salvar. Os 403 alunos migrados da Ensinio e os 30
// que entraram depois nunca fizeram isso, então 432 dos 433 perfis estavam sem
// slug (medido em 11/08/2026).
//
// A consequência aparecia no menu do avatar: "Perfil público" apontava para
// `/perito/${slug ?? ''}`, que vira `/perito/` — rota que não casa com
// `/perito/[slug]` e devolve 404. Praticamente toda a base clicava e via erro.
//
// ── O DESEMPATE ──
//
// Não existe índice único em `perfis.slug`, e `carregarPeritoPublico` busca com
// `.single()`, que ERRA quando mais de uma linha casa. Gerar slug pelo nome sem
// conferir duplicidade derrubaria a página pública dos DOIS homônimos — e são 3
// colisões nesta base (6 pessoas).
//
// Quem já tem slug mantém o dele. Entre os que não têm, a ordem é a de criação:
// quem chegou primeiro fica com o endereço limpo, o seguinte vira `-2`. É a
// mesma regra de `salvarPerfil`, e as duas precisam concordar — se divergirem,
// a primeira pessoa a salvar o perfil depois disto muda de endereço sozinha.
// ══════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const APLICAR = process.argv.includes('--aplicar')

function lerEnvLocal(caminho) {
  if (!existsSync(caminho)) return {}
  return Object.fromEntries(
    readFileSync(caminho, 'utf-8')
      .split('\n')
      .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
  )
}

const env = lerEnvLocal(join(process.cwd(), 'env.local'))
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')

const sb = createClient(url, key, { auth: { persistSession: false } })

/** Idêntico ao de app/perfil/actions.ts. Se um mudar, o outro muda junto. */
function slugificar(nome) {
  return (
    (nome || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'perito'
  )
}

// PAGINADO: `perfis` passa de 400 e cresce; um select cru devolveria só as
// primeiras mil sem avisar, e os de fora ficariam sem endereço para sempre.
const perfis = []
for (let de = 0; ; de += 1000) {
  const { data, error } = await sb
    .from('perfis')
    .select('id, nome, slug, criado_em')
    .order('criado_em', { ascending: true })
    .range(de, de + 999)
  if (error) throw new Error(`perfis: ${error.message}`)
  perfis.push(...data)
  if (data.length < 1000) break
}

const ocupados = new Set(perfis.filter((p) => p.slug).map((p) => p.slug))
const semSlug = perfis.filter((p) => !p.slug)

console.log(`\n${APLICAR ? '🔴 APLICANDO' : '🔵 SIMULAÇÃO'}`)
console.log(`   perfis: ${perfis.length} · já com slug: ${ocupados.size} · sem slug: ${semSlug.length}\n`)

const plano = []
for (const p of semSlug) {
  const base = slugificar(p.nome)
  let slug = base
  for (let n = 2; ocupados.has(slug); n++) slug = `${base}-${n}`
  ocupados.add(slug)
  plano.push({ id: p.id, nome: p.nome, slug, desempatado: slug !== base })
}

for (const l of plano.filter((x) => x.desempatado)) {
  console.log(`  ⚖️  ${(l.nome || '').padEnd(38)} -> ${l.slug}  (homônimo; o primeiro ficou com o endereço limpo)`)
}

let gravados = 0
const erros = []
if (APLICAR) {
  for (const l of plano) {
    const { error } = await sb.from('perfis').update({ slug: l.slug }).eq('id', l.id)
    if (error) erros.push(`${l.nome}: ${error.message}`)
    else gravados++
  }
}

console.log(`${'─'.repeat(60)}`)
console.log(`slugs a gravar:   ${plano.length}`)
console.log(`desempatados:     ${plano.filter((x) => x.desempatado).length}`)
if (APLICAR) console.log(`gravados:         ${gravados}`)
if (erros.length) {
  console.log(`\n❌ ERROS (${erros.length}):`)
  for (const e of erros) console.log(`   ${e}`)
}
if (!APLICAR) console.log('\n🔵 Nada foi escrito. Rode com --aplicar para valer.')

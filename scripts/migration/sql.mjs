#!/usr/bin/env node
// scripts/migration/sql.mjs
// Roda SQL no projeto Supabase via Management API.
//
//   node scripts/migration/sql.mjs "select 1;"
//   node scripts/migration/sql.mjs --arquivo=supabase/migrations/xxx.sql
//
// Usa SUPABASE_ACCESS_TOKEN (token pessoal, já presente no ambiente) — não a
// service role key, que só fala com PostgREST/Auth/Storage e não executa SQL.
// A conexão roda como `postgres` (owner), então DDL e GRANT/REVOKE funcionam.
import { readFileSync } from 'node:fs'
import { carregarEnv } from './supabase.mjs'

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN
if (!TOKEN) {
  console.error('SUPABASE_ACCESS_TOKEN não está no ambiente.')
  process.exit(1)
}

export function refDoProjeto() {
  const env = carregarEnv()
  const m = String(env.NEXT_PUBLIC_SUPABASE_URL ?? '').match(/https:\/\/([a-z0-9]+)\.supabase\./)
  if (!m) throw new Error('não consegui extrair o ref do projeto de NEXT_PUBLIC_SUPABASE_URL')
  return m[1]
}

export async function rodarSql(sql) {
  const ref = refDoProjeto()
  const resposta = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const texto = await resposta.text()
  if (!resposta.ok) {
    throw new Error(`HTTP ${resposta.status}: ${texto}`)
  }
  try { return JSON.parse(texto) } catch { return texto }
}

// ------------------------------------------------------------------- CLI
const executadoDireto = import.meta.url === `file://${process.argv[1]}`
if (executadoDireto) {
  const args = process.argv.slice(2)
  const arquivo = args.find((a) => a.startsWith('--arquivo='))?.slice(10)
  const sql = arquivo ? readFileSync(arquivo, 'utf8') : args.join(' ')
  if (!sql.trim()) { console.error('nada pra rodar'); process.exit(1) }
  try {
    const r = await rodarSql(sql)
    console.log(typeof r === 'string' ? r : JSON.stringify(r, null, 2))
  } catch (e) {
    console.error('❌ ' + e.message)
    process.exit(1)
  }
}

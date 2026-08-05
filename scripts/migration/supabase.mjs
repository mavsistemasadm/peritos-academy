// scripts/migration/supabase.mjs
// Cliente service-role para os scripts de migração. Lê as chaves de
// env.local (mesmo arquivo que o `next dev` usa) sem depender de nenhuma
// lib de dotenv.
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'

export function carregarEnv(caminho = 'env.local') {
  // aceita também .env.local (nome padrão do Next) se existir
  const alvo = existsSync(caminho) ? caminho : '.env.local'
  if (!existsSync(alvo)) throw new Error(`não achei ${caminho} nem .env.local`)
  const env = {}
  for (const linha of readFileSync(alvo, 'utf8').split('\n')) {
    const t = linha.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
  return env
}

export function clienteServico() {
  const env = carregarEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

// app/avisos/actions.ts
// Ações do sistema de avisos: marcar novidades e notificações como lidas.
'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import type { Notificacao } from '@/lib/queries/avisos'

// ---------- NOVIDADES ----------

// Marca UMA novidade como lida (ao fechar o popup daquela novidade)
export async function marcarNovidadeLida(novidadeId: string) {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return { ok: false }

  const { error } = await supabase.from('novidade_leituras').insert({
    novidade_id: novidadeId, usuario_id: auth.user.id,
  })
  // 23505 = já estava lida (clique duplo); tudo bem
  if (error && error.code !== '23505') return { ok: false, erro: error.message }

  revalidatePath('/', 'layout')
  return { ok: true }
}

// Marca TODAS as novidades publicadas como lidas ("Marcar todas como lidas")
export async function marcarTodasNovidadesLidas() {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return { ok: false }

  const { data: novidades } = await supabase
    .from('novidades').select('id').eq('publicado', true)

  if (novidades?.length) {
    const { error } = await supabase.from('novidade_leituras').upsert(
      novidades.map(n => ({ novidade_id: n.id, usuario_id: auth.user!.id })),
      { onConflict: 'novidade_id,usuario_id', ignoreDuplicates: true },
    )
    if (error) return { ok: false, erro: error.message }
  }

  revalidatePath('/', 'layout')
  return { ok: true }
}

// ---------- NOTIFICAÇÕES ----------

// Marca uma notificação como lida (ao clicar nela)
export async function marcarNotificacaoLida(notificacaoId: string) {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return { ok: false }

  const { error } = await supabase.from('notificacoes')
    .update({ lida: true }).eq('id', notificacaoId)
  if (error) return { ok: false, erro: error.message }

  revalidatePath('/', 'layout')
  return { ok: true }
}

// Marca todas as notificações como lidas
export async function marcarTodasNotificacoesLidas() {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return { ok: false }

  const { error } = await supabase.from('notificacoes')
    .update({ lida: true }).eq('lida', false)
  if (error) return { ok: false, erro: error.message }

  revalidatePath('/', 'layout')
  return { ok: true }
}

// Busca a próxima página de notificações (painel do sino, "carregar mais")
export async function buscarMaisNotificacoes(offset: number): Promise<{ ok: true; notificacoes: Notificacao[] } | { ok: false }> {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return { ok: false }

  const { data, error } = await supabase.from('notificacoes')
    .select('*')
    .order('criado_em', { ascending: false })
    .range(offset, offset + 11)

  if (error) return { ok: false }
  return { ok: true, notificacoes: (data ?? []) as Notificacao[] }
}
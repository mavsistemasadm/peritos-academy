'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'

type Resultado = { ok: true } | { ok: false; erro: string }

async function checarPermissao() {
  const admin = await obterAdminAtual()
  if (!temPermissao(admin, 'comunidade')) return null
  return admin
}

function revalidar() {
  revalidatePath('/admin/comunidade')
  revalidatePath('/comunidade')
}

// ---------- Posts ----------

export async function alternarFixado(postId: string, fixado: boolean): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('comunidade_posts').update({ fixado }).eq('id', postId)
  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true }
}

export async function alternarDestaque(postId: string, destaque: boolean): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('comunidade_posts').update({ destaque }).eq('id', postId)
  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true }
}

export async function excluirPost(postId: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('comunidade_posts').delete().eq('id', postId)
  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true }
}

// ---------- Comentários ----------

export async function marcarMelhorResposta(comentarioId: string, postId: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const supabase = await criarClienteServidor()
  const { error: e1 } = await supabase.from('comunidade_comentarios').update({ melhor_resposta: false }).eq('post_id', postId)
  if (e1) return { ok: false, erro: e1.message }
  const { error: e2 } = await supabase.from('comunidade_comentarios').update({ melhor_resposta: true }).eq('id', comentarioId)
  if (e2) return { ok: false, erro: e2.message }
  revalidar()
  return { ok: true }
}

export async function desmarcarMelhorResposta(comentarioId: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('comunidade_comentarios').update({ melhor_resposta: false }).eq('id', comentarioId)
  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true }
}

export async function excluirComentario(comentarioId: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('comunidade_comentarios').delete().eq('id', comentarioId)
  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true }
}

// ---------- Dúvidas de aula ----------

export async function excluirDuvidaAula(id: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('aula_duvidas').delete().eq('id', id)
  if (error) return { ok: false, erro: error.message }
  revalidatePath('/admin/comunidade')
  return { ok: true }
}

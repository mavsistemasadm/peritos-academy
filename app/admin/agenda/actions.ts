'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'

type Resultado = { ok: true; id?: string } | { ok: false; erro: string }

async function checarPermissao() {
  const admin = await obterAdminAtual()
  if (!temPermissao(admin, 'agenda')) return null
  return admin
}

function revalidar(id?: string) {
  revalidatePath('/admin/agenda')
  if (id) revalidatePath(`/admin/agenda/${id}`)
  revalidatePath('/agenda')
  revalidatePath('/comunidade')
  revalidatePath('/')
}

function montarCampos(formData: FormData) {
  const iniciaEmRaw = (formData.get('inicia_em') as string)?.trim()
  return {
    titulo: (formData.get('titulo') as string)?.trim(),
    tipo: (formData.get('tipo') as string)?.trim(),
    descricao: (formData.get('descricao') as string)?.trim() || null,
    inicia_em: iniciaEmRaw ? new Date(iniciaEmRaw).toISOString() : null,
    duracao_seg: Number((formData.get('duracao_seg') as string) || 3600),
    link_transmissao: (formData.get('link_transmissao') as string)?.trim() || null,
    gravacao_url: (formData.get('gravacao_url') as string)?.trim() || null,
    apresentador_nome: (formData.get('apresentador_nome') as string)?.trim() || null,
    apresentador_cargo: (formData.get('apresentador_cargo') as string)?.trim() || null,
    meta_extra: (formData.get('meta_extra') as string)?.trim() || null,
    curso_id: (formData.get('curso_id') as string)?.trim() || null,
    alvo_rotulo: (formData.get('alvo_rotulo') as string)?.trim() || null,
    visibilidade: (formData.get('visibilidade') as string)?.trim() || 'todos',
    gravar: formData.get('gravar') === 'on',
    lembrete: formData.get('lembrete') === 'on',
    publicar_feed: formData.get('publicar_feed') === 'on',
  }
}

export async function criarEvento(formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const admin = await obterAdminAtual()
  const campos = montarCampos(formData)
  if (!campos.titulo || campos.titulo.length < 3) return { ok: false, erro: 'Título precisa ter pelo menos 3 caracteres.' }
  if (!['sala_analise', 'aula_ao_vivo', 'plantao', 'mentoria', 'lancamento'].includes(campos.tipo)) {
    return { ok: false, erro: 'Tipo inválido.' }
  }

  const supabase = await criarClienteServidor()
  const { data, error } = await supabase
    .from('eventos')
    .insert({ ...campos, publicado: false, criado_por: admin?.usuarioId ?? null })
    .select('id')
    .single()

  if (error) return { ok: false, erro: error.message }
  revalidar(data.id)
  return { ok: true, id: data.id }
}

export async function atualizarEvento(id: string, formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const campos = montarCampos(formData)
  if (!campos.titulo || campos.titulo.length < 3) return { ok: false, erro: 'Título precisa ter pelo menos 3 caracteres.' }
  if (!['sala_analise', 'aula_ao_vivo', 'plantao', 'mentoria', 'lancamento'].includes(campos.tipo)) {
    return { ok: false, erro: 'Tipo inválido.' }
  }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('eventos').update(campos).eq('id', id)
  if (error) return { ok: false, erro: error.message }
  revalidar(id)
  return { ok: true }
}

export async function alternarPublicacaoEvento(id: string, publicado: boolean): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('eventos').update({ publicado }).eq('id', id)
  if (error) return { ok: false, erro: error.message }
  revalidar(id)
  return { ok: true }
}

export async function excluirEvento(id: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('eventos').delete().eq('id', id)
  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true }
}

export async function uploadThumbEvento(id: string, formData: FormData): Promise<Resultado & { thumbUrl?: string }> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const arquivo = formData.get('thumb') as File | null
  if (!arquivo || arquivo.size === 0) return { ok: false, erro: 'Selecione uma imagem.' }
  const ext = arquivo.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return { ok: false, erro: 'Formato não aceito. Use JPG, PNG ou WebP.' }
  if (arquivo.size > 5 * 1024 * 1024) return { ok: false, erro: 'Imagem muito grande. Máximo 5 MB.' }

  const supabase = await criarClienteServidor()
  const path = `eventos/${id}/thumb.${ext}`
  const buffer = Buffer.from(await arquivo.arrayBuffer())
  const { error: upErr } = await supabase.storage.from('capas').upload(path, buffer, { contentType: arquivo.type, upsert: true })
  if (upErr) return { ok: false, erro: upErr.message }

  const { data: urlData } = supabase.storage.from('capas').getPublicUrl(path)
  const thumbUrl = urlData.publicUrl + '?t=' + Date.now()

  const { error } = await supabase.from('eventos').update({ gravacao_thumb_url: thumbUrl }).eq('id', id)
  if (error) return { ok: false, erro: error.message }
  revalidar(id)
  return { ok: true, thumbUrl }
}

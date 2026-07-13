'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'

type Resultado = { ok: true; id?: string } | { ok: false; erro: string }

async function checarPermissao() {
  const admin = await obterAdminAtual()
  if (!temPermissao(admin, 'avisos')) return null
  return admin
}

function revalidar() {
  revalidatePath('/admin/avisos')
  revalidatePath('/avisos')
  revalidatePath('/')
}

function montarCampos(formData: FormData) {
  const corpoRaw = (formData.get('corpo') as string) ?? ''
  return {
    titulo: (formData.get('titulo') as string)?.trim() || null,
    corpo: corpoRaw.split('\n').map(l => l.trim()).filter(Boolean),
    link_url: (formData.get('link_url') as string)?.trim() || null,
    link_rotulo: (formData.get('link_rotulo') as string)?.trim() || null,
    selo: (formData.get('selo') as string)?.trim() || null,
  }
}

export async function criarNovidade(formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const campos = montarCampos(formData)
  if (!campos.titulo) return { ok: false, erro: 'Título é obrigatório.' }

  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.from('novidades').insert({ ...campos, publicado: false }).select('id').single()
  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true, id: data.id }
}

export async function atualizarNovidade(id: string, formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const campos = montarCampos(formData)
  if (!campos.titulo) return { ok: false, erro: 'Título é obrigatório.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('novidades').update(campos).eq('id', id)
  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true }
}

export async function alternarPublicacaoNovidade(id: string, publicado: boolean): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('novidades').update({ publicado }).eq('id', id)
  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true }
}

export async function excluirNovidade(id: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('novidades').delete().eq('id', id)
  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true }
}

export async function uploadImagemNovidade(id: string, formData: FormData): Promise<Resultado & { imagemUrl?: string }> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const arquivo = formData.get('imagem') as File | null
  if (!arquivo || arquivo.size === 0) return { ok: false, erro: 'Selecione uma imagem.' }
  const ext = arquivo.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return { ok: false, erro: 'Formato não aceito. Use JPG, PNG ou WebP.' }
  if (arquivo.size > 5 * 1024 * 1024) return { ok: false, erro: 'Imagem muito grande. Máximo 5 MB.' }

  const supabase = await criarClienteServidor()
  const path = `novidades/${id}/imagem.${ext}`
  const buffer = Buffer.from(await arquivo.arrayBuffer())
  const { error: upErr } = await supabase.storage.from('capas').upload(path, buffer, { contentType: arquivo.type, upsert: true })
  if (upErr) return { ok: false, erro: upErr.message }

  const { data: urlData } = supabase.storage.from('capas').getPublicUrl(path)
  const imagemUrl = urlData.publicUrl + '?t=' + Date.now()

  const { error } = await supabase.from('novidades').update({ imagem_url: imagemUrl }).eq('id', id)
  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true, imagemUrl }
}

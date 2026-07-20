// app/perfil/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'

export async function salvarPerfil(formData: FormData) {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return { ok: false as const, erro: 'Faça login.' }

  const nome = (formData.get('nome') as string)?.trim()
  const bio = (formData.get('bio') as string)?.trim() || null
  const cidade = (formData.get('cidade') as string)?.trim() || null
  const estado = (formData.get('estado') as string)?.trim() || null
  const telefone = (formData.get('telefone') as string)?.trim() || null
  const email_publico = (formData.get('email_publico') as string)?.trim() || null
  const mostrar_tel = formData.get('mostrar_tel') === 'on'
  const mostrar_email = formData.get('mostrar_email') === 'on'
  const perfil_publico = formData.get('perfil_publico') === 'on'
  const sons_conquista = formData.get('sons_conquista') === 'on'

  if (!nome || nome.length < 3) return { ok: false as const, erro: 'Nome precisa ter pelo menos 3 caracteres.' }

  const slug = nome
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  const { error } = await supabase
    .from('perfis')
    .update({ nome, bio, cidade, estado, telefone, email_publico, mostrar_tel, mostrar_email, perfil_publico, sons_conquista, slug })
    .eq('id', auth.user.id)

  if (error) return { ok: false as const, erro: error.message }

  revalidatePath('/perfil')
  revalidatePath(`/perito/${slug}`)
  revalidatePath('/', 'layout')
  return { ok: true as const, slug }
}

export async function salvarPreferenciaEmail(receberEmails: boolean) {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return { ok: false as const, erro: 'Faça login.' }

  const { error } = await supabase
    .from('email_preferencias')
    .upsert({ usuario_id: auth.user.id, receber_emails: receberEmails }, { onConflict: 'usuario_id' })

  if (error) return { ok: false as const, erro: error.message }
  return { ok: true as const }
}

export async function uploadFoto(formData: FormData) {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return { ok: false as const, erro: 'Faça login.' }

  const arquivo = formData.get('foto') as File | null
  if (!arquivo || arquivo.size === 0) return { ok: false as const, erro: 'Selecione uma foto.' }

  const ext = arquivo.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return { ok: false as const, erro: 'Formato não aceito. Use JPG, PNG ou WebP.' }
  if (arquivo.size > 5 * 1024 * 1024) return { ok: false as const, erro: 'Foto muito grande. Máximo 5 MB.' }

  const userId = auth.user.id
  const path = `${userId}/foto.${ext}`
  const buffer = Buffer.from(await arquivo.arrayBuffer())

  const { error: upErr } = await supabase.storage
    .from('fotos-perfil')
    .upload(path, buffer, { contentType: arquivo.type, upsert: true })
  if (upErr) return { ok: false as const, erro: upErr.message }

  const { data: urlData } = supabase.storage.from('fotos-perfil').getPublicUrl(path)
  const foto_url = urlData.publicUrl + '?t=' + Date.now()

  const { error } = await supabase.from('perfis').update({ foto_url }).eq('id', userId)
  if (error) return { ok: false as const, erro: error.message }

  revalidatePath('/perfil')
  return { ok: true as const, foto_url }
}
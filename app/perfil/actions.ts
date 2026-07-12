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

  if (!nome || nome.length < 3) return { ok: false as const, erro: 'Nome precisa ter pelo menos 3 caracteres.' }

  // gera slug a partir do nome
  const slug = nome
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  const { error } = await supabase
    .from('perfis')
    .update({
      nome,
      bio,
      cidade,
      estado,
      telefone,
      email_publico,
      mostrar_tel,
      mostrar_email,
      perfil_publico,
      slug,
    })
    .eq('id', auth.user.id)

  if (error) return { ok: false as const, erro: error.message }

  revalidatePath('/perfil')
  revalidatePath(`/perito/${slug}`)
  return { ok: true as const, slug }
}
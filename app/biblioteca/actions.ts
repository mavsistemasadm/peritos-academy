// app/biblioteca/actions.ts
// Ações da biblioteca: download com link assinado (bucket privado,
// validado no servidor) e toggle de favorita.
'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'

// ---------- DOWNLOAD ----------
// Valida o acesso do aluno, registra o download e devolve um link
// assinado que expira em 60 segundos. Ninguém baixa por fora.
export async function baixarItem(planilhaId: string) {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return { ok: false as const, erro: 'Faça login para baixar.' }

  // 1) o aluno pertence ao grupo com acesso?
  const { data: perfil } = await supabase
    .from('perfis').select('acesso_biblioteca').eq('id', auth.user.id).single()
  if (!perfil?.acesso_biblioteca) {
    return { ok: false as const, erro: 'Sua conta ainda não tem acesso à Biblioteca.' }
  }

  // 2) o item existe e está publicado?
  const { data: item } = await supabase
    .from('planilhas').select('id, arquivo_path, nome, publicado')
    .eq('id', planilhaId).single()
  if (!item?.publicado || !item.arquivo_path) {
    return { ok: false as const, erro: 'Arquivo indisponível.' }
  }

  // 3) gera o link assinado do bucket privado (expira em 60s)
  const { data: assinado, error: erroAssinar } = await supabase.storage
    .from('planilhas')
    .createSignedUrl(item.arquivo_path, 60, { download: true })
  if (erroAssinar || !assinado?.signedUrl) {
    return { ok: false as const, erro: 'Não foi possível gerar o link. Tente de novo.' }
  }

  // 4) registra o download (contador real + "minhas baixadas")
  await supabase.from('planilha_downloads').insert({
    planilha_id: planilhaId, usuario_id: auth.user.id,
  })

  revalidatePath('/biblioteca')
  return { ok: true as const, url: assinado.signedUrl }
}

// ---------- FAVORITA (toggle ⭐) ----------
export async function alternarFavorita(planilhaId: string) {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return { ok: false as const }

  const { data: existente } = await supabase
    .from('planilha_favoritas').select('id')
    .eq('planilha_id', planilhaId).eq('usuario_id', auth.user.id).maybeSingle()

  if (existente) {
    await supabase.from('planilha_favoritas').delete().eq('id', existente.id)
  } else {
    const { error } = await supabase.from('planilha_favoritas').insert({
      planilha_id: planilhaId, usuario_id: auth.user.id,
    })
    if (error && error.code !== '23505') return { ok: false as const }
  }

  revalidatePath('/biblioteca')
  return { ok: true as const, favorita: !existente }
}
// app/comunidade/actions.ts
// Ações da comunidade: publicar, útil, salvar, parabenizar.
'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'

// ---------- PUBLICAR (caixa de compor) ----------
export async function publicarPost(dados: {
  texto: string
  tipo: 'caso' | 'duvida' | 'vitoria'
  espacoId: string
}) {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return { ok: false, erro: 'É preciso entrar para publicar.' }

  const texto = dados.texto.trim()
  if (!texto) return { ok: false, erro: 'Escreva algo antes de publicar.' }

  // 1ª linha (ou 1ª frase) vira o título; o resto vira o corpo
  const quebra = texto.indexOf('\n')
  let titulo: string, corpo: string | null
  if (quebra > -1) {
    titulo = texto.slice(0, quebra).trim()
    corpo = texto.slice(quebra + 1).trim() || null
  } else if (texto.length > 90) {
    const ponto = texto.indexOf('. ')
    if (ponto > 20 && ponto < 120) {
      titulo = texto.slice(0, ponto + 1)
      corpo = texto.slice(ponto + 2).trim() || null
    } else {
      titulo = texto.slice(0, 90) + '…'
      corpo = texto
    }
  } else {
    titulo = texto
    corpo = null
  }

  // nível real do perfil pro selo "N12" do post
  const { data: perfil } = await supabase
    .from('perfis').select('nome, nivel').eq('id', auth.user.id).single()

  const { error } = await supabase.from('comunidade_posts').insert({
    espaco_id: dados.espacoId,
    usuario_id: auth.user.id,
    autor_nome: perfil?.nome ?? null,
    autor_nivel: perfil?.nivel ?? null,
    tipo: dados.tipo,
    titulo,
    corpo,
  })
  if (error) return { ok: false, erro: error.message }

  revalidatePath('/comunidade')
  return { ok: true }
}

// ---------- REAÇÕES (útil / salvar / parabenizar) — toggle ----------
export async function alternarReacao(postId: string, tipo: 'util' | 'salvar' | 'parabens') {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return { ok: false, erro: 'É preciso entrar para reagir.' }

  // já existe? então remove (toggle off)
  const { data: existente } = await supabase
    .from('comunidade_reacoes')
    .select('id')
    .eq('post_id', postId)
    .eq('tipo', tipo)
    .maybeSingle()

  if (existente) {
    const { error } = await supabase
      .from('comunidade_reacoes').delete().eq('id', existente.id)
    if (error) return { ok: false, erro: error.message }
    revalidatePath('/comunidade')
    return { ok: true, ativo: false }
  }

  const { error } = await supabase.from('comunidade_reacoes').insert({
    post_id: postId, usuario_id: auth.user.id, tipo,
  })
  // 23505 = corrida entre dois cliques; tratamos como já-ativo
  if (error && error.code !== '23505') return { ok: false, erro: error.message }

  revalidatePath('/comunidade')
  return { ok: true, ativo: true }
}
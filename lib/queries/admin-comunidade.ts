// lib/queries/admin-comunidade.ts
import { criarClienteServidor } from '@/lib/supabase/server'

export type PostAdmin = {
  id: string
  espacoId: string | null
  espacoNome: string
  autorNome: string | null
  tipo: string
  titulo: string | null
  corpo: string | null
  respondida: boolean
  fixado: boolean
  destaque: boolean
  criadoEm: string
  totalComentarios: number
}

export type ComentarioAdmin = {
  id: string
  postId: string | null
  postTitulo: string
  autorNome: string | null
  corpo: string | null
  melhorResposta: boolean
  criadoEm: string
}

export type DuvidaAulaAdmin = {
  id: string
  aulaId: string | null
  aulaTitulo: string
  autorNome: string | null
  texto: string | null
  eEspecialista: boolean
  criadaEm: string
}

export async function carregarPostsAdmin(): Promise<PostAdmin[]> {
  const supabase = await criarClienteServidor()
  const { data: posts } = await supabase
    .from('comunidade_posts')
    .select('id, espaco_id, autor_nome, tipo, titulo, corpo, respondida, fixado, destaque, criado_em')
    .order('fixado', { ascending: false })
    .order('criado_em', { ascending: false })
  if (!posts || posts.length === 0) return []

  const [{ data: espacos }, { data: comentarios }] = await Promise.all([
    supabase.from('comunidade_espacos').select('id, nome'),
    supabase.from('comunidade_comentarios').select('post_id'),
  ])
  const espacosMap = new Map((espacos ?? []).map(e => [e.id, e.nome as string]))
  const comentariosPorPost = new Map<string, number>()
  for (const c of comentarios ?? []) {
    if (!c.post_id) continue
    comentariosPorPost.set(c.post_id, (comentariosPorPost.get(c.post_id) ?? 0) + 1)
  }

  return posts.map(p => ({
    id: p.id, espacoId: p.espaco_id, espacoNome: p.espaco_id ? espacosMap.get(p.espaco_id) ?? 'Geral' : 'Geral',
    autorNome: p.autor_nome, tipo: p.tipo, titulo: p.titulo, corpo: p.corpo, respondida: p.respondida,
    fixado: p.fixado, destaque: p.destaque, criadoEm: p.criado_em,
    totalComentarios: comentariosPorPost.get(p.id) ?? 0,
  }))
}

export async function carregarComentariosAdmin(): Promise<ComentarioAdmin[]> {
  const supabase = await criarClienteServidor()
  const { data: comentarios } = await supabase
    .from('comunidade_comentarios')
    .select('id, post_id, autor_nome, corpo, melhor_resposta, criado_em')
    .order('criado_em', { ascending: false })
    .limit(200)
  if (!comentarios || comentarios.length === 0) return []

  const postIds = [...new Set(comentarios.map(c => c.post_id).filter(Boolean) as string[])]
  const { data: posts } = postIds.length
    ? await supabase.from('comunidade_posts').select('id, titulo, corpo').in('id', postIds)
    : { data: [] as any[] }
  const postsMap = new Map((posts ?? []).map(p => [p.id, p.titulo ?? (p.corpo ?? '').slice(0, 40) ?? 'Post']))

  return comentarios.map(c => ({
    id: c.id, postId: c.post_id, postTitulo: c.post_id ? postsMap.get(c.post_id) ?? 'Post' : 'Post',
    autorNome: c.autor_nome, corpo: c.corpo, melhorResposta: c.melhor_resposta, criadoEm: c.criado_em,
  }))
}

export async function carregarDuvidasAulaAdmin(): Promise<DuvidaAulaAdmin[]> {
  const supabase = await criarClienteServidor()
  const { data: duvidas } = await supabase
    .from('aula_duvidas')
    .select('id, aula_id, autor_nome, texto, e_especialista, criada_em')
    .order('criada_em', { ascending: false })
    .limit(200)
  if (!duvidas || duvidas.length === 0) return []

  const aulaIds = [...new Set(duvidas.map(d => d.aula_id).filter(Boolean) as string[])]
  const { data: aulas } = aulaIds.length
    ? await supabase.from('aulas').select('id, titulo').in('id', aulaIds)
    : { data: [] as any[] }
  const aulasMap = new Map((aulas ?? []).map(a => [a.id, a.titulo as string]))

  return duvidas.map(d => ({
    id: d.id, aulaId: d.aula_id, aulaTitulo: d.aula_id ? aulasMap.get(d.aula_id) ?? 'Aula' : 'Aula',
    autorNome: d.autor_nome, texto: d.texto, eEspecialista: d.e_especialista, criadaEm: d.criada_em,
  }))
}

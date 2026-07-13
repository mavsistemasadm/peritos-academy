'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'
import { gerarSlug } from '@/lib/slug'

type Resultado = { ok: true; id?: string } | { ok: false; erro: string }

async function checarPermissao() {
  const admin = await obterAdminAtual()
  if (!temPermissao(admin, 'trilhas')) return null
  return admin
}

function revalidarTrilha(id?: string) {
  revalidatePath('/admin/trilhas')
  if (id) revalidatePath(`/admin/trilhas/${id}`)
  revalidatePath('/biblioteca')
  revalidatePath('/cursos')
}

// ---------- Trilha ----------

export async function criarTrilha(formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const nome = (formData.get('nome') as string)?.trim()
  if (!nome || nome.length < 3) return { ok: false, erro: 'Nome precisa ter pelo menos 3 caracteres.' }

  const supabase = await criarClienteServidor()
  const { data, error } = await supabase
    .from('trilhas')
    .insert({
      nome,
      slug: gerarSlug(nome),
      descricao: (formData.get('descricao') as string)?.trim() || null,
      principal: formData.get('principal') === 'on',
      ordem: 0,
    })
    .select('id')
    .single()

  if (error) return { ok: false, erro: error.message }

  revalidarTrilha(data.id)
  return { ok: true, id: data.id }
}

export async function atualizarTrilha(id: string, formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const nome = (formData.get('nome') as string)?.trim()
  if (!nome || nome.length < 3) return { ok: false, erro: 'Nome precisa ter pelo menos 3 caracteres.' }

  const horasRaw = (formData.get('horas') as string)?.trim()
  const alunosRaw = (formData.get('alunos') as string)?.trim()

  const supabase = await criarClienteServidor()
  const { error } = await supabase
    .from('trilhas')
    .update({
      nome,
      descricao: (formData.get('descricao') as string)?.trim() || null,
      principal: formData.get('principal') === 'on',
      horas: horasRaw ? Number(horasRaw) : null,
      alunos: alunosRaw ? Number(alunosRaw) : null,
    })
    .eq('id', id)

  if (error) return { ok: false, erro: error.message }

  revalidarTrilha(id)
  return { ok: true }
}

export async function excluirTrilha(id: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('trilhas').delete().eq('id', id)
  if (error) return { ok: false, erro: error.message }

  revalidarTrilha()
  return { ok: true }
}

// ---------- Etapa ----------

export async function criarEtapa(trilhaId: string, formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const nome = (formData.get('nome') as string)?.trim()
  if (!nome) return { ok: false, erro: 'Nome da etapa é obrigatório.' }

  const supabase = await criarClienteServidor()
  const { data: ultima } = await supabase
    .from('etapas').select('ordem').eq('trilha_id', trilhaId).order('ordem', { ascending: false }).limit(1).maybeSingle()
  const ordem = (ultima?.ordem ?? 0) + 1

  const { error } = await supabase.from('etapas').insert({
    trilha_id: trilhaId,
    nome,
    descricao: (formData.get('descricao') as string)?.trim() || null,
    xp_conclusao: Number((formData.get('xp_conclusao') as string) || 0),
    insignia: (formData.get('insignia') as string)?.trim() || null,
    ordem,
  })
  if (error) return { ok: false, erro: error.message }

  revalidarTrilha(trilhaId)
  return { ok: true }
}

export async function atualizarEtapa(id: string, trilhaId: string, formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const nome = (formData.get('nome') as string)?.trim()
  if (!nome) return { ok: false, erro: 'Nome da etapa é obrigatório.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('etapas').update({
    nome,
    descricao: (formData.get('descricao') as string)?.trim() || null,
    xp_conclusao: Number((formData.get('xp_conclusao') as string) || 0),
    insignia: (formData.get('insignia') as string)?.trim() || null,
  }).eq('id', id)
  if (error) return { ok: false, erro: error.message }

  revalidarTrilha(trilhaId)
  return { ok: true }
}

export async function excluirEtapa(id: string, trilhaId: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('etapas').delete().eq('id', id)
  if (error) return { ok: false, erro: error.message }

  revalidarTrilha(trilhaId)
  return { ok: true }
}

export async function moverEtapa(trilhaId: string, id: string, direcao: 'up' | 'down'): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const supabase = await criarClienteServidor()
  const { data: etapas } = await supabase.from('etapas').select('id, ordem').eq('trilha_id', trilhaId).order('ordem', { ascending: true })
  if (!etapas) return { ok: false, erro: 'Etapas não encontradas.' }

  const idx = etapas.findIndex(e => e.id === id)
  const alvo = direcao === 'up' ? idx - 1 : idx + 1
  if (idx < 0 || alvo < 0 || alvo >= etapas.length) return { ok: true }

  const a = etapas[idx]
  const b = etapas[alvo]
  await Promise.all([
    supabase.from('etapas').update({ ordem: b.ordem }).eq('id', a.id),
    supabase.from('etapas').update({ ordem: a.ordem }).eq('id', b.id),
  ])

  revalidarTrilha(trilhaId)
  return { ok: true }
}

// ---------- Missões (cursos vinculados a uma etapa) ----------

export async function adicionarCursoNaEtapa(etapaId: string, trilhaId: string, cursoId: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  if (!cursoId) return { ok: false, erro: 'Selecione um curso.' }

  const supabase = await criarClienteServidor()
  const { data: ultima } = await supabase
    .from('etapa_missoes').select('ordem').eq('etapa_id', etapaId).order('ordem', { ascending: false }).limit(1).maybeSingle()
  const ordem = (ultima?.ordem ?? 0) + 1

  const { error } = await supabase.from('etapa_missoes').insert({ etapa_id: etapaId, curso_id: cursoId, ordem })
  if (error) return { ok: false, erro: error.message.includes('duplicate') ? 'Esse curso já está nessa etapa.' : error.message }

  revalidarTrilha(trilhaId)
  return { ok: true }
}

export async function removerCursoDaEtapa(etapaId: string, trilhaId: string, cursoId: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('etapa_missoes').delete().eq('etapa_id', etapaId).eq('curso_id', cursoId)
  if (error) return { ok: false, erro: error.message }

  revalidarTrilha(trilhaId)
  return { ok: true }
}

export async function moverMissao(etapaId: string, trilhaId: string, cursoId: string, direcao: 'up' | 'down'): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const supabase = await criarClienteServidor()
  const { data: missoes } = await supabase.from('etapa_missoes').select('curso_id, ordem').eq('etapa_id', etapaId).order('ordem', { ascending: true })
  if (!missoes) return { ok: false, erro: 'Missões não encontradas.' }

  const idx = missoes.findIndex(m => m.curso_id === cursoId)
  const alvo = direcao === 'up' ? idx - 1 : idx + 1
  if (idx < 0 || alvo < 0 || alvo >= missoes.length) return { ok: true }

  const a = missoes[idx]
  const b = missoes[alvo]
  await Promise.all([
    supabase.from('etapa_missoes').update({ ordem: b.ordem }).eq('etapa_id', etapaId).eq('curso_id', a.curso_id),
    supabase.from('etapa_missoes').update({ ordem: a.ordem }).eq('etapa_id', etapaId).eq('curso_id', b.curso_id),
  ])

  revalidarTrilha(trilhaId)
  return { ok: true }
}

// lib/queries/admin-trilhas.ts
import { criarClienteServidor } from '@/lib/supabase/server'

export type TrilhaAdmin = {
  id: string
  nome: string | null
  slug: string | null
  descricao: string | null
  ordem: number | null
  principal: boolean | null
  missoesQtd: number | null
  horas: number | null
  alunos: number | null
}

export type TrilhaListaItem = TrilhaAdmin & { totalEtapas: number }

export type EtapaMissaoAdmin = {
  cursoId: string
  ordem: number
  curso: { titulo: string; slug: string; capaUrl: string | null }
}

export type EtapaAdmin = {
  id: string
  trilhaId: string
  nome: string
  descricao: string | null
  ordem: number
  xpConclusao: number
  insignia: string | null
  missoes: EtapaMissaoAdmin[]
}

export type TrilhaDetalheAdmin = {
  trilha: TrilhaAdmin
  etapas: EtapaAdmin[]
}

export type CursoPicker = { id: string; titulo: string; slug: string; outraTrilhaNome: string | null }

export async function carregarTrilhasAdmin(): Promise<TrilhaListaItem[]> {
  const supabase = await criarClienteServidor()

  const { data: trilhas } = await supabase
    .from('trilhas')
    .select('id, nome, slug, descricao, ordem, principal, missoes_qtd, horas, alunos')
    .order('ordem', { ascending: true })
  if (!trilhas || trilhas.length === 0) return []

  const { data: etapas } = await supabase
    .from('etapas')
    .select('id, trilha_id')
    .in('trilha_id', trilhas.map(t => t.id))

  const etapasPorTrilha = new Map<string, number>()
  for (const e of etapas ?? []) {
    etapasPorTrilha.set(e.trilha_id, (etapasPorTrilha.get(e.trilha_id) ?? 0) + 1)
  }

  return trilhas.map(t => ({
    id: t.id, nome: t.nome, slug: t.slug, descricao: t.descricao, ordem: t.ordem,
    principal: t.principal, missoesQtd: t.missoes_qtd, horas: t.horas, alunos: t.alunos,
    totalEtapas: etapasPorTrilha.get(t.id) ?? 0,
  }))
}

export async function carregarTrilhaAdmin(id: string): Promise<TrilhaDetalheAdmin | null> {
  const supabase = await criarClienteServidor()

  const { data: trilha } = await supabase
    .from('trilhas')
    .select('id, nome, slug, descricao, ordem, principal, missoes_qtd, horas, alunos')
    .eq('id', id)
    .single()
  if (!trilha) return null

  const { data: etapasRaw } = await supabase
    .from('etapas')
    .select('id, trilha_id, nome, descricao, ordem, xp_conclusao, insignia')
    .eq('trilha_id', id)
    .order('ordem', { ascending: true })

  const etapaIds = (etapasRaw ?? []).map(e => e.id)

  const { data: missoesRaw } = etapaIds.length
    ? await supabase.from('etapa_missoes').select('etapa_id, curso_id, ordem').in('etapa_id', etapaIds).order('ordem')
    : { data: [] as any[] }

  const cursoIds = [...new Set((missoesRaw ?? []).map(m => m.curso_id))]
  const { data: cursos } = cursoIds.length
    ? await supabase.from('cursos').select('id, titulo, slug, capa_url').in('id', cursoIds)
    : { data: [] as any[] }
  const cursosMap = new Map((cursos ?? []).map(c => [c.id, c]))

  const missoesPorEtapa = new Map<string, EtapaMissaoAdmin[]>()
  for (const m of missoesRaw ?? []) {
    const curso = cursosMap.get(m.curso_id)
    if (!curso) continue
    const lista = missoesPorEtapa.get(m.etapa_id) ?? []
    lista.push({
      cursoId: m.curso_id, ordem: m.ordem,
      curso: { titulo: curso.titulo, slug: curso.slug, capaUrl: curso.capa_url },
    })
    missoesPorEtapa.set(m.etapa_id, lista)
  }

  const etapas: EtapaAdmin[] = (etapasRaw ?? []).map(e => ({
    id: e.id, trilhaId: e.trilha_id, nome: e.nome, descricao: e.descricao, ordem: e.ordem,
    xpConclusao: e.xp_conclusao, insignia: e.insignia,
    missoes: missoesPorEtapa.get(e.id) ?? [],
  }))

  return {
    trilha: {
      id: trilha.id, nome: trilha.nome, slug: trilha.slug, descricao: trilha.descricao,
      ordem: trilha.ordem, principal: trilha.principal, missoesQtd: trilha.missoes_qtd,
      horas: trilha.horas, alunos: trilha.alunos,
    },
    etapas,
  }
}

// Usada tanto pelo editor de trilhas quanto pelo editor de agenda (pra
// vincular um curso a um evento — sem noção de "trilha atual"). Só faz a
// exclusão/badge de vínculo com trilha quando `trilhaAtualId` é passado;
// sem ele, comportamento idêntico ao anterior (todos os cursos, sem filtro).
//
// Exclui cursos já vinculados a QUALQUER etapa da trilha atual (não só à
// etapa sendo editada) — evita o mesmo curso em duas etapas da mesma trilha.
// Pra quem sobra, marca se o curso já pertence a outra trilha (badge "também
// em: ...") — um curso pode estar em mais de uma trilha diferente, isso é
// permitido, só não pode duplicar dentro da mesma trilha.
export async function carregarCursosParaPicker(trilhaAtualId?: string): Promise<CursoPicker[]> {
  const supabase = await criarClienteServidor()

  if (!trilhaAtualId) {
    const { data: cursos } = await supabase.from('cursos').select('id, titulo, slug').order('titulo', { ascending: true })
    return (cursos ?? []).map(c => ({ id: c.id, titulo: c.titulo, slug: c.slug, outraTrilhaNome: null }))
  }

  const [{ data: cursos }, { data: vinculos }] = await Promise.all([
    supabase.from('cursos').select('id, titulo, slug').order('titulo', { ascending: true }),
    supabase.from('etapa_missoes').select('curso_id, etapas!inner(trilha_id, trilhas!inner(nome))'),
  ])
  if (!cursos) return []

  const vinculosPorCurso = new Map<string, { trilhaId: string; trilhaNome: string }[]>()
  for (const v of (vinculos ?? []) as any[]) {
    const trilhaId = v.etapas.trilha_id as string
    const trilhaNome = (v.etapas.trilhas?.nome as string) ?? ''
    const lista = vinculosPorCurso.get(v.curso_id) ?? []
    lista.push({ trilhaId, trilhaNome })
    vinculosPorCurso.set(v.curso_id, lista)
  }

  return cursos
    .filter(c => !(vinculosPorCurso.get(c.id) ?? []).some(v => v.trilhaId === trilhaAtualId))
    .map(c => {
      const outra = (vinculosPorCurso.get(c.id) ?? []).find(v => v.trilhaId !== trilhaAtualId)
      return { id: c.id, titulo: c.titulo, slug: c.slug, outraTrilhaNome: outra?.trilhaNome ?? null }
    })
}

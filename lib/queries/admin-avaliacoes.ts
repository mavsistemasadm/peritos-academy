// lib/queries/admin-avaliacoes.ts
// Lê as tabelas cruas (com gabarito) — só admin de conteúdo enxerga isso,
// via as policies *_admin_select criadas na migração admin_conteudo_rls.
import { criarClienteServidor } from '@/lib/supabase/server'

export type AvaliacaoListaItem = {
  id: string
  cursoId: string
  cursoTitulo: string
  moduloId: string | null
  moduloTitulo: string | null
  numeroCaso: string | null
  titulo: string
  tipo: 'avaliacao' | 'prova'
  notaMinima: number
  peso: number
  tema: number
  publicado: boolean
  capaUrl: string | null
  totalQuestoes: number
}

export type QuestaoOpcaoAdmin = { id: string; ordem: number; texto: string; correta: boolean }

export type QuestaoAdmin = {
  id: string
  avaliacaoId: string
  ordem: number
  tipo: 'multipla_escolha' | 'valor'
  enunciado: string
  parecer: string | null
  aulaId: string | null
  aulaRef: string | null
  respostaValor: number | null
  tolerancia: number
  prefixo: string | null
  sufixo: string | null
  opcoes: QuestaoOpcaoAdmin[]
}

export type AvaliacaoAdmin = {
  id: string
  cursoId: string
  moduloId: string | null
  numeroCaso: string | null
  titulo: string
  briefing: string | null
  notaMinima: number
  peso: number
  tipo: 'avaliacao' | 'prova'
  ordem: number
  tema: number
  publicado: boolean
  capaUrl: string | null
}

export type AvaliacaoDetalheAdmin = {
  avaliacao: AvaliacaoAdmin
  questoes: QuestaoAdmin[]
}

export type ModuloPicker = { id: string; titulo: string }

export async function carregarAvaliacoesAdmin(cursoId?: string): Promise<AvaliacaoListaItem[]> {
  const supabase = await criarClienteServidor()

  let query = supabase
    .from('avaliacoes')
    .select('id, curso_id, modulo_id, numero_caso, titulo, tipo, nota_minima, peso, tema, publicado, capa_url')
    .order('ordem', { ascending: true })
  if (cursoId) query = query.eq('curso_id', cursoId)

  const { data: avaliacoes } = await query
  if (!avaliacoes || avaliacoes.length === 0) return []

  const cursoIds = [...new Set(avaliacoes.map(a => a.curso_id))]
  const moduloIds = [...new Set(avaliacoes.map(a => a.modulo_id).filter(Boolean) as string[])]

  const [{ data: cursos }, { data: modulos }, { data: questoes }] = await Promise.all([
    supabase.from('cursos').select('id, titulo').in('id', cursoIds),
    moduloIds.length
      ? supabase.from('modulos').select('id, titulo').in('id', moduloIds)
      : Promise.resolve({ data: [] as any[] }),
    supabase.from('avaliacao_questoes').select('id, avaliacao_id').in('avaliacao_id', avaliacoes.map(a => a.id)),
  ])

  const cursosMap = new Map((cursos ?? []).map(c => [c.id, c.titulo]))
  const modulosMap = new Map((modulos ?? []).map(m => [m.id, m.titulo]))
  const questoesPorAvaliacao = new Map<string, number>()
  for (const q of questoes ?? []) {
    questoesPorAvaliacao.set(q.avaliacao_id, (questoesPorAvaliacao.get(q.avaliacao_id) ?? 0) + 1)
  }

  return avaliacoes.map(a => ({
    id: a.id, cursoId: a.curso_id, cursoTitulo: cursosMap.get(a.curso_id) ?? 'Curso',
    moduloId: a.modulo_id, moduloTitulo: a.modulo_id ? modulosMap.get(a.modulo_id) ?? null : null,
    numeroCaso: a.numero_caso, titulo: a.titulo, tipo: a.tipo, notaMinima: Number(a.nota_minima),
    peso: a.peso, tema: a.tema, publicado: a.publicado, capaUrl: a.capa_url,
    totalQuestoes: questoesPorAvaliacao.get(a.id) ?? 0,
  }))
}

export async function carregarAvaliacaoAdmin(id: string): Promise<AvaliacaoDetalheAdmin | null> {
  const supabase = await criarClienteServidor()

  const { data: av } = await supabase
    .from('avaliacoes')
    .select('id, curso_id, modulo_id, numero_caso, titulo, briefing, nota_minima, peso, tipo, ordem, tema, publicado, capa_url')
    .eq('id', id)
    .single()
  if (!av) return null

  const { data: questoesRaw } = await supabase
    .from('avaliacao_questoes')
    .select('*')
    .eq('avaliacao_id', id)
    .order('ordem', { ascending: true })

  const questaoIds = (questoesRaw ?? []).map(q => q.id)
  const { data: opcoesRaw } = questaoIds.length
    ? await supabase.from('avaliacao_opcoes').select('*').in('questao_id', questaoIds).order('ordem')
    : { data: [] as any[] }

  const opcoesPorQuestao = new Map<string, QuestaoOpcaoAdmin[]>()
  for (const o of opcoesRaw ?? []) {
    const lista = opcoesPorQuestao.get(o.questao_id) ?? []
    lista.push({ id: o.id, ordem: o.ordem, texto: o.texto, correta: o.correta })
    opcoesPorQuestao.set(o.questao_id, lista)
  }

  const questoes: QuestaoAdmin[] = (questoesRaw ?? []).map(q => ({
    id: q.id, avaliacaoId: q.avaliacao_id, ordem: q.ordem, tipo: q.tipo, enunciado: q.enunciado,
    parecer: q.parecer, aulaId: q.aula_id, aulaRef: q.aula_ref,
    respostaValor: q.resposta_valor === null ? null : Number(q.resposta_valor),
    tolerancia: Number(q.tolerancia), prefixo: q.prefixo, sufixo: q.sufixo,
    opcoes: opcoesPorQuestao.get(q.id) ?? [],
  }))

  return {
    avaliacao: {
      id: av.id, cursoId: av.curso_id, moduloId: av.modulo_id, numeroCaso: av.numero_caso,
      titulo: av.titulo, briefing: av.briefing, notaMinima: Number(av.nota_minima), peso: av.peso,
      tipo: av.tipo, ordem: av.ordem, tema: av.tema, publicado: av.publicado, capaUrl: av.capa_url,
    },
    questoes,
  }
}

export async function carregarModulosDoCurso(cursoId: string): Promise<ModuloPicker[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('modulos')
    .select('id, titulo')
    .eq('curso_id', cursoId)
    .order('ordem', { ascending: true })
  return data ?? []
}

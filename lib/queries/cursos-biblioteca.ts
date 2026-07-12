// lib/queries/cursos-biblioteca.ts
// Biblioteca de cursos: todos os cursos organizados por trilha e etapa.
import { criarClienteServidor } from '@/lib/supabase/server'

export type CursoBiblioteca = {
  id: string
  slug: string
  titulo: string
  subtitulo: string | null
  capa_url: string | null
  nivel: string | null
  duracao_seg: number
  instrutor_nome: string | null
  progresso: number | null       // 0-100 pra aluno logado
  trilha_nome: string
  trilha_slug: string
  etapa_nome: string
}

export type EtapaAgrupada = {
  nome: string
  descricao: string | null
  insignia: string | null
  cursos: CursoBiblioteca[]
}

export type TrilhaAgrupada = {
  nome: string
  slug: string
  descricao: string | null
  etapas: EtapaAgrupada[]
}

export type DadosBibliotecaCursos = {
  trilhas: TrilhaAgrupada[]
  totalCursos: number
}

export async function carregarBibliotecaCursos(): Promise<DadosBibliotecaCursos> {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth?.user?.id ?? null

  // busca todos os cursos publicados com suas trilhas
  const { data: relacoes } = await supabase
    .from('curso_trilha')
    .select('curso_id, trilha_nome, trilha_slug, etapa_nome')

  const cursoIds = [...new Set((relacoes ?? []).map(r => r.curso_id))]

  const { data: cursosRaw } = await supabase
    .from('cursos')
    .select('id, slug, titulo, subtitulo, capa_url, nivel, duracao_seg, instrutor_nome')
    .eq('publicado', true)
    .in('id', cursoIds.length > 0 ? cursoIds : ['none'])

  const cursosMap = new Map((cursosRaw ?? []).map(c => [c.id, c]))

  // progresso do aluno (se logado)
  let progressoMap = new Map<string, number>()
  if (uid) {
    const { data: certs } = await supabase
      .from('certificados')
      .select('curso_id, progresso_pct')
      .eq('usuario_id', uid)

    for (const c of certs ?? []) {
      if (c.curso_id) progressoMap.set(c.curso_id, c.progresso_pct ?? 0)
    }

    // também busca aulas assistidas pra calcular progresso
    const { data: aulasTotal } = await supabase
      .from('aulas')
      .select('id, modulo_id, modulos!inner(curso_id)')

    const { data: aulasAssistidas } = await supabase
      .from('aula_concluida')
      .select('aula_id')
      .eq('usuario_id', uid)

    if (aulasTotal && aulasAssistidas) {
      const assistidasSet = new Set(aulasAssistidas.map(a => a.aula_id))
      const cursoAulas = new Map<string, { total: number; feitas: number }>()

      for (const aula of aulasTotal) {
        const cursoId = (aula as any).modulos?.curso_id
        if (!cursoId) continue
        const entry = cursoAulas.get(cursoId) ?? { total: 0, feitas: 0 }
        entry.total++
        if (assistidasSet.has(aula.id)) entry.feitas++
        cursoAulas.set(cursoId, entry)
      }

      for (const [cursoId, { total, feitas }] of cursoAulas) {
        if (!progressoMap.has(cursoId) && total > 0) {
          progressoMap.set(cursoId, Math.round((feitas / total) * 100))
        }
      }
    }
  }

  // agrupa por trilha > etapa
  const trilhasMap = new Map<string, TrilhaAgrupada>()
  const etapasOrdem = ['Fundamentos', 'Domínio técnico', 'Atuação prática', 'Autoridade']

  for (const rel of relacoes ?? []) {
    const curso = cursosMap.get(rel.curso_id)
    if (!curso) continue

    let trilha = trilhasMap.get(rel.trilha_slug)
    if (!trilha) {
trilha = { nome: rel.trilha_nome, slug: rel.trilha_slug, descricao: null, etapas: [] }
      trilhasMap.set(rel.trilha_slug, trilha)
    }

    let etapa = trilha.etapas.find(e => e.nome === rel.etapa_nome)
    if (!etapa) {
    etapa = { nome: rel.etapa_nome, descricao: null, insignia: null, cursos: [] }      
    trilha.etapas.push(etapa)
    }

    etapa.cursos.push({
      id: curso.id,
      slug: curso.slug,
      titulo: curso.titulo,
      subtitulo: curso.subtitulo,
      capa_url: curso.capa_url,
      nivel: curso.nivel,
      duracao_seg: curso.duracao_seg ?? 0,
      instrutor_nome: curso.instrutor_nome,
      progresso: progressoMap.get(curso.id) ?? null,
      trilha_nome: rel.trilha_nome,
      trilha_slug: rel.trilha_slug,
      etapa_nome: rel.etapa_nome,
    })
  }

  // busca descrições das etapas
  const { data: etapasInfo } = await supabase
    .from('etapas')
    .select('nome, descricao, insignia')
  for (const trilha of trilhasMap.values()) {
    for (const etapa of trilha.etapas) {
      const ei = (etapasInfo ?? []).find(e => e.nome === etapa.nome)
      if (ei) {
        etapa.descricao = ei.descricao
        etapa.insignia = ei.insignia
      }
    }
  }

// busca descrições das trilhas
  const { data: trilhasInfo } = await supabase
    .from('trilhas')
    .select('slug, descricao')
  for (const ti of trilhasInfo ?? []) {
    const trilha = trilhasMap.get(ti.slug)
    if (trilha) trilha.descricao = ti.descricao
  }

  // ordena etapas
  for (const trilha of trilhasMap.values()) {
    trilha.etapas.sort((a, b) => {
      const ia = etapasOrdem.indexOf(a.nome)
      const ib = etapasOrdem.indexOf(b.nome)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
  }

  const trilhas = Array.from(trilhasMap.values())
  const totalCursos = (cursosRaw ?? []).length

  return { trilhas, totalCursos }
}
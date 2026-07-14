// lib/queries/admin-cursos.ts
import { criarClienteServidor } from '@/lib/supabase/server'

export type CursoListaItem = {
  id: string
  slug: string
  titulo: string
  subtitulo: string | null
  capaUrl: string | null
  nivel: string | null
  publicado: boolean
  atualizadoEm: string
  totalModulos: number
  totalAulas: number
}

export type CapituloAdmin = { id: string; titulo: string; tempoSeg: number; ordem: number }
export type MaterialAdmin = {
  id: string
  nome: string
  descricao: string | null
  tipo: 'pdf' | 'xlsx' | 'docx' | 'zip' | 'outro'
  arquivoUrl: string | null
  tamanhoBytes: number | null
  ordem: number
}

export type AulaAdmin = {
  id: string
  moduloId: string
  titulo: string
  descricao: string | null
  videoUrl: string | null
  duracaoSeg: number
  ordem: number
  xp: number
  tipo: string
  capaUrl: string | null
  sobre: string[]
  capitulos: CapituloAdmin[]
  materiais: MaterialAdmin[]
}

export type ModuloAdmin = {
  id: string
  cursoId: string
  titulo: string
  ordem: number
  aulas: AulaAdmin[]
}

export type CursoAdmin = {
  id: string
  slug: string
  titulo: string
  subtitulo: string | null
  capaUrl: string | null
  nivel: string | null
  duracaoSeg: number
  publicado: boolean
  instrutorNome: string | null
  instrutorTitulo: string | null
  instrutorIniciais: string | null
  citacao: string | null
  objetivos: string[]
  emiteCertificado: boolean
  contextoCertificado: string | null
  cargaHoras: number | null
  atualizadoEm: string
}

export type CursoDetalheAdmin = {
  curso: CursoAdmin
  modulos: ModuloAdmin[]
}

export async function carregarCursosAdmin(): Promise<CursoListaItem[]> {
  const supabase = await criarClienteServidor()

  const { data: cursos } = await supabase
    .from('cursos')
    .select('id, slug, titulo, subtitulo, capa_url, nivel, publicado, atualizado_em')
    .order('atualizado_em', { ascending: false })
  if (!cursos || cursos.length === 0) return []

  const cursoIds = cursos.map(c => c.id)
  const { data: modulos } = await supabase
    .from('modulos')
    .select('id, curso_id')
    .in('curso_id', cursoIds)

  const moduloIds = (modulos ?? []).map(m => m.id)
  const { data: aulas } = moduloIds.length
    ? await supabase.from('aulas').select('id, modulo_id').in('modulo_id', moduloIds)
    : { data: [] as { id: string; modulo_id: string }[] }

  const modulosPorCurso = new Map<string, number>()
  const moduloParaCurso = new Map<string, string>()
  for (const m of modulos ?? []) {
    modulosPorCurso.set(m.curso_id, (modulosPorCurso.get(m.curso_id) ?? 0) + 1)
    moduloParaCurso.set(m.id, m.curso_id)
  }
  const aulasPorCurso = new Map<string, number>()
  for (const a of aulas ?? []) {
    const cursoId = moduloParaCurso.get(a.modulo_id)
    if (!cursoId) continue
    aulasPorCurso.set(cursoId, (aulasPorCurso.get(cursoId) ?? 0) + 1)
  }

  return cursos.map(c => ({
    id: c.id,
    slug: c.slug,
    titulo: c.titulo,
    subtitulo: c.subtitulo,
    capaUrl: c.capa_url,
    nivel: c.nivel,
    publicado: c.publicado,
    atualizadoEm: c.atualizado_em,
    totalModulos: modulosPorCurso.get(c.id) ?? 0,
    totalAulas: aulasPorCurso.get(c.id) ?? 0,
  }))
}

export async function carregarCursoAdmin(id: string): Promise<CursoDetalheAdmin | null> {
  const supabase = await criarClienteServidor()

  const { data: curso } = await supabase.from('cursos').select('*').eq('id', id).single()
  if (!curso) return null

  const { data: modulosRaw } = await supabase
    .from('modulos')
    .select('id, curso_id, titulo, ordem')
    .eq('curso_id', id)
    .order('ordem', { ascending: true })

  const moduloIds = (modulosRaw ?? []).map(m => m.id)

  const { data: aulasRaw } = moduloIds.length
    ? await supabase
        .from('aulas')
        .select('id, modulo_id, titulo, descricao, video_url, duracao_seg, ordem, xp, tipo, capa_url, sobre')
        .in('modulo_id', moduloIds)
        .order('ordem', { ascending: true })
    : { data: [] as any[] }

  const aulaIds = (aulasRaw ?? []).map(a => a.id)

  const [{ data: capitulosRaw }, { data: materiaisRaw }] = aulaIds.length
    ? await Promise.all([
        supabase.from('aula_capitulos').select('*').in('aula_id', aulaIds).order('ordem'),
        supabase.from('aula_materiais').select('*').in('aula_id', aulaIds).order('ordem'),
      ])
    : [{ data: [] as any[] }, { data: [] as any[] }]

  const capitulosPorAula = new Map<string, CapituloAdmin[]>()
  for (const c of capitulosRaw ?? []) {
    const lista = capitulosPorAula.get(c.aula_id) ?? []
    lista.push({ id: c.id, titulo: c.titulo, tempoSeg: c.tempo_seg, ordem: c.ordem })
    capitulosPorAula.set(c.aula_id, lista)
  }
  const materiaisPorAula = new Map<string, MaterialAdmin[]>()
  for (const m of materiaisRaw ?? []) {
    const lista = materiaisPorAula.get(m.aula_id) ?? []
    lista.push({
      id: m.id, nome: m.nome, descricao: m.descricao, tipo: m.tipo,
      arquivoUrl: m.arquivo_url, tamanhoBytes: m.tamanho_bytes, ordem: m.ordem,
    })
    materiaisPorAula.set(m.aula_id, lista)
  }

  const aulasPorModulo = new Map<string, AulaAdmin[]>()
  for (const a of aulasRaw ?? []) {
    const lista = aulasPorModulo.get(a.modulo_id) ?? []
    lista.push({
      id: a.id, moduloId: a.modulo_id, titulo: a.titulo, descricao: a.descricao,
      videoUrl: a.video_url, duracaoSeg: a.duracao_seg, ordem: a.ordem, xp: a.xp,
      tipo: a.tipo, capaUrl: a.capa_url,
      sobre: Array.isArray(a.sobre) ? a.sobre : [],
      capitulos: capitulosPorAula.get(a.id) ?? [],
      materiais: materiaisPorAula.get(a.id) ?? [],
    })
    aulasPorModulo.set(a.modulo_id, lista)
  }

  const modulos: ModuloAdmin[] = (modulosRaw ?? []).map(m => ({
    id: m.id, cursoId: m.curso_id, titulo: m.titulo, ordem: m.ordem,
    aulas: aulasPorModulo.get(m.id) ?? [],
  }))

  return {
    curso: {
      id: curso.id, slug: curso.slug, titulo: curso.titulo, subtitulo: curso.subtitulo,
      capaUrl: curso.capa_url, nivel: curso.nivel, duracaoSeg: curso.duracao_seg,
      publicado: curso.publicado, instrutorNome: curso.instrutor_nome,
      instrutorTitulo: curso.instrutor_titulo, instrutorIniciais: curso.instrutor_iniciais,
      citacao: curso.citacao, objetivos: Array.isArray(curso.objetivos) ? curso.objetivos : [],
      emiteCertificado: curso.emite_certificado, contextoCertificado: curso.contexto_certificado,
      cargaHoras: curso.carga_horas,
      atualizadoEm: curso.atualizado_em,
    },
    modulos,
  }
}

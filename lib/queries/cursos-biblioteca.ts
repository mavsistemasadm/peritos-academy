// lib/queries/cursos-biblioteca.ts
// Vitrine editorial de cursos: hero em destaque, continuação de progresso e seções por trilha.
import { criarClienteServidor } from '@/lib/supabase/server'

export type CursoCard = {
  id: string
  slug: string
  titulo: string
  subtitulo: string | null
  capa_url: string | null // resolvido pra capa_horizontal_url, fallback capa_url
  nivel: string | null
  aulasCount: number
  duracaoSeg: number
  progresso: number | null // 0-100 pra aluno logado, null se nunca começou
}

export type TrilhaSecao = {
  nome: string
  slug: string
  descricao: string | null
  cursos: CursoCard[]
}

export type DadosBibliotecaCursos = {
  hero: CursoCard | null
  continuar: CursoCard[]
  trilhas: TrilhaSecao[]
  totalCursos: number
}

export async function carregarBibliotecaCursos(): Promise<DadosBibliotecaCursos> {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth?.user?.id ?? null

  const [
    { data: relacoes },
    { data: cursosRaw },
    { data: trilhasInfo },
    { data: modulosRaw },
  ] = await Promise.all([
    supabase.from('curso_trilha').select('curso_id, trilha_nome, trilha_slug, etapa_nome, ordem'),
    supabase.from('cursos').select('id, slug, titulo, subtitulo, capa_url, capa_horizontal_url, nivel, publicado, destaque'),
    supabase.from('trilhas').select('nome, slug, descricao, ordem').order('ordem', { ascending: true }),
    supabase.from('modulos').select('id, curso_id'),
  ])

  const cursosPublicados = (cursosRaw ?? []).filter(c => c.publicado)
  const cursosMap = new Map(cursosPublicados.map(c => [c.id, c]))

  // aulas: conta + soma de duração por curso (via módulo -> curso)
  const cursoIdPorModulo = new Map((modulosRaw ?? []).map(m => [m.id, m.curso_id]))
  const { data: aulasRaw } = await supabase.from('aulas').select('id, modulo_id, duracao_seg')
  const aulasPorCurso = new Map<string, { count: number; duracaoSeg: number }>()
  for (const a of aulasRaw ?? []) {
    const cursoId = cursoIdPorModulo.get(a.modulo_id)
    if (!cursoId || !cursosMap.has(cursoId)) continue
    const entry = aulasPorCurso.get(cursoId) ?? { count: 0, duracaoSeg: 0 }
    entry.count++
    entry.duracaoSeg += a.duracao_seg ?? 0
    aulasPorCurso.set(cursoId, entry)
  }

  // progresso do aluno: só de aula_progresso (nunca certificados.progresso_pct, que é dado de seed de demo)
  const progressoMap = new Map<string, number>()
  const ultimoAcessoMap = new Map<string, string>()
  if (uid) {
    const { data: aulasAssistidas } = await supabase
      .from('aula_progresso')
      .select('aula_id, concluida_em')
      .eq('usuario_id', uid)
      .eq('concluida', true)

    if (aulasAssistidas && aulasAssistidas.length > 0) {
      const aulaParaCurso = new Map<string, string>()
      for (const a of aulasRaw ?? []) {
        const cursoId = cursoIdPorModulo.get(a.modulo_id)
        if (cursoId) aulaParaCurso.set(a.id, cursoId)
      }

      const cursoAulasFeitas = new Map<string, { feitas: number; ultimo: string | null }>()
      for (const ap of aulasAssistidas) {
        const cursoId = aulaParaCurso.get(ap.aula_id)
        if (!cursoId) continue
        const entry = cursoAulasFeitas.get(cursoId) ?? { feitas: 0, ultimo: null }
        entry.feitas++
        if (ap.concluida_em && (!entry.ultimo || ap.concluida_em > entry.ultimo)) entry.ultimo = ap.concluida_em
        cursoAulasFeitas.set(cursoId, entry)
      }

      for (const [cursoId, { feitas, ultimo }] of cursoAulasFeitas) {
        const total = aulasPorCurso.get(cursoId)?.count ?? 0
        if (total > 0) progressoMap.set(cursoId, Math.round((feitas / total) * 100))
        if (ultimo) ultimoAcessoMap.set(cursoId, ultimo)
      }
    }
  }

  function montaCard(curso: NonNullable<typeof cursosRaw>[number]): CursoCard {
    const aulasInfo = aulasPorCurso.get(curso.id) ?? { count: 0, duracaoSeg: 0 }
    return {
      id: curso.id,
      slug: curso.slug,
      titulo: curso.titulo,
      subtitulo: curso.subtitulo,
      capa_url: curso.capa_horizontal_url ?? curso.capa_url,
      nivel: curso.nivel,
      aulasCount: aulasInfo.count,
      duracaoSeg: aulasInfo.duracaoSeg,
      progresso: progressoMap.get(curso.id) ?? null,
    }
  }

  // hero: único curso com destaque=true
  const cursoDestaque = cursosPublicados.find(c => c.destaque)
  const hero = cursoDestaque ? montaCard(cursoDestaque) : null

  // continuar de onde parou: progresso entre 1% e 99%, mais recente primeiro, máx 6
  const continuar = cursosPublicados
    .filter(c => {
      const pct = progressoMap.get(c.id)
      return pct != null && pct > 0 && pct < 100
    })
    .map(c => ({ card: montaCard(c), ultimo: ultimoAcessoMap.get(c.id) ?? '' }))
    .sort((a, b) => (b.ultimo > a.ultimo ? 1 : b.ultimo < a.ultimo ? -1 : 0))
    .slice(0, 6)
    .map(x => x.card)

  // agrupa por trilha (seção flat, sem subdivisão por etapa)
  const trilhasMap = new Map<string, { nome: string; slug: string; descricao: string | null; cursos: { card: CursoCard; ordem: number }[] }>()
  for (const rel of relacoes ?? []) {
    const curso = cursosMap.get(rel.curso_id)
    if (!curso) continue

    let trilha = trilhasMap.get(rel.trilha_slug)
    if (!trilha) {
      trilha = { nome: rel.trilha_nome, slug: rel.trilha_slug, descricao: null, cursos: [] }
      trilhasMap.set(rel.trilha_slug, trilha)
    }
    trilha.cursos.push({ card: montaCard(curso), ordem: rel.ordem ?? 0 })
  }

  for (const ti of trilhasInfo ?? []) {
    const trilha = trilhasMap.get(ti.slug)
    if (trilha) trilha.descricao = ti.descricao
  }

  // ordena trilhas pela ordem cadastrada (trilhas.ordem), empate por nome;
  // dentro de cada trilha, ordena cursos por curso_trilha.ordem (editorial), empate por título
  const ordemPorSlug = new Map((trilhasInfo ?? []).map(t => [t.slug, t.ordem ?? 0]))
  const trilhas: TrilhaSecao[] = Array.from(trilhasMap.values())
    .sort((a, b) => {
      const oa = ordemPorSlug.get(a.slug) ?? 0
      const ob = ordemPorSlug.get(b.slug) ?? 0
      if (oa !== ob) return oa - ob
      return a.nome.localeCompare(b.nome, 'pt-BR')
    })
    .map(t => ({
      nome: t.nome,
      slug: t.slug,
      descricao: t.descricao,
      cursos: t.cursos
        .sort((a, b) => {
          if (a.ordem !== b.ordem) return a.ordem - b.ordem
          return a.card.titulo.localeCompare(b.card.titulo, 'pt-BR')
        })
        .map(x => x.card),
    }))

  return { hero, continuar, trilhas, totalCursos: cursosPublicados.length }
}

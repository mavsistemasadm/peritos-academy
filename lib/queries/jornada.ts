// lib/queries/jornada.ts
// Trilha principal, territórios de especialização e progresso real do
// usuário — 100% plugado no banco (trilhas/etapas/etapa_missoes cadastradas
// pelo admin), sem seed/mock. Nenhuma trilha é travada: "estado" é só
// narrativo (feita/atual/pendente), nunca bloqueia acesso.
import { criarClienteServidor } from '@/lib/supabase/server'

export type Marco = {
  id: string
  ordem: number
  nome: string
  estado: 'feita' | 'atual' | 'pendente'
}

// Card "missão" (formação em curso) ou "protagonista" (território em curso) —
// mesma anatomia nos dois casos, só muda o conteúdo.
export type PainelTrilha = {
  id: string
  nome: string
  slug: string | null
  descricao: string | null
  tag: string
  marcos: Marco[]
  marcosFeitos: number
  marcosTotal: number
  progressoPct: number
  proximoRotulo: string          // "Próximo curso" | "Próxima aula"
  proximoTexto: string | null
  continuarHref: string | null
  marcoFinalRotulo: string       // "Selo de Excelência" | "insígnia {nome}"
}

export type Territorio = {
  id: string
  nome: string
  slug: string | null
  descricao: string | null
  totalCursos: number
  horas: number
  cursosConcluidos: number
  progressoPct: number
  estado: 'em-curso' | 'aberta' | 'concluida'
  ultimaAtividadeEm: string | null
  proximoCursoNome: string | null   // próximo curso não concluído deste território (pra régua de recomendação da home)
  proximoHref: string | null
}

export type DadosJornada = {
  logado: boolean
  seloConquistado: boolean
  seloConquistadoEm: string | null
  trilhaPrincipalNome: string | null
  trilhaPrincipalSlug: string | null
  marcosTrilhaPrincipal: Marco[]   // etapas da formação sempre (mesmo já concluída) — pra seção "5 etapas" da home
  painelFormacao: PainelTrilha | null   // null quando a formação já foi concluída
  painelProtagonista: PainelTrilha | null // território de atividade mais recente pós-formação
  tambemEmAndamento: Territorio[]        // até 3, exclui o protagonista
  territorios: Territorio[]              // grade completa (todas as não-principais)
  aulasConcluidas: number
}

type CursoInfo = {
  id: string
  titulo: string
  slug: string
  totalAulas: number
  aulaIdsOrdenadas: string[]
  totalAvaliacoes: number
  duracaoSeg: number
}

const TZ = 'America/Sao_Paulo'
const fmtDataLonga = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: '2-digit', month: 'long', year: 'numeric' })

export async function carregarJornada(): Promise<DadosJornada> {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth?.user?.id ?? null

  const [{ data: trilhasRaw }, { data: etapasRaw }] = await Promise.all([
    supabase.from('trilhas').select('id, nome, slug, descricao, ordem, principal').order('ordem', { ascending: true }),
    supabase.from('etapas').select('id, trilha_id, nome, descricao, ordem, insignia').order('ordem', { ascending: true }),
  ])
  const trilhas = trilhasRaw ?? []
  const etapas = etapasRaw ?? []
  const etapaIds = etapas.map(e => e.id)

  const { data: missoesRaw } = etapaIds.length
    ? await supabase.from('etapa_missoes').select('etapa_id, curso_id, ordem').in('etapa_id', etapaIds).order('ordem', { ascending: true })
    : { data: [] as any[] }
  const missoes = missoesRaw ?? []
  const cursoIds = [...new Set(missoes.map(m => m.curso_id))]

  const [{ data: cursosRaw }, { data: modulosRaw }] = await Promise.all([
    cursoIds.length ? supabase.from('cursos').select('id, titulo, slug, capa_url').in('id', cursoIds) : Promise.resolve({ data: [] as any[] }),
    cursoIds.length ? supabase.from('modulos').select('id, curso_id, ordem').in('curso_id', cursoIds).order('ordem', { ascending: true }) : Promise.resolve({ data: [] as any[] }),
  ])
  const cursosRawList = cursosRaw ?? []
  const modulos = modulosRaw ?? []
  const moduloIds = modulos.map(m => m.id)

  const [{ data: aulasRaw }, { data: avaliacoesRaw }] = await Promise.all([
    moduloIds.length ? supabase.from('aulas').select('id, modulo_id, ordem, titulo, duracao_seg').in('modulo_id', moduloIds).order('ordem', { ascending: true }) : Promise.resolve({ data: [] as any[] }),
    cursoIds.length ? supabase.from('avaliacoes').select('id, curso_id').in('curso_id', cursoIds) : Promise.resolve({ data: [] as any[] }),
  ])
  const aulas = aulasRaw ?? []
  const avaliacoes = avaliacoesRaw ?? []

  let concluidas = new Set<string>()
  let concluidaEmPorAula = new Map<string, string>()
  let aprovadas = new Set<string>()
  let aprovadaEmPorAvaliacao = new Map<string, string>()
  let seloExcelenciaEm: string | null = null
  let aulasConcluidas = 0

  if (uid) {
    const [{ data: progresso }, { data: tentativas }, { data: perfil }, { count }] = await Promise.all([
      supabase.from('aula_progresso').select('aula_id, concluida, concluida_em').eq('usuario_id', uid).eq('concluida', true),
      supabase.from('avaliacao_tentativas').select('avaliacao_id, aprovado, criada_em').eq('usuario_id', uid).eq('aprovado', true),
      supabase.from('perfis').select('selo_excelencia_em').eq('id', uid).maybeSingle(),
      supabase.from('aula_progresso').select('aula_id', { count: 'exact', head: true }).eq('usuario_id', uid).eq('concluida', true),
    ])
    for (const p of progresso ?? []) {
      concluidas.add(p.aula_id)
      if (p.concluida_em) concluidaEmPorAula.set(p.aula_id, p.concluida_em)
    }
    for (const t of tentativas ?? []) {
      aprovadas.add(t.avaliacao_id)
      if (t.criada_em) aprovadaEmPorAvaliacao.set(t.avaliacao_id, t.criada_em)
    }
    seloExcelenciaEm = perfil?.selo_excelencia_em ?? null
    aulasConcluidas = count ?? 0
  }

  // ---------- monta CursoInfo por curso ----------
  const modulosPorCurso = new Map<string, string[]>() // curso_id -> [modulo_id] (ordenados)
  for (const m of modulos) {
    if (!modulosPorCurso.has(m.curso_id)) modulosPorCurso.set(m.curso_id, [])
    modulosPorCurso.get(m.curso_id)!.push(m.id)
  }
  const aulasPorModulo = new Map<string, { id: string; duracao_seg: number }[]>()
  const aulaTituloPorId = new Map<string, string>()
  for (const a of aulas) {
    if (!aulasPorModulo.has(a.modulo_id)) aulasPorModulo.set(a.modulo_id, [])
    aulasPorModulo.get(a.modulo_id)!.push({ id: a.id, duracao_seg: a.duracao_seg ?? 0 })
    aulaTituloPorId.set(a.id, a.titulo)
  }
  const avaliacoesPorCurso = new Map<string, string[]>()
  for (const av of avaliacoes) {
    if (!avaliacoesPorCurso.has(av.curso_id)) avaliacoesPorCurso.set(av.curso_id, [])
    avaliacoesPorCurso.get(av.curso_id)!.push(av.id)
  }

  const cursoInfoPorId = new Map<string, CursoInfo>()
  for (const c of cursosRawList) {
    const moduloIdsDoCurso = modulosPorCurso.get(c.id) ?? []
    const aulaIdsOrdenadas: string[] = []
    let duracaoSeg = 0
    for (const mid of moduloIdsDoCurso) {
      for (const a of aulasPorModulo.get(mid) ?? []) {
        aulaIdsOrdenadas.push(a.id)
        duracaoSeg += a.duracao_seg
      }
    }
    cursoInfoPorId.set(c.id, {
      id: c.id, titulo: c.titulo, slug: c.slug,
      totalAulas: aulaIdsOrdenadas.length, aulaIdsOrdenadas,
      totalAvaliacoes: (avaliacoesPorCurso.get(c.id) ?? []).length,
      duracaoSeg,
    })
  }

  function cursoCompleto(cursoId: string): boolean {
    const info = cursoInfoPorId.get(cursoId)
    if (!info || info.totalAulas === 0) return false
    const feitas = info.aulaIdsOrdenadas.filter(id => concluidas.has(id)).length
    if (feitas < info.totalAulas) return false
    const avals = avaliacoesPorCurso.get(cursoId) ?? []
    return avals.every(id => aprovadas.has(id))
  }
  function primeiraAulaPendente(cursoId: string): string | null {
    const info = cursoInfoPorId.get(cursoId)
    if (!info) return null
    return info.aulaIdsOrdenadas.find(id => !concluidas.has(id)) ?? null
  }
  function cursoUltimaAtividade(cursoId: string): string | null {
    const info = cursoInfoPorId.get(cursoId)
    if (!info) return null
    let max: string | null = null
    for (const id of info.aulaIdsOrdenadas) {
      const em = concluidaEmPorAula.get(id)
      if (em && (!max || em > max)) max = em
    }
    for (const id of avaliacoesPorCurso.get(cursoId) ?? []) {
      const em = aprovadaEmPorAvaliacao.get(id)
      if (em && (!max || em > max)) max = em
    }
    return max
  }

  // ---------- missões por etapa (ordenadas) ----------
  const missoesPorEtapa = new Map<string, string[]>() // etapa_id -> [curso_id] ordenados
  for (const m of missoes) {
    if (!missoesPorEtapa.has(m.etapa_id)) missoesPorEtapa.set(m.etapa_id, [])
    missoesPorEtapa.get(m.etapa_id)!.push(m.curso_id)
  }
  function etapaCompleta(etapaId: string): boolean {
    const cids = missoesPorEtapa.get(etapaId) ?? []
    return cids.length > 0 && cids.every(cursoCompleto)
  }

  // ---------- etapas por trilha ----------
  const etapasPorTrilha = new Map<string, typeof etapas>()
  for (const e of etapas) {
    if (!etapasPorTrilha.has(e.trilha_id)) etapasPorTrilha.set(e.trilha_id, [])
    etapasPorTrilha.get(e.trilha_id)!.push(e)
  }

  function marcosDeEtapas(trilhaId: string): Marco[] {
    const es = etapasPorTrilha.get(trilhaId) ?? []
    let atualAchado = false
    return es.map(e => {
      const feita = etapaCompleta(e.id)
      let estado: Marco['estado'] = 'pendente'
      if (feita) estado = 'feita'
      else if (!atualAchado) { estado = 'atual'; atualAchado = true }
      return { id: e.id, ordem: e.ordem, nome: e.nome, estado }
    })
  }
  // pra trilha com 1 etapa só (território): bolas = cursos daquela etapa
  function marcosDeCursos(trilhaId: string): Marco[] {
    const es = etapasPorTrilha.get(trilhaId) ?? []
    const cids = es.flatMap(e => missoesPorEtapa.get(e.id) ?? [])
    let atualAchado = false
    return cids.map((cid, i) => {
      const info = cursoInfoPorId.get(cid)
      const feita = cursoCompleto(cid)
      let estado: Marco['estado'] = 'pendente'
      if (feita) estado = 'feita'
      else if (!atualAchado) { estado = 'atual'; atualAchado = true }
      return { id: cid, ordem: i, nome: info?.titulo ?? '', estado }
    })
  }

  function trilhaTemConteudo(trilhaId: string): boolean {
    const es = etapasPorTrilha.get(trilhaId) ?? []
    return es.some(e => (missoesPorEtapa.get(e.id) ?? []).length > 0)
  }
  // mesma régua do lado do banco (trilha_completa): só conta "completa" se
  // TODA etapa já tem pelo menos 1 curso vinculado — evita fechar a trilha
  // ignorando uma etapa que ainda está vazia por estar em cadastro.
  function trilhaTotalmentePreenchida(trilhaId: string): boolean {
    const es = etapasPorTrilha.get(trilhaId) ?? []
    return es.length > 0 && es.every(e => (missoesPorEtapa.get(e.id) ?? []).length > 0)
  }
  function trilhaCursosUnicos(trilhaId: string): string[] {
    const es = etapasPorTrilha.get(trilhaId) ?? []
    return [...new Set(es.flatMap(e => missoesPorEtapa.get(e.id) ?? []))]
  }
  function trilhaHoras(trilhaId: string): number {
    const cids = trilhaCursosUnicos(trilhaId)
    const seg = cids.reduce((s, cid) => s + (cursoInfoPorId.get(cid)?.duracaoSeg ?? 0), 0)
    return Math.round(seg / 3600)
  }
  function trilhaUltimaAtividade(trilhaId: string): string | null {
    const cids = trilhaCursosUnicos(trilhaId)
    let max: string | null = null
    for (const cid of cids) {
      const em = cursoUltimaAtividade(cid)
      if (em && (!max || em > max)) max = em
    }
    return max
  }

  // ---------- próximo curso/aula dentro de uma trilha (pra CTA) ----------
  function proximoDaTrilha(trilhaId: string): { cursoNome: string | null; aulaNome: string | null; aulaPosicao: number | null; href: string | null } {
    const es = (etapasPorTrilha.get(trilhaId) ?? []).slice().sort((a, b) => a.ordem - b.ordem)
    for (const e of es) {
      const cids = missoesPorEtapa.get(e.id) ?? []
      for (const cid of cids) {
        if (cursoCompleto(cid)) continue
        const info = cursoInfoPorId.get(cid)
        if (!info) continue
        const aulaId = primeiraAulaPendente(cid)
        if (aulaId) {
          const posicao = info.aulaIdsOrdenadas.indexOf(aulaId) + 1
          return {
            cursoNome: info.titulo, aulaNome: aulaTituloPorId.get(aulaId) ?? null, aulaPosicao: posicao,
            href: `/curso/${info.slug}/aula/${aulaId}`,
          }
        }
        return { cursoNome: info.titulo, aulaNome: null, aulaPosicao: null, href: `/curso/${info.slug}` }
      }
    }
    return { cursoNome: null, aulaNome: null, aulaPosicao: null, href: null }
  }

  function montaPainel(trilhaId: string, nome: string, slug: string | null, descricao: string | null, tag: string, marcoFinalRotulo: string, usaEtapasComoMarcos: boolean): PainelTrilha {
    const marcos = usaEtapasComoMarcos ? marcosDeEtapas(trilhaId) : marcosDeCursos(trilhaId)
    const feitos = marcos.filter(m => m.estado === 'feita').length
    const prox = proximoDaTrilha(trilhaId)
    const proximoRotulo = usaEtapasComoMarcos ? 'Próximo curso' : 'Próxima aula'
    const proximoTexto = usaEtapasComoMarcos
      ? prox.cursoNome
      : (prox.aulaNome ? `${prox.aulaNome} · Aula ${prox.aulaPosicao}` : prox.cursoNome)
    return {
      id: trilhaId, nome, slug, descricao, tag,
      marcos, marcosFeitos: feitos, marcosTotal: marcos.length,
      progressoPct: marcos.length ? Math.round((feitos / marcos.length) * 100) : 0,
      proximoRotulo, proximoTexto,
      continuarHref: prox.href,
      marcoFinalRotulo,
    }
  }

  // ---------- trilha principal ----------
  const trilhaPrincipalRow = trilhas.find(t => t.principal) ?? null
  const principalTemConteudo = trilhaPrincipalRow ? trilhaTemConteudo(trilhaPrincipalRow.id) : false
  const principalCompleta = trilhaPrincipalRow && trilhaTotalmentePreenchida(trilhaPrincipalRow.id)
    ? trilhaCursosUnicos(trilhaPrincipalRow.id).every(cursoCompleto)
    : false
  const seloConquistado = !!seloExcelenciaEm || principalCompleta

  const painelFormacao = (trilhaPrincipalRow && principalTemConteudo && !seloConquistado)
    ? montaPainel(trilhaPrincipalRow.id, trilhaPrincipalRow.nome ?? 'Formação Pericial de Alta Performance', trilhaPrincipalRow.slug, trilhaPrincipalRow.descricao, 'Trilha obrigatória', 'Selo de Excelência', true)
    : null
  const marcosTrilhaPrincipal = trilhaPrincipalRow ? marcosDeEtapas(trilhaPrincipalRow.id) : []

  // ---------- territórios (todas as não-principais) ----------
  const territoriosRows = trilhas.filter(t => !t.principal)
  const territorios: Territorio[] = territoriosRows.map(t => {
    const cids = trilhaCursosUnicos(t.id)
    const concluidosCount = cids.filter(cursoCompleto).length
    const progressoPct = cids.length ? Math.round((concluidosCount / cids.length) * 100) : 0
    const prox = proximoDaTrilha(t.id)
    return {
      id: t.id, nome: t.nome ?? '', slug: t.slug, descricao: t.descricao,
      totalCursos: cids.length, horas: trilhaHoras(t.id), cursosConcluidos: concluidosCount,
      progressoPct,
      estado: progressoPct === 100 && cids.length > 0 ? 'concluida' : progressoPct > 0 ? 'em-curso' : 'aberta',
      ultimaAtividadeEm: trilhaUltimaAtividade(t.id),
      proximoCursoNome: prox.cursoNome, proximoHref: prox.href,
    }
  })

  // ---------- protagonista pós-formação ----------
  let painelProtagonista: PainelTrilha | null = null
  let tambemEmAndamento: Territorio[] = []
  if (seloConquistado) {
    const comAtividade = territorios.filter(t => t.progressoPct > 0 && t.ultimaAtividadeEm)
      .sort((a, b) => (b.ultimaAtividadeEm! > a.ultimaAtividadeEm! ? 1 : -1))
    const protagonistaRow = comAtividade[0] ?? null
    if (protagonistaRow) {
      const trilhaRow = territoriosRows.find(t => t.id === protagonistaRow.id)!
      const numEtapas = (etapasPorTrilha.get(trilhaRow.id) ?? []).length
      painelProtagonista = montaPainel(
        trilhaRow.id, trilhaRow.nome ?? '', trilhaRow.slug, trilhaRow.descricao,
        'Sua especialização em curso', `insígnia ${trilhaRow.nome} no perfil`, numEtapas > 1
      )
      tambemEmAndamento = comAtividade.slice(1, 4)
    }
  }

  return {
    logado: !!uid,
    seloConquistado,
    seloConquistadoEm: seloExcelenciaEm,
    trilhaPrincipalNome: trilhaPrincipalRow?.nome ?? null,
    trilhaPrincipalSlug: trilhaPrincipalRow?.slug ?? null,
    marcosTrilhaPrincipal,
    painelFormacao,
    painelProtagonista,
    tambemEmAndamento,
    territorios,
    aulasConcluidas,
  }
}

export function formatarDataSelo(iso: string | null): string | null {
  if (!iso) return null
  return fmtDataLonga.format(new Date(iso))
}

// ============================================================
// DETALHE DE UMA TRILHA (/jornada/[slug])
// ============================================================
export type CursoDetalhe = {
  id: string
  titulo: string
  slug: string
  capaUrl: string | null
  totalAulas: number
  duracaoSeg: number
  progressoPct: number
  completo: boolean
  notaMedia: number | null
}

export type EtapaDetalhe = {
  id: string
  ordem: number
  nome: string
  descricao: string | null
  estado: 'feita' | 'atual' | 'pendente'
  cursos: CursoDetalhe[]
}

export type TrilhaDetalhe = {
  id: string
  nome: string
  slug: string | null
  descricao: string | null
  principal: boolean
  horas: number
  alunos: number
  etapas: EtapaDetalhe[]
  etapasFeitas: number
  etapasTotal: number
  marcoFinalNome: string
  marcoFinalDourado: boolean
}

export async function carregarTrilhaPorSlug(slug: string): Promise<TrilhaDetalhe | null> {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth?.user?.id ?? null

  const { data: trilha } = await supabase
    .from('trilhas').select('id, nome, slug, descricao, principal').eq('slug', slug).maybeSingle()
  if (!trilha) return null

  const { data: etapasRaw } = await supabase
    .from('etapas').select('id, nome, descricao, ordem, insignia').eq('trilha_id', trilha.id).order('ordem', { ascending: true })
  const etapas = etapasRaw ?? []
  const etapaIds = etapas.map(e => e.id)

  const { data: missoesRaw } = etapaIds.length
    ? await supabase.from('etapa_missoes').select('etapa_id, curso_id, ordem').in('etapa_id', etapaIds).order('ordem', { ascending: true })
    : { data: [] as any[] }
  const missoes = missoesRaw ?? []
  const cursoIds = [...new Set(missoes.map(m => m.curso_id))]

  const [{ data: cursosRaw }, { data: modulosRaw }] = await Promise.all([
    cursoIds.length ? supabase.from('cursos').select('id, titulo, slug, capa_url').in('id', cursoIds) : Promise.resolve({ data: [] as any[] }),
    cursoIds.length ? supabase.from('modulos').select('id, curso_id, ordem').in('curso_id', cursoIds) : Promise.resolve({ data: [] as any[] }),
  ])
  const cursosRawList = cursosRaw ?? []
  const modulos = modulosRaw ?? []
  const moduloIds = modulos.map(m => m.id)

  const [{ data: aulasRaw }, { data: avaliacoesRaw }] = await Promise.all([
    moduloIds.length ? supabase.from('aulas').select('id, modulo_id, duracao_seg').in('modulo_id', moduloIds) : Promise.resolve({ data: [] as any[] }),
    cursoIds.length ? supabase.from('avaliacoes').select('id, curso_id').in('curso_id', cursoIds) : Promise.resolve({ data: [] as any[] }),
  ])
  const aulas = aulasRaw ?? []
  const avaliacoes = avaliacoesRaw ?? []

  const concluidas = new Set<string>()
  const notasPorAvaliacao = new Map<string, number[]>()
  const aprovadas = new Set<string>()
  const alunosSet = new Set<string>()

  if (uid) {
    const [{ data: progresso }, { data: tentativas }] = await Promise.all([
      supabase.from('aula_progresso').select('aula_id, concluida').eq('usuario_id', uid).eq('concluida', true),
      supabase.from('avaliacao_tentativas').select('avaliacao_id, aprovado, nota').eq('usuario_id', uid).eq('aprovado', true),
    ])
    for (const p of progresso ?? []) concluidas.add(p.aula_id)
    for (const t of tentativas ?? []) {
      aprovadas.add(t.avaliacao_id)
      if (!notasPorAvaliacao.has(t.avaliacao_id)) notasPorAvaliacao.set(t.avaliacao_id, [])
      notasPorAvaliacao.get(t.avaliacao_id)!.push(Number(t.nota))
    }
  }

  // alunos reais: quem já concluiu >=1 aula de algum curso desta trilha
  const aulaIdsDaTrilha = aulas.map(a => a.id)
  if (aulaIdsDaTrilha.length) {
    const { data: quemConcluiu } = await supabase
      .from('aula_progresso').select('usuario_id').eq('concluida', true).in('aula_id', aulaIdsDaTrilha)
    for (const r of quemConcluiu ?? []) alunosSet.add(r.usuario_id)
  }

  const modulosPorCurso = new Map<string, string[]>()
  for (const m of modulos) {
    if (!modulosPorCurso.has(m.curso_id)) modulosPorCurso.set(m.curso_id, [])
    modulosPorCurso.get(m.curso_id)!.push(m.id)
  }
  const aulasPorModulo = new Map<string, { id: string; duracao_seg: number }[]>()
  for (const a of aulas) {
    if (!aulasPorModulo.has(a.modulo_id)) aulasPorModulo.set(a.modulo_id, [])
    aulasPorModulo.get(a.modulo_id)!.push({ id: a.id, duracao_seg: a.duracao_seg ?? 0 })
  }
  const avaliacoesPorCurso = new Map<string, string[]>()
  for (const av of avaliacoes) {
    if (!avaliacoesPorCurso.has(av.curso_id)) avaliacoesPorCurso.set(av.curso_id, [])
    avaliacoesPorCurso.get(av.curso_id)!.push(av.id)
  }

  const cursosPorId = new Map(cursosRawList.map(c => [c.id, c]))
  function montaCursoDetalhe(cursoId: string): CursoDetalhe | null {
    const c = cursosPorId.get(cursoId)
    if (!c) return null
    const moduloIdsDoCurso = modulosPorCurso.get(cursoId) ?? []
    const aulaIds: string[] = []
    let duracaoSeg = 0
    for (const mid of moduloIdsDoCurso) {
      for (const a of aulasPorModulo.get(mid) ?? []) { aulaIds.push(a.id); duracaoSeg += a.duracao_seg }
    }
    const feitas = aulaIds.filter(id => concluidas.has(id)).length
    const progressoPct = aulaIds.length ? Math.round((feitas / aulaIds.length) * 100) : 0
    const avals = avaliacoesPorCurso.get(cursoId) ?? []
    const completo = aulaIds.length > 0 && feitas === aulaIds.length && avals.every(id => aprovadas.has(id))
    const notas = avals.flatMap(id => notasPorAvaliacao.get(id) ?? [])
    return {
      id: c.id, titulo: c.titulo, slug: c.slug, capaUrl: c.capa_url,
      totalAulas: aulaIds.length, duracaoSeg, progressoPct, completo,
      notaMedia: notas.length ? notas.reduce((s, n) => s + n, 0) / notas.length : null,
    }
  }

  const missoesPorEtapa = new Map<string, string[]>()
  for (const m of missoes) {
    if (!missoesPorEtapa.has(m.etapa_id)) missoesPorEtapa.set(m.etapa_id, [])
    missoesPorEtapa.get(m.etapa_id)!.push(m.curso_id)
  }

  let atualAchado = false
  const etapasDetalhe: EtapaDetalhe[] = etapas.map(e => {
    const cursos = (missoesPorEtapa.get(e.id) ?? []).map(montaCursoDetalhe).filter((c): c is CursoDetalhe => !!c)
    const feita = cursos.length > 0 && cursos.every(c => c.completo)
    let estado: EtapaDetalhe['estado'] = 'pendente'
    if (feita) estado = 'feita'
    else if (!atualAchado) { estado = 'atual'; atualAchado = true }
    return { id: e.id, ordem: e.ordem, nome: e.nome, descricao: e.descricao, estado, cursos }
  })

  const totalSeg = cursosRawList.reduce((s, c) => {
    const cid = c.id
    const moduloIdsDoCurso = modulosPorCurso.get(cid) ?? []
    return s + moduloIdsDoCurso.reduce((s2, mid) => s2 + (aulasPorModulo.get(mid) ?? []).reduce((s3, a) => s3 + a.duracao_seg, 0), 0)
  }, 0)

  return {
    id: trilha.id, nome: trilha.nome ?? '', slug: trilha.slug, descricao: trilha.descricao,
    principal: !!trilha.principal,
    horas: Math.round(totalSeg / 3600),
    alunos: alunosSet.size,
    etapas: etapasDetalhe,
    etapasFeitas: etapasDetalhe.filter(e => e.estado === 'feita').length,
    etapasTotal: etapasDetalhe.length,
    marcoFinalNome: trilha.principal ? 'Selo de Excelência' : `Insígnia ${trilha.nome}`,
    marcoFinalDourado: !!trilha.principal,
  }
}

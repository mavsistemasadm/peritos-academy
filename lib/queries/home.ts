// lib/queries/home.ts
// O dashboard: junta perfil, progresso de cursos, jornada real (via
// lib/queries/jornada.ts), agenda real e comunidade numa passada só.
// Nenhum dado inventado — o que não existe ainda mostra estado vazio.
import { criarClienteServidor } from '@/lib/supabase/server'
import { carregarJornada } from '@/lib/queries/jornada'
import { carregarAgenda } from '@/lib/queries/agenda'

export type CursoCard = {
  slug: string
  titulo: string
  capa_url: string | null
  aulas: number
  progressoPct: number      // 0 = ainda não começou
  concluidasPct: number     // idem, para a barra
  novo: boolean             // publicado nos últimos 30 dias e sem progresso
  motivo: string            // rótulo do badge ("Continuar" | "Começar" | "Próximo na sua formação" | "Descubra" ...)
  href: string              // link exato (pode apontar direto pra próxima aula)
}

export type EtapaTrilho = {
  numero: number
  nome: string
  estado: 'feita' | 'atual' | 'a-seguir'
  detalhe: string           // "Concluído" | "6 de 9 cursos" | "A seguir"
}

export type MovItem = {
  iniciais: string
  titulo: string
  detalhe: string
  quando: string
  link: string
}

export type DadosHome = {
  logado: boolean
  // nav / popover
  nome: string
  primeiroNome: string
  iniciais: string
  moedas: number
  // hero
  saudacao: string             // "Bom dia" | "Boa tarde" | "Boa noite"
  dataHoje: string
  continuarCurso: CursoCard | null
  missaoAtualNome: string
  missaoAtualPct: number
  proximaAulaNome: string | null
  // indicadores
  metaDias: string             // "4 de 5 dias"
  proximaConquista: string
  proximaConquistaFalta: string
  eventoHoje: { titulo: string; hora: string } | null
  // jornada — sempre a trilha protagonista (mais atividade recente; default = Formação)
  trilho: EtapaTrilho[]
  evolucaoTitulo: string
  evolucaoDescricao: string | null
  // vitrines
  vitrine: CursoCard[]         // régua de recomendação, até 3
  // ao vivo + comunidade
  eventoLive: {
    titulo: string; descricao: string | null
    apresentador: string; apresentadorIniciais: string; horaRotulo: string
  } | null
  online: number
  movimento: MovItem[]
  // tour guiado de boas-vindas
  mostrarTourInicial: boolean       // true só na primeira visita (perfis.tour_visto_em IS NULL)
  tourPrimeiraAulaHref: string      // alvo do CTA final do tour — próxima aula pendente da Formação (ou /jornada)
}

const TZ = 'America/Sao_Paulo'
const fmtHora = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
const fmtDataLonga = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'long', day: '2-digit', month: 'long' })
const fmtDiaCurto = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit' })
const fmtDiaISO = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const fmtDiaSemanaISO = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }) // "Mon".."Sun"
const META_DIAS_SEMANA = 5

function iniciaisDe(nome: string) {
  return nome.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}
function saudacaoPorHora(): string {
  const h = Number(new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: 'numeric', hour12: false }).format(new Date()))
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}
function tempoRel(iso: string) {
  const min = Math.floor((Date.now() - +new Date(iso)) / 60000)
  if (min < 60) return min <= 1 ? 'agora' : `há ${min} min`
  const hh = Math.floor(min / 60)
  if (hh < 24) return `há ${hh}h`
  const d = Math.floor(hh / 24)
  return d === 1 ? 'ontem' : `há ${d} dias`
}
function extrairSlug(href: string | null): string | null {
  if (!href) return null
  const m = href.match(/^\/curso\/([^/]+)/)
  return m ? m[1] : null
}

export async function carregarHome(): Promise<DadosHome | null> {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return null
  const uid = auth.user.id

  const [
    { data: perfil },
    { data: cursosRaw },
    { data: modulosRaw },
    { data: postsRaw },
    { data: config },
    { data: niveis },
    { data: saldo },
    jornada,
    agenda,
  ] = await Promise.all([
    supabase.from('perfis').select('nome, tour_visto_em').eq('id', uid).single(),
    supabase.from('cursos').select('id, slug, titulo, capa_url, atualizado_em').eq('publicado', true).order('atualizado_em', { ascending: false }),
    supabase.from('modulos').select('id, curso_id, ordem').order('ordem', { ascending: true }),
    supabase.from('comunidade_posts').select('*').order('criado_em', { ascending: false }).limit(3),
    supabase.from('comunidade_config').select('*').eq('id', 1).maybeSingle(),
    supabase.from('gamificacao_niveis').select('nome, pontos_minimos, ordem').order('ordem', { ascending: true }),
    supabase.from('gamificacao_saldo').select('xp_total, moedas_total').eq('usuario_id', uid).maybeSingle(),
    carregarJornada(),
    carregarAgenda(),
  ])
  if (!perfil) return null

  const { data: aulasRaw } = await supabase.from('aulas').select('id, modulo_id, ordem').order('ordem', { ascending: true })
  const { data: progresso } = await supabase.from('aula_progresso').select('aula_id, concluida, concluida_em').eq('usuario_id', uid).eq('concluida', true)
  const { data: tentativas } = await supabase.from('avaliacao_tentativas').select('criada_em').eq('usuario_id', uid)

  // ---------- aulas ordenadas por curso (modulo.ordem, aula.ordem) ----------
  const modulosPorCurso = new Map<string, string[]>()
  for (const m of modulosRaw ?? []) {
    if (!modulosPorCurso.has(m.curso_id)) modulosPorCurso.set(m.curso_id, [])
    modulosPorCurso.get(m.curso_id)!.push(m.id)
  }
  const aulasPorModulo = new Map<string, string[]>()
  for (const a of aulasRaw ?? []) {
    if (!aulasPorModulo.has(a.modulo_id)) aulasPorModulo.set(a.modulo_id, [])
    aulasPorModulo.get(a.modulo_id)!.push(a.id)
  }
  const aulasPorCurso = new Map<string, string[]>() // curso_id -> [aula_id] ordenadas
  for (const [cursoId, moduloIds] of modulosPorCurso) {
    const aulaIds: string[] = []
    for (const mid of moduloIds) aulaIds.push(...(aulasPorModulo.get(mid) ?? []))
    aulasPorCurso.set(cursoId, aulaIds)
  }
  const concluidas = new Set((progresso ?? []).map(p => p.aula_id))

  const TRINTA_DIAS = 30 * 864e5
  function montaCard(c: any): CursoCard {
    const aulasIds = aulasPorCurso.get(c.id) ?? []
    const feitas = aulasIds.filter(id => concluidas.has(id)).length
    const pct = aulasIds.length ? Math.round((feitas / aulasIds.length) * 100) : 0
    const recente = c.atualizado_em && (Date.now() - +new Date(c.atualizado_em) < TRINTA_DIAS)
    const emAndamento = pct > 0 && pct < 100
    const proximaAula = aulasIds.find(id => !concluidas.has(id))
    return {
      slug: c.slug, titulo: c.titulo, capa_url: c.capa_url,
      aulas: aulasIds.length,
      progressoPct: pct, concluidasPct: pct,
      novo: pct === 0 && !!recente,
      motivo: emAndamento ? 'Continuar' : 'Começar',
      href: proximaAula ? `/curso/${c.slug}/aula/${proximaAula}` : `/curso/${c.slug}`,
    }
  }

  const cursos = (cursosRaw ?? []).map(montaCard)
  const cursoPorSlug = new Map(cursos.map(c => [c.slug, c]))

  // curso a continuar: o de maior progresso ainda não terminado
  const emAndamento = cursos.filter(c => c.progressoPct > 0 && c.progressoPct < 100)
    .sort((a, b) => b.progressoPct - a.progressoPct)
  const continuarCurso = emAndamento[0] ? { ...emAndamento[0], motivo: 'Continue de onde parou' } : null

  // ---------- régua de recomendação (até 3, sem repetir curso) ----------
  const regua: CursoCard[] = []
  const usados = new Set<string>()
  function tenta(card: CursoCard | null | undefined) {
    if (!card || usados.has(card.slug) || regua.length >= 3) return
    regua.push(card); usados.add(card.slug)
  }
  tenta(continuarCurso)
  if (jornada.painelFormacao?.continuarHref) {
    const slug = extrairSlug(jornada.painelFormacao.continuarHref)
    const base = slug ? cursoPorSlug.get(slug) : null
    if (base) tenta({ ...base, motivo: 'Próximo na sua formação', href: jornada.painelFormacao.continuarHref })
  }
  if (jornada.painelProtagonista?.continuarHref) {
    const slug = extrairSlug(jornada.painelProtagonista.continuarHref)
    const base = slug ? cursoPorSlug.get(slug) : null
    if (base) tenta({ ...base, motivo: 'Continue sua especialização', href: jornada.painelProtagonista.continuarHref })
  }
  if (regua.length < 3) {
    const territorioAberto = jornada.territorios.find(t => t.progressoPct === 0 && t.proximoHref)
    if (territorioAberto?.proximoHref) {
      const slug = extrairSlug(territorioAberto.proximoHref)
      const base = slug ? cursoPorSlug.get(slug) : null
      if (base) tenta({ ...base, motivo: 'Descubra', href: territorioAberto.proximoHref })
    }
  }
  // completa com os cursos mais recentes ainda não usados, se sobrar espaço
  for (const c of cursos) {
    if (regua.length >= 3) break
    tenta(c)
  }

  // ---------- meta semanal: dias com atividade real nesta semana (seg-dom) ----------
  const diasAtividade = new Set<string>()
  for (const p of progresso ?? []) if (p.concluida_em) diasAtividade.add(fmtDiaISO.format(new Date(p.concluida_em)))
  for (const t of tentativas ?? []) if (t.criada_em) diasAtividade.add(fmtDiaISO.format(new Date(t.criada_em)))

  const hoje = new Date()
  const diaSemanaHoje = fmtDiaSemanaISO.format(hoje) // "Mon".."Sun"
  const ORDEM_SEMANA = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const offsetHoje = ORDEM_SEMANA.indexOf(diaSemanaHoje)
  let diasNaSemana = 0
  for (let i = 0; i <= offsetHoje; i++) {
    const d = new Date(hoje); d.setDate(d.getDate() - (offsetHoje - i))
    if (diasAtividade.has(fmtDiaISO.format(d))) diasNaSemana++
  }

  // ---------- próximo nível (pra "próxima conquista") ----------
  const xp = saldo?.xp_total ?? 0
  const ordenados = (niveis ?? []).slice().sort((a, b) => a.ordem - b.ordem)
  const proximoNivel = ordenados.find(n => n.pontos_minimos > xp) ?? null
  const faltaXp = proximoNivel ? Math.max(0, proximoNivel.pontos_minimos - xp) : 0

  // ---------- trilho: trilha protagonista (mais atividade recente; default = Formação) ----------
  const trilho: EtapaTrilho[] = jornada.trilhaProtagonistaHome.marcos.map((m, i) => ({
    numero: i + 1, nome: m.nome,
    estado: m.estado === 'feita' ? 'feita' : m.estado === 'atual' ? 'atual' : 'a-seguir',
    detalhe: m.estado === 'feita' ? 'Concluído' : m.estado === 'atual' ? 'Em andamento' : 'A seguir',
  }))

  // ---------- hero: barra da missão ----------
  let missaoAtualNome = jornada.trilhaPrincipalNome ?? 'Sua jornada'
  let missaoAtualPct = 0
  let proximaAulaNome: string | null = null
  if (jornada.painelFormacao) {
    const p = jornada.painelFormacao
    missaoAtualNome = `${p.nome} · ${p.marcosFeitos} de ${p.marcosTotal} etapas`
    missaoAtualPct = p.progressoPct
    proximaAulaNome = p.proximoTexto
  } else if (jornada.seloConquistado && jornada.painelProtagonista) {
    const p = jornada.painelProtagonista
    missaoAtualNome = p.nome
    missaoAtualPct = p.progressoPct
    proximaAulaNome = p.proximoTexto
  } else if (jornada.seloConquistado) {
    missaoAtualNome = 'Selo de Excelência conquistado'
    missaoAtualPct = 100
  }

  // ---------- comunidade: movimento ----------
  const movimento: MovItem[] = (postsRaw ?? []).map(p => ({
    iniciais: iniciaisDe(p.autor_nome ?? 'Perito'),
    titulo: p.tipo === 'vitoria'
      ? `${(p.autor_nome ?? 'Perito').split(' ')[0]} ${p.vitoria_rotulo ?? 'conquistou algo'}`
      : `${(p.autor_nome ?? 'Perito').split(' ')[0]} ${p.tipo === 'caso' ? 'compartilhou um caso' : 'abriu uma dúvida'}`,
    detalhe: p.titulo ?? p.vitoria_detalhe ?? '',
    quando: tempoRel(p.criado_em),
    link: '/comunidade',
  }))

  // ---------- agenda: hoje / ao vivo ----------
  const evAoVivo = agenda.aoVivo[0] ?? null
  const evProximo = agenda.proximos[0] ?? null
  const ehHoje = (iso: string) => new Date(iso).toDateString() === new Date().toDateString()
  const eventoHojeRaw = evAoVivo ?? (evProximo && ehHoje(evProximo.inicia_em) ? evProximo : null)
  const eventoLiveRaw = evAoVivo ?? evProximo

  return {
    logado: true,
    nome: perfil.nome ?? 'Perito',
    primeiroNome: (perfil.nome ?? 'Perito').split(' ')[0],
    iniciais: iniciaisDe(perfil.nome ?? 'PA'),
    moedas: saldo?.moedas_total ?? 0,
    saudacao: saudacaoPorHora(),
    dataHoje: fmtDataLonga.format(new Date()).replace(/^\w/, c => c.toUpperCase()),
    continuarCurso,
    missaoAtualNome, missaoAtualPct, proximaAulaNome,
    metaDias: `${diasNaSemana} de ${META_DIAS_SEMANA} dias`,
    proximaConquista: proximoNivel?.nome ?? 'Nível máximo alcançado',
    proximaConquistaFalta: proximoNivel ? `Faltam ${faltaXp} XP` : 'Você chegou ao topo',
    eventoHoje: eventoHojeRaw
      ? { titulo: eventoHojeRaw.titulo, hora: fmtHora.format(new Date(eventoHojeRaw.inicia_em)).replace(':', 'h') }
      : null,
    trilho,
    evolucaoTitulo: jornada.trilhaProtagonistaHome.nome || 'Sua jornada',
    evolucaoDescricao: jornada.trilhaProtagonistaHome.descricao,
    vitrine: regua,
    eventoLive: eventoLiveRaw
      ? {
          titulo: eventoLiveRaw.titulo,
          descricao: eventoLiveRaw.descricao,
          apresentador: eventoLiveRaw.apresentador_nome ?? 'Especialista',
          apresentadorIniciais: iniciaisDe(eventoLiveRaw.apresentador_nome ?? 'PA'),
          horaRotulo: evAoVivo
            ? 'Ao vivo agora'
            : `${ehHoje(eventoLiveRaw.inicia_em) ? 'Hoje' : fmtDiaCurto.format(new Date(eventoLiveRaw.inicia_em))} · ${fmtHora.format(new Date(eventoLiveRaw.inicia_em)).replace(':', 'h')}`,
        }
      : null,
    online: config?.online_agora ?? 0,
    movimento,
    mostrarTourInicial: !perfil.tour_visto_em,
    tourPrimeiraAulaHref: jornada.painelFormacao?.continuarHref ?? jornada.trilhaProtagonistaHome.continuarHref ?? '/jornada',
  }
}

// lib/queries/home.ts
// A query mais conectada do projeto: junta perfil, progresso, jornada,
// eventos, comunidade e cursos numa passada só para montar o dashboard.
import { criarClienteServidor } from '@/lib/supabase/server'

export type CursoCard = {
  slug: string
  titulo: string
  capa_url: string | null
  aulas: number
  progressoPct: number      // 0 = ainda não começou
  concluidasPct: number     // idem, para a barra
  novo: boolean             // publicado nos últimos 30 dias e sem progresso
}

export type EtapaTrilho = {
  numero: number
  nome: string
  estado: 'feita' | 'atual' | 'a-seguir'
  detalhe: string           // "Concluído" | "6 de 9 missões" | "A seguir"
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
  nivel: number
  titulo: string
  xp: number
  xpProximo: number
  progressoNivelPct: number
  moedas: number
  proximaRecompensa: string
  sequenciaDias: number
  recorde: number
  sequenciaSemana: boolean[]   // 7 posições: true = estudou
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
  // jornada
  trilho: EtapaTrilho[]
  // vitrines
  vitrine: CursoCard[]         // "Para você"
  // ao vivo + comunidade
  eventoLive: {
    titulo: string; descricao: string | null
    apresentador: string; apresentadorIniciais: string; horaRotulo: string
  } | null
  online: number
  movimento: MovItem[]
}

const TZ = 'America/Sao_Paulo'
const fmtHora = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
const fmtDataLonga = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'long', day: '2-digit', month: 'long' })
const fmtNum = (n: number) => n.toLocaleString('pt-BR')

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

export async function carregarHome(): Promise<DadosHome | null> {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return null
  const uid = auth.user.id

  const [
    { data: perfil },
    { data: cursosRaw },
    { data: etapasRaw },
    { data: eventosRaw },
    { data: postsRaw },
    { data: config },
    { data: diasEstudo },
    { data: insignias },
    { data: progresso },
  ] = await Promise.all([
    supabase.from('perfis').select('*').eq('id', uid).single(),
    supabase.from('cursos').select('id, slug, titulo, capa_url, atualizado_em').eq('publicado', true).order('atualizado_em', { ascending: false }),
    supabase.from('jornada_etapas').select('*').order('numero'),
    supabase.from('eventos').select('*').eq('publicado', true).order('inicia_em'),
    supabase.from('comunidade_posts').select('*').order('criado_em', { ascending: false }).limit(3),
    supabase.from('comunidade_config').select('*').eq('id', 1).maybeSingle(),
    supabase.from('perfil_estudo_dias').select('dia'),
    supabase.from('perfil_insignias').select('*').eq('conquistada_em', null).order('ordem').limit(1),
    supabase.from('aula_progresso').select('aula_id, concluida'),
  ])
  if (!perfil) return null

  // ---------- contagem de aulas por curso + progresso ----------
  const { data: aulasRaw } = await supabase
    .from('aulas').select('id, modulo_id, modulos!inner(curso_id)')

  const aulasPorCurso = new Map<string, string[]>()  // curso_id -> [aula_id]
  for (const a of (aulasRaw ?? []) as any[]) {
    const cid = a.modulos?.curso_id
    if (!cid) continue
    if (!aulasPorCurso.has(cid)) aulasPorCurso.set(cid, [])
    aulasPorCurso.get(cid)!.push(a.id)
  }
  const concluidas = new Set((progresso ?? []).filter(p => p.concluida).map(p => p.aula_id))

  const TRINTA_DIAS = 30 * 864e5
  function montaCard(c: any): CursoCard {
    const aulasIds = aulasPorCurso.get(c.id) ?? []
    const feitas = aulasIds.filter(id => concluidas.has(id)).length
    const pct = aulasIds.length ? Math.round((feitas / aulasIds.length) * 100) : 0
    const recente = c.atualizado_em && (Date.now() - +new Date(c.atualizado_em) < TRINTA_DIAS)
    return {
      slug: c.slug, titulo: c.titulo, capa_url: c.capa_url,
      aulas: aulasIds.length,
      progressoPct: pct, concluidasPct: pct,
      novo: pct === 0 && !!recente,
    }
  }

  const cursos = (cursosRaw ?? []).map(montaCard)

  // curso a continuar: o de maior progresso ainda não terminado; senão o 1º
  const emAndamento = cursos.filter(c => c.progressoPct > 0 && c.progressoPct < 100)
    .sort((a, b) => b.progressoPct - a.progressoPct)
  const continuarCurso = emAndamento[0] ?? cursos[0] ?? null

  // ---------- sequência de estudo (7 dias) ----------
  const diasSet = new Set((diasEstudo ?? []).map(d => d.dia))
  const hoje = new Date(); hoje.setHours(12, 0, 0, 0)
  const sequenciaSemana: boolean[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(hoje); d.setDate(d.getDate() - i)
    sequenciaSemana.push(diasSet.has(d.toISOString().slice(0, 10)))
  }
  // meta semanal: dias estudados na semana corrente (seg-dom)
  const diasNaSemana = sequenciaSemana.filter(Boolean).length

  // sequência atual e recorde (reusa a lógica do perfil, simplificada)
  const ordenados = [...diasSet].sort()
  let recorde = 0, corr = 0, prev: number | null = null
  for (const s of ordenados) {
    const t = +new Date(s + 'T12:00:00')
    if (prev !== null && t - prev === 864e5) corr++; else corr = 1
    if (corr > recorde) recorde = corr
    prev = t
  }
  let sequenciaDias = 0
  for (let i = 0; ; i++) {
    const d = new Date(hoje); d.setDate(d.getDate() - i)
    if (diasSet.has(d.toISOString().slice(0, 10))) sequenciaDias++
    else if (i === 0) continue
    else break
  }

  // ---------- trilho da jornada ----------
  const etapaAtual = perfil.etapa ?? 1
  const trilho: EtapaTrilho[] = (etapasRaw ?? []).map(e => {
    if (e.numero < etapaAtual) return { numero: e.numero, nome: e.nome, estado: 'feita', detalhe: 'Concluído' }
    if (e.numero === etapaAtual) return { numero: e.numero, nome: e.nome, estado: 'atual', detalhe: `${e.missoes_feitas} de ${e.missoes_total} missões` }
    return { numero: e.numero, nome: e.nome, estado: 'a-seguir', detalhe: 'A seguir' }
  })
  const daAtual = (etapasRaw ?? []).find(e => e.numero === etapaAtual)

  // ---------- eventos: hoje / live / próximo ----------
  const agora = Date.now()
  const eventos = (eventosRaw ?? [])
  const eventoFuturo = eventos.find(e => +new Date(e.inicia_em) > agora && !e.gravacao_url)
  const ehHoje = (iso: string) => new Date(iso).toDateString() === new Date().toDateString()
  const eventoHojeRaw = eventos.find(e => ehHoje(e.inicia_em))

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

  const proximaInsignia = (insignias ?? [])[0]
  const xp = perfil.xp ?? 0
  const xpProximo = perfil.xp_proximo_nivel ?? 100

  return {
    logado: true,
    nome: perfil.nome ?? 'Perito',
    primeiroNome: (perfil.nome ?? 'Perito').split(' ')[0],
    iniciais: iniciaisDe(perfil.nome ?? 'PA'),
    nivel: perfil.nivel ?? 1,
    titulo: perfil.titulo ?? 'Perito Iniciante',
    xp, xpProximo,
    progressoNivelPct: xpProximo > 0 ? Math.min(100, Math.round((xp / xpProximo) * 100)) : 0,
    moedas: perfil.moedas ?? 0,
    proximaRecompensa: 'Análise de caso ao vivo · 800',
    sequenciaDias, recorde, sequenciaSemana,
    saudacao: saudacaoPorHora(),
    dataHoje: fmtDataLonga.format(new Date()).replace(/^\w/, c => c.toUpperCase()),
    continuarCurso,
    missaoAtualNome: daAtual?.nome ?? 'Sua jornada',
    missaoAtualPct: daAtual && daAtual.missoes_total
      ? Math.round((daAtual.missoes_feitas / daAtual.missoes_total) * 100) : 0,
    proximaAulaNome: continuarCurso?.titulo ?? null,
    metaDias: `${diasNaSemana} de 5 dias`,
    proximaConquista: proximaInsignia?.nome ?? 'Perito Estrategista',
    proximaConquistaFalta: daAtual
      ? `Faltam ${Math.max(0, daAtual.missoes_total - daAtual.missoes_feitas)} missões`
      : `Faltam ${Math.max(0, xpProximo - xp)} XP`,
    eventoHoje: eventoHojeRaw
      ? { titulo: eventoHojeRaw.titulo, hora: fmtHora.format(new Date(eventoHojeRaw.inicia_em)).replace(':', 'h') }
      : null,
    trilho,
    vitrine: cursos.slice(0, 8),
    eventoLive: eventoFuturo
      ? {
          titulo: eventoFuturo.titulo,
          descricao: eventoFuturo.descricao,
          apresentador: eventoFuturo.apresentador_nome ?? 'Especialista',
          apresentadorIniciais: iniciaisDe(eventoFuturo.apresentador_nome ?? 'PA'),
          horaRotulo: `Hoje · ${fmtHora.format(new Date(eventoFuturo.inicia_em)).replace(':', 'h')}`,
        }
      : null,
    online: config?.online_agora ?? 0,
    movimento,
  }
}
// lib/queries/perfil.ts
// Carrega o perfil e COMPUTA constância: heatmap, sequência, recorde,
// dias fortes, missões da jornada e atividade recente saem TODOS de
// registros reais (gamificacao_extrato, aula_progresso, a trilha real via
// lib/queries/jornada.ts, e o motor de streak unificado via
// registrar_acesso_diario). Nenhuma tabela de seed (perfil_estudo_dias,
// perfil_atividades) e nenhuma coluna órfã de perfis (etapa*, xp_semana,
// estudo_*_seg, missoes_*, iniciou_em) é lida aqui — auditoria de
// 2026-07-23 confirmou que eram mock nunca escrito pelo app real.
import { criarClienteServidor } from '@/lib/supabase/server'
import { carregarJornada } from '@/lib/queries/jornada'

export type Insignia = {
  nome: string
  descricao: string
  icone: 'check' | 'doc' | 'raio' | 'cadeado'
  conquistada: boolean
  quando_rotulo: string | null
}

export type Certificado = {
  numero: string | null
  curso_titulo: string
  curso_slug: string | null
  emitido: boolean
  emitido_rotulo: string | null
  nota: number | null
  carga_horas: number | null
  progresso_pct: number | null
  faltam_txt: string | null
}

export type Atividade = {
  prefixo: string
  destaque: string
  sufixo: string
  xp: number
  quando: string
}

export type RequisitoProximoNivel = {
  rotulo: 'aulas_concluidas' | 'cursos_completos' | 'avaliacoes_aprovadas' | 'desafios_completos' | 'streak_marco_dias' | 'participacoes_comunidade'
  atual: number
  necessario: number
  cumprido: boolean
  suspenso: boolean // sem conteúdo publicado desse tipo ainda — não trava nível, aparece como "em breve"
}

export type ProximoNivel = {
  ordem: number
  nome: string
  seloUrl: string | null
  xpAtual: number
  xpNecessario: number
  xpCumprido: boolean
  requisitos: RequisitoProximoNivel[]
} | null

export type DadosPerfil = {
  nome: string
  slug: string | null
  bio: string | null
  cidade: string | null
  estado: string | null
  telefone: string | null
  email_publico: string | null
  mostrar_tel: boolean
  mostrar_email: boolean
  perfil_publico: boolean
  sons_conquista: boolean
  receberEmails: boolean
  foto_url: string | null
  titulo: string
  nivel: number
  xp: number
  xpProximoNivel: number
  progressoPct: number
  iniciouRotulo: string
  etapa: number
  etapaTotal: number
  etapaNome: string
  xpSemana: number
  estudoHoras: string
  estudoSemana: string
  missoesFeitas: number
  missoesTotal: number
  anotacoes: number
  heatmap: number[]
  diasEstudados: number
  diasJanela: number
  sequenciaAtual: number
  recorde: number
  diasFortes: string
  ritmoSubiu: boolean
  insignias: Insignia[]
  certificados: Certificado[]
  atividades: Atividade[]
  proximoNivel: ProximoNivel
}

const TZ = 'America/Sao_Paulo'
const DIA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const fmtMesAno = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, month: 'long', year: 'numeric' })
const fmtDiaISO = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const fmtDiaSemanaISO = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' })
const ORDEM_SEMANA = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function fmtHoras(seg: number) {
  const h = Math.floor(seg / 3600), m = Math.round((seg % 3600) / 60)
  return m ? `${h}h ${String(m).padStart(2, '0')}` : `${h}h`
}
function inicioSemanaISO(): string {
  const hoje = new Date()
  const offset = ORDEM_SEMANA.indexOf(fmtDiaSemanaISO.format(hoje))
  const seg = new Date(hoje); seg.setDate(seg.getDate() - offset)
  return fmtDiaISO.format(seg)
}

export async function carregarPerfil(): Promise<DadosPerfil | null> {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return null
  const uid = auth.user.id

  const JANELA = 112
  const hoje = new Date(); hoje.setHours(12, 0, 0, 0)
  const inicioJanela = new Date(hoje); inicioJanela.setDate(inicioJanela.getDate() - (JANELA - 1))
  const inicioSemana = inicioSemanaISO()

  const [
    { data: perfil },
    { data: insigniasRaw },
    { data: certsRaw },
    { count: anotacoes },
    { data: emailPref },
    { data: niveis },
    { data: statusProximoNivel },
    { data: streak },
    jornada,
    { data: extratoJanela },
    { data: gatilhos },
    { data: progressoAulas },
  ] = await Promise.all([
    supabase.from('perfis').select('*').eq('id', uid).single(),
    supabase.from('perfil_insignias').select('*').order('ordem'),
    supabase.from('certificados').select('*').order('ordem'),
    supabase.from('aula_anotacoes').select('id', { count: 'exact', head: true }),
    supabase.from('email_preferencias').select('receber_emails').eq('usuario_id', uid).maybeSingle(),
    supabase.from('gamificacao_niveis').select('ordem, nome, pontos_minimos').order('ordem'),
    supabase.rpc('gam_status_proximo_nivel'),
    // fonte unificada de streak (mesma que a nav usa) — registra o acesso de
    // hoje (idempotente) e devolve sequência + recorde persistidos de verdade,
    // nunca recalculado por cima de uma tabela de seed.
    supabase.rpc('registrar_acesso_diario'),
    carregarJornada(),
    // ledger real: alimenta heatmap, dias fortes, XP da semana e atividade
    // recente — tudo na mesma janela de 112 dias, uma query só.
    supabase.from('gamificacao_extrato').select('gatilho_codigo, pontos, criado_em, referencia_tipo, referencia_id')
      .eq('usuario_id', uid).gte('criado_em', inicioJanela.toISOString()).order('criado_em', { ascending: false }),
    supabase.from('gamificacao_gatilhos').select('codigo, descricao'),
    supabase.from('aula_progresso').select('concluida_em, aulas(duracao_seg)').eq('usuario_id', uid).eq('concluida', true),
  ])
  if (!perfil) return null

  // nível/título/progresso reais — perfis.xp_proximo_nivel e perfis.titulo
  // são colunas órfãs (nunca escritas pelo motor de gamificação real, ver
  // CLAUDE.md), nunca ler delas pra exibir XP/nível.
  const nivelAtualReal = niveis?.find(n => n.ordem === (statusProximoNivel?.nivel_atual_ordem ?? perfil.nivel ?? 1))
  const proximoNivelRaw = statusProximoNivel?.proximo_nivel ?? null
  const xpProximoNivelReal = proximoNivelRaw?.xp_necessario ?? nivelAtualReal?.pontos_minimos ?? 100
  const progressoPctReal = proximoNivelRaw
    ? Math.min(100, Math.round((proximoNivelRaw.xp_atual / Math.max(1, proximoNivelRaw.xp_necessario)) * 100))
    : 100

  // ---------- heatmap real (gamificacao_extrato, não perfil_estudo_dias) ----------
  const extrato = extratoJanela ?? []
  const contagemPorDia = new Map<string, number>()
  for (const e of extrato) {
    const dia = fmtDiaISO.format(new Date(e.criado_em))
    contagemPorDia.set(dia, (contagemPorDia.get(dia) ?? 0) + 1)
  }
  function nivelHeat(qtd: number) {
    if (qtd <= 0) return 0
    if (qtd === 1) return 1
    if (qtd <= 3) return 2
    if (qtd <= 6) return 3
    return 4
  }

  const heatmap: number[] = []
  let diasEstudados = 0
  const porDow = [0, 0, 0, 0, 0, 0, 0]
  let estudou28 = 0, estudouAntes = 0
  for (let i = JANELA - 1; i >= 0; i--) {
    const d = new Date(hoje); d.setDate(d.getDate() - i)
    const qtd = contagemPorDia.get(fmtDiaISO.format(d)) ?? 0
    heatmap.push(nivelHeat(qtd))
    if (qtd > 0) {
      diasEstudados++
      porDow[d.getDay()]++
      if (i < 28) estudou28++; else estudouAntes++
    }
  }

  const ordenados = porDow.map((qtd, dow) => ({ dow, qtd })).sort((a, b) => b.qtd - a.qtd)
  const fortes = ordenados.slice(0, 2).filter(x => x.qtd > 0).map(x => DIA_SEMANA[x.dow])
  const diasFortes = fortes.length === 2
    ? `${fortes[0].charAt(0).toUpperCase() + fortes[0].slice(1)} e ${fortes[1]} são seus dias fortes.`
    : fortes.length === 1
      ? `${fortes[0].charAt(0).toUpperCase() + fortes[0].slice(1)} é seu dia forte.`
      : 'Comece a estudar para descobrir seus dias fortes.'
  const ritmoSubiu = estudou28 / 28 > estudouAntes / (JANELA - 28)

  const streakDados = streak as { sequencia_atual?: number; recorde?: number } | null

  // ---------- XP e horas de estudo da semana ----------
  const xpSemana = extrato
    .filter(e => fmtDiaISO.format(new Date(e.criado_em)) >= inicioSemana)
    .reduce((s, e) => s + (e.pontos ?? 0), 0)

  const progresso = progressoAulas ?? []
  let estudoSegTotal = 0, estudoSegSemana = 0
  for (const p of progresso as { concluida_em: string | null; aulas: { duracao_seg: number | null } | { duracao_seg: number | null }[] | null }[]) {
    const aula = Array.isArray(p.aulas) ? p.aulas[0] : p.aulas
    const seg = aula?.duracao_seg ?? 0
    estudoSegTotal += seg
    if (p.concluida_em && fmtDiaISO.format(new Date(p.concluida_em)) >= inicioSemana) estudoSegSemana += seg
  }

  // ---------- missões da jornada + etapa atual (real, mesma trilha da home) ----------
  const painelAtivo = jornada.painelFormacao ?? (jornada.seloConquistado ? jornada.painelProtagonista : null) ?? jornada.trilhaProtagonistaHome
  const marcoAtualIdx = painelAtivo.marcos.findIndex(m => m.estado === 'atual')
  const etapa = marcoAtualIdx >= 0 ? marcoAtualIdx + 1 : painelAtivo.marcosTotal
  const etapaNome = marcoAtualIdx >= 0 ? painelAtivo.marcos[marcoAtualIdx].nome : (painelAtivo.marcos[painelAtivo.marcosTotal - 1]?.nome ?? painelAtivo.nome)

  // ---------- atividade recente (gamificacao_extrato + catálogo real de gatilhos) ----------
  const descricaoPorGatilho = new Map((gatilhos ?? []).map(g => [g.codigo, g.descricao]))
  const recentes = extrato.slice(0, 8)
  const aulaIds = [...new Set(recentes.filter(e => e.referencia_tipo === 'aula').map(e => e.referencia_id))]
  const cursoIds = [...new Set(recentes.filter(e => e.referencia_tipo === 'curso').map(e => e.referencia_id))]
  const [{ data: aulasNomes }, { data: cursosNomes }] = await Promise.all([
    aulaIds.length ? supabase.from('aulas').select('id, titulo').in('id', aulaIds) : Promise.resolve({ data: [] as { id: string; titulo: string }[] }),
    cursoIds.length ? supabase.from('cursos').select('id, titulo').in('id', cursoIds) : Promise.resolve({ data: [] as { id: string; titulo: string }[] }),
  ])
  const nomeAula = new Map((aulasNomes ?? []).map(a => [a.id, a.titulo]))
  const nomeCurso = new Map((cursosNomes ?? []).map(c => [c.id, c.titulo]))

  const atividades: Atividade[] = recentes.map(e => {
    let prefixo = ''
    let destaque = descricaoPorGatilho.get(e.gatilho_codigo) ?? e.gatilho_codigo
    if (e.gatilho_codigo === 'concluir_aula' && nomeAula.has(e.referencia_id)) {
      prefixo = 'Concluiu a aula '
      destaque = nomeAula.get(e.referencia_id)!
    } else if (e.gatilho_codigo === 'concluir_curso' && nomeCurso.has(e.referencia_id)) {
      prefixo = 'Concluiu o curso '
      destaque = nomeCurso.get(e.referencia_id)!
    } else if (e.gatilho_codigo === 'iniciar_curso' && nomeCurso.has(e.referencia_id)) {
      prefixo = 'Começou o curso '
      destaque = nomeCurso.get(e.referencia_id)!
    }
    return { prefixo, destaque, sufixo: '', xp: e.pontos ?? 0, quando: e.criado_em }
  })

  return {
    nome: perfil.nome ?? 'Perito',
    slug: perfil.slug ?? null,
    bio: perfil.bio ?? null,
    cidade: perfil.cidade ?? null,
    estado: perfil.estado ?? null,
    telefone: perfil.telefone ?? null,
    email_publico: perfil.email_publico ?? null,
    mostrar_tel: perfil.mostrar_tel ?? false,
    mostrar_email: perfil.mostrar_email ?? false,
    perfil_publico: perfil.perfil_publico ?? true,
    sons_conquista: perfil.sons_conquista ?? true,
    receberEmails: emailPref?.receber_emails ?? true,
    foto_url: perfil.foto_url ?? null,
    titulo: nivelAtualReal?.nome ?? perfil.titulo ?? 'Explorador Novato',
    nivel: statusProximoNivel?.nivel_atual_ordem ?? perfil.nivel ?? 1,
    xp: perfil.xp ?? 0,
    xpProximoNivel: xpProximoNivelReal,
    progressoPct: progressoPctReal,
    iniciouRotulo: perfil.criado_em ? fmtMesAno.format(new Date(perfil.criado_em)) : '—',
    etapa, etapaTotal: painelAtivo.marcosTotal, etapaNome,
    xpSemana,
    estudoHoras: fmtHoras(estudoSegTotal),
    estudoSemana: fmtHoras(estudoSegSemana),
    missoesFeitas: painelAtivo.marcosFeitos,
    missoesTotal: painelAtivo.marcosTotal,
    anotacoes: anotacoes ?? 0,
    heatmap,
    diasEstudados,
    diasJanela: JANELA,
    sequenciaAtual: streakDados?.sequencia_atual ?? 0,
    recorde: streakDados?.recorde ?? 0,
    diasFortes,
    ritmoSubiu,
    insignias: (insigniasRaw ?? []).map((i: any) => ({
      nome: i.nome, descricao: i.descricao, icone: i.icone,
      conquistada: i.conquistada_em != null, quando_rotulo: i.quando_rotulo,
    })),
    certificados: (certsRaw ?? []).map((c: any) => ({
      numero: c.numero, curso_titulo: c.curso_titulo, curso_slug: c.curso_slug,
      emitido: c.emitido_em != null, emitido_rotulo: c.emitido_rotulo,
      nota: c.nota, carga_horas: c.carga_horas,
      progresso_pct: c.progresso_pct, faltam_txt: c.faltam_txt,
    })),
    atividades,
    proximoNivel: proximoNivelRaw ? {
      ordem: proximoNivelRaw.ordem,
      nome: proximoNivelRaw.nome,
      seloUrl: proximoNivelRaw.selo_url ?? null,
      xpAtual: proximoNivelRaw.xp_atual,
      xpNecessario: proximoNivelRaw.xp_necessario,
      xpCumprido: proximoNivelRaw.xp_cumprido,
      requisitos: (proximoNivelRaw.requisitos ?? []) as RequisitoProximoNivel[],
    } : null,
  }
}

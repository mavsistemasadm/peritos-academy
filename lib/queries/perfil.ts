// lib/queries/perfil.ts
// Carrega o perfil e COMPUTA constância: heatmap, sequência,
// recorde e dias fortes saem dos registros reais de estudo.
import { criarClienteServidor } from '@/lib/supabase/server'

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
  tipo: 'aula' | 'comunidade' | 'caso' | 'anotacao' | 'ranking'
  prefixo: string | null
  destaque: string | null
  sufixo: string | null
  xp: number | null
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

const DIA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const fmtMesAno = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })

function chaveDia(d: Date) {
  return d.toISOString().slice(0, 10)
}
function fmtHoras(seg: number) {
  const h = Math.floor(seg / 3600), m = Math.round((seg % 3600) / 60)
  return m ? `${h}h ${String(m).padStart(2, '0')}` : `${h}h`
}

export async function carregarPerfil(): Promise<DadosPerfil | null> {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return null

  const [
    { data: perfil },
    { data: dias },
    { data: insigniasRaw },
    { data: certsRaw },
    { data: atividadesRaw },
    { count: anotacoes },
    { data: emailPref },
    { data: niveis },
    { data: statusProximoNivel },
  ] = await Promise.all([
    supabase.from('perfis').select('*').eq('id', auth.user.id).single(),
    supabase.from('perfil_estudo_dias').select('dia, nivel'),
    supabase.from('perfil_insignias').select('*').order('ordem'),
    supabase.from('certificados').select('*').order('ordem'),
    supabase.from('perfil_atividades').select('*').order('quando', { ascending: false }).limit(8),
    supabase.from('aula_anotacoes').select('id', { count: 'exact', head: true }),
    supabase.from('email_preferencias').select('receber_emails').eq('usuario_id', auth.user.id).maybeSingle(),
    supabase.from('gamificacao_niveis').select('ordem, nome, pontos_minimos').order('ordem'),
    supabase.rpc('gam_status_proximo_nivel'),
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

  const JANELA = 112
  const porDia = new Map<string, number>()
  for (const d of dias ?? []) porDia.set(d.dia, d.nivel)

  const hoje = new Date(); hoje.setHours(12, 0, 0, 0)
  const heatmap: number[] = []
  let diasEstudados = 0
  const porDow = [0, 0, 0, 0, 0, 0, 0]
  let estudou28 = 0, estudouAntes = 0

  for (let i = JANELA - 1; i >= 0; i--) {
    const d = new Date(hoje); d.setDate(d.getDate() - i)
    const nivel = porDia.get(chaveDia(d)) ?? 0
    heatmap.push(nivel)
    if (nivel > 0) {
      diasEstudados++
      porDow[d.getDay()]++
      if (i < 28) estudou28++; else estudouAntes++
    }
  }

  let sequenciaAtual = 0
  for (let i = heatmap.length - 1; i >= 0; i--) {
    if (heatmap[i] > 0) sequenciaAtual++
    else if (i === heatmap.length - 1) continue
    else break
  }
  let recorde = 0, corrente = 0
  for (const n of heatmap) {
    corrente = n > 0 ? corrente + 1 : 0
    if (corrente > recorde) recorde = corrente
  }

  const ordenados = porDow.map((qtd, dow) => ({ dow, qtd })).sort((a, b) => b.qtd - a.qtd)
  const fortes = ordenados.slice(0, 2).filter(x => x.qtd > 0).map(x => DIA_SEMANA[x.dow])
  const diasFortes = fortes.length === 2
    ? `${fortes[0].charAt(0).toUpperCase() + fortes[0].slice(1)} e ${fortes[1]} são seus dias fortes.`
    : fortes.length === 1
      ? `${fortes[0].charAt(0).toUpperCase() + fortes[0].slice(1)} é seu dia forte.`
      : 'Comece a estudar para descobrir seus dias fortes.'

  const ritmoSubiu = estudou28 / 28 > estudouAntes / (JANELA - 28)

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
    iniciouRotulo: perfil.iniciou_em ? fmtMesAno.format(new Date(perfil.iniciou_em + 'T12:00:00')) : '—',
    etapa: perfil.etapa ?? 1,
    etapaTotal: perfil.etapa_total ?? 5,
    etapaNome: perfil.etapa_nome ?? '',
    xpSemana: perfil.xp_semana ?? 0,
    estudoHoras: fmtHoras(perfil.estudo_seg ?? 0),
    estudoSemana: fmtHoras(perfil.estudo_semana_seg ?? 0),
    missoesFeitas: perfil.missoes_feitas ?? 0,
    missoesTotal: perfil.missoes_total ?? 21,
    anotacoes: anotacoes ?? 0,
    heatmap,
    diasEstudados,
    diasJanela: JANELA,
    sequenciaAtual,
    recorde,
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
    atividades: (atividadesRaw ?? []) as Atividade[],
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
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

export type DadosPerfil = {
  nome: string
  titulo: string
  nivel: number
  xp: number
  xpProximoNivel: number
  progressoPct: number          // barra do hero
  iniciouRotulo: string         // "março de 2026"
  etapa: number
  etapaTotal: number
  etapaNome: string
  // números
  xpSemana: number
  estudoHoras: string           // "41h"
  estudoSemana: string          // "3h 40"
  missoesFeitas: number
  missoesTotal: number
  rankingPos: number | null
  rankingVar: number | null
  anotacoes: number
  // constância (tudo computado)
  heatmap: number[]             // 112 células, 0..4, da mais antiga à mais nova
  diasEstudados: number
  diasJanela: number
  sequenciaAtual: number
  recorde: number
  diasFortes: string            // "Terça e quinta são seus dias fortes."
  ritmoSubiu: boolean
  // listas
  insignias: Insignia[]
  certificados: Certificado[]
  atividades: Atividade[]
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
    { data: rankingVoce },
    { count: anotacoes },
  ] = await Promise.all([
    supabase.from('perfis').select('*').eq('id', auth.user.id).single(),
    supabase.from('perfil_estudo_dias').select('dia, nivel'),
    supabase.from('perfil_insignias').select('*').order('ordem'),
    supabase.from('certificados').select('*').order('ordem'),
    supabase.from('perfil_atividades').select('*').order('quando', { ascending: false }).limit(8),
    supabase.from('comunidade_ranking').select('posicao, variacao').eq('eh_voce', true).maybeSingle(),
    supabase.from('aula_anotacoes').select('id', { count: 'exact', head: true }),
  ])
  if (!perfil) return null

  // ---------- constância: computada dos dias reais ----------
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

  // sequência atual (termina hoje ou ontem) e recorde na janela
  let sequenciaAtual = 0
  for (let i = heatmap.length - 1; i >= 0; i--) {
    if (heatmap[i] > 0) sequenciaAtual++
    else if (i === heatmap.length - 1) continue // hoje ainda sem estudo não quebra
    else break
  }
  let recorde = 0, corrente = 0
  for (const n of heatmap) {
    corrente = n > 0 ? corrente + 1 : 0
    if (corrente > recorde) recorde = corrente
  }

  // dias fortes: os 2 dias da semana com mais estudo
  const ordenados = porDow.map((qtd, dow) => ({ dow, qtd })).sort((a, b) => b.qtd - a.qtd)
  const fortes = ordenados.slice(0, 2).filter(x => x.qtd > 0).map(x => DIA_SEMANA[x.dow])
  const diasFortes = fortes.length === 2
    ? `${fortes[0].charAt(0).toUpperCase() + fortes[0].slice(1)} e ${fortes[1]} são seus dias fortes.`
    : fortes.length === 1
      ? `${fortes[0].charAt(0).toUpperCase() + fortes[0].slice(1)} é seu dia forte.`
      : 'Comece a estudar para descobrir seus dias fortes.'

  const ritmoSubiu = estudou28 / 28 > estudouAntes / (JANELA - 28)

  // ---------- montagem ----------
  const progressoPct = Math.min(100, Math.round(
    perfil.xp_proximo_nivel > 0 ? (perfil.xp / perfil.xp_proximo_nivel) * 100 : 0
  ))

  return {
    nome: perfil.nome ?? 'Perito',
    titulo: perfil.titulo ?? 'Perito Iniciante',
    nivel: perfil.nivel ?? 1,
    xp: perfil.xp ?? 0,
    xpProximoNivel: perfil.xp_proximo_nivel ?? 100,
    progressoPct,
    iniciouRotulo: perfil.iniciou_em ? fmtMesAno.format(new Date(perfil.iniciou_em + 'T12:00:00')) : '—',
    etapa: perfil.etapa ?? 1,
    etapaTotal: perfil.etapa_total ?? 5,
    etapaNome: perfil.etapa_nome ?? '',
    xpSemana: perfil.xp_semana ?? 0,
    estudoHoras: fmtHoras(perfil.estudo_seg ?? 0),
    estudoSemana: fmtHoras(perfil.estudo_semana_seg ?? 0),
    missoesFeitas: perfil.missoes_feitas ?? 0,
    missoesTotal: perfil.missoes_total ?? 21,
    rankingPos: rankingVoce?.posicao ?? null,
    rankingVar: rankingVoce?.variacao ?? null,
    anotacoes: anotacoes ?? 0,
    heatmap,
    diasEstudados,
    diasJanela: JANELA,
    sequenciaAtual,
    recorde,
    diasFortes,
    ritmoSubiu,
    insignias: (insigniasRaw ?? []).map(i => ({
      nome: i.nome, descricao: i.descricao, icone: i.icone,
      conquistada: i.conquistada_em != null, quando_rotulo: i.quando_rotulo,
    })),
    certificados: (certsRaw ?? []).map(c => ({
      numero: c.numero, curso_titulo: c.curso_titulo, curso_slug: c.curso_slug,
      emitido: c.emitido_em != null, emitido_rotulo: c.emitido_rotulo,
      nota: c.nota, carga_horas: c.carga_horas,
      progresso_pct: c.progresso_pct, faltam_txt: c.faltam_txt,
    })),
    atividades: (atividadesRaw ?? []) as Atividade[],
  }
}
// lib/queries/jornada.ts
// Carrega a jornada: o estado de cada etapa (feita/atual/travada)
// deriva do perfil — avançou de etapa, o mapa reorganiza sozinho.
import { criarClienteServidor } from '@/lib/supabase/server'

export type Missao = {
  titulo: string
  curso_slug: string | null
  progresso_pct: number
  nota: number | null      // não-nula = concluída
  info: string | null      // "11 aulas · 3h 05min"
}

export type Etapa = {
  numero: number
  nome: string
  descricao: string
  estado: 'feita' | 'atual' | 'travada'
  missoes_feitas: number
  missoes_total: number
  recompensa_nome: string | null
  recompensa_xp: number | null
  concluida_rotulo: string | null
  trava_txt: string | null   // computado da etapa anterior
  missoes: Missao[]
}

export type Trilha = {
  nome: string
  slug: string | null
  descricao: string
  missoes_qtd: number
  horas: number
  alunos: number
}

export type DadosJornada = {
  usuarioNome: string | null
  nivel: number
  xp: number
  titulo: string
  etapaAtual: number
  etapaTotal: number
  missoesEtapaFeitas: number
  missoesEtapaTotal: number
  missoesJornadaFeitas: number
  missoesJornadaTotal: number
  ritmoSemanas: number
  etapas: Etapa[]
  trilhas: Trilha[]
}

export async function carregarJornada(): Promise<DadosJornada> {
  const supabase = await criarClienteServidor()

  const [{ data: etapasRaw }, { data: missoesRaw }, { data: trilhasRaw }, { data: auth }] =
    await Promise.all([
      supabase.from('jornada_etapas').select('*').order('numero'),
      supabase.from('jornada_missoes').select('*').order('ordem'),
      supabase.from('trilhas').select('*').order('ordem'),
      supabase.auth.getUser(),
    ])

  // perfil (nav + hero); sem login, cai em padrões neutros
  let perfil: any = null
  if (auth?.user) {
    const { data } = await supabase.from('perfis').select('*').eq('id', auth.user.id).single()
    perfil = data
  }
  const etapaAtual = perfil?.etapa ?? 1

  const porEtapa = new Map<string, Missao[]>()
  for (const m of missoesRaw ?? []) {
    if (!porEtapa.has(m.etapa_id)) porEtapa.set(m.etapa_id, [])
    porEtapa.get(m.etapa_id)!.push({
      titulo: m.titulo, curso_slug: m.curso_slug,
      progresso_pct: m.progresso_pct, nota: m.nota, info: m.info,
    })
  }

  const brutas = etapasRaw ?? []
  const etapas: Etapa[] = brutas.map(e => {
    const estado: Etapa['estado'] =
      e.numero < etapaAtual ? 'feita' : e.numero === etapaAtual ? 'atual' : 'travada'

    // texto da trava: olha a etapa imediatamente anterior
    let trava_txt: string | null = null
    if (estado === 'travada') {
      const anterior = brutas.find(x => x.numero === e.numero - 1)
      if (anterior && anterior.numero === etapaAtual) {
        const faltam = anterior.missoes_total - anterior.missoes_feitas
        trava_txt = `Destrava ao concluir as ${anterior.missoes_total} missões da Etapa ${String(anterior.numero).padStart(2, '0')} — faltam ${faltam}`
      } else if (anterior) {
        trava_txt = `Destrava ao concluir a Etapa ${String(anterior.numero).padStart(2, '0')}`
      }
    }

    return {
      numero: e.numero, nome: e.nome, descricao: e.descricao,
      estado,
      missoes_feitas: e.missoes_feitas, missoes_total: e.missoes_total,
      recompensa_nome: e.recompensa_nome, recompensa_xp: e.recompensa_xp,
      concluida_rotulo: e.concluida_rotulo,
      trava_txt,
      missoes: porEtapa.get(e.id) ?? [],
    }
  })

  const daAtual = etapas.find(e => e.estado === 'atual')

  return {
    usuarioNome: perfil?.nome ?? null,
    nivel: perfil?.nivel ?? 1,
    xp: perfil?.xp ?? 0,
    titulo: perfil?.titulo ?? 'Perito Iniciante',
    etapaAtual,
    etapaTotal: perfil?.etapa_total ?? 5,
    missoesEtapaFeitas: daAtual?.missoes_feitas ?? 0,
    missoesEtapaTotal: daAtual?.missoes_total ?? 0,
    missoesJornadaFeitas: perfil?.missoes_feitas ?? etapas.reduce((s, e) => s + e.missoes_feitas, 0),
    missoesJornadaTotal: perfil?.missoes_total ?? etapas.reduce((s, e) => s + e.missoes_total, 0),
    ritmoSemanas: perfil?.ritmo_semanas ?? 9,
    etapas,
    trilhas: (trilhasRaw ?? []).map(t => ({
      nome: t.nome, slug: t.slug, descricao: t.descricao,
      missoes_qtd: t.missoes_qtd, horas: t.horas, alunos: t.alunos,
    })),
  }
}
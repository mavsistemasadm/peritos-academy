// lib/queries/admin-gamificacao.ts
import { criarClienteServidor } from '@/lib/supabase/server'

export type ConfigGamificacao = {
  gamificacaoAtiva: boolean
  gatilhosAtivos: boolean
  rankingAtivo: boolean
  lojaAtiva: boolean
  niveisAtivos: boolean
  exibirPontuacaoPerfil: boolean
  exibirNivelPreviaPerfil: boolean
  xpSingular: string
  xpPlural: string
  xpAbreviacao: string
  moedaSingular: string
  moedaPlural: string
  moedaAbreviacao: string
  moedaCor: string | null
  moedaIcone: string | null
  textoComoAcumular: string | null
  avaliacaoXpBase: number
  bonusCursoConcluido: number
  tetoEngajamentoDiario: number
  moedaACadaXp: number | null
  xpTetoCalculado: number | null
  xpTetoCalculadoEm: string | null
  gatilhosPendentesAgendamento: string[]
}

export type CategoriaGatilho = 'comum' | 'quiz' | 'marco' | 'especial'

export type GatilhoAdmin = {
  codigo: string
  nome: string
  descricao: string | null
  pontos: number
  moedas: number
  limiteDiario: number | null
  ativo: boolean
  categoria: CategoriaGatilho
  contaTetoEngajamento: boolean
}

export type NivelAdmin = {
  id: string
  nome: string
  pontosMinimos: number
  seloUrl: string | null
  ordem: number
  aulasConcluidas: number | null
  cursosCompletos: number | null
  avaliacoesAprovadas: number | null
  desafiosCompletos: number | null
  streakMarcoDias: number | null
  participacoesComunidade: number | null
}

export async function carregarConfigGamificacao(): Promise<ConfigGamificacao> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('config_gamificacao').select('*').eq('id', 1).single()

  return {
    gamificacaoAtiva: data?.gamificacao_ativa ?? true,
    gatilhosAtivos: data?.gatilhos_ativos ?? true,
    rankingAtivo: data?.ranking_ativo ?? true,
    lojaAtiva: data?.loja_ativa ?? false,
    niveisAtivos: data?.niveis_ativos ?? true,
    exibirPontuacaoPerfil: data?.exibir_pontuacao_perfil ?? true,
    exibirNivelPreviaPerfil: data?.exibir_nivel_previa_perfil ?? true,
    xpSingular: data?.xp_singular ?? 'Ponto de Experiência',
    xpPlural: data?.xp_plural ?? 'Pontos de Experiência',
    xpAbreviacao: data?.xp_abreviacao ?? 'XP',
    moedaSingular: data?.moeda_singular ?? 'Moeda',
    moedaPlural: data?.moeda_plural ?? 'Moedas',
    moedaAbreviacao: data?.moeda_abreviacao ?? 'moedas',
    moedaCor: data?.moeda_cor ?? null,
    moedaIcone: data?.moeda_icone ?? null,
    textoComoAcumular: data?.texto_como_acumular ?? null,
    avaliacaoXpBase: data?.avaliacao_xp_base ?? 200,
    bonusCursoConcluido: data?.bonus_curso_concluido ?? 100,
    tetoEngajamentoDiario: data?.teto_engajamento_diario ?? 60,
    moedaACadaXp: data?.moeda_a_cada_xp ?? null,
    xpTetoCalculado: data?.xp_teto_calculado ?? null,
    xpTetoCalculadoEm: data?.xp_teto_calculado_em ?? null,
    gatilhosPendentesAgendamento: data?.gatilhos_pendentes_agendamento ?? [],
  }
}

const ORDEM_CATEGORIA: Record<CategoriaGatilho, number> = { comum: 1, marco: 2, quiz: 3, especial: 4 }

export async function carregarGatilhosAdmin(): Promise<GatilhoAdmin[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('gamificacao_gatilhos').select('*').order('nome')
  if (!data) return []

  return data
    .map(g => ({
      codigo: g.codigo, nome: g.nome, descricao: g.descricao, pontos: g.pontos, moedas: g.moedas,
      limiteDiario: g.limite_diario, ativo: g.ativo, categoria: g.categoria as CategoriaGatilho,
      contaTetoEngajamento: g.conta_teto_engajamento ?? false,
    }))
    .sort((a, b) => ORDEM_CATEGORIA[a.categoria] - ORDEM_CATEGORIA[b.categoria] || a.nome.localeCompare(b.nome))
}

export async function carregarNiveisAdmin(): Promise<NivelAdmin[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('gamificacao_niveis').select('*').order('ordem')
  return (data ?? []).map(n => ({
    id: n.id, nome: n.nome, pontosMinimos: n.pontos_minimos, seloUrl: n.selo_url, ordem: n.ordem,
    aulasConcluidas: n.aulas_concluidas, cursosCompletos: n.cursos_completos,
    avaliacoesAprovadas: n.avaliacoes_aprovadas, desafiosCompletos: n.desafios_completos,
    streakMarcoDias: n.streak_marco_dias, participacoesComunidade: n.participacoes_comunidade,
  }))
}

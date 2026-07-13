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
}

export type NivelAdmin = {
  id: string
  nome: string
  pontosMinimos: number
  seloUrl: string | null
  ordem: number
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
    }))
    .sort((a, b) => ORDEM_CATEGORIA[a.categoria] - ORDEM_CATEGORIA[b.categoria] || a.nome.localeCompare(b.nome))
}

export async function carregarNiveisAdmin(): Promise<NivelAdmin[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('gamificacao_niveis').select('*').order('ordem')
  return (data ?? []).map(n => ({
    id: n.id, nome: n.nome, pontosMinimos: n.pontos_minimos, seloUrl: n.selo_url, ordem: n.ordem,
  }))
}

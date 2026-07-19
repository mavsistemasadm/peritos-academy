// lib/queries/gamificacao-jornada.ts
// Dados ao vivo pra /gamificacao ("Como funciona a jornada"). Nada aqui é
// hardcoded — os 10 níveis, os requisitos compostos e a tabela de XP vêm
// direto de gamificacao_niveis/gamificacao_gatilhos/config_gamificacao, pra
// nunca ficar defasado quando o admin recalibrar a curva ou os gatilhos.
import { criarClienteServidor } from '@/lib/supabase/server'
import { NIVEL_IMG } from '@/lib/queries/guia'

export type RequisitoNivel = {
  aulasConcluidas: number | null
  cursosCompletos: number | null
  avaliacoesAprovadas: number | null
  desafiosCompletos: number | null
  streakMarcoDias: number | null
  participacoesComunidade: number | null
}

export type NivelJornada = {
  ordem: number
  nome: string
  pontosMinimos: number
  imgUrl: string
  requisito: RequisitoNivel
}

export type GatilhoJornada = {
  codigo: string
  nome: string
  descricao: string | null
  pontos: number
  moedas: number
  limiteDiario: number | null
  categoria: string
}

export type DadosGamificacaoJornada = {
  xpSingular: string
  xpPlural: string
  xpAbreviacao: string
  moedaPlural: string
  avaliacaoXpBase: number
  bonusCursoConcluido: number
  tetoEngajamentoDiario: number
  niveis: NivelJornada[]
  gatilhos: GatilhoJornada[]
}

export async function carregarGamificacaoJornada(): Promise<DadosGamificacaoJornada> {
  const supabase = await criarClienteServidor()

  const [{ data: config }, { data: niveisRaw }, { data: gatilhosRaw }] = await Promise.all([
    supabase.from('config_gamificacao').select('*').eq('id', 1).single(),
    supabase.from('gamificacao_niveis').select('*').order('ordem', { ascending: true }),
    supabase.from('gamificacao_gatilhos').select('*').eq('ativo', true).order('categoria').order('nome'),
  ])

  return {
    xpSingular: config?.xp_singular ?? 'Ponto de Experiência',
    xpPlural: config?.xp_plural ?? 'Pontos de Experiência',
    xpAbreviacao: config?.xp_abreviacao ?? 'XP',
    moedaPlural: config?.moeda_plural ?? 'Moedas',
    avaliacaoXpBase: config?.avaliacao_xp_base ?? 200,
    bonusCursoConcluido: config?.bonus_curso_concluido ?? 100,
    tetoEngajamentoDiario: config?.teto_engajamento_diario ?? 60,
    niveis: (niveisRaw ?? []).map(n => ({
      ordem: n.ordem,
      nome: n.nome,
      pontosMinimos: n.pontos_minimos,
      imgUrl: n.selo_url || NIVEL_IMG[n.ordem] || NIVEL_IMG[1],
      requisito: {
        aulasConcluidas: n.aulas_concluidas,
        cursosCompletos: n.cursos_completos,
        avaliacoesAprovadas: n.avaliacoes_aprovadas,
        desafiosCompletos: n.desafios_completos,
        streakMarcoDias: n.streak_marco_dias,
        participacoesComunidade: n.participacoes_comunidade,
      },
    })),
    gatilhos: (gatilhosRaw ?? [])
      .filter(g => g.categoria !== 'quiz' || g.codigo === 'avaliacao_aprovada')
      .map(g => ({
        codigo: g.codigo, nome: g.nome, descricao: g.descricao,
        pontos: g.pontos, moedas: g.moedas, limiteDiario: g.limite_diario, categoria: g.categoria,
      })),
  }
}

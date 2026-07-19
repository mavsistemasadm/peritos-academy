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
  pontosLabel: string
  moedasLabel: string
  limiteDiario: number | null
  categoria: string
  pendente: boolean // ativo=true no catálogo, mas sem mecanismo de disparo ligado ainda
}

// Gatilhos cujo crédito real não é o valor fixo de gamificacao_gatilhos.pontos
// (a RPC credita um p_pontos_override dinâmico) — pra esses, o rótulo exibido
// vem de dados reais, nunca do valor estático da tabela.
const CODIGOS_DINAMICOS = new Set(['concluir_aula', 'concluir_etapa', 'concluir_curso', 'entregar_desafio', 'avaliacao_aprovada'])

// ajuste_admin é ferramenta interna do admin (nunca uma ação do aluno) —
// esse sim some da tabela. Gatilhos "pendentes de agendamento" (sem cron
// ligado, ver config.gatilhos_pendentes_agendamento) continuam visíveis,
// só sem prometer um valor de XP que não seria creditado de verdade hoje.
const CODIGOS_OCULTOS = new Set(['ajuste_admin'])

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

  const [{ data: config }, { data: niveisRaw }, { data: gatilhosRaw }, { data: cursosPublicados }, { data: etapasXp }, { count: desafiosPublicados }] = await Promise.all([
    supabase.from('config_gamificacao').select('*').eq('id', 1).single(),
    supabase.from('gamificacao_niveis').select('*').order('ordem', { ascending: true }),
    supabase.from('gamificacao_gatilhos').select('*').eq('ativo', true).order('categoria').order('nome'),
    supabase.from('cursos').select('id').eq('publicado', true),
    supabase.from('etapas').select('xp_conclusao').gt('xp_conclusao', 0),
    supabase.from('desafios').select('id', { count: 'exact', head: true }).eq('publicado', true),
  ])

  // valor real creditado por concluir_aula (dinâmico, aulas.xp) — busca só
  // pra montar o rótulo correto na tabela, nunca o valor estático do gatilho.
  const idsCursosPublicados = (cursosPublicados ?? []).map(c => c.id)
  const { data: modulosPublicados } = idsCursosPublicados.length
    ? await supabase.from('modulos').select('id').in('curso_id', idsCursosPublicados)
    : { data: [] as { id: string }[] }
  const idsModulosPublicados = (modulosPublicados ?? []).map(m => m.id)
  const { data: aulasXp } = idsModulosPublicados.length
    ? await supabase.from('aulas').select('xp').in('modulo_id', idsModulosPublicados).gt('xp', 0)
    : { data: [] as { xp: number }[] }

  const aulaXpValores = (aulasXp ?? []).map(a => a.xp as number)
  const aulaXpMin = aulaXpValores.length ? Math.min(...aulaXpValores) : null
  const aulaXpMax = aulaXpValores.length ? Math.max(...aulaXpValores) : null
  const rotuloAulaXp = aulaXpMin === null ? 'varia por aula'
    : aulaXpMin === aulaXpMax ? `${aulaXpMin} XP`
    : `${aulaXpMin} a ${aulaXpMax} XP`

  const etapaXpValores = (etapasXp ?? []).map(e => e.xp_conclusao as number)
  const etapaXpMin = etapaXpValores.length ? Math.min(...etapaXpValores) : null
  const etapaXpMax = etapaXpValores.length ? Math.max(...etapaXpValores) : null
  const rotuloEtapaXp = etapaXpMin === null ? 'varia por etapa'
    : etapaXpMin === etapaXpMax ? `${etapaXpMin} XP`
    : `${etapaXpMin} a ${etapaXpMax} XP`

  const bonusCurso = config?.bonus_curso_concluido ?? 100
  const avaliacaoXpBase = config?.avaliacao_xp_base ?? 200
  const codigosPendentes = new Set<string>(config?.gatilhos_pendentes_agendamento ?? [])

  const rotuloPorCodigoDinamico: Record<string, string> = {
    concluir_aula: rotuloAulaXp,
    concluir_etapa: rotuloEtapaXp,
    concluir_curso: `${bonusCurso} XP de bônus`,
    entregar_desafio: (desafiosPublicados ?? 0) > 0 ? 'varia por desafio' : 'varia por desafio (nenhum publicado ainda)',
    avaliacao_aprovada: `até ${avaliacaoXpBase} XP`,
  }

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
      .filter(g => (g.categoria !== 'quiz' || g.codigo === 'avaliacao_aprovada') && !CODIGOS_OCULTOS.has(g.codigo))
      .map(g => {
        const pendente = codigosPendentes.has(g.codigo)
        return {
          codigo: g.codigo, nome: g.nome, descricao: g.descricao,
          pontosLabel: pendente ? 'em breve' : (CODIGOS_DINAMICOS.has(g.codigo) ? rotuloPorCodigoDinamico[g.codigo] : `${g.pontos} XP`),
          moedasLabel: pendente ? 'em breve' : (g.moedas > 0 ? `${g.moedas}` : '0'),
          limiteDiario: g.limite_diario, categoria: g.categoria,
          pendente,
        }
      }),
  }
}

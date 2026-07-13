// lib/queries/admin-financeiro.ts
import { criarClienteServidor } from '@/lib/supabase/server'

export type Periodicidade = 'mensal' | 'anual'
export type StatusAssinatura = 'ativa' | 'inadimplente' | 'suspensa' | 'cancelada' | 'cortesia'
export type StatusCobranca = 'pendente' | 'confirmada' | 'vencida' | 'estornada'

export type PlanoAdmin = {
  id: string
  nome: string
  descricao: string | null
  valorCentavos: number
  periodicidade: Periodicidade
  asaasPlanId: string | null
  ativo: boolean
  criadoEm: string
}

export type CobrancaAdmin = {
  id: string
  valorCentavos: number
  status: StatusCobranca
  metodo: string | null
  vencimento: string
  pagoEm: string | null
  asaasPaymentId: string | null
  observacao: string | null
  criadoEm: string
}

export type AssinaturaAdmin = {
  id: string
  usuarioId: string
  usuarioNome: string
  planoId: string
  planoNome: string
  status: StatusAssinatura
  asaasSubscriptionId: string | null
  iniciadaEm: string
  proximaCobranca: string | null
  canceladaEm: string | null
  observacao: string | null
  cobrancas: CobrancaAdmin[]
}

export type PainelFinanceiro = {
  mrrCentavos: number
  assinantesAtivos: number
  inadimplentes: number
  cortesias: number
  faturamentoMesCentavos: number
  receitaPorMes: { mes: string; valorCentavos: number }[]
  diasCarencia: number
}

export type WebhookEventoAdmin = {
  id: string
  origem: string
  tipo: string | null
  processado: boolean
  erro: string | null
  recebidoEm: string
  payload: unknown
}

function mapCobranca(c: any): CobrancaAdmin {
  return {
    id: c.id, valorCentavos: c.valor_centavos, status: c.status, metodo: c.metodo,
    vencimento: c.vencimento, pagoEm: c.pago_em, asaasPaymentId: c.asaas_payment_id,
    observacao: c.observacao, criadoEm: c.criado_em,
  }
}

export async function carregarPlanosAdmin(): Promise<PlanoAdmin[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('planos_assinatura').select('*').order('valor_centavos')
  return (data ?? []).map(p => ({
    id: p.id, nome: p.nome, descricao: p.descricao, valorCentavos: p.valor_centavos,
    periodicidade: p.periodicidade, asaasPlanId: p.asaas_plan_id, ativo: p.ativo, criadoEm: p.criado_em,
  }))
}

export async function carregarAssinaturasAdmin(): Promise<AssinaturaAdmin[]> {
  const supabase = await criarClienteServidor()
  const { data: assinaturas } = await supabase
    .from('assinaturas')
    .select('*, perfis(nome), planos_assinatura(nome)')
    .order('iniciada_em', { ascending: false })

  if (!assinaturas || assinaturas.length === 0) return []

  const ids = assinaturas.map(a => a.id)
  const { data: cobrancas } = await supabase
    .from('cobrancas')
    .select('*')
    .in('assinatura_id', ids)
    .order('vencimento', { ascending: false })

  return assinaturas.map((a: any) => ({
    id: a.id,
    usuarioId: a.usuario_id,
    usuarioNome: a.perfis?.nome ?? '—',
    planoId: a.plano_id,
    planoNome: a.planos_assinatura?.nome ?? '—',
    status: a.status,
    asaasSubscriptionId: a.asaas_subscription_id,
    iniciadaEm: a.iniciada_em,
    proximaCobranca: a.proxima_cobranca,
    canceladaEm: a.cancelada_em,
    observacao: a.observacao,
    cobrancas: (cobrancas ?? []).filter((c: any) => c.assinatura_id === a.id).map(mapCobranca),
  }))
}

export async function carregarWebhooksAdmin(): Promise<WebhookEventoAdmin[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('webhook_eventos')
    .select('*')
    .order('recebido_em', { ascending: false })
    .limit(50)

  return (data ?? []).map(w => ({
    id: w.id, origem: w.origem, tipo: w.tipo, processado: w.processado, erro: w.erro,
    recebidoEm: w.recebido_em, payload: w.payload,
  }))
}

export async function carregarPainelFinanceiro(): Promise<PainelFinanceiro> {
  const supabase = await criarClienteServidor()

  const [{ data: assinaturas }, { data: cobrancas }, { data: config }] = await Promise.all([
    supabase.from('assinaturas').select('status, planos_assinatura(valor_centavos, periodicidade)'),
    supabase.from('cobrancas').select('valor_centavos, status, pago_em'),
    supabase.from('config_financeiro').select('dias_carencia').eq('id', 1).single(),
  ])

  const lista = assinaturas ?? []
  const ativas = lista.filter(a => a.status === 'ativa')
  const inadimplentes = lista.filter(a => a.status === 'inadimplente').length
  const cortesias = lista.filter(a => a.status === 'cortesia').length

  const mrrCentavos = ativas.reduce((soma, a: any) => {
    const plano = a.planos_assinatura
    if (!plano) return soma
    const mensal = plano.periodicidade === 'anual' ? Math.round(plano.valor_centavos / 12) : plano.valor_centavos
    return soma + mensal
  }, 0)

  const hoje = new Date()
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)

  const confirmadas = (cobrancas ?? []).filter(c => c.status === 'confirmada' && c.pago_em)

  const faturamentoMesCentavos = confirmadas
    .filter(c => new Date(c.pago_em as string) >= inicioMes)
    .reduce((soma, c) => soma + c.valor_centavos, 0)

  const receitaPorMesMap = new Map<string, number>()
  for (const c of confirmadas) {
    const d = new Date(c.pago_em as string)
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    receitaPorMesMap.set(chave, (receitaPorMesMap.get(chave) ?? 0) + c.valor_centavos)
  }
  const receitaPorMes = Array.from(receitaPorMesMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([mes, valorCentavos]) => ({ mes, valorCentavos }))

  return {
    mrrCentavos,
    assinantesAtivos: ativas.length,
    inadimplentes,
    cortesias,
    faturamentoMesCentavos,
    receitaPorMes,
    diasCarencia: config?.dias_carencia ?? 3,
  }
}

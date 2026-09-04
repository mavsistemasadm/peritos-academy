// lib/queries/admin-configuracoes.ts
import { criarClienteServidor } from '@/lib/supabase/server'

export { carregarConfigPlataforma } from '@/lib/queries/config-plataforma'
export type { ConfigPlataforma } from '@/lib/queries/config-plataforma'

export type IntegracaoStatus = {
  chave: string
  nome: string
  configurada: boolean
  onde: string
  docUrl: string
  info?: string
}

// Nunca retorna o valor da env — só se ela existe (boolean). Chamado
// server-side (page.tsx é Server Component); os booleans são os únicos
// dados que chegam ao client.
export function verificarIntegracoes(): IntegracaoStatus[] {
  return [
    {
      chave: 'supabase',
      nome: 'Supabase',
      configurada: !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      onde: 'Vercel → Project Settings → Environment Variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)',
      docUrl: 'https://supabase.com/docs/guides/getting-started',
    },
    {
      chave: 'asaas_webhook',
      nome: 'Asaas · validação de webhook',
      configurada: !!process.env.ASAAS_WEBHOOK_TOKEN,
      onde: 'Vercel → Environment Variables (ASAAS_WEBHOOK_TOKEN). Sem essa env, o webhook aceita qualquer chamada (ver CLAUDE.md, pendência)',
      docUrl: 'https://docs.asaas.com/docs/webhook',
    },
    {
      chave: 'asaas_api',
      nome: 'Asaas · API (criação de assinatura/cobrança)',
      configurada: !!process.env.ASAAS_API_KEY,
      onde: 'Vercel → Environment Variables (ASAAS_API_KEY). Integração real ainda não ligada',
      docUrl: 'https://docs.asaas.com/reference/comece-por-aqui',
    },
    {
      chave: 'panda_video',
      nome: 'Panda Video',
      configurada: true,
      info: 'Player embutido via iframe (player-vz-a94806ca-13a.tv.pandavideo.com.br). Não usa API key, nada a configurar aqui.',
      onde: '—',
      docUrl: 'https://pandavideo.com.br/',
    },
  ]
}

// ============================================================
// Sugestões do Nexus (aba própria em /admin/configuracoes)
// ============================================================
export type ConfigNexus = {
  linkGlobal: string
  linkFinanceiro: string
  linkOpera: string
  linkGalacticos: string
  linkPonto: string
  linkAcheUmPerito: string
  linkBiblioteca: string
  ativo: boolean
  ativoAula: boolean
  ativoConquista: boolean
  ativoSino: boolean
  ativoPerfil: boolean
  ativoBloqueio: boolean
  maxSinoPorSemana: number
  diasPausaDismissal: number
  dispensasParaPausar: number
}

export type MetricaNexus = {
  app: string
  exibidas: number
  clicadas: number
  dispensadas: number
  /** conversões atribuídas a este app (último clicado antes de assinar) */
  assinou: number
}

export async function carregarConfigNexus(): Promise<ConfigNexus> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('nexus_cta_config').select('*').eq('id', 1).maybeSingle()
  return {
    linkGlobal: data?.link_global ?? '',
    linkFinanceiro: data?.link_financeiro ?? '',
    linkOpera: data?.link_opera ?? '',
    linkGalacticos: data?.link_galacticos ?? '',
    linkPonto: data?.link_ponto ?? '',
    linkAcheUmPerito: data?.link_ache_um_perito ?? '',
    linkBiblioteca: data?.link_biblioteca ?? '',
    ativo: data?.ativo ?? true,
    ativoAula: data?.ativo_aula ?? true,
    ativoConquista: data?.ativo_conquista ?? true,
    ativoSino: data?.ativo_sino ?? true,
    ativoPerfil: data?.ativo_perfil ?? true,
    ativoBloqueio: data?.ativo_bloqueio ?? true,
    maxSinoPorSemana: data?.max_sino_por_semana ?? 1,
    diasPausaDismissal: data?.dias_pausa_dismissal ?? 30,
    dispensasParaPausar: data?.dispensas_para_pausar ?? 3,
  }
}

/**
 * Desempenho por app: exibições, cliques e dispensas. É o que responde
 * "qual dor desperta mais interesse" e "a frequência está incomodando?".
 */
export async function carregarMetricasNexus(): Promise<MetricaNexus[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('nexus_cta_interactions').select('app, acao')
  const mapa = new Map<string, MetricaNexus>()
  for (const i of data ?? []) {
    const m = mapa.get(i.app) ?? { app: i.app, exibidas: 0, clicadas: 0, dispensadas: 0, assinou: 0 }
    if (i.acao === 'exibida') m.exibidas++
    else if (i.acao === 'clicada') m.clicadas++
    else if (i.acao === 'dispensada') m.dispensadas++
    else if (i.acao === 'assinou') m.assinou++
    mapa.set(i.app, m)
  }
  return [...mapa.values()].sort((a, b) => b.exibidas - a.exibidas)
}

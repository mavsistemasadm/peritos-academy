// lib/nexus/servidor.ts
// Seleção das sugestões do Nexus no servidor. Toda a decisão de "mostrar ou
// não, e o quê" mora aqui — o componente só renderiza o que receber.
import { criarClienteServidor } from '@/lib/supabase/server'
import {
  filaDeApps,
  type AppNexus,
  type BloqueioNexus,
  type PlacementNexus,
  type SugestaoNexus,
} from '@/lib/nexus'

type Config = {
  ativo: boolean
  ativo_aula: boolean
  ativo_conquista: boolean
  ativo_sino: boolean
  ativo_perfil: boolean
  ativo_bloqueio: boolean
  link_global: string
  link_financeiro: string | null
  link_opera: string | null
  link_galacticos: string | null
  link_ponto: string | null
  link_ache_um_perito: string | null
  link_biblioteca: string | null
  max_sino_por_semana: number
  dias_pausa_dismissal: number
  dispensas_para_pausar: number
}

const CAMPO_ATIVO: Record<PlacementNexus, keyof Config> = {
  aula: 'ativo_aula',
  conquista: 'ativo_conquista',
  sino: 'ativo_sino',
  perfil: 'ativo_perfil',
  bloqueio: 'ativo_bloqueio',
}

const CAMPO_LINK: Record<AppNexus, keyof Config> = {
  financeiro: 'link_financeiro',
  opera: 'link_opera',
  galacticos: 'link_galacticos',
  ponto: 'link_ponto',
  ache_um_perito: 'link_ache_um_perito',
  biblioteca: 'link_biblioteca',
}

/** Link do app: override específico quando preenchido, senão o global. */
function resolverLink(config: Config, app: AppNexus): string {
  const especifico = config[CAMPO_LINK[app]]
  const valor = typeof especifico === 'string' ? especifico.trim() : ''
  return valor || config.link_global
}

/**
 * Escolhe a sugestão a exibir, ou null quando nada deve aparecer.
 *
 * Ordem das checagens (a primeira que barrar encerra):
 *  1. config: sugestões ligadas? este placement está ligado?
 *  2. aluno logado?
 *  3. assinante ativo do Nexus -> nunca mostra nada
 *  4. sino: respeita o teto semanal
 *  5. apps pausados por dispensas repetidas ficam de fora
 *  6. nunca repete o app mostrado na vez anterior
 *  7. escolhe uma variação de copy que o aluno ainda não viu
 *
 * NÃO registra a exibição: quem registra é o componente, quando de fato
 * renderiza (o cliente ainda pode suprimir por já ter mostrado algo nesta
 * sessão). Registrar aqui inflaria as métricas e queimaria variações que o
 * aluno nunca viu.
 */
export async function escolherSugestaoNexus(
  placement: PlacementNexus,
  contexto?: string | null
): Promise<SugestaoNexus | null> {
  const supabase = await criarClienteServidor()

  const { data: config } = await supabase
    .from('nexus_cta_config')
    .select('*')
    .eq('id', 1)
    .maybeSingle<Config>()
  if (!config || !config.ativo) return null
  if (config[CAMPO_ATIVO[placement]] !== true) return null

  const { data: auth } = await supabase.auth.getUser()
  const uid = auth?.user?.id
  if (!uid) return null

  const { data: perfil } = await supabase
    .from('perfis')
    .select('nexus_status')
    .eq('id', uid)
    .maybeSingle<{ nexus_status: string }>()
  // Assinante ativo não vê sugestão nenhuma, em nenhum lugar.
  if (perfil?.nexus_status === 'active') return null
  const publico = perfil?.nexus_status === 'cancelled' ? 'ex' : 'novo'

  // Histórico recente do aluno: serve pro teto do sino, pra pausa por
  // dispensas e pra não repetir app/variação. Uma leitura só.
  const desde = new Date(Date.now() - Math.max(config.dias_pausa_dismissal, 7) * 864e5).toISOString()
  const { data: interacoes } = await supabase
    .from('nexus_cta_interactions')
    .select('app, placement, copy_chave, acao, criado_em')
    .eq('usuario_id', uid)
    .gte('criado_em', desde)
    .order('criado_em', { ascending: false })
  const hist = interacoes ?? []

  // 4. teto semanal do sino
  if (placement === 'sino') {
    const seteDias = Date.now() - 7 * 864e5
    const noSino = hist.filter(
      (i) => i.placement === 'sino' && i.acao === 'exibida' && +new Date(i.criado_em) >= seteDias
    ).length
    if (noSino >= config.max_sino_por_semana) return null
  }

  // 5. apps pausados: N dispensas dentro da janela de pausa
  const limitePausa = Date.now() - config.dias_pausa_dismissal * 864e5
  const dispensasPorApp = new Map<string, number>()
  for (const i of hist) {
    if (i.acao !== 'dispensada') continue
    if (+new Date(i.criado_em) < limitePausa) continue
    dispensasPorApp.set(i.app, (dispensasPorApp.get(i.app) ?? 0) + 1)
  }
  const pausados = new Set(
    [...dispensasPorApp.entries()]
      .filter(([, n]) => n >= config.dispensas_para_pausar)
      .map(([app]) => app)
  )

  // 6. último app exibido (não repetir duas vezes seguidas)
  const ultimoApp = hist.find((i) => i.acao === 'exibida')?.app ?? null

  const fila = filaDeApps(contexto).filter((a) => !pausados.has(a))
  if (fila.length === 0) return null
  // só evita o último se houver alternativa — com uma opção só, mostrar de
  // novo é melhor que não mostrar nada
  const candidatos = fila.length > 1 ? fila.filter((a) => a !== ultimoApp) : fila
  const app = (candidatos[0] ?? fila[0]) as AppNexus

  // 7. variação ainda não vista para este app
  const { data: copies } = await supabase
    .from('nexus_cta_copies')
    .select('chave, titulo, corpo')
    .eq('app', app)
    .eq('publico', publico)
    .eq('ativo', true)
  if (!copies?.length) return null

  const jaVistas = new Set(
    hist.filter((i) => i.acao === 'exibida' && i.copy_chave).map((i) => i.copy_chave as string)
  )
  // Esgotou o pool? Recomeça do zero em vez de parar de sugerir — a regra é
  // "não repetir até esgotar", não "nunca repetir".
  const disponiveis = copies.filter((c) => !jaVistas.has(c.chave))
  const pool = disponiveis.length > 0 ? disponiveis : copies
  const escolhida = pool[Math.floor(Math.random() * pool.length)]

  return {
    app,
    chave: escolhida.chave,
    titulo: escolhida.titulo,
    corpo: escolhida.corpo,
    link: resolverLink(config, app),
  }
}

/**
 * Copy da tela de conteúdo bloqueado. Diferente das sugestões: não rotaciona,
 * não tem pool por aluno e não é suprimida por sessão nem por dispensa — é
 * informação sobre o que ele está tentando abrir. Só não aparece para quem já
 * assina (nada a sugerir) ou se o placement estiver desligado.
 *
 * `alvo` é o slug do curso, ou 'biblioteca'. Cai no texto padrão se não houver
 * copy específica.
 */
export async function carregarBloqueioNexus(alvo?: string | null): Promise<BloqueioNexus | null> {
  const supabase = await criarClienteServidor()

  const { data: config } = await supabase
    .from('nexus_cta_config')
    .select('*')
    .eq('id', 1)
    .maybeSingle<Config>()
  if (!config || !config.ativo || !config.ativo_bloqueio) return null

  const { data: auth } = await supabase.auth.getUser()
  if (auth?.user) {
    const { data: perfil } = await supabase
      .from('perfis')
      .select('nexus_status')
      .eq('id', auth.user.id)
      .maybeSingle<{ nexus_status: string }>()
    if (perfil?.nexus_status === 'active') return null
  }

  const chaves = alvo ? [alvo, '__padrao__'] : ['__padrao__']
  const { data: copies } = await supabase
    .from('nexus_cta_bloqueio')
    .select('alvo, corpo')
    .in('alvo', chaves)
    .eq('ativo', true)
  if (!copies?.length) return null

  // preferência pela copy específica do conteúdo; o padrão é o fallback
  const especifica = copies.find((c) => c.alvo !== '__padrao__')
  const corpo = (especifica ?? copies[0]).corpo

  return { corpo, link: config.link_global }
}

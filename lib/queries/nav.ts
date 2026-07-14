// lib/queries/nav.ts
// Dados do topo (nav) — independente da query principal de cada página.
// Qualquer página chama carregarNav() e passa pro <NavPlataforma>.
import { criarClienteServidor } from '@/lib/supabase/server'

export type DadosNav = {
  logado: boolean
  nome: string
  iniciais: string
  slug: string | null
  nivel: number
  titulo: string
  xp: number
  xpProximo: number
  progressoPct: number       // barra de nível
  faltaXp: number
  proximoNivelNome: string | null   // null = já está no nível máximo
  moedas: number
  sequenciaDias: number      // o foguinho
  isAdmin: boolean
  nomePlataforma: string
  logoUrl: string | null
  comunidadeAtiva: boolean
  desafiosAtivos: boolean
  agendaAtiva: boolean
  modoManutencao: boolean
}

const VAZIO: DadosNav = {
logado: false, nome: 'Visitante', iniciais: 'PA', slug: null,
  nivel: 0, titulo: 'Iniciante',
  xp: 0, xpProximo: 100, progressoPct: 0, faltaXp: 100, proximoNivelNome: null,
  moedas: 0, sequenciaDias: 0, isAdmin: false,
  nomePlataforma: 'Peritos Academy', logoUrl: null,
  comunidadeAtiva: true, desafiosAtivos: true, agendaAtiva: true, modoManutencao: false,
}

function iniciaisDe(nome: string) {
  return nome.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

export async function carregarNav(): Promise<DadosNav> {
  const supabase = await criarClienteServidor()
  const [{ data: auth }, { data: config }] = await Promise.all([
    supabase.auth.getUser(),
    // config_plataforma é pública (RLS select using true) — precisa valer
    // pro nav de visitante deslogado também (comunidade/agenda mostram nav
    // antes de checar assinatura).
    supabase.from('config_plataforma').select('nome_plataforma, logo_url, comunidade_ativa, desafios_ativos, agenda_ativa, modo_manutencao').eq('id', 1).maybeSingle(),
  ])

  const configNav = {
    nomePlataforma: config?.nome_plataforma ?? VAZIO.nomePlataforma,
    logoUrl: config?.logo_url ?? null,
    comunidadeAtiva: config?.comunidade_ativa ?? true,
    desafiosAtivos: config?.desafios_ativos ?? true,
    agendaAtiva: config?.agenda_ativa ?? true,
    modoManutencao: config?.modo_manutencao ?? false,
  }

  if (!auth?.user) return { ...VAZIO, ...configNav }

  const [{ data: perfil }, { data: niveis }, { data: saldo }, { data: adminRows }, { data: streak }] = await Promise.all([
    supabase.from('perfis').select('nome, slug').eq('id', auth.user.id).single(),
    // gamificacao_niveis é pequena (dezenas de linhas) — busca tudo e deriva
    // atual/próximo aqui em vez de duas queries com filtro.
    supabase.from('gamificacao_niveis').select('nome, pontos_minimos, ordem').order('ordem', { ascending: true }),
    // fonte real: soma do ledger (gamificacao_extrato) via view, não a coluna
    // perfis.xp em cache — evita depender de um valor que pode dessincronizar.
    supabase.from('gamificacao_saldo').select('xp_total, moedas_total').eq('usuario_id', auth.user.id).maybeSingle(),
    supabase.from('admin_usuarios').select('id').eq('usuario_id', auth.user.id).eq('ativo', true).limit(1),
    supabase.rpc('gam_calcular_streak', { p_usuario: auth.user.id }),
  ])
  if (!perfil) return { ...VAZIO, ...configNav }

  const xp = saldo?.xp_total ?? 0
  const moedas = saldo?.moedas_total ?? 0

  const ordenados = (niveis ?? []).slice().sort((a, b) => a.ordem - b.ordem)
  const atual = [...ordenados].reverse().find(n => n.pontos_minimos <= xp) ?? null
  const proximo = ordenados.find(n => n.pontos_minimos > xp) ?? null

  const xpProximo = proximo?.pontos_minimos ?? atual?.pontos_minimos ?? 100

  return {
    logado: true,
    nome: perfil.nome ?? 'Perito',
    iniciais: iniciaisDe(perfil.nome ?? 'PA'),
    slug: perfil.slug ?? null,
    nivel: atual?.ordem ?? 0,
    titulo: atual?.nome ?? 'Iniciante',
    xp, xpProximo,
    progressoPct: xpProximo > 0 ? Math.min(100, Math.round((xp / xpProximo) * 100)) : 100,
    faltaXp: Math.max(0, xpProximo - xp),
    proximoNivelNome: proximo?.nome ?? null,
    moedas,
    sequenciaDias: typeof streak === 'number' ? streak : 0,
    isAdmin: (adminRows?.length ?? 0) > 0,
    ...configNav,
  }
}

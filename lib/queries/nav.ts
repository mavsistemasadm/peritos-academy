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
  streakRecorde: number
  streakProtecoesRestantes: number
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
  moedas: 0, sequenciaDias: 0, streakRecorde: 0, streakProtecoesRestantes: 2, isAdmin: false,
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

  const [{ data: perfil }, { data: saldo }, { data: adminRows }, { data: streak }, { data: statusNivel }] = await Promise.all([
    supabase.from('perfis').select('nome, slug').eq('id', auth.user.id).single(),
    // fonte real: soma do ledger (gamificacao_extrato) via view, não a coluna
    // perfis.xp em cache — evita depender de um valor que pode dessincronizar.
    supabase.from('gamificacao_saldo').select('xp_total, moedas_total').eq('usuario_id', auth.user.id).maybeSingle(),
    supabase.from('admin_usuarios').select('id').eq('usuario_id', auth.user.id).eq('ativo', true).limit(1),
    // registra o acesso de hoje (idempotente) e já devolve o estado da streak —
    // chokepoint único (carregarNav roda em toda página autenticada), evita um
    // fetch extra no client só pra mostrar a pílula. Substitui gam_calcular_streak
    // (que segue existindo pra outros usos — admin_usuario_ficha, resumo
    // quinzenal por email — e é derivada de gamificação, não de acesso real).
    supabase.rpc('registrar_acesso_diario'),
    // nível real (XP + requisito composto) — nunca derivar localmente só por
    // XP aqui, um nível pode exigir cursos/avaliações/desafios/streak/
    // comunidade além do limiar, ver gam_status_proximo_nivel().
    supabase.rpc('gam_status_proximo_nivel'),
  ])
  if (!perfil) return { ...VAZIO, ...configNav }

  const streakDados = streak as { sequencia_atual?: number; recorde?: number; protecoes_restantes?: number } | null
  const statusDados = statusNivel as {
    nivel_atual_ordem?: number; nivel_atual_nome?: string
    proximo_nivel?: { nome: string; xp_necessario: number } | null
  } | null

  const xp = saldo?.xp_total ?? 0
  const moedas = saldo?.moedas_total ?? 0

  const proximo = statusDados?.proximo_nivel ?? null
  const xpProximo = proximo?.xp_necessario ?? xp

  return {
    logado: true,
    nome: perfil.nome ?? 'Perito',
    iniciais: iniciaisDe(perfil.nome ?? 'PA'),
    slug: perfil.slug ?? null,
    nivel: statusDados?.nivel_atual_ordem ?? 0,
    titulo: statusDados?.nivel_atual_nome ?? 'Iniciante',
    xp, xpProximo,
    progressoPct: proximo ? Math.min(100, Math.round((xp / Math.max(1, xpProximo)) * 100)) : 100,
    faltaXp: Math.max(0, xpProximo - xp),
    proximoNivelNome: proximo?.nome ?? null,
    moedas,
    sequenciaDias: streakDados?.sequencia_atual ?? 0,
    streakRecorde: streakDados?.recorde ?? 0,
    streakProtecoesRestantes: streakDados?.protecoes_restantes ?? 2,
    isAdmin: (adminRows?.length ?? 0) > 0,
    ...configNav,
  }
}

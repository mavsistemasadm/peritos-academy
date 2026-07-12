// lib/queries/nav.ts
// Dados do topo (nav) — independente da query principal de cada página.
// Qualquer página chama carregarNav() e passa pro <NavPlataforma>.
import { criarClienteServidor } from '@/lib/supabase/server'

export type DadosNav = {
  logado: boolean
  nome: string
  iniciais: string
  nivel: number
  titulo: string
  xp: number
  xpProximo: number
  progressoPct: number       // barra de nível
  faltaXp: number
  moedas: number
  sequenciaDias: number      // o foguinho
}

const VAZIO: DadosNav = {
  logado: false, nome: 'Visitante', iniciais: 'PA',
  nivel: 1, titulo: 'Perito Iniciante',
  xp: 0, xpProximo: 100, progressoPct: 0, faltaXp: 100,
  moedas: 0, sequenciaDias: 0,
}

function iniciaisDe(nome: string) {
  return nome.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

export async function carregarNav(): Promise<DadosNav> {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return VAZIO

  const [{ data: perfil }, { data: dias }] = await Promise.all([
    supabase.from('perfis').select('nome, nivel, titulo, xp, xp_proximo_nivel, moedas').eq('id', auth.user.id).single(),
    supabase.from('perfil_estudo_dias').select('dia'),
  ])
  if (!perfil) return VAZIO

  const xp = perfil.xp ?? 0
  const xpProximo = perfil.xp_proximo_nivel ?? 100

  // sequência atual de dias consecutivos (o foguinho)
  const diasSet = new Set((dias ?? []).map(d => d.dia))
  const hoje = new Date(); hoje.setHours(12, 0, 0, 0)
  let sequenciaDias = 0
  for (let i = 0; ; i++) {
    const d = new Date(hoje); d.setDate(d.getDate() - i)
    const chave = d.toISOString().slice(0, 10)
    if (diasSet.has(chave)) sequenciaDias++
    else if (i === 0) continue    // hoje ainda sem estudo não zera a sequência de ontem
    else break
  }

  return {
    logado: true,
    nome: perfil.nome ?? 'Perito',
    iniciais: iniciaisDe(perfil.nome ?? 'PA'),
    nivel: perfil.nivel ?? 1,
    titulo: perfil.titulo ?? 'Perito Iniciante',
    xp, xpProximo,
    progressoPct: xpProximo > 0 ? Math.min(100, Math.round((xp / xpProximo) * 100)) : 0,
    faltaXp: Math.max(0, xpProximo - xp),
    moedas: perfil.moedas ?? 0,
    sequenciaDias,
  }
}
// app/actions.ts
'use server'

import { criarClienteServidor } from '@/lib/supabase/server'
import { perfilPublicoUrl, primeiroNomeDe } from '@/lib/selo'

// marca o tour guiado como visto — chamada só na primeira exibição automática
// (pular ou concluir); "Refazer o tour" na /guia não chama isso de novo, só
// reroda o tour localmente via ?tour=1 na home.
export async function marcarTourVisto(): Promise<{ ok: boolean }> {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return { ok: false }

  const { error } = await supabase
    .from('perfis')
    .update({ tour_visto_em: new Date().toISOString() })
    .eq('id', auth.user.id)

  return { ok: !error }
}

// marca as boas-vindas do aluno migrado como vistas — mesmo padrão do tour
// acima (a mensagem é de transição de plataforma, então aparece uma vez só).
export async function marcarBoasVindasMigrado(): Promise<{ ok: boolean }> {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return { ok: false }

  const { error } = await supabase
    .from('perfis')
    .update({ boas_vindas_migrado_em: new Date().toISOString() })
    .eq('id', auth.user.id)

  return { ok: !error }
}

// Selo de Excelência: devolve o que a comemoração de tela cheia mostra e marca
// como vista. Chamada pelo ConquistaToast no instante em que a comemoração
// abre, seja pela notificação nova (polling), seja pelo selo pendente que o
// layout detectou (concedido com a pessoa fora, há qualquer tempo). Uma vez
// marcada, nunca mais abre sozinha.
export type DadosComemoracaoSelo = {
  primeiroNome: string
  cursos: number
  aulas: number
  horas: number
  perfilPublicoUrl: string | null
}

export async function abrirComemoracaoSelo(): Promise<DadosComemoracaoSelo | null> {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return null

  const [{ data: perfil }, { data: numeros }] = await Promise.all([
    supabase.from('perfis').select('nome, slug, perfil_publico, selo_excelencia_em').eq('id', auth.user.id).maybeSingle(),
    supabase.rpc('formacao_numeros'),
  ])
  if (!perfil?.selo_excelencia_em) return null

  await supabase.from('perfis').update({ selo_comemorado_em: new Date().toISOString() }).eq('id', auth.user.id)

  const n = (numeros ?? {}) as { cursos?: number; aulas?: number; horas?: number }
  return {
    primeiroNome: primeiroNomeDe(perfil.nome),
    cursos: n.cursos ?? 0,
    aulas: n.aulas ?? 0,
    horas: n.horas ?? 0,
    perfilPublicoUrl: perfilPublicoUrl(perfil.slug, perfil.perfil_publico),
  }
}

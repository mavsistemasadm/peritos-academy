// app/actions.ts
'use server'

import { criarClienteServidor } from '@/lib/supabase/server'

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

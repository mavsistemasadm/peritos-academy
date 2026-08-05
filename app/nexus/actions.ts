// app/nexus/actions.ts
// Ponte cliente -> servidor das sugestões do Nexus. O componente é client
// (precisa de sessionStorage e do X), mas a decisão de exibir e o registro das
// interações ficam no servidor.
'use server'

import { criarClienteServidor } from '@/lib/supabase/server'
import { escolherSugestaoNexus } from '@/lib/nexus/servidor'
import type { AcaoNexus, PlacementNexus, SugestaoNexus } from '@/lib/nexus'

export async function buscarSugestaoNexus(
  placement: PlacementNexus,
  contexto?: string | null
): Promise<SugestaoNexus | null> {
  try {
    return await escolherSugestaoNexus(placement, contexto)
  } catch (e) {
    // Sugestão é enfeite: nunca deve derrubar a página que a hospeda.
    console.error('[nexus] falha ao escolher sugestão', e)
    return null
  }
}

export async function registrarNexus(
  acao: AcaoNexus,
  app: string,
  copyChave: string | null,
  placement: PlacementNexus,
  contexto?: string | null
): Promise<{ ok: boolean }> {
  try {
    const supabase = await criarClienteServidor()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth?.user) return { ok: false }

    const { error } = await supabase.from('nexus_cta_interactions').insert({
      usuario_id: auth.user.id,
      app,
      placement,
      copy_chave: copyChave,
      acao,
      contexto: contexto ?? null,
    })
    return { ok: !error }
  } catch {
    return { ok: false }
  }
}

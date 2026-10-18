// ══════════════════════════════════════════════════════
// Os textos de uma live, guardados (18/10/2026). A escrita mora em
// textos-ia.ts, sem import com @/ para o script de teste conseguir usar.
// ══════════════════════════════════════════════════════
import { criarClienteServico } from '@/lib/supabase/servico'
import { escreverTextosEmail, type EventoParaTexto, type TextosEmail } from '@/lib/evento/textos-ia'

export type { TextosEmail } from '@/lib/evento/textos-ia'

/** Os textos da live, escrevendo e guardando se faltarem ou se o título mudou. */
export async function garantirTextosEmail(ev: EventoParaTexto): Promise<TextosEmail | null> {
  if (ev.textos_email && ev.textos_email.titulo === ev.titulo) return ev.textos_email
  const novos = await escreverTextosEmail(ev)
  if (novos) await criarClienteServico().from('eventos').update({ textos_email: novos }).eq('id', ev.id)
  return novos ?? null
}

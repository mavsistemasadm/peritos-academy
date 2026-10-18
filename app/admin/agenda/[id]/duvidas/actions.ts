// app/admin/agenda/[id]/duvidas/actions.ts — dar baixa e abrir o anexo
//
// `evento_duvidas` e o bucket `evento-duvidas` não têm policy nenhuma: toda
// leitura e escrita passa pela chave de serviço, DEPOIS de conferir o papel de
// agenda aqui. É por isso que cada action confere de novo, e não confia na
// página que a chamou.
'use server'

import { revalidatePath } from 'next/cache'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'
import { criarClienteServico } from '@/lib/supabase/servico'

export async function marcarDuvida(id: string, respondida: boolean): Promise<{ ok: true } | { ok: false; erro: string }> {
  const admin = await obterAdminAtual()
  if (!temPermissao(admin, 'agenda')) return { ok: false, erro: 'Sem permissão.' }
  const sb = criarClienteServico()
  const { data, error } = await sb.from('evento_duvidas')
    .update(respondida
      ? { status: 'respondida', respondida_em: new Date().toISOString(), respondida_por: admin!.usuarioId }
      : { status: 'aberta', respondida_em: null, respondida_por: null })
    .eq('id', id).select('evento_id').maybeSingle()
  if (error || !data) return { ok: false, erro: 'Não consegui salvar. Tente de novo.' }
  revalidatePath(`/admin/agenda/${data.evento_id}/duvidas`)
  revalidatePath('/admin/agenda')
  return { ok: true }
}

/** URL assinada de 10 minutos, gerada no clique: embutida na página, expiraria
 *  no meio da live, que é quando ela mais vai ser aberta. */
export async function linkDoAnexo(id: string): Promise<{ ok: true; url: string } | { ok: false; erro: string }> {
  const admin = await obterAdminAtual()
  if (!temPermissao(admin, 'agenda')) return { ok: false, erro: 'Sem permissão.' }
  const sb = criarClienteServico()
  const { data: d } = await sb.from('evento_duvidas').select('anexo_path, anexo_nome').eq('id', id).maybeSingle()
  if (!d?.anexo_path) return { ok: false, erro: 'Esta dúvida não tem anexo.' }
  const { data, error } = await sb.storage.from('evento-duvidas').createSignedUrl(d.anexo_path, 600, { download: false })
  if (error || !data) return { ok: false, erro: 'Não consegui abrir o arquivo.' }
  return { ok: true, url: data.signedUrl }
}

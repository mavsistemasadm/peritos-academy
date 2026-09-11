import type { criarClienteServidor } from '@/lib/supabase/server'

type Cliente = Awaited<ReturnType<typeof criarClienteServidor>>
type Item = { id: string; ordem: number }

/**
 * Troca a `ordem` de dois itens irmãos.
 *
 * `aulas`, `modulos` e `avaliacao_questoes` têm UNIQUE (pai, ordem), e não
 * deferrable: gravar A com a ordem de B enquanto B ainda está nela é recusado
 * pelo banco. Os dois updates em paralelo que existiam antes falhavam sempre, e
 * como ninguém lia o erro, a seta simplesmente não fazia nada.
 *
 * Por isso A passa antes por uma ordem provisória (negativa, fora da faixa
 * usada), B ocupa o lugar de A, e A ocupa o de B. Se um passo falhar, desfaz o
 * que já foi feito e devolve a mensagem.
 */
export async function trocarOrdem(
  supabase: Cliente,
  tabela: 'aulas' | 'modulos' | 'avaliacao_questoes',
  a: Item,
  b: Item,
): Promise<string | null> {
  const provisoria = -(Math.abs(a.ordem) + 1)

  const p1 = await supabase.from(tabela).update({ ordem: provisoria }).eq('id', a.id)
  if (p1.error) return p1.error.message

  const p2 = await supabase.from(tabela).update({ ordem: a.ordem }).eq('id', b.id)
  if (p2.error) {
    await supabase.from(tabela).update({ ordem: a.ordem }).eq('id', a.id)
    return p2.error.message
  }

  const p3 = await supabase.from(tabela).update({ ordem: b.ordem }).eq('id', a.id)
  if (p3.error) {
    await supabase.from(tabela).update({ ordem: b.ordem }).eq('id', b.id)
    await supabase.from(tabela).update({ ordem: a.ordem }).eq('id', a.id)
    return p3.error.message
  }

  return null
}

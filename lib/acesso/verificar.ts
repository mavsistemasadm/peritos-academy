// lib/acesso/verificar.ts
import { criarClienteServidor } from '@/lib/supabase/server'

export type StatusAcesso = { logado: boolean; permitido: boolean }

export async function verificarAcessoConteudo(): Promise<StatusAcesso> {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return { logado: false, permitido: false }

  const { data } = await supabase.rpc('tem_acesso_ativo', { p_usuario_id: auth.user.id })
  return { logado: true, permitido: data === true }
}

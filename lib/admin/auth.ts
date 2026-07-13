// lib/admin/auth.ts
import { criarClienteServidor } from '@/lib/supabase/server'
import { PERMISSOES_SECAO, type PapelAdmin, type SecaoAdmin } from '@/lib/admin/permissoes'

export type AdminAtual = { usuarioId: string; papeis: PapelAdmin[] }

export async function obterAdminAtual(): Promise<AdminAtual | null> {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return null

  const { data } = await supabase
    .from('admin_usuarios')
    .select('papel')
    .eq('usuario_id', auth.user.id)
    .eq('ativo', true)

  if (!data || data.length === 0) return null
  return { usuarioId: auth.user.id, papeis: data.map(d => d.papel as PapelAdmin) }
}

export function temPermissao(admin: AdminAtual | null, secao: SecaoAdmin): boolean {
  if (!admin) return false
  return PERMISSOES_SECAO[secao].some(p => admin.papeis.includes(p))
}

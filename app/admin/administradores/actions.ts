'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { obterAdminAtual } from '@/lib/admin/auth'
import { buscarPerfisPorNome, type PerfilBusca } from '@/lib/queries/admin-usuarios'
import type { PapelAdmin } from '@/lib/admin/permissoes'

const PAPEIS_VALIDOS: PapelAdmin[] = ['super_admin', 'conteudo', 'financeiro', 'moderador']

export async function buscarPerfis(termo: string): Promise<PerfilBusca[]> {
  const admin = await obterAdminAtual()
  if (!admin || !admin.papeis.includes('super_admin')) return []
  return buscarPerfisPorNome(termo)
}

export async function concederPapel(formData: FormData) {
  const admin = await obterAdminAtual()
  if (!admin || !admin.papeis.includes('super_admin')) {
    return { ok: false as const, erro: 'Apenas Super Admins podem conceder papéis.' }
  }

  const usuarioId = (formData.get('usuario_id') as string)?.trim()
  const papel = (formData.get('papel') as string)?.trim() as PapelAdmin

  if (!usuarioId) return { ok: false as const, erro: 'Selecione um usuário.' }
  if (!PAPEIS_VALIDOS.includes(papel)) return { ok: false as const, erro: 'Papel inválido.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase
    .from('admin_usuarios')
    .upsert(
      { usuario_id: usuarioId, papel, ativo: true, criado_por: admin.usuarioId },
      { onConflict: 'usuario_id,papel' }
    )

  if (error) return { ok: false as const, erro: error.message }

  revalidatePath('/admin/administradores')
  return { ok: true as const }
}

export async function alternarPapel(formData: FormData) {
  const admin = await obterAdminAtual()
  if (!admin || !admin.papeis.includes('super_admin')) {
    return { ok: false as const, erro: 'Apenas Super Admins podem alterar papéis.' }
  }

  const id = (formData.get('id') as string)?.trim()
  const ativo = formData.get('ativo') === 'true'
  if (!id) return { ok: false as const, erro: 'Papel não encontrado.' }

  const supabase = await criarClienteServidor()

  if (!ativo) {
    const { data: linha } = await supabase
      .from('admin_usuarios')
      .select('papel')
      .eq('id', id)
      .single()

    if (linha?.papel === 'super_admin') {
      const { count } = await supabase
        .from('admin_usuarios')
        .select('id', { count: 'exact', head: true })
        .eq('papel', 'super_admin')
        .eq('ativo', true)

      if ((count ?? 0) <= 1) {
        return { ok: false as const, erro: 'Não é possível remover o único Super Admin ativo.' }
      }
    }
  }

  const { error } = await supabase
    .from('admin_usuarios')
    .update({ ativo })
    .eq('id', id)

  if (error) return { ok: false as const, erro: error.message }

  revalidatePath('/admin/administradores')
  return { ok: true as const }
}

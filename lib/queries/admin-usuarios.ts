// lib/queries/admin-usuarios.ts
import { criarClienteServidor } from '@/lib/supabase/server'
import type { PapelAdmin } from '@/lib/admin/permissoes'

export type PapelConcedido = {
  id: string
  papel: PapelAdmin
  ativo: boolean
  criadoEm: string
}

export type AdministradorLinha = {
  usuarioId: string
  nome: string
  slug: string | null
  fotoUrl: string | null
  papeis: PapelConcedido[]
}

export type PerfilBusca = {
  id: string
  nome: string
  slug: string | null
  fotoUrl: string | null
}

export async function carregarAdministradores(): Promise<AdministradorLinha[]> {
  const supabase = await criarClienteServidor()

  const { data: linhas } = await supabase
    .from('admin_usuarios')
    .select('id, usuario_id, papel, ativo, criado_em')
    .order('criado_em', { ascending: true })
  if (!linhas || linhas.length === 0) return []

  const usuarioIds = [...new Set(linhas.map(l => l.usuario_id))]
  const { data: perfis } = await supabase
    .from('perfis')
    .select('id, nome, slug, foto_url')
    .in('id', usuarioIds)

  const perfisMap = new Map((perfis ?? []).map(p => [p.id, p]))

  const porUsuario = new Map<string, AdministradorLinha>()
  for (const l of linhas) {
    const perfil = perfisMap.get(l.usuario_id)
    if (!porUsuario.has(l.usuario_id)) {
      porUsuario.set(l.usuario_id, {
        usuarioId: l.usuario_id,
        nome: perfil?.nome ?? 'Perito',
        slug: perfil?.slug ?? null,
        fotoUrl: perfil?.foto_url ?? null,
        papeis: [],
      })
    }
    porUsuario.get(l.usuario_id)!.papeis.push({
      id: l.id,
      papel: l.papel as PapelAdmin,
      ativo: l.ativo,
      criadoEm: l.criado_em,
    })
  }

  return [...porUsuario.values()]
}

export async function buscarPerfisPorNome(termo: string): Promise<PerfilBusca[]> {
  const busca = termo.trim()
  if (busca.length < 2) return []

  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('perfis')
    .select('id, nome, slug, foto_url')
    .or(`nome.ilike.%${busca}%,slug.ilike.%${busca}%`)
    .limit(10)

  return (data ?? []).map(p => ({
    id: p.id,
    nome: p.nome ?? 'Perito',
    slug: p.slug ?? null,
    fotoUrl: p.foto_url ?? null,
  }))
}

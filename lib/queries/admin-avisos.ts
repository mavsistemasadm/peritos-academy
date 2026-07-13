// lib/queries/admin-avisos.ts
import { criarClienteServidor } from '@/lib/supabase/server'

export type NovidadeAdmin = {
  id: string
  titulo: string | null
  corpo: string[]
  imagemUrl: string | null
  linkUrl: string | null
  linkRotulo: string | null
  selo: string | null
  publicado: boolean
  criadoEm: string
  totalLeituras: number
}

export async function carregarNovidadesAdmin(): Promise<NovidadeAdmin[]> {
  const supabase = await criarClienteServidor()
  const { data: novidades } = await supabase
    .from('novidades')
    .select('id, titulo, corpo, imagem_url, link_url, link_rotulo, selo, publicado, criado_em')
    .order('criado_em', { ascending: false })
  if (!novidades || novidades.length === 0) return []

  const { data: leituras } = await supabase.from('novidade_leituras').select('novidade_id')
  const leiturasPorNovidade = new Map<string, number>()
  for (const l of leituras ?? []) {
    if (!l.novidade_id) continue
    leiturasPorNovidade.set(l.novidade_id, (leiturasPorNovidade.get(l.novidade_id) ?? 0) + 1)
  }

  return novidades.map(n => ({
    id: n.id, titulo: n.titulo, corpo: Array.isArray(n.corpo) ? n.corpo : [],
    imagemUrl: n.imagem_url, linkUrl: n.link_url, linkRotulo: n.link_rotulo, selo: n.selo,
    publicado: n.publicado, criadoEm: n.criado_em, totalLeituras: leiturasPorNovidade.get(n.id) ?? 0,
  }))
}

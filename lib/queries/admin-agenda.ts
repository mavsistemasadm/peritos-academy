// lib/queries/admin-agenda.ts
import { criarClienteServidor } from '@/lib/supabase/server'

export type EventoAdmin = {
  id: string
  titulo: string
  tipo: string
  descricao: string | null
  iniciaEm: string | null
  duracaoSeg: number
  linkTransmissao: string | null
  gravacaoUrl: string | null
  gravacaoThumbUrl: string | null
  apresentadorNome: string | null
  apresentadorCargo: string | null
  metaExtra: string | null
  cursoId: string | null
  alvoRotulo: string | null
  visibilidade: string
  gravar: boolean
  lembrete: boolean
  publicarFeed: boolean
  publicado: boolean
  totalReservas: number
}

export async function carregarEventosAdmin(): Promise<EventoAdmin[]> {
  const supabase = await criarClienteServidor()
  const { data: eventos } = await supabase
    .from('eventos')
    .select('*')
    .order('inicia_em', { ascending: false, nullsFirst: false })
  if (!eventos || eventos.length === 0) return []

  const { data: reservas } = await supabase.from('evento_reservas').select('evento_id')
  const reservasPorEvento = new Map<string, number>()
  for (const r of reservas ?? []) {
    reservasPorEvento.set(r.evento_id, (reservasPorEvento.get(r.evento_id) ?? 0) + 1)
  }

  return eventos.map(e => ({
    id: e.id, titulo: e.titulo, tipo: e.tipo, descricao: e.descricao, iniciaEm: e.inicia_em,
    duracaoSeg: e.duracao_seg, linkTransmissao: e.link_transmissao, gravacaoUrl: e.gravacao_url,
    gravacaoThumbUrl: e.gravacao_thumb_url, apresentadorNome: e.apresentador_nome,
    apresentadorCargo: e.apresentador_cargo, metaExtra: e.meta_extra, cursoId: e.curso_id,
    alvoRotulo: e.alvo_rotulo, visibilidade: e.visibilidade, gravar: e.gravar, lembrete: e.lembrete,
    publicarFeed: e.publicar_feed, publicado: e.publicado,
    totalReservas: reservasPorEvento.get(e.id) ?? 0,
  }))
}

export async function carregarEventoAdmin(id: string): Promise<EventoAdmin | null> {
  const supabase = await criarClienteServidor()
  const { data: e } = await supabase.from('eventos').select('*').eq('id', id).single()
  if (!e) return null

  const { count } = await supabase.from('evento_reservas').select('evento_id', { count: 'exact', head: true }).eq('evento_id', id)

  return {
    id: e.id, titulo: e.titulo, tipo: e.tipo, descricao: e.descricao, iniciaEm: e.inicia_em,
    duracaoSeg: e.duracao_seg, linkTransmissao: e.link_transmissao, gravacaoUrl: e.gravacao_url,
    gravacaoThumbUrl: e.gravacao_thumb_url, apresentadorNome: e.apresentador_nome,
    apresentadorCargo: e.apresentador_cargo, metaExtra: e.meta_extra, cursoId: e.curso_id,
    alvoRotulo: e.alvo_rotulo, visibilidade: e.visibilidade, gravar: e.gravar, lembrete: e.lembrete,
    publicarFeed: e.publicar_feed, publicado: e.publicado, totalReservas: count ?? 0,
  }
}

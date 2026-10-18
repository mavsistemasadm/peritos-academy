// lib/queries/admin-agenda.ts
import { criarClienteServidor } from '@/lib/supabase/server'
import { criarClienteServico } from '@/lib/supabase/servico'

export type EventoAdmin = {
  id: string
  /** Endereço público do evento — `/evento/{slug}`. Gerado pelo banco no
   *  nascimento e imutável depois; ver 20260825_evento_endereco_publico.sql. */
  slug: string | null
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
  /** Live aberta: quem não tem conta se inscreve pela página pública. */
  abertoAoPublico: boolean
  chatModo: 'nenhum' | 'youtube' | 'proprio'
  /** Live de tira-dúvidas: a página recebe dúvidas com anexo antes da live. */
  recebeDuvidas: boolean
  /** Dúvidas ainda sem baixa (as respondidas não contam). */
  duvidasAbertas: number
  totalReservas: number
  /** Convidados sem conta. Vazio na listagem; preenchido na ficha do evento. */
  inscricoes: InscricaoEvento[]
}

export type InscricaoEvento = {
  nome: string
  email: string
  whatsapp: string | null
  /** true quando o email já é de um aluno — não é lead novo. */
  jaEAluno: boolean
  criadoEm: string
}

export async function carregarEventosAdmin(): Promise<EventoAdmin[]> {
  const supabase = await criarClienteServidor()
  const { data: eventos } = await supabase
    .from('eventos')
    .select('*')
    .order('inicia_em', { ascending: false, nullsFirst: false })
  if (!eventos || eventos.length === 0) return []

  const { data: reservas } = await supabase.from('evento_reservas').select('evento_id')
  const abertasPorEvento = await duvidasAbertasPorEvento()
  const reservasPorEvento = new Map<string, number>()
  for (const r of reservas ?? []) {
    reservasPorEvento.set(r.evento_id, (reservasPorEvento.get(r.evento_id) ?? 0) + 1)
  }

  return eventos.map(e => ({
    id: e.id, slug: e.slug ?? null, titulo: e.titulo, tipo: e.tipo, descricao: e.descricao, iniciaEm: e.inicia_em,
    duracaoSeg: e.duracao_seg, linkTransmissao: e.link_transmissao, gravacaoUrl: e.gravacao_url,
    gravacaoThumbUrl: e.gravacao_thumb_url, apresentadorNome: e.apresentador_nome,
    apresentadorCargo: e.apresentador_cargo, metaExtra: e.meta_extra, cursoId: e.curso_id,
    alvoRotulo: e.alvo_rotulo, visibilidade: e.visibilidade, gravar: e.gravar, lembrete: e.lembrete,
    publicarFeed: e.publicar_feed, publicado: e.publicado,
    abertoAoPublico: !!e.aberto_ao_publico, chatModo: (e.chat_modo ?? 'proprio') as EventoAdmin['chatModo'],
    recebeDuvidas: !!e.recebe_duvidas, duvidasAbertas: abertasPorEvento.get(e.id) ?? 0,
    totalReservas: reservasPorEvento.get(e.id) ?? 0,
    inscricoes: [],
  }))
}

export async function carregarEventoAdmin(id: string): Promise<EventoAdmin | null> {
  const supabase = await criarClienteServidor()
  const { data: e } = await supabase.from('eventos').select('*').eq('id', id).single()
  if (!e) return null

  const { count } = await supabase.from('evento_reservas').select('evento_id', { count: 'exact', head: true }).eq('evento_id', id)

  // RLS de evento_inscricoes só deixa admin ler (ver a migração), então esta
  // consulta devolve vazio para qualquer outro — e a tela nem é alcançável
  // sem papel de agenda.
  const { data: inscritos } = await supabase
    .from('evento_inscricoes')
    .select('nome, email, whatsapp, usuario_id, criado_em')
    .eq('evento_id', id)
    .is('cancelado_em', null)
    .order('criado_em', { ascending: true })

  return {
    id: e.id, slug: e.slug ?? null, titulo: e.titulo, tipo: e.tipo, descricao: e.descricao, iniciaEm: e.inicia_em,
    duracaoSeg: e.duracao_seg, linkTransmissao: e.link_transmissao, gravacaoUrl: e.gravacao_url,
    gravacaoThumbUrl: e.gravacao_thumb_url, apresentadorNome: e.apresentador_nome,
    apresentadorCargo: e.apresentador_cargo, metaExtra: e.meta_extra, cursoId: e.curso_id,
    alvoRotulo: e.alvo_rotulo, visibilidade: e.visibilidade, gravar: e.gravar, lembrete: e.lembrete,
    publicarFeed: e.publicar_feed, publicado: e.publicado,
    abertoAoPublico: !!e.aberto_ao_publico, chatModo: (e.chat_modo ?? 'proprio') as EventoAdmin['chatModo'],
    recebeDuvidas: !!e.recebe_duvidas, duvidasAbertas: (await duvidasAbertasPorEvento(id)).get(id) ?? 0,
    totalReservas: count ?? 0,
    inscricoes: (inscritos ?? []).map(i => ({
      nome: i.nome, email: i.email, whatsapp: i.whatsapp,
      jaEAluno: !!i.usuario_id, criadoEm: i.criado_em,
    })),
  }
}

/**
 * Dúvidas sem baixa, por evento. `evento_duvidas` não tem policy nenhuma (só
 * a chave de serviço lê), e quem chama aqui é tela de admin que já conferiu o
 * papel de agenda.
 */
async function duvidasAbertasPorEvento(eventoId?: string): Promise<Map<string, number>> {
  let q = criarClienteServico().from('evento_duvidas').select('evento_id').eq('status', 'aberta')
  if (eventoId) q = q.eq('evento_id', eventoId)
  const { data } = await q
  const mapa = new Map<string, number>()
  for (const d of data ?? []) mapa.set(d.evento_id, (mapa.get(d.evento_id) ?? 0) + 1)
  return mapa
}

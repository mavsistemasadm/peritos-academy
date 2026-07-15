// app/agenda/actions.ts
// Ações do aluno (reservar lugar) e do produtor (publicar evento).
'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'

// ---------- RESERVAR MEU LUGAR ----------
export async function reservarLugar(eventoId: string) {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return { ok: false, erro: 'É preciso entrar para reservar.' }

  const { error } = await supabase
    .from('evento_reservas')
    .insert({ evento_id: eventoId, usuario_id: auth.user.id })

  // 23505 = já reservado (unique) — tratamos como sucesso idempotente
  if (error && error.code !== '23505') return { ok: false, erro: error.message }

  revalidatePath('/agenda')
  return { ok: true }
}

// ---------- PUBLICAR EVENTO (modal do produtor) ----------
export type NovoEvento = {
  titulo: string
  tipo: 'sala_analise' | 'aula_ao_vivo' | 'plantao' | 'mentoria' | 'lancamento'
  data: string       // "15/07/2026"
  hora: string       // "20:00"
  duracao: string    // "1h 30", "45min", "2h"
  link: string
  descricao: string
  visibilidade: 'todos' | 'curso' | 'assinatura' | 'turma'
  alvoRotulo: string | null   // "Turma Kit Bancário 2026", "Premium"...
  gravar: boolean
  lembrete: boolean
  publicarFeed: boolean
}

function parseDuracaoSeg(txt: string): number {
  const limpo = txt.toLowerCase().replace(/\s/g, '')
  const h = limpo.match(/(\d+)h/)
  const m = limpo.match(/(?:h(\d+)$)|(?:^(\d+)min?)/)
  const horas = h ? parseInt(h[1]) : 0
  const mins = m ? parseInt(m[1] ?? m[2]) : 0
  const total = horas * 3600 + mins * 60
  return total > 0 ? total : 3600
}

function parseInicioBrasilia(data: string, hora: string): string | null {
  const d = data.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  const h = hora.match(/^(\d{1,2}):(\d{2})$/)
  if (!d || !h) return null
  // Brasília = UTC-3 (sem horário de verão)
  return `${d[3]}-${d[2]}-${d[1]}T${h[1].padStart(2, '0')}:${h[2]}:00-03:00`
}

export async function publicarEvento(ev: NovoEvento) {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return { ok: false, erro: 'É preciso entrar para publicar.' }

  if (!ev.titulo.trim()) return { ok: false, erro: 'Dê um título ao evento.' }
  const inicia_em = parseInicioBrasilia(ev.data, ev.hora)
  if (!inicia_em) return { ok: false, erro: 'Data ou hora inválida. Use 15/07/2026 e 20:00.' }

  const { error } = await supabase.from('eventos').insert({
    titulo: ev.titulo.trim(),
    descricao: ev.descricao.trim() || null,
    tipo: ev.tipo,
    inicia_em,
    duracao_seg: parseDuracaoSeg(ev.duracao),
    link_transmissao: ev.link.trim() || null,
    visibilidade: ev.visibilidade,
    alvo_rotulo: ev.visibilidade === 'todos' ? null : ev.alvoRotulo,
    gravar: ev.gravar,
    lembrete: ev.lembrete,
    publicar_feed: ev.publicarFeed,
    criado_por: auth.user.id,
  })
  if (error) return { ok: false, erro: error.message }

  revalidatePath('/agenda')
  return { ok: true }
}
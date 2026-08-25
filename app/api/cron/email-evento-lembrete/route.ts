// ══════════════════════════════════════════════════════════════════
// app/api/cron/email-evento-lembrete — OS DOIS LEMBRETES DE UM ENCONTRO
//
// Roda de hora em hora, e não uma vez por dia como os outros crons de email.
// A razão é o segundo lembrete: "estamos começando" mandado às 7h da manhã
// para uma live das 20h não é um lembrete, é um aviso antigo — e é justamente
// esse o que traz gente para a sala.
//
//   véspera   — entre 23h e 24h à frente     → "é amanhã"
//   começando — entre 30min e 90min à frente  → "daqui a uma hora"
//   ao vivo   — começou há até 20 minutos     → "estamos no ar"
//
// O terceiro é o que mais traz gente, e é o que não existiria num cron
// diário: ele vale por vinte minutos. É para quem leu o de uma hora antes e
// deixou passar — a maioria.
//
// As janelas são maiores que o intervalo entre duas passagens de propósito:
// cron que atrasa alguns minutos é normal, e uma janela justa faria o
// lembrete simplesmente não sair, sem erro nenhum aparecendo em lugar algum.
// Mandar duas vezes é o risco oposto, e contra ele existe o dedupe por
// (endereço, tipo, evento) — ver enviarConvidado.ts.
//
// ── QUEM RECEBE ──
//
// Convidado inscrito na live aberta (`evento_inscricoes`) e aluno que reservou
// pela agenda (`evento_reservas`). Os dois esperam pela mesma coisa; separar
// só o convidado deixaria o aluno, que é quem já paga, sabendo menos.
//
// ⚠️ Quem está nas duas listas recebe UMA vez: a inscrição guarda o
// `usuario_id` quando o email casa com um aluno, e os já cobertos por ela são
// removidos da lista de reservas antes do envio.
// ══════════════════════════════════════════════════════════════════
import { NextResponse, type NextRequest } from 'next/server'
import { criarClienteServico } from '@/lib/supabase/servico'
import { enviarEmailConvidado } from '@/lib/email/enviarConvidado'
import { emailEvento } from '@/lib/email/templates/evento'
import { dadosDoEmail, type EventoParaEmail } from '@/lib/evento/email'

function autorizado(request: NextRequest): boolean {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  return !!process.env.CRON_SECRET && token === process.env.CRON_SECRET
}

const MIN = 60_000

const JANELAS = [
  { momento: 'vespera' as const, tipo: 'evento_vespera' as const, de: 23 * 60 * MIN, ate: 24 * 60 * MIN },
  { momento: 'comecando' as const, tipo: 'evento_comecando' as const, de: 30 * MIN, ate: 90 * MIN },
  // Negativo: já começou. O `de` menor que zero é o que faz esta janela
  // apanhar o evento no ar, e não o que ainda vai começar.
  { momento: 'ao_vivo' as const, tipo: 'evento_ao_vivo' as const, de: -20 * MIN, ate: 0 },
]

export async function GET(request: NextRequest) {
  if (!autorizado(request)) return NextResponse.json({ erro: 'não autorizado' }, { status: 401 })

  const supabase = criarClienteServico()
  const agora = Date.now()
  const resumo: Record<string, number> = {}

  for (const janela of JANELAS) {
    const { data: eventos, error } = await supabase
      .from('eventos')
      .select('id, slug, titulo, inicia_em, duracao_seg, descricao, apresentador_nome, lembrete')
      .eq('publicado', true)
      .gte('inicia_em', new Date(agora + janela.de).toISOString())
      .lte('inicia_em', new Date(agora + janela.ate).toISOString())

    if (error) {
      console.error('[cron/email-evento-lembrete] erro ao buscar eventos', error.message)
      return NextResponse.json({ ok: false, erro: error.message }, { status: 500 })
    }

    let enviados = 0
    for (const ev of eventos ?? []) {
      // `eventos.lembrete` é o interruptor que já existia na tela do produtor
      // e que até aqui não ligava nada. Agora liga isto.
      if (ev.lembrete === false) continue

      for (const pessoa of await destinatarios(supabase, ev.id)) {
        const { assunto, html } = emailEvento(janela.momento, dadosDoEmail(ev as EventoParaEmail, pessoa.nome))
        const r = await enviarEmailConvidado({
          para: pessoa.email,
          tipo: janela.tipo,
          refId: ev.id,
          assunto,
          html,
        })
        if (r.enviado) enviados++
      }
    }
    resumo[janela.momento] = enviados
  }

  return NextResponse.json({ ok: true, ...resumo })
}

type Pessoa = { nome: string; email: string }

/** A lista de quem espera por este encontro, sem repetir ninguém. */
async function destinatarios(
  supabase: ReturnType<typeof criarClienteServico>,
  eventoId: string,
): Promise<Pessoa[]> {
  const { data: inscricoes } = await supabase
    .from('evento_inscricoes')
    .select('nome, email, usuario_id')
    .eq('evento_id', eventoId)
    .is('cancelado_em', null)

  const lista: Pessoa[] = (inscricoes ?? []).map(i => ({ nome: i.nome, email: i.email }))
  const jaCobertos = new Set(
    (inscricoes ?? []).map(i => i.usuario_id).filter((id): id is string => !!id),
  )

  const { data: reservas } = await supabase
    .from('evento_reservas')
    .select('usuario_id')
    .eq('evento_id', eventoId)

  const idsDeAlunos = (reservas ?? [])
    .map(r => r.usuario_id)
    .filter((id): id is string => !!id && !jaCobertos.has(id))

  if (idsDeAlunos.length > 0) {
    // O endereço do aluno mora em auth.users, fora do alcance do PostgREST —
    // ver emails_de_usuarios() na migração.
    const { data: perfis } = await supabase.rpc('emails_de_usuarios', { p_ids: idsDeAlunos })
    for (const p of (perfis ?? []) as { nome: string | null; email: string }[]) {
      if (p.email) lista.push({ nome: p.nome ?? 'Perito', email: p.email })
    }
  }

  // Rede de segurança: dois registros com o mesmo endereço em grafias
  // diferentes chegariam aqui como duas pessoas. O dedupe do envio pegaria,
  // mas o custo já teria sido pago em duas chamadas ao Resend.
  const vistos = new Set<string>()
  return lista.filter(p => {
    const chave = p.email.trim().toLowerCase()
    if (!chave || vistos.has(chave)) return false
    vistos.add(chave)
    return true
  })
}

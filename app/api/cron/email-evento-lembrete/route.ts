// ══════════════════════════════════════════════════════════════════
// app/api/cron/email-evento-lembrete — OS TRÊS LEMBRETES DE UM ENCONTRO
//
// A confirmação sai na hora da inscrição (ver a server action). Estes são os
// três que vêm depois:
//
//   hoje      · na manhã do dia do evento
//   comecando · uma hora antes
//   ao_vivo   · quando entra no ar
//
// Roda de hora em hora, e não uma vez por dia como os outros crons de email.
// A razão são os dois últimos: "estamos no ar" mandado às 7h da manhã para uma
// live das 20h não é um lembrete, é um aviso antigo. E é justamente esse que
// traz gente para a sala, porque é para quem viu o de uma hora antes e deixou
// passar.
//
// Quando cada um sai é decidido em `lib/evento/janelas.ts`, que é conta de
// tempo pura e por isso testável de mesa. Aqui fica só o trabalho de ir ao
// banco, montar o email e mandar.
//
// ── QUEM RECEBE ──
//
// Convidado inscrito na live aberta (`evento_inscricoes`) e aluno que reservou
// pela agenda (`evento_reservas`). Os dois esperam pela mesma coisa; avisar só
// o convidado deixaria o aluno, que é quem já paga, sabendo menos.
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
import { JANELAS } from '@/lib/evento/janelas'

function autorizado(request: NextRequest): boolean {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  return !!process.env.CRON_SECRET && token === process.env.CRON_SECRET
}

export async function GET(request: NextRequest) {
  if (!autorizado(request)) return NextResponse.json({ erro: 'não autorizado' }, { status: 401 })

  const supabase = criarClienteServico()
  const agora = Date.now()
  const resumo: Record<string, number | string> = {}

  for (const janela of JANELAS) {
    const faixa = janela.faixa(agora)
    if (!faixa || faixa.ate <= faixa.de) {
      resumo[janela.momento] = 'fora da janela'
      continue
    }

    const { data: eventos, error } = await supabase
      .from('eventos')
      .select('id, slug, titulo, inicia_em, duracao_seg, descricao, apresentador_nome, lembrete')
      .eq('publicado', true)
      .gte('inicia_em', new Date(agora + faixa.de).toISOString())
      .lte('inicia_em', new Date(agora + faixa.ate).toISOString())

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

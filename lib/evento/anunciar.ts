// ══════════════════════════════════════════════════════
// O ANÚNCIO DE UM EVENTO — o miolo, sem a porta (17/10/2026)
//
// Morava dentro da server action do admin (`anunciarEvento`, em
// app/admin/agenda/actions.ts), presa à checagem de sessão. O Jarvis (o
// assistente de voz do dono) anuncia live pela rota /api/integracoes/jarvis, e
// as duas portas precisam mandar EXATAMENTE o mesmo email para o mesmo público:
// por isso o miolo veio para cá, e quem chama confere a permissão antes.
// ══════════════════════════════════════════════════════
import { criarClienteServico } from '@/lib/supabase/servico'
import { enviarEmailConvidado } from '@/lib/email/enviarConvidado'
import { emailEvento } from '@/lib/email/templates/evento'
import { dadosDoEmail, type EventoParaEmail } from '@/lib/evento/email'
import { garantirTextosEmail } from '@/lib/evento/textos'

export type ResultadoAnuncio =
  | { ok: true; enviados: number; total: number }
  | { ok: false; erro: string }

type Pessoa = { usuario_id: string; nome: string | null; email: string }

/** Só conta o público, sem mandar nada. É o número que se mostra antes de anunciar. */
export async function contarAudienciaDoEvento(id: string): Promise<number> {
  const supabase = criarClienteServico()
  const { data } = await supabase.rpc('evento_audiencia', { p_evento: id })
  return (data as Pessoa[] | null)?.length ?? 0
}

/** Manda o anúncio (email + sino) para a audiência do evento. Quem chama confere a permissão. */
export async function anunciarEventoNucleo(id: string): Promise<ResultadoAnuncio> {
  const supabase = criarClienteServico()

  const { data: ev } = await supabase
    .from('eventos')
    .select('id, slug, titulo, tipo, descricao, inicia_em, duracao_seg, apresentador_nome, publicado, visibilidade, textos_email')
    .eq('id', id)
    .maybeSingle()

  if (!ev) return { ok: false, erro: 'Evento não encontrado.' }
  if (!ev.publicado) {
    return { ok: false, erro: 'Publique o evento antes de anunciar: o link do anúncio responderia 404.' }
  }
  if (!ev.inicia_em) {
    return { ok: false, erro: 'Defina a data e a hora antes de anunciar.' }
  }

  const { data: audienciaRaw, error: erroAud } = await supabase.rpc('evento_audiencia', { p_evento: id })
  if (erroAud) return { ok: false, erro: erroAud.message }

  const audiencia = (audienciaRaw as Pessoa[] | null) ?? []
  if (audiencia.length === 0) {
    return {
      ok: false,
      erro: ev.visibilidade === 'todos'
        ? 'Não encontrei nenhum aluno ativo para avisar.'
        : ev.visibilidade === 'turma'
          ? 'Turma ainda não existe no banco: o rótulo é texto livre e não seleciona ninguém. '
            + 'Escolha outra visibilidade para poder anunciar.'
          : ev.visibilidade === 'curso'
            ? 'Escolha o curso vinculado: sem ele não dá para saber quem são os alunos dele.'
            : 'Não encontrei ninguém neste segmento.',
    }
  }

  const textos = await garantirTextosEmail(ev)

  let enviados = 0
  for (const pessoa of audiencia) {
    const { assunto, html } = emailEvento('anuncio', dadosDoEmail(ev as EventoParaEmail, pessoa.nome ?? 'Perito'), { tema: textos?.anuncio })
    const r = await enviarEmailConvidado({
      para: pessoa.email,
      tipo: 'evento_anuncio',
      refId: ev.id,
      assunto,
      html,
    })
    if (r.enviado) enviados++

    // O sino junto com o email, pelo mesmo motivo dos lembretes: são dois
    // canais, e o de dentro não deve depender do de fora ter funcionado.
    await supabase.rpc('notificar_anuncio_evento', { p_usuario: pessoa.usuario_id, p_evento: ev.id })

    // O Resend aceita 2 por segundo. Sem a pausa, uma base de 544 devolve
    // metade em 429 e o anúncio "termina" tendo alcançado metade.
    // 520ms (≈1,9 por segundo): com 600ms, 544 pessoas davam 326s e passavam
    // do teto de 300s da função; o fim da lista ficava sem anúncio.
    await new Promise(res => setTimeout(res, 520))
  }

  return { ok: true, enviados, total: audiencia.length }
}

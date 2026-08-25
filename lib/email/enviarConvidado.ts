// ══════════════════════════════════════════════════════════════════
// lib/email/enviarConvidado.ts — EMAIL PARA QUEM NÃO TEM CONTA
//
// Irmão de enviar.ts, e separado dele de propósito. Aquele arquivo é inteiro
// construído em cima de `usuarioId`: a preferência mora em
// `email_preferencias.usuario_id`, o dedupe é um índice sobre `usuario_id`, o
// rodapé aponta para `/perfil`, e o teto diário de celebração pressupõe uma
// jornada de aluno. O convidado de uma live aberta não tem nada disso — ele
// tem um endereço de email e mais nada.
//
// Enfiar os dois no mesmo caminho exigiria afrouxar `usuario_id` para
// nullable, e aí o índice único de dedupe **para de funcionar em silêncio**:
// no Postgres, nulos são distintos entre si, então cada passagem do cron
// acharia que ainda não mandou e mandaria de novo. Um lembrete duplicado é o
// jeito mais rápido de o convite virar spam — e de o domínio ir junto.
//
// O que este arquivo mantém idêntico ao irmão: falha em silêncio (log, nunca
// lança — um email que não sai não pode derrubar a inscrição que o gerou),
// respeita descadastro antes de qualquer coisa, e só grava o registro depois
// que o Resend aceitou.
// ══════════════════════════════════════════════════════════════════
import { Resend } from 'resend'
import { criarClienteServico } from '@/lib/supabase/servico'
import { SITE_URL } from '@/lib/site'
import { gerarTokenEmail } from './token'

export type TipoEmailConvidado =
  | 'evento_confirmacao'
  | 'evento_hoje'
  | 'evento_comecando'
  | 'evento_ao_vivo'

type Entrada = {
  para: string
  tipo: TipoEmailConvidado
  refId?: string
  assunto: string
  html: string
}

type Resultado = { enviado: boolean; motivo?: string }

/**
 * ⚠️ O REMETENTE QUERIDO É `noreply@nexuspericia.com.br`, E ELE AINDA NÃO
 * PODE SER USADO. Conferido contra a API do Resend em 25/08/2026:
 *
 *   403 · "This API key is not authorized to send emails from nexuspericia.com.br"
 *
 * Enquanto isso valer, o remetente é o da Academy, que está autorizado (e foi
 * usado no envio de teste que passou). Deixar o de Nexus assim mesmo seria o
 * pior dos mundos: este arquivo nunca lança, então TODO email de convidado
 * falharia em silêncio, e o sintoma seria "os lembretes não chegaram",
 * descoberto depois da live, sem nada em log nenhum acusando.
 *
 * Para trocar: verificar `nexuspericia.com.br` em resend.com/domains (DNS de
 * SPF/DKIM) e trocar esta linha. É uma linha, e o teste é reenviar para
 * `delivered@resend.dev`. Nada mais no código depende disso.
 *
 * O motivo de querer o de Nexus continua de pé: quem recebe estes emails é
 * convidado de live aberta, gente que ainda não é aluna, e o que se apresenta
 * a ela é o ecossistema, não o endereço de uma plataforma em que ela ainda
 * não entrou.
 */
const REMETENTE = 'Peritos Academy <noreply@peritosacademy.com.br>'

/** A frase exata do rodapé do template. Se ela mudar lá, muda aqui. */
const FRASE_DESCADASTRO = 'Não quero mais receber estes e-mails'

function urlDescadastro(email: string) {
  return `${SITE_URL}/api/email/descadastrar?token=${gerarTokenEmail(email)}`
}

/**
 * ⚠️ Já quebrou uma vez, exatamente como o comentário do template avisava que
 * quebraria: o texto do rodapé mudou e este replace continuou procurando a
 * frase antiga. Não deu erro, não apareceu em log nenhum, e os emails saíram
 * com a frase em texto morto, sem link. Descadastro que não descadastra é
 * denúncia de spam esperando acontecer.
 *
 * Por isso a frase agora é uma constante e a função avisa quando não acha.
 */
function injetarDescadastro(html: string, email: string): string {
  if (!html.includes(FRASE_DESCADASTRO)) {
    console.error(
      `[email convidado] rodapé sem "${FRASE_DESCADASTRO}": o email vai sair sem link de descadastro. `
      + 'Alguém mudou o texto do template sem mudar FRASE_DESCADASTRO.',
    )
    return html
  }
  return html.replace(
    FRASE_DESCADASTRO,
    `<a href="${urlDescadastro(email)}" style="color:#A3ABA6;text-decoration:underline;">${FRASE_DESCADASTRO}</a>`,
  )
}

/**
 * O QUE FAZ ESTE EMAIL SER ENTREGUE, E NÃO SÓ ACEITO.
 *
 * Gmail e Yahoo exigem descadastro de um clique de quem manda em volume desde
 * fevereiro de 2024. Sem estes dois cabeçalhos a mensagem não é recusada: ela
 * é despriorizada, cai na aba de promoções ou em spam. O Resend responde
 * "enviado", o log concorda, e ninguém lê.
 *
 * `List-Unsubscribe-Post` é o que promete o clique único, e a rota
 * /api/email/descadastrar é quem cumpre. Prometer sem cumprir é pior que não
 * prometer: o provedor chama a rota sozinho e anota quem não atende.
 */
function cabecalhosDeLista(email: string) {
  return {
    'List-Unsubscribe': `<${urlDescadastro(email)}>, <mailto:suporte@peritosacademy.com.br?subject=unsubscribe>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}

export async function enviarEmailConvidado(entrada: Entrada): Promise<Resultado> {
  try {
    const email = entrada.para.trim().toLowerCase()
    if (!email) return { enviado: false, motivo: 'sem_endereco' }

    const supabase = criarClienteServico()

    const { data: optout } = await supabase
      .from('email_optout_publico')
      .select('email')
      .eq('email', email)
      .maybeSingle()
    if (optout) return { enviado: false, motivo: 'descadastrado' }

    // Mesma checagem para quem TAMBÉM é aluno: quem desligou os emails no
    // perfil desligou os emails, e não "os emails de um dos dois sistemas".
    // O endereço vive em auth.users, não em perfis — daí a RPC.
    const { data: usuarioId } = await supabase.rpc('usuario_id_por_email', { p_email: email })
    if (usuarioId) {
      const { data: pref } = await supabase
        .from('email_preferencias')
        .select('receber_emails')
        .eq('usuario_id', usuarioId)
        .maybeSingle()
      if (pref && pref.receber_emails === false) return { enviado: false, motivo: 'preferencia_desligada' }
    }

    let dup = supabase
      .from('email_convidados_enviados')
      .select('id')
      .ilike('email', email)
      .eq('tipo', entrada.tipo)
    dup = entrada.refId ? dup.eq('ref_id', entrada.refId) : dup.is('ref_id', null)
    const { data: existente } = await dup.maybeSingle()
    if (existente) return { enviado: false, motivo: 'duplicado' }

    const chave = process.env.RESEND_API_KEY
    if (!chave) {
      console.error('[email convidado] RESEND_API_KEY ausente')
      return { enviado: false, motivo: 'sem_chave' }
    }

    const resend = new Resend(chave)
    const { error } = await resend.emails.send({
      from: REMETENTE,
      replyTo: 'marlos@peritosacademy.com.br',
      to: email,
      subject: entrada.assunto,
      html: injetarDescadastro(entrada.html, email),
      headers: cabecalhosDeLista(email),
    })
    if (error) {
      console.error('[email convidado] Resend recusou:', error)
      return { enviado: false, motivo: 'resend_erro' }
    }

    await supabase.from('email_convidados_enviados').insert({
      email,
      tipo: entrada.tipo,
      ref_id: entrada.refId ?? null,
      assunto: entrada.assunto,
    })

    return { enviado: true }
  } catch (e) {
    console.error('[email convidado] falhou:', e)
    return { enviado: false, motivo: 'excecao' }
  }
}

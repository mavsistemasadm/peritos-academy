// ══════════════════════════════════════════════════════════════════
// app/evento/[slug]/actions.ts — A INSCRIÇÃO DE QUEM NÃO TEM CONTA
//
// Único caminho de escrita em `evento_inscricoes`. A tabela não tem policy de
// INSERT para ninguém (ver a migração): quem grava é a service role, daqui,
// depois de validar. Isso é deliberado — uma policy de insert para `anon`
// deixaria um formulário aberto na internet com a chave publicável que vai no
// HTML de toda página.
// ══════════════════════════════════════════════════════════════════
'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { criarClienteServico } from '@/lib/supabase/servico'
import { criarClienteServidor } from '@/lib/supabase/server'
import { gerarTokenEmail, verificarTokenEmail } from '@/lib/email/token'
import { enviarEmailConvidado } from '@/lib/email/enviarConvidado'
import { emailEvento } from '@/lib/email/templates/evento'
import { nomeDoCookieDeInscricao } from '@/lib/queries/evento-publico'
import { dadosDoEmail } from '@/lib/evento/email'

export type ResultadoInscricao = { ok: true } | { ok: false; erro: string }

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function inscreverNoEvento(entrada: {
  eventoId: string
  nome: string
  email: string
  whatsapp?: string
}): Promise<ResultadoInscricao> {
  const nome = entrada.nome.trim().replace(/\s+/g, ' ')
  const email = entrada.email.trim().toLowerCase()
  const whatsapp = entrada.whatsapp?.trim() || null

  if (nome.length < 2) return { ok: false, erro: 'Escreva seu nome.' }
  if (!EMAIL_VALIDO.test(email)) return { ok: false, erro: 'Confira o email: parece incompleto.' }

  const supabase = criarClienteServico()

  // A live precisa estar publicada E aberta ao público. Sem esta checagem, o
  // id de um evento fechado, colado à mão na requisição, viraria inscrição
  // numa mentoria de turma — e o convidado receberia lembrete de um encontro
  // em que não pode entrar.
  const { data: ev } = await supabase
    .from('eventos')
    .select('id, slug, titulo, inicia_em, duracao_seg, descricao, apresentador_nome, publicado, aberto_ao_publico')
    .eq('id', entrada.eventoId)
    .maybeSingle()

  if (!ev || !ev.publicado || !ev.aberto_ao_publico) {
    return { ok: false, erro: 'Este encontro não está aberto para inscrição.' }
  }

  // Se o endereço já é de um aluno, a inscrição fica amarrada nele. Não
  // concede nada — serve para o admin não contar como lead novo quem já está
  // dentro, e para o lembrete não sair duas vezes para quem também reservou
  // pela agenda. O email mora em auth.users, então quem responde é a RPC.
  const { data: usuarioId } = await supabase.rpc('usuario_id_por_email', { p_email: email })

  const { error } = await supabase
    .from('evento_inscricoes')
    .upsert(
      {
        evento_id: ev.id,
        nome,
        email,
        whatsapp,
        usuario_id: usuarioId ?? null,
        cancelado_em: null,
      },
      { onConflict: 'evento_id,email', ignoreDuplicates: false },
    )

  // O upsert por índice de expressão (lower(email)) não é endereçável por
  // onConflict; se o PostgREST recusar, cai no caminho manual — a inscrição
  // não pode falhar por causa de um detalhe de sintaxe de conflito.
  if (error) {
    const { data: jaTem } = await supabase
      .from('evento_inscricoes')
      .select('id')
      .eq('evento_id', ev.id)
      .ilike('email', email)
      .maybeSingle()

    if (jaTem) {
      await supabase.from('evento_inscricoes')
        .update({ nome, whatsapp, usuario_id: usuarioId ?? null, cancelado_em: null })
        .eq('id', jaTem.id)
    } else {
      const { error: erroInsert } = await supabase.from('evento_inscricoes').insert({
        evento_id: ev.id, nome, email, whatsapp, usuario_id: usuarioId ?? null,
      })
      if (erroInsert) {
        console.error('[inscricao evento] falhou:', erroInsert)
        return { ok: false, erro: 'Não consegui registrar agora. Tente de novo em instantes.' }
      }
    }
  }

  // ── O CONTATO SOBREVIVE AO EVENTO ──
  //
  // A linha em `evento_inscricoes` morre com a live: ela responde "quem vem
  // neste encontro". Quem essa pessoa é, e o fato de podermos falar com ela
  // depois, mora em `contatos` — e é a única parte disto que, se não for
  // gravada hoje, não tem como ser recuperada amanhã.
  //
  // As tags: o evento (para saber de onde veio), o canal, e `nao-aluno`
  // quando não há conta por trás. Essa última é uma fotografia da captura, e
  // não uma verdade permanente — ver o comentário da migração.
  const tags = ['live', `evento:${ev.slug}`]
  if (!usuarioId) tags.push('nao-aluno')

  const { error: erroContato } = await supabase.rpc('registrar_contato', {
    p_email: email,
    p_nome: nome,
    p_whatsapp: whatsapp,
    p_tags: tags,
    p_origem: `evento:${ev.slug}`,
  })
  // Falha aqui não desfaz a inscrição: a pessoa se inscreveu, e dizer que não
  // deu certo por causa do CRM seria mentira na cara dela. Fica o log.
  if (erroContato) console.error('[inscricao evento] contato não registrado:', erroContato)

  // O cookie é só para a página reconhecer quem volta — ver
  // jaInscritoComoConvidado(). Não dá acesso a nada.
  const jar = await cookies()
  jar.set(nomeDoCookieDeInscricao(ev.id), gerarTokenEmail(email), {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 120,
  })

  // Confirmação na hora. É ela que prova para a pessoa que o email dela está
  // certo — e um email errado só aparece aqui, enquanto ela ainda está na
  // tela para corrigir; descoberto no dia da live, já não adianta.
  const { assunto, html } = emailEvento('confirmacao', dadosDoEmail(ev, nome))
  await enviarEmailConvidado({ para: email, tipo: 'evento_confirmacao', refId: ev.id, assunto, html })

  revalidatePath(`/evento/${ev.slug}`)
  return { ok: true }
}


// ══════════════════════════════════════════════════════════════════
// FALAR NO CHAT DA TRANSMISSÃO
//
// Único caminho de escrita em `evento_mensagens`: a tabela não tem policy de
// INSERT para ninguém. A chave publicável vai no HTML de toda página, então
// uma policy aberta para `anon` viraria um formulário na internet capaz de
// despejar mensagem em nome de qualquer nome, em laço, durante a transmissão.
//
// ── COMO CADA UM É IDENTIFICADO ──
//
//   aluno    → pela sessão. O nome vem do perfil, não do que ele digitar.
//   convidado → pelo cookie assinado gravado na inscrição. O nome vem da linha
//               de `evento_inscricoes`, também não do que ele digitar.
//
// ⚠️ Em nenhum dos dois casos o autor manda o próprio nome. Se mandasse,
// qualquer pessoa assinaria como o apresentador no meio da live — e a live é
// exatamente o momento em que ninguém está conferindo.
// ══════════════════════════════════════════════════════════════════

export type ResultadoMensagem =
  | { ok: true; id: string; autorNome: string; ehApresentador: boolean }
  | { ok: false; erro: string }

const TAMANHO_MAXIMO = 500
/** Vazão por autor. Segura o dedo nervoso sem atrapalhar conversa de verdade. */
const MAX_POR_JANELA = 5
const JANELA_MS = 30_000

export async function enviarMensagemEvento(
  eventoId: string,
  textoBruto: string,
): Promise<ResultadoMensagem> {
  const texto = textoBruto.replace(/\s+/g, ' ').trim()
  if (!texto) return { ok: false, erro: 'Escreva alguma coisa.' }
  if (texto.length > TAMANHO_MAXIMO) {
    return { ok: false, erro: `Máximo de ${TAMANHO_MAXIMO} caracteres.` }
  }

  const supabase = criarClienteServico()

  const { data: ev } = await supabase
    .from('eventos')
    .select('id, publicado, chat_modo, apresentador_nome, criado_por, inicia_em, duracao_seg')
    .eq('id', eventoId)
    .maybeSingle()

  if (!ev || !ev.publicado) return { ok: false, erro: 'Este encontro não está disponível.' }
  if (ev.chat_modo !== 'proprio') return { ok: false, erro: 'O chat deste encontro está desligado.' }
  if (!janelaDoChatAberta(ev.inicia_em, ev.duracao_seg)) {
    return { ok: false, erro: 'O chat deste encontro já foi encerrado.' }
  }

  // ── quem está falando ──
  const servidor = await criarClienteServidor()
  const { data: auth } = await servidor.auth.getUser()

  let usuarioId: string | null = null
  let inscricaoId: string | null = null
  let autorNome: string | null = null

  if (auth?.user) {
    const { data: perfil } = await supabase.from('perfis').select('nome').eq('id', auth.user.id).maybeSingle()
    usuarioId = auth.user.id
    autorNome = perfil?.nome?.trim() || 'Perito'
  } else {
    const jar = await cookies()
    const token = jar.get(nomeDoCookieDeInscricao(eventoId))?.value
    const email = token ? verificarTokenEmail(token) : null
    if (!email) {
      return { ok: false, erro: 'Inscreva-se no encontro para poder falar no chat.' }
    }
    const { data: insc } = await supabase
      .from('evento_inscricoes')
      .select('id, nome')
      .eq('evento_id', eventoId)
      .ilike('email', email)
      .maybeSingle()
    if (!insc) return { ok: false, erro: 'Inscreva-se no encontro para poder falar no chat.' }
    inscricaoId = insc.id
    autorNome = insc.nome?.trim() || 'Convidado'
  }

  // ── vazão ──
  const desde = new Date(Date.now() - JANELA_MS).toISOString()
  const consulta = supabase
    .from('evento_mensagens')
    .select('id', { count: 'exact', head: true })
    .eq('evento_id', eventoId)
    .gte('criado_em', desde)
  const { count } = usuarioId
    ? await consulta.eq('usuario_id', usuarioId)
    : await consulta.eq('inscricao_id', inscricaoId!)

  if ((count ?? 0) >= MAX_POR_JANELA) {
    return { ok: false, erro: 'Calma: espere alguns segundos antes de mandar de novo.' }
  }

  // Quem conduz ganha marca visual. Comparar pelo id de quem criou o evento, e
  // não pelo nome, porque nome se repete e é justamente o que um impostor
  // usaria.
  const ehApresentador = !!usuarioId && usuarioId === ev.criado_por

  const { data: nova, error } = await supabase
    .from('evento_mensagens')
    .insert({ evento_id: eventoId, usuario_id: usuarioId, inscricao_id: inscricaoId, autor_nome: autorNome, eh_apresentador: ehApresentador, texto })
    .select('id')
    .single()

  if (error) {
    console.error('[chat evento] falhou:', error)
    return { ok: false, erro: 'Não consegui enviar agora. Tente de novo.' }
  }

  return { ok: true, id: nova.id, autorNome: autorNome!, ehApresentador }
}

/**
 * O chat abre uma hora antes e fecha seis horas depois do fim.
 *
 * Antes: dá para a sala encher antes de começar, que é metade da graça de uma
 * live. Depois: quem assiste à gravação no dia seguinte ainda comenta, mas o
 * chat de um evento de três meses atrás não fica aberto para sempre virando
 * caixa de spam sem ninguém olhando.
 */
function janelaDoChatAberta(iniciaEm: string | null, duracaoSeg: number): boolean {
  if (!iniciaEm) return false
  const inicio = +new Date(iniciaEm)
  const agora = Date.now()
  return agora >= inicio - 60 * 60_000 && agora <= inicio + duracaoSeg * 1000 + 6 * 60 * 60_000
}

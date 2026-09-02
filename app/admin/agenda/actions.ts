'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'
import { criarClienteServico } from '@/lib/supabase/servico'
import { deBrasiliaParaISO, somarSemanasEmBrasilia } from '@/lib/evento/relogio'
import { enviarEmailConvidado } from '@/lib/email/enviarConvidado'
import { emailEvento } from '@/lib/email/templates/evento'
import { dadosDoEmail, type EventoParaEmail } from '@/lib/evento/email'

type Resultado = { ok: true; id?: string } | { ok: false; erro: string }

async function checarPermissao() {
  const admin = await obterAdminAtual()
  if (!temPermissao(admin, 'agenda')) return null
  return admin
}

function revalidar(id?: string) {
  revalidatePath('/admin/agenda')
  if (id) revalidatePath(`/admin/agenda/${id}`)
  revalidatePath('/agenda')
  revalidatePath('/comunidade')
  revalidatePath('/')
}

function montarCampos(formData: FormData) {
  const iniciaEmRaw = (formData.get('inicia_em') as string)?.trim()
  return {
    titulo: (formData.get('titulo') as string)?.trim(),
    tipo: (formData.get('tipo') as string)?.trim(),
    descricao: (formData.get('descricao') as string)?.trim() || null,
    // ⚠️ O campo entrega um relógio de parede sem fuso ("2026-10-06T19:00").
    // `new Date()` o interpretaria no fuso de quem executa, que na Vercel é
    // UTC: o evento nascia três horas mais cedo, e cada salvamento seguinte
    // andava mais três. Ver lib/evento/relogio.ts.
    inicia_em: deBrasiliaParaISO(iniciaEmRaw),
    duracao_seg: Number((formData.get('duracao_seg') as string) || 3600),
    link_transmissao: (formData.get('link_transmissao') as string)?.trim() || null,
    gravacao_url: (formData.get('gravacao_url') as string)?.trim() || null,
    apresentador_nome: (formData.get('apresentador_nome') as string)?.trim() || null,
    apresentador_cargo: (formData.get('apresentador_cargo') as string)?.trim() || null,
    meta_extra: (formData.get('meta_extra') as string)?.trim() || null,
    curso_id: (formData.get('curso_id') as string)?.trim() || null,
    alvo_rotulo: (formData.get('alvo_rotulo') as string)?.trim() || null,
    visibilidade: (formData.get('visibilidade') as string)?.trim() || 'todos',
    gravar: formData.get('gravar') === 'on',
    lembrete: formData.get('lembrete') === 'on',
    publicar_feed: formData.get('publicar_feed') === 'on',
    // Live aberta a quem não é aluno. Nasce desligada e é ligada evento a
    // evento — abrir por engano entrega de graça o que se vende, e ninguém
    // percebe uma sala aberta demais.
    aberto_ao_publico: formData.get('aberto_ao_publico') === 'on',
    chat_modo: ['nenhum', 'youtube', 'proprio'].includes(String(formData.get('chat_modo')))
      ? String(formData.get('chat_modo'))
      : 'proprio',
  }
}

export async function criarEvento(formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const admin = await obterAdminAtual()
  const campos = montarCampos(formData)
  if (!campos.titulo || campos.titulo.length < 3) return { ok: false, erro: 'Título precisa ter pelo menos 3 caracteres.' }
  if (!['sala_analise', 'aula_ao_vivo', 'plantao', 'mentoria', 'lancamento'].includes(campos.tipo)) {
    return { ok: false, erro: 'Tipo inválido.' }
  }

  const supabase = await criarClienteServidor()
  const { data, error } = await supabase
    .from('eventos')
    .insert({ ...campos, publicado: false, criado_por: admin?.usuarioId ?? null })
    .select('id')
    .single()

  if (error) return { ok: false, erro: error.message }
  revalidar(data.id)
  return { ok: true, id: data.id }
}

export async function atualizarEvento(id: string, formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const campos = montarCampos(formData)
  if (!campos.titulo || campos.titulo.length < 3) return { ok: false, erro: 'Título precisa ter pelo menos 3 caracteres.' }
  if (!['sala_analise', 'aula_ao_vivo', 'plantao', 'mentoria', 'lancamento'].includes(campos.tipo)) {
    return { ok: false, erro: 'Tipo inválido.' }
  }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('eventos').update(campos).eq('id', id)
  if (error) return { ok: false, erro: error.message }
  revalidar(id)
  return { ok: true }
}

/**
 * ══════════════════════════════════════════════════════════════════
 * REPETIR O ENCONTRO NA SEMANA SEGUINTE
 *
 * A aula ao vivo é semanal, e não existe — nem deve existir — evento
 * recorrente neste banco. ⚠️ UM registro servindo várias quartas quebraria
 * tudo que pendura nele: `evento_inscricoes` é por `evento_id`, os três
 * lembretes são por evento, e a porta da aula única CONTA ENCONTROS
 * DISTINTOS. Com um registro só, a pessoa se inscreveria uma vez e viria para
 * sempre — o oposto exato da regra.
 *
 * Então cada quarta é um registro, e o que se automatiza é a cópia.
 * ══════════════════════════════════════════════════════════════════
 *
 * O que a cópia NÃO leva, e cada omissão tem motivo:
 *
 *   publicado          nasce rascunho, como todo evento criado por aqui. O
 *                      link de divulgação não pode existir antes de alguém
 *                      conferir a data.
 *   slug               é o ENDEREÇO, e endereço não se duplica. Deixado nulo,
 *                      o trigger gera um livre a partir do título.
 *   link_transmissao   ⚠️ a sala da semana passada. Copiá-lo mandaria os
 *                      inscritos da quarta que vem para uma transmissão
 *                      encerrada, e o campo preenchido não pede para ser
 *                      revisto — ninguém troca o que parece pronto.
 *   gravacao_url       pelo mesmo motivo, e pior: seria a gravação de OUTRO
 *                      encontro anunciada como o desta semana.
 *   visualizacoes      contador do encontro anterior.
 *   confirmados_base   idem.
 *   oferta_liberada    ⚠️ o interruptor do pitch da semana passada. Herdado, a
 *                      live nova abriria com a faixa de venda já na tela às
 *                      11h — exatamente o infomercial de uma hora que o
 *                      interruptor existe para evitar.
 *
 * ⚠️ `gravacao_thumb_url` FICA, apesar do nome. Ela não é a miniatura da
 * gravação: é a CAPA do encontro — `evento-publico.ts` a expõe como
 * `imagemUrl`, e é ela que vira a imagem do cartão que o WhatsApp monta para o
 * link. O `generateMetadata` do `/evento/[slug]` chama esse cartão de "a
 * metade do recurso", e uma série semanal sem capa perderia a metade toda
 * semana. Herdá-la é o certo justamente porque a arte da série é a mesma.
 *
 * As inscrições e reservas ficam onde estão: são de quem veio naquele dia.
 */
export async function repetirEvento(id: string, semanas = 1): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const admin = await obterAdminAtual()
  const supabase = await criarClienteServidor()

  const { data: original, error: erroLeitura } = await supabase
    .from('eventos')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (erroLeitura) return { ok: false, erro: erroLeitura.message }
  if (!original) return { ok: false, erro: 'Encontro não encontrado.' }
  if (!original.inicia_em) return { ok: false, erro: 'O encontro original não tem data para repetir.' }

  const novaData = somarSemanasEmBrasilia(original.inicia_em, semanas)
  if (!novaData) return { ok: false, erro: 'Não consegui calcular a data da próxima semana.' }

  const {
    id: _id, criado_em: _criadoEm, slug: _slug, publicado: _publicado,
    link_transmissao: _link, gravacao_url: _gravacao,
    visualizacoes: _views, confirmados_base: _confirmados,
    oferta_liberada: _oferta,
    ...conteudo
  } = original as Record<string, unknown>

  const { data, error } = await supabase
    .from('eventos')
    .insert({
      ...conteudo,
      inicia_em: novaData,
      publicado: false,
      slug: null,
      link_transmissao: null,
      gravacao_url: null,
      oferta_liberada: false,
      criado_por: admin?.usuarioId ?? null,
    })
    .select('id')
    .single()

  if (error) return { ok: false, erro: error.message }
  revalidar(data.id)
  return { ok: true, id: data.id }
}

export async function alternarPublicacaoEvento(id: string, publicado: boolean): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('eventos').update({ publicado }).eq('id', id)
  if (error) return { ok: false, erro: error.message }
  revalidar(id)
  return { ok: true }
}

export async function excluirEvento(id: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('eventos').delete().eq('id', id)
  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true }
}

export async function uploadThumbEvento(id: string, formData: FormData): Promise<Resultado & { thumbUrl?: string }> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const arquivo = formData.get('thumb') as File | null
  if (!arquivo || arquivo.size === 0) return { ok: false, erro: 'Selecione uma imagem.' }
  const ext = arquivo.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return { ok: false, erro: 'Formato não aceito. Use JPG, PNG ou WebP.' }
  if (arquivo.size > 5 * 1024 * 1024) return { ok: false, erro: 'Imagem muito grande. Máximo 5 MB.' }

  const supabase = await criarClienteServidor()
  const path = `eventos/${id}/thumb.${ext}`
  const buffer = Buffer.from(await arquivo.arrayBuffer())
  const { error: upErr } = await supabase.storage.from('capas').upload(path, buffer, { contentType: arquivo.type, upsert: true })
  if (upErr) return { ok: false, erro: upErr.message }

  const { data: urlData } = supabase.storage.from('capas').getPublicUrl(path)
  const thumbUrl = urlData.publicUrl + '?t=' + Date.now()

  const { error } = await supabase.from('eventos').update({ gravacao_thumb_url: thumbUrl }).eq('id', id)
  if (error) return { ok: false, erro: error.message }
  revalidar(id)
  return { ok: true, thumbUrl }
}


// ══════════════════════════════════════════════════════════════════
// ANUNCIAR UM EVENTO PARA OS ALUNOS
//
// Publicar um evento não avisava ninguém: a linha entrava em `eventos`, o card
// aparecia em `/agenda`, e quem não passasse por lá naquela semana nunca ficava
// sabendo. Esta é a porta que faltava.
//
// ── POR QUE É UM BOTÃO, E NÃO AUTOMÁTICO NA PUBLICAÇÃO ──
//
// `publicado` é um interruptor que se liga e desliga: para revisar o horário,
// para corrigir o título, para tirar do ar por um minuto. Anunciar
// automaticamente nessa transição significa que despublicar e republicar
// manda o email de novo, e que uma correção de vírgula às onze da noite vira
// uma leva para a base inteira.
//
// Email não tem desfazer. Um gesto explícito, com a contagem do público na
// frente antes de confirmar, é a única forma de a pessoa que aperta saber para
// quantos está mandando.
//
// ⚠️ RECUSA em vez de adivinhar. Se `evento_audiencia` devolver ninguém — o
// que acontece com `visibilidade` de assinatura ou turma, que não têm do que
// derivar o público — a ação para e explica. Mandar para todos "porque não
// souberam para quem" é entregar ao público geral o que foi marcado como
// exclusivo, e isso não tem volta.
// ══════════════════════════════════════════════════════════════════

type ResultadoAnuncio =
  | { ok: true; enviados: number; total: number }
  | { ok: false; erro: string }

type Pessoa = { usuario_id: string; nome: string | null; email: string }

/** Só conta o público, sem mandar nada. É o número que o botão mostra antes. */
export async function contarAudienciaEvento(id: string): Promise<number> {
  if (!(await checarPermissao())) return 0
  const supabase = criarClienteServico()
  const { data } = await supabase.rpc('evento_audiencia', { p_evento: id })
  return (data as Pessoa[] | null)?.length ?? 0
}

export async function anunciarEvento(id: string): Promise<ResultadoAnuncio> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const supabase = criarClienteServico()

  const { data: ev } = await supabase
    .from('eventos')
    .select('id, slug, titulo, tipo, descricao, inicia_em, duracao_seg, apresentador_nome, publicado, visibilidade')
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

  let enviados = 0
  for (const pessoa of audiencia) {
    const { assunto, html } = emailEvento('anuncio', dadosDoEmail(ev as EventoParaEmail, pessoa.nome ?? 'Perito'))
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
    await new Promise(res => setTimeout(res, 600))
  }

  revalidar(id)
  return { ok: true, enviados, total: audiencia.length }
}

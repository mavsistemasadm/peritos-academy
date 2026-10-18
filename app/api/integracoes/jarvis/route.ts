// ══════════════════════════════════════════════════════
// /api/integracoes/jarvis — a porta do Jarvis na Academy (17/10/2026)
//
// O Jarvis (assistente de voz do dono, repositório jarvis-nexus) consulta e
// age na Academy por aqui, sempre pelos MESMOS núcleos das telas do admin:
// `concederAcessoNaAcademy` (a matrícula de /admin/acessos) e
// `anunciarEventoNucleo` (o anúncio de /admin/agenda). Do lado de lá, toda
// escrita só sai depois de o dono confirmar por voz.
//
//   POST { acao, ... }   headers: x-jarvis-key: JARVIS_ACADEMY_KEY
//
//   cursos                                  cursos publicados (slug e título)
//   eventos                                 próximos eventos com o público de cada um
//   matricular { email, cursoSlug, meses? } matrícula num curso (meses ausente = vitalício)
//   anunciar   { eventoId }                 anúncio por email, sino e celular, e liga os
//                                           lembretes da véspera e do dia para todos
//   anuncio_teste { eventoId, email }       o email do anúncio só para esse endereço
//   abrir_ao_publico { eventoId }           quem não é aluno passa a poder se inscrever
//   grupos                                  grupos de WhatsApp: os escolhidos e os que o número vê
//   grupos_definir { jids: [{jid,nome}] }   quais grupos recebem as lives
//   grupos_teste { eventoId, numero }       o convite do grupo só no WhatsApp do dono
//   grupos_anunciar { eventoId }            o convite nos grupos, e liga o "é hoje" e o "ao vivo"
//   criar_evento { titulo, quando, ... }     live nova, já publicada (18/10/2026)
//   pendentes_gravacao                      lives que já acabaram, com YouTube e sem gravação
//   gravacao { eventoId, url }              grava o link da gravação (só se ainda vazio)
//   duvidas { eventoId? }                   dúvidas mandadas antes da live de tira-dúvidas
//
// ⚠️ A matrícula NÃO cria conta: email sem conta volta `sem_conta`, como no
// lote de /admin/acessos. Conta fantasma por erro de voz é para sempre.
// ⚠️ Nenhum email sai na matrícula, como em toda aquela tela.
// ⚠️ criar_evento recebe a hora como RELÓGIO DE BRASÍLIA ("2026-10-28T19:00"),
// convertido por deBrasiliaParaISO, o mesmo do editor: a Vercel roda em UTC e
// `new Date()` faria a live nascer três horas antes (ver CLAUDE.md, 01/09).
// Ela nasce PUBLICADA, porque é o que faz a data aparecer na agenda e na home
// do Nexus; publicar não manda email nenhum (anunciar é outro passo).
// ══════════════════════════════════════════════════════
import { NextResponse, after, type NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { criarClienteServico } from '@/lib/supabase/servico'
import { concederAcessoNaAcademy, daquiAMeses } from '@/lib/acessos/conceder'
import { anunciarEventoNucleo, contarAudienciaDoEvento } from '@/lib/evento/anunciar'
import { deBrasiliaParaISO } from '@/lib/evento/relogio'
import { garantirTextosEmail } from '@/lib/evento/textos'
import { descobrirGrupos, gruposLigados, publicarNosGrupos, testeNoWhatsapp } from '@/lib/whatsapp/grupos'
import { enviarEmailConvidado } from '@/lib/email/enviarConvidado'
import { emailEvento } from '@/lib/email/templates/evento'
import { dadosDoEmail, type EventoParaEmail } from '@/lib/evento/email'
import { SITE_URL } from '@/lib/site'

const TIPOS = ['sala_analise', 'aula_ao_vivo', 'plantao', 'mentoria', 'lancamento']

// O anúncio manda um email a cada 600ms: 100 alunos são um minuto.
export const maxDuration = 300

function chaveConfere(recebida: string | null): boolean {
  const esperada = (process.env.JARVIS_ACADEMY_KEY || '').trim()
  if (!esperada || !recebida) return false
  const a = Buffer.from(recebida)
  const b = Buffer.from(esperada)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: NextRequest) {
  if (!chaveConfere(request.headers.get('x-jarvis-key'))) {
    return NextResponse.json({ erro: 'não autorizado' }, { status: 401 })
  }
  const corpo = await request.json().catch(() => ({} as Record<string, unknown>))
  const acao = corpo.acao as string
  const sb = criarClienteServico()

  if (acao === 'cursos') {
    const { data } = await sb.from('cursos').select('slug, titulo, restrito').eq('publicado', true).order('titulo')
    return NextResponse.json({ cursos: data ?? [] })
  }

  if (acao === 'eventos') {
    const { data } = await sb.from('eventos')
      .select('id, titulo, slug, inicia_em, publicado, visibilidade, aberto_ao_publico, link_transmissao')
      .gte('inicia_em', new Date(Date.now() - 3 * 3600_000).toISOString())
      .order('inicia_em').limit(10)
    const eventos = await Promise.all((data ?? []).map(async e => ({
      ...e, link: `${SITE_URL}/evento/${e.slug}`,
      publico: e.publicado ? await contarAudienciaDoEvento(e.id) : 0,
    })))
    return NextResponse.json({ eventos })
  }

  if (acao === 'matricular') {
    const slug = String(corpo.cursoSlug || '')
    const { data: curso } = await sb.from('cursos').select('id, titulo').eq('slug', slug).maybeSingle()
    if (!curso) return NextResponse.json({ ok: false, erro: `Curso "${slug}" não encontrado.` }, { status: 400 })
    const meses = corpo.meses == null ? null : Number(corpo.meses)
    const r = await concederAcessoNaAcademy({
      email: String(corpo.email || ''),
      nome: '',
      escopo: 'curso',
      cursoId: curso.id,
      vitalicio: meses == null,
      expiraEm: meses == null ? null : daquiAMeses(meses),
      observacao: 'Matrícula pelo Jarvis',
      permitirCriarConta: false,
    })
    return NextResponse.json({ ...r, curso: curso.titulo })
  }

  if (acao === 'anunciar') {
    // Pelo Jarvis, o anúncio também liga os lembretes da véspera e do dia
    // para a audiência inteira (ver o cron email-evento-lembrete).
    await sb.from('eventos').update({ lembrar_audiencia: true }).eq('id', String(corpo.eventoId || ''))
    // Em segundo plano (`after`): 500+ emails levam quase 5 minutos, e o
    // Jarvis não pode ficar pendurado esperando. A resposta diz quantos vão.
    const id = String(corpo.eventoId || '')
    const total = await contarAudienciaDoEvento(id)
    if (!total) return NextResponse.json({ ok: false, erro: 'Ninguém para avisar neste evento.' }, { status: 400 })
    after(async () => {
      const r = await anunciarEventoNucleo(id)
      if (!r.ok) console.error('[jarvis] anúncio falhou:', r.erro)
    })
    return NextResponse.json({ ok: true, total, nota: 'O anúncio está saindo agora, leva alguns minutos.' })
  }

  if (acao === 'criar_evento') {
    const titulo = String(corpo.titulo || '').trim()
    const iniciaEm = deBrasiliaParaISO(String(corpo.quando || ''))
    if (titulo.length < 3) return NextResponse.json({ ok: false, erro: 'Título curto demais.' }, { status: 400 })
    if (!iniciaEm) return NextResponse.json({ ok: false, erro: 'Data e hora no formato AAAA-MM-DDTHH:MM, horário de Brasília.' }, { status: 400 })
    if (new Date(iniciaEm).getTime() < Date.now()) return NextResponse.json({ ok: false, erro: 'Essa data já passou.' }, { status: 400 })
    const tipo = TIPOS.includes(String(corpo.tipo)) ? String(corpo.tipo) : 'aula_ao_vivo'
    const { data, error } = await sb.from('eventos').insert({
      titulo,
      tipo,
      descricao: String(corpo.descricao || '').trim() || null,
      inicia_em: iniciaEm,
      duracao_seg: Math.round(Number(corpo.duracaoMin || 60) * 60),
      link_transmissao: String(corpo.linkTransmissao || '').trim() || null,
      apresentador_nome: String(corpo.apresentador || '').trim() || 'Marlos Henrique',
      visibilidade: 'todos',
      aberto_ao_publico: corpo.abertoAoPublico === true,
      // Live de tira-dúvidas: a página recebe a dúvida antes, com anexo, e o
      // convite e os lembretes chamam para mandar. Plantão já nasce assim.
      recebe_duvidas: corpo.tiraDuvidas === true || (corpo.tiraDuvidas !== false && tipo === 'plantao'),
      publicado: true,
    }).select('id, slug, inicia_em').single()
    if (error) return NextResponse.json({ ok: false, erro: error.message }, { status: 400 })
    // Os textos de cada email, sobre o assunto, já na criação: o teste do
    // anúncio e os lembretes saem com eles sem esperar.
    after(() => garantirTextosEmail({ id: data.id, titulo, descricao: String(corpo.descricao || '') || null, tipo }).then(() => undefined))
    return NextResponse.json({ ok: true, ...data, link: `${SITE_URL}/evento/${data.slug}` })
  }

  // As dúvidas que chegaram para uma live de tira-dúvidas (a próxima, se não
  // vier o id). Só leitura: dar baixa é na tela, durante a live.
  if (acao === 'duvidas') {
    let id = String(corpo.eventoId || '')
    if (!id) {
      const { data: prox } = await sb.from('eventos').select('id').eq('recebe_duvidas', true)
        .gte('inicia_em', new Date(Date.now() - 6 * 3600_000).toISOString()).order('inicia_em').limit(1).maybeSingle()
      id = prox?.id || ''
    }
    if (!id) return NextResponse.json({ ok: true, evento: null, total: 0, abertas: 0, duvidas: [] })
    const [{ data: ev }, { data: ds }] = await Promise.all([
      sb.from('eventos').select('id, titulo, inicia_em, recebe_duvidas').eq('id', id).maybeSingle(),
      sb.from('evento_duvidas').select('nome, texto, anexo_nome, status, criado_em, usuario_id').eq('evento_id', id).order('criado_em'),
    ])
    const lista = ds ?? []
    return NextResponse.json({
      ok: true, evento: ev, total: lista.length, abertas: lista.filter(d => d.status === 'aberta').length,
      pagina: `${SITE_URL}/admin/agenda/${id}/duvidas`,
      duvidas: lista.map(d => ({ nome: d.nome, aluno: !!d.usuario_id, texto: d.texto.slice(0, 400), anexo: d.anexo_nome, respondida: d.status === 'respondida' })),
    })
  }

  if (acao === 'anuncio_teste') {
    const { data: ev } = await sb.from('eventos')
      .select('id, slug, titulo, tipo, descricao, inicia_em, duracao_seg, apresentador_nome, textos_email, recebe_duvidas')
      .eq('id', String(corpo.eventoId || '')).maybeSingle()
    if (!ev) return NextResponse.json({ ok: false, erro: 'Evento não encontrado.' }, { status: 400 })
    const textos = await garantirTextosEmail(ev)
    const { assunto, html } = emailEvento('anuncio', dadosDoEmail(ev as EventoParaEmail, 'Marlos'), { tema: textos?.anuncio, gancho: textos?.assuntos?.anuncio })
    // refId próprio: não conta como o anúncio real (ref_id = id do evento) no
    // dedupe, e cada teste é um envio novo.
    const r = await enviarEmailConvidado({
      para: String(corpo.email || ''), tipo: 'evento_anuncio', refId: `teste:${ev.id}:${Date.now()}`,
      assunto: `[TESTE] ${assunto}`, html,
    })
    return NextResponse.json({ ok: r.enviado, motivo: r.motivo, assunto })
  }

  if (acao === 'abrir_ao_publico') {
    const { data, error } = await sb.from('eventos').update({ aberto_ao_publico: true })
      .eq('id', String(corpo.eventoId || '')).select('slug')
    if (error || !data?.length) return NextResponse.json({ ok: false, erro: error?.message ?? 'Evento não encontrado.' }, { status: 400 })
    return NextResponse.json({ ok: true, link: `${SITE_URL}/evento/${data[0].slug}` })
  }

  if (acao === 'grupos') {
    const { data: escolhidos } = await sb.from('whatsapp_grupos').select('jid, nome, ativo')
    let disponiveis: unknown = null
    try { disponiveis = await descobrirGrupos() } catch (e) { disponiveis = { erro: (e as Error).message } }
    return NextResponse.json({ ligado: gruposLigados(), escolhidos: escolhidos ?? [], disponiveis })
  }

  if (acao === 'grupos_definir') {
    const lista = (Array.isArray(corpo.jids) ? corpo.jids : []) as { jid: string; nome: string }[]
    const validos = lista.filter(g => /@g\.us$/.test(String(g?.jid)) && g?.nome)
    if (!validos.length) return NextResponse.json({ ok: false, erro: 'Nenhum grupo válido.' }, { status: 400 })
    // Escolher é substituir: o que não está na lista nova fica desligado.
    await sb.from('whatsapp_grupos').update({ ativo: false }).neq('jid', '')
    const { error } = await sb.from('whatsapp_grupos').upsert(validos.map(g => ({ jid: g.jid, nome: g.nome, ativo: true })))
    if (error) return NextResponse.json({ ok: false, erro: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, grupos: validos.map(g => g.nome) })
  }

  const eventoDoGrupo = async () => (await sb.from('eventos')
    .select('id, slug, titulo, inicia_em, descricao, tipo, apresentador_nome, textos_email, recebe_duvidas')
    .eq('id', String(corpo.eventoId || '')).maybeSingle()).data

  if (acao === 'grupos_teste') {
    const ev = await eventoDoGrupo()
    if (!ev) return NextResponse.json({ ok: false, erro: 'Evento não encontrado.' }, { status: 400 })
    try {
      return NextResponse.json(await testeNoWhatsapp(ev, String(corpo.numero || '')))
    } catch (e) {
      return NextResponse.json({ ok: false, erro: (e as Error).message }, { status: 400 })
    }
  }

  if (acao === 'grupos_anunciar') {
    const ev = await eventoDoGrupo()
    if (!ev) return NextResponse.json({ ok: false, erro: 'Evento não encontrado.' }, { status: 400 })
    if (!gruposLigados()) {
      return NextResponse.json({ ok: false, erro: 'Os grupos ainda estão desligados (WHATSAPP_GRUPOS_ATIVO): falta conferir se o número é administrador.' }, { status: 400 })
    }
    await sb.from('eventos').update({ avisar_grupos: true }).eq('id', ev.id)
    const r = await publicarNosGrupos(ev, 'anuncio')
    return NextResponse.json({ ok: true, ...r })
  }

  if (acao === 'pendentes_gravacao') {
    const { data } = await sb.from('eventos')
      .select('id, titulo, link_transmissao, inicia_em')
      .is('gravacao_url', null)
      .not('link_transmissao', 'is', null)
      .lt('inicia_em', new Date(Date.now() - 3600_000).toISOString())
      .gte('inicia_em', new Date(Date.now() - 14 * 86400_000).toISOString())
    return NextResponse.json({ eventos: data ?? [] })
  }

  if (acao === 'gravacao') {
    const url = String(corpo.url || '')
    if (!/^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/.test(url)) {
      return NextResponse.json({ ok: false, erro: 'Só link de vídeo do YouTube.' }, { status: 400 })
    }
    // Só preenche o vazio: gravação posta à mão no admin nunca é trocada.
    const { data, error } = await sb.from('eventos').update({ gravacao_url: url })
      .eq('id', String(corpo.eventoId || '')).is('gravacao_url', null).select('id')
    if (error) return NextResponse.json({ ok: false, erro: error.message }, { status: 400 })
    return NextResponse.json({ ok: (data ?? []).length > 0 })
  }

  return NextResponse.json({ erro: `ação desconhecida: ${acao}` }, { status: 400 })
}

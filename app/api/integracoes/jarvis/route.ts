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
//   anunciar   { eventoId }                 anúncio por email e sino
//   criar_evento { titulo, quando, ... }     live nova, já publicada (18/10/2026)
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
import { NextResponse, type NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { criarClienteServico } from '@/lib/supabase/servico'
import { concederAcessoNaAcademy, daquiAMeses } from '@/lib/acessos/conceder'
import { anunciarEventoNucleo, contarAudienciaDoEvento } from '@/lib/evento/anunciar'
import { deBrasiliaParaISO } from '@/lib/evento/relogio'
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
      .select('id, titulo, slug, inicia_em, publicado, visibilidade')
      .gte('inicia_em', new Date(Date.now() - 3 * 3600_000).toISOString())
      .order('inicia_em').limit(10)
    const eventos = await Promise.all((data ?? []).map(async e => ({
      ...e, publico: e.publicado ? await contarAudienciaDoEvento(e.id) : 0,
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
    const r = await anunciarEventoNucleo(String(corpo.eventoId || ''))
    return NextResponse.json(r, { status: r.ok ? 200 : 400 })
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
      publicado: true,
    }).select('id, slug, inicia_em').single()
    if (error) return NextResponse.json({ ok: false, erro: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, ...data, link: `${SITE_URL}/evento/${data.slug}` })
  }

  return NextResponse.json({ erro: `ação desconhecida: ${acao}` }, { status: 400 })
}

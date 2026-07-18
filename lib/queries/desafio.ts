// lib/queries/desafio.ts
// Página do desafio: intimação, documentos, quesitos, entregas da comunidade.
import { criarClienteServidor } from '@/lib/supabase/server'

export type Documento = {
  nome: string
  path: string
  formato: string
  tamanho_kb: number
}

export type Quesito = {
  ordem: number
  enunciado: string
  tipo: 'valor' | 'texto' | 'multipla'
  prefixo?: string
  sufixo?: string
  tolerancia?: number
  resposta_modelo?: string
  opcoes?: string[] | null
}

export type EntregaGaleria = {
  id: string
  usuario_nome: string
  usuario_iniciais: string
  nota: number | null
  tempo_seg: number | null
  arquivo_path: string | null
  entregue_em: string
  curtidas: number
  jaCurtiu: boolean
}

export type DadosDesafio = {
  logado: boolean
  desafio: {
    id: string
    slug: string
    numero: string
    titulo: string
    capa_url: string | null
    categoria_nome: string
    intimacao_texto: string
    mensageiro_nome: string
    mensageiro_cargo: string
    mensagem_texto: string
    instrucoes: string[]
    documentos: Documento[]
    quesitos: Omit<Quesito, 'resposta_modelo'>[]   // sem gabarito pro front
    quesitos_total: number
    prazo_dias: number
    xp: number
    moedas: number
    plano: string
    participantes: number
    nota_minima: number
    gabarito_path: string | null
  }
  // estado do aluno
  aceito_em: string | null
  entregue_em: string | null
  entrega_id: string | null
  respostas_salvas: Record<string, string> | null
  feedbacks: { quesito_ordem: number; nota: number; feedback: string; sugerir_refazer: boolean }[] | null
  nota: number | null
  tempo_seg: number | null
  prazoExpirado: boolean
  tempoRestanteSeg: number | null
  // galeria
  entregas: EntregaGaleria[]
}

export async function carregarDesafio(slug: string): Promise<DadosDesafio | null> {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return null

  const uid = auth.user.id

  const { data: d } = await supabase
    .from('desafios').select('*, desafio_categorias(nome)')
    .eq('slug', slug).eq('publicado', true).single()
  if (!d) return null

  // entrega do aluno (se existir)
  const { data: minhaEntrega } = await supabase
    .from('desafio_entregas').select('*')
    .eq('desafio_id', d.id).eq('usuario_id', uid).maybeSingle()

  // entregas da comunidade (galeria)
  const { data: entregasRaw } = await supabase
    .from('desafio_entregas').select('id, usuario_id, nota, tempo_seg, arquivo_path, entregue_em')
    .eq('desafio_id', d.id).not('entregue_em', 'is', null)
    .order('nota', { ascending: false, nullsFirst: false })
    .limit(20)

  // curtidas
  const { data: curtidasRaw } = await supabase
    .from('desafio_curtidas').select('entrega_id')

  const { data: minhasCurtidas } = await supabase
    .from('desafio_curtidas').select('entrega_id').eq('usuario_id', uid)

  // buscar nomes dos autores das entregas
  const userIds = [...new Set((entregasRaw ?? []).map(e => e.usuario_id))]
  let perfisMap = new Map<string, { nome: string }>()
  if (userIds.length > 0) {
    const { data: perfis } = await supabase
      .from('perfis').select('id, nome').in('id', userIds)
    for (const p of perfis ?? []) perfisMap.set(p.id, p)
  }

  // contar curtidas por entrega
  const curtCount = new Map<string, number>()
  for (const c of curtidasRaw ?? []) {
    curtCount.set(c.entrega_id, (curtCount.get(c.entrega_id) ?? 0) + 1)
  }
  const meusCurtidos = new Set((minhasCurtidas ?? []).map(c => c.entrega_id))

  // contar participantes
  const { count: partCount } = await supabase
    .from('desafio_entregas').select('id', { count: 'exact', head: true })
    .eq('desafio_id', d.id)

  function iniciaisDe(nome: string) {
    return nome.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
  }

  const entregas: EntregaGaleria[] = (entregasRaw ?? []).map(e => {
    const perfil = perfisMap.get(e.usuario_id)
    const nome = perfil?.nome ?? 'Perito'
    return {
      id: e.id,
      usuario_nome: nome,
      usuario_iniciais: iniciaisDe(nome),
      nota: e.nota,
      tempo_seg: e.tempo_seg,
      arquivo_path: e.arquivo_path,
      entregue_em: e.entregue_em,
      curtidas: curtCount.get(e.id) ?? 0,
      jaCurtiu: meusCurtidos.has(e.id),
    }
  })

  // prazo
  const aceito_em = minhaEntrega?.aceito_em ?? null
  let prazoExpirado = false
  let tempoRestanteSeg: number | null = null
  if (aceito_em && !minhaEntrega?.entregue_em) {
    const prazoMs = d.prazo_dias * 24 * 60 * 60 * 1000
    const fimMs = +new Date(aceito_em) + prazoMs
    const restante = fimMs - Date.now()
    prazoExpirado = restante <= 0
    tempoRestanteSeg = Math.max(0, Math.floor(restante / 1000))
  }

  // quesitos sem gabarito (o front não pode ver a resposta_modelo)
  const quesitos = (Array.isArray(d.quesitos) ? d.quesitos : []).map((q: any) => ({
    ordem: q.ordem,
    enunciado: q.enunciado,
    tipo: q.tipo,
prefixo: q.prefixo,
    sufixo: q.sufixo,
    opcoes: q.opcoes ?? null,
  }))

  // respostas salvas (se já aceitou mas não entregou)
  let respostas_salvas: Record<string, string> | null = null
  if (minhaEntrega?.respostas && Array.isArray(minhaEntrega.respostas)) {
    respostas_salvas = {}
    for (const r of minhaEntrega.respostas as any[]) {
      respostas_salvas[String(r.quesito_ordem)] = r.resposta ?? ''
    }
  }

  // feedbacks da IA (se já entregou)
  const feedbacks = minhaEntrega?.feedbacks ?? null

  return {
    logado: true,
    desafio: {
      id: d.id,
      slug: d.slug,
      numero: d.numero ?? '000',
      titulo: d.titulo,
      capa_url: d.capa_url,
      categoria_nome: (d as any).desafio_categorias?.nome ?? 'Geral',
      intimacao_texto: d.intimacao_texto ?? '',
      mensageiro_nome: d.mensageiro_nome ?? 'Advogado',
      mensageiro_cargo: d.mensageiro_cargo ?? '',
      mensagem_texto: d.mensagem_texto ?? '',
      instrucoes: Array.isArray(d.instrucoes) ? d.instrucoes : [],
      documentos: Array.isArray(d.documentos) ? d.documentos : [],
      quesitos,
      quesitos_total: quesitos.length,
      prazo_dias: d.prazo_dias,
      xp: d.xp,
      moedas: d.moedas,
      plano: d.plano ?? 'free',
      participantes: partCount ?? 0,
      nota_minima: d.nota_minima ?? 6,
      gabarito_path: d.gabarito_path,
    },
    aceito_em,
    entregue_em: minhaEntrega?.entregue_em ?? null,
    entrega_id: minhaEntrega?.id ?? null,
    respostas_salvas,
    feedbacks,
    nota: minhaEntrega?.nota ?? null,
    tempo_seg: minhaEntrega?.tempo_seg ?? null,
    prazoExpirado,
    tempoRestanteSeg,
    entregas,
  }
}
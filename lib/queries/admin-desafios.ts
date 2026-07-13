// lib/queries/admin-desafios.ts
import { criarClienteServidor } from '@/lib/supabase/server'

export type CategoriaAdmin = { id: string; nome: string; slug: string; ordem: number; totalDesafios: number }

export type DesafioListaItem = {
  id: string
  numero: string | null
  slug: string
  titulo: string
  categoriaId: string | null
  categoriaNome: string
  capaUrl: string | null
  prazoDias: number
  xp: number
  moedas: number
  notaMinima: number
  publicado: boolean
  totalEntregas: number
}

export type Documento = { nome: string; path: string; formato: string; tamanho_kb: number }
export type Quesito = {
  ordem: number
  enunciado: string
  tipo: 'valor' | 'texto' | 'multipla'
  prefixo?: string | null
  sufixo?: string | null
  tolerancia?: number | null
  resposta_modelo?: string | null
  opcoes?: string[] | null
}

export type DesafioAdmin = {
  id: string
  numero: string | null
  slug: string
  categoriaId: string | null
  titulo: string
  capaUrl: string | null
  intimacaoTexto: string | null
  mensageiroNome: string | null
  mensageiroCargo: string | null
  mensagemTexto: string | null
  instrucoes: string[]
  documentos: Documento[]
  quesitos: Quesito[]
  prazoDias: number
  xp: number
  moedas: number
  plano: string
  gabaritoPath: string | null
  participantesBase: number
  publicado: boolean
  notaMinima: number
}

export type EntregaAdmin = {
  id: string
  usuarioId: string
  usuarioNome: string
  nota: number | null
  tempoSeg: number | null
  arquivoPath: string | null
  aceitoEm: string | null
  entregueEm: string | null
}

export async function carregarCategoriasAdmin(): Promise<CategoriaAdmin[]> {
  const supabase = await criarClienteServidor()
  const { data: categorias } = await supabase.from('desafio_categorias').select('id, nome, slug, ordem').order('ordem')
  if (!categorias || categorias.length === 0) return []

  const { data: desafios } = await supabase.from('desafios').select('categoria_id')
  const contagem = new Map<string, number>()
  for (const d of desafios ?? []) {
    if (!d.categoria_id) continue
    contagem.set(d.categoria_id, (contagem.get(d.categoria_id) ?? 0) + 1)
  }

  return categorias.map(c => ({
    id: c.id, nome: c.nome ?? 'Sem nome', slug: c.slug ?? '', ordem: c.ordem,
    totalDesafios: contagem.get(c.id) ?? 0,
  }))
}

export async function carregarDesafiosAdmin(): Promise<DesafioListaItem[]> {
  const supabase = await criarClienteServidor()
  const { data: desafios } = await supabase
    .from('desafios')
    .select('id, numero, slug, titulo, categoria_id, capa_url, prazo_dias, xp, moedas, nota_minima, publicado')
    .order('criado_em', { ascending: false })
  if (!desafios || desafios.length === 0) return []

  const [{ data: categorias }, { data: entregas }] = await Promise.all([
    supabase.from('desafio_categorias').select('id, nome'),
    supabase.from('desafio_entregas').select('desafio_id'),
  ])
  const categoriasMap = new Map((categorias ?? []).map(c => [c.id, c.nome as string]))
  const entregasPorDesafio = new Map<string, number>()
  for (const e of entregas ?? []) {
    entregasPorDesafio.set(e.desafio_id, (entregasPorDesafio.get(e.desafio_id) ?? 0) + 1)
  }

  return desafios.map(d => ({
    id: d.id, numero: d.numero, slug: d.slug, titulo: d.titulo ?? 'Sem título',
    categoriaId: d.categoria_id, categoriaNome: d.categoria_id ? categoriasMap.get(d.categoria_id) ?? 'Geral' : 'Geral',
    capaUrl: d.capa_url, prazoDias: d.prazo_dias, xp: d.xp, moedas: d.moedas,
    notaMinima: Number(d.nota_minima), publicado: d.publicado,
    totalEntregas: entregasPorDesafio.get(d.id) ?? 0,
  }))
}

export async function carregarDesafioAdmin(id: string): Promise<DesafioAdmin | null> {
  const supabase = await criarClienteServidor()
  const { data: d } = await supabase.from('desafios').select('*').eq('id', id).single()
  if (!d) return null

  return {
    id: d.id, numero: d.numero, slug: d.slug, categoriaId: d.categoria_id, titulo: d.titulo ?? '',
    capaUrl: d.capa_url, intimacaoTexto: d.intimacao_texto, mensageiroNome: d.mensageiro_nome,
    mensageiroCargo: d.mensageiro_cargo, mensagemTexto: d.mensagem_texto,
    instrucoes: Array.isArray(d.instrucoes) ? d.instrucoes : [],
    documentos: Array.isArray(d.documentos) ? d.documentos : [],
    quesitos: Array.isArray(d.quesitos) ? d.quesitos : [],
    prazoDias: d.prazo_dias, xp: d.xp, moedas: d.moedas, plano: d.plano,
    gabaritoPath: d.gabarito_path, participantesBase: d.participantes_base,
    publicado: d.publicado, notaMinima: Number(d.nota_minima),
  }
}

export async function carregarEntregasDesafio(desafioId: string): Promise<EntregaAdmin[]> {
  const supabase = await criarClienteServidor()
  const { data: entregas } = await supabase
    .from('desafio_entregas')
    .select('id, usuario_id, nota, tempo_seg, arquivo_path, aceito_em, entregue_em')
    .eq('desafio_id', desafioId)
    .order('entregue_em', { ascending: false, nullsFirst: false })
  if (!entregas || entregas.length === 0) return []

  const userIds = [...new Set(entregas.map(e => e.usuario_id))]
  const { data: perfis } = await supabase.from('perfis').select('id, nome').in('id', userIds)
  const perfisMap = new Map((perfis ?? []).map(p => [p.id, p.nome as string]))

  return entregas.map(e => ({
    id: e.id, usuarioId: e.usuario_id, usuarioNome: perfisMap.get(e.usuario_id) ?? 'Perito',
    nota: e.nota === null ? null : Number(e.nota), tempoSeg: e.tempo_seg,
    arquivoPath: e.arquivo_path, aceitoEm: e.aceito_em, entregueEm: e.entregue_em,
  }))
}

// lib/queries/desafios.ts
// Galeria de desafios: cards com categoria, participantes, prazo, recompensas.
import { criarClienteServidor } from '@/lib/supabase/server'

export type CategoriaDesafio = {
  slug: string
  nome: string
  qtd: number
}

export type DesafioCard = {
  slug: string
  numero: string
  titulo: string
  capa_url: string | null
  categoria_slug: string
  categoria_nome: string
  prazo_dias: number
  xp: number
  moedas: number
  plano: string
  participantes: number
  quesitos: number
  documentos: number
  jaAceitou: boolean
  jaEntregou: boolean
  nota: number | null
}

export type DadosDesafios = {
  logado: boolean
  categorias: CategoriaDesafio[]
  desafios: DesafioCard[]
  totalDesafios: number
  totalEntregas: number
}

export async function carregarDesafios(): Promise<DadosDesafios> {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return { logado: false, categorias: [], desafios: [], totalDesafios: 0, totalEntregas: 0 }

  const uid = auth.user.id

  const [{ data: catsRaw }, { data: desafiosRaw }, { data: entregasRaw }, { data: todasEntregas }] =
    await Promise.all([
      supabase.from('desafio_categorias').select('*').order('ordem'),
      supabase.from('desafios').select('*').eq('publicado', true).order('criado_em', { ascending: false }),
      supabase.from('desafio_entregas').select('desafio_id, aceito_em, entregue_em, nota').eq('usuario_id', uid),
      supabase.from('desafio_entregas').select('desafio_id'),
    ])

  const cats = (catsRaw ?? [])
  const entregas = new Map((entregasRaw ?? []).map(e => [e.desafio_id, e]))

  // contar participantes por desafio (todos os usuários)
  const partCount = new Map<string, number>()
  for (const e of todasEntregas ?? []) {
    partCount.set(e.desafio_id, (partCount.get(e.desafio_id) ?? 0) + 1)
  }

  const desafios: DesafioCard[] = (desafiosRaw ?? []).map(d => {
    const cat = cats.find(c => c.id === d.categoria_id)
    const entrega = entregas.get(d.id)
    const quesitos = Array.isArray(d.quesitos) ? d.quesitos : []
    const documentos = Array.isArray(d.documentos) ? d.documentos : []
    return {
      slug: d.slug,
      numero: d.numero ?? '000',
      titulo: d.titulo,
      capa_url: d.capa_url,
      categoria_slug: cat?.slug ?? 'geral',
      categoria_nome: cat?.nome ?? 'Geral',
      prazo_dias: d.prazo_dias,
      xp: d.xp,
      moedas: d.moedas,
      plano: d.plano ?? 'free',
      participantes: partCount.get(d.id) ?? 0,
      quesitos: quesitos.length,
      documentos: documentos.length,
      jaAceitou: !!entrega?.aceito_em,
      jaEntregou: !!entrega?.entregue_em,
      nota: entrega?.nota ?? null,
    }
  })

  // contagem por categoria
  const categorias: CategoriaDesafio[] = cats.map(c => ({
    slug: c.slug,
    nome: c.nome,
    qtd: desafios.filter(d => d.categoria_slug === c.slug).length,
  })).filter(c => c.qtd > 0)

  const minhasEntregas = (entregasRaw ?? []).filter(e => e.entregue_em).length

  return {
    logado: true,
    categorias,
    desafios,
    totalDesafios: desafios.length,
    totalEntregas: minhasEntregas,
  }
}
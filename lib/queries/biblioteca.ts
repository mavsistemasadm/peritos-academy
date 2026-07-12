// lib/queries/biblioteca.ts
// Biblioteca do perito: planilhas, laudos e petições por área.
import { criarClienteServidor } from '@/lib/supabase/server'

export type ItemBiblioteca = {
  id: string
  tipo: 'planilha' | 'laudo' | 'peticao'
  nome: string
  descricao: string | null
  formato: string
  tamanhoKb: number | null
  downloads: number
  atualizadoEm: string
  novo: boolean            // atualizado nos últimos 30 dias
  favorita: boolean
  baixada: boolean         // este aluno já baixou
}

export type AreaBiblioteca = {
  slug: string
  nome: string
  itens: ItemBiblioteca[]
}

export type DadosBiblioteca = {
  logado: boolean
  temAcesso: boolean       // o grupo restrito
  areas: AreaBiblioteca[]
  totalItens: number
  totalDownloads: number
  maisBaixadas: ItemBiblioteca[]   // top 4 geral
}

const VAZIO: DadosBiblioteca = {
  logado: false, temAcesso: false, areas: [],
  totalItens: 0, totalDownloads: 0, maisBaixadas: [],
}

export async function carregarBiblioteca(): Promise<DadosBiblioteca> {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return VAZIO

  const [{ data: perfil }, { data: areasRaw }, { data: itensRaw }, { data: downloadsRaw }, { data: favoritasRaw }, { data: minhasRaw }] =
    await Promise.all([
      supabase.from('perfis').select('acesso_biblioteca').eq('id', auth.user.id).single(),
      supabase.from('planilha_areas').select('*').order('ordem'),
      supabase.from('planilhas').select('*').eq('publicado', true).order('atualizado_em', { ascending: false }),
      supabase.from('planilha_downloads').select('planilha_id'),
      supabase.from('planilha_favoritas').select('planilha_id'),
      supabase.from('planilha_downloads').select('planilha_id').eq('usuario_id', auth.user.id),
    ])

  // contagem real de downloads por item (RLS limita o select geral aos meus;
  // por isso o total público = downloads_base + meus registros são contados
  // no servidor via downloads_base — o número exibido é base + count visível)
  const contagem = new Map<string, number>()
  for (const d of downloadsRaw ?? []) {
    contagem.set(d.planilha_id, (contagem.get(d.planilha_id) ?? 0) + 1)
  }
  const favoritas = new Set((favoritasRaw ?? []).map(f => f.planilha_id))
  const minhas = new Set((minhasRaw ?? []).map(m => m.planilha_id))

  const TRINTA_DIAS = 30 * 864e5
  const montaItem = (p: any): ItemBiblioteca => ({
    id: p.id,
    tipo: p.tipo ?? 'planilha',
    nome: p.nome,
    descricao: p.descricao,
    formato: p.formato ?? 'xlsx',
    tamanhoKb: p.tamanho_kb,
    downloads: (p.downloads_base ?? 0) + (contagem.get(p.id) ?? 0),
    atualizadoEm: p.atualizado_em,
    novo: p.atualizado_em ? (Date.now() - +new Date(p.atualizado_em) < TRINTA_DIAS) : false,
    favorita: favoritas.has(p.id),
    baixada: minhas.has(p.id),
  })

  const itens = (itensRaw ?? []).map(montaItem)
  const porArea = new Map<string, ItemBiblioteca[]>()
  for (const p of itensRaw ?? []) {
    const item = itens.find(i => i.id === p.id)!
    if (!porArea.has(p.area_id)) porArea.set(p.area_id, [])
    porArea.get(p.area_id)!.push(item)
  }

  const areas: AreaBiblioteca[] = (areasRaw ?? [])
    .map(a => ({ slug: a.slug, nome: a.nome, itens: porArea.get(a.id) ?? [] }))
    .filter(a => a.itens.length > 0)

  return {
    logado: true,
    temAcesso: perfil?.acesso_biblioteca === true,
    areas,
    totalItens: itens.length,
    totalDownloads: itens.reduce((s, i) => s + i.downloads, 0),
    maisBaixadas: [...itens].sort((a, b) => b.downloads - a.downloads).slice(0, 4),
  }
}
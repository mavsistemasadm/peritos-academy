// lib/queries/comunidade.ts
// Carrega tudo que a página da Comunidade precisa, numa passada só.
import { criarClienteServidor } from '@/lib/supabase/server'

export type Espaco = {
  id: string
  nome: string
  slug: string
  qtd: number          // qtd_base + posts reais
  temNovo: boolean     // post nas últimas 24h
}

export type MelhorResposta = {
  autor_nome: string
  autor_selo: string | null
  corpo: string
}

export type Post = {
  id: string
  espaco_id: string
  espaco_nome: string
  autor_nome: string
  autor_nivel: number | null
  tipo: 'caso' | 'duvida' | 'vitoria'
  titulo: string | null
  corpo: string | null
  respondida: boolean
  vitoria_rotulo: string | null
  vitoria_detalhe: string | null
  uteis: number            // uteis_base + reações reais
  comentarios: number      // comentarios_base + comentários reais
  criado_em: string
  minhaTurma: boolean      // por ora: posts do próprio usuário
  jaUtil: boolean          // o usuário logado já reagiu?
  jaSalvo: boolean
  melhorResposta: MelhorResposta | null
  fixado: boolean
  destaque: boolean
}

export type LinhaRanking = {
  posicao: number
  nome: string
  iniciais: string
  xp: number
  variacao: number
  eh_voce: boolean
}

export type Especialista = {
  nome: string
  iniciais: string
  area: string
  online: boolean
}

export type EventoRail = {
  id: string
  titulo: string
  descricao: string | null
  inicia_em: string
} | null

export type DadosComunidade = {
  usuarioNome: string | null
  usuarioXp: number
  usuarioNivel: number
  usuarioTitulo: string
  espacos: Espaco[]
  posts: Post[]
  ranking: LinhaRanking[]
  especialistas: Especialista[]
  eventoProximo: EventoRail
  config: { online_agora: number; membros_total: number; casos_semana: number }
}

export async function carregarComunidade(): Promise<DadosComunidade> {
  const supabase = await criarClienteServidor()

  const [
    { data: espacosRaw },
    { data: postsRaw },
    { data: comentarios },
    { data: ranking },
    { data: especialistas },
    { data: configRaw },
    { data: eventos },
    { data: auth },
  ] = await Promise.all([
    supabase.from('comunidade_espacos').select('*').order('ordem'),
    supabase.from('comunidade_posts').select('*').order('fixado', { ascending: false }).order('criado_em', { ascending: false }),
    supabase.from('comunidade_comentarios').select('*'),
    supabase.from('comunidade_ranking').select('*').order('posicao'),
    supabase.from('comunidade_especialistas').select('*').order('ordem'),
    supabase.from('comunidade_config').select('*').eq('id', 1).single(),
    supabase.from('eventos').select('id, titulo, descricao, inicia_em, gravacao_url')
      .eq('publicado', true).gt('inicia_em', new Date().toISOString())
      .order('inicia_em').limit(1),
    supabase.auth.getUser(),
  ])

  const usuario = auth?.user ?? null

  // perfil do usuário (nav) + reações próprias (RLS devolve só as suas)
  let usuarioNome: string | null = null
  let usuarioXp = 0, usuarioNivel = 1, usuarioTitulo = 'Perito Iniciante'
  let minhasReacoes = new Map<string, Set<string>>() // post_id -> tipos
  if (usuario) {
    const [{ data: perfil }, { data: reacoes }] = await Promise.all([
      supabase.from('perfis').select('nome, xp, nivel, titulo').eq('id', usuario.id).single(),
      supabase.from('comunidade_reacoes').select('post_id, tipo'),
    ])
    usuarioNome = perfil?.nome ?? null
    usuarioXp = perfil?.xp ?? 0
    usuarioNivel = perfil?.nivel ?? 1
    usuarioTitulo = perfil?.titulo ?? 'Perito Iniciante'
    for (const r of reacoes ?? []) {
      if (!minhasReacoes.has(r.post_id)) minhasReacoes.set(r.post_id, new Set())
      minhasReacoes.get(r.post_id)!.add(r.tipo)
    }
  }

  const brutos = postsRaw ?? []
  const nomesEspacos = new Map((espacosRaw ?? []).map(e => [e.id, e.nome as string]))
  const coments = comentarios ?? []

  // espaços: contagem real + "novo" nas últimas 24h
  const limite24h = Date.now() - 24 * 3600 * 1000
  const espacos: Espaco[] = (espacosRaw ?? []).map(e => {
    const doEspaco = brutos.filter(p => p.espaco_id === e.id)
    return {
      id: e.id, nome: e.nome, slug: e.slug,
      qtd: e.qtd_base + doEspaco.length,
      temNovo: doEspaco.some(p => +new Date(p.criado_em) > limite24h),
    }
  })

  // reações reais por post (base + contagem via RPC)
  const posts: Post[] = await Promise.all(brutos.map(async p => {
    const { data: uteis } = await supabase.rpc('contar_reacoes', {
      p_post: p.id, p_tipo: p.tipo === 'vitoria' ? 'parabens' : 'util',
    })
    const doPost = coments.filter(c => c.post_id === p.id)
    const melhor = doPost.find(c => c.melhor_resposta) ?? null
    const meus = minhasReacoes.get(p.id) ?? new Set()
    return {
      id: p.id,
      espaco_id: p.espaco_id,
      espaco_nome: nomesEspacos.get(p.espaco_id) ?? 'Geral',
      autor_nome: p.autor_nome ?? usuarioNome ?? 'Perito',
      autor_nivel: p.autor_nivel,
      tipo: p.tipo,
      titulo: p.titulo,
      corpo: p.corpo,
      respondida: p.respondida,
      vitoria_rotulo: p.vitoria_rotulo,
      vitoria_detalhe: p.vitoria_detalhe,
      uteis: typeof uteis === 'number' ? uteis : p.uteis_base,
      comentarios: p.comentarios_base + doPost.filter(c => !c.melhor_resposta).length,
      criado_em: p.criado_em,
      minhaTurma: !!usuario && p.usuario_id === usuario.id,
      jaUtil: meus.has('util') || meus.has('parabens'),
      jaSalvo: meus.has('salvar'),
      melhorResposta: melhor
        ? { autor_nome: melhor.autor_nome, autor_selo: melhor.autor_selo, corpo: melhor.corpo }
        : null,
      fixado: p.fixado,
      destaque: p.destaque,
    }
  }))

  // ranking: a linha "você" reflete o XP real do perfil
  const rankingFinal: LinhaRanking[] = (ranking ?? []).map(r =>
    r.eh_voce ? { ...r, xp: usuarioXp || r.xp, iniciais: iniciaisDe(usuarioNome) ?? r.iniciais } : r
  )

  const proximoEv = (eventos ?? []).find(e => !e.gravacao_url) ?? null

  return {
    usuarioNome, usuarioXp, usuarioNivel, usuarioTitulo,
    espacos, posts,
    ranking: rankingFinal,
    especialistas: (especialistas ?? []) as Especialista[],
    eventoProximo: proximoEv
      ? { id: proximoEv.id, titulo: proximoEv.titulo, descricao: proximoEv.descricao, inicia_em: proximoEv.inicia_em }
      : null,
    config: configRaw ?? { online_agora: 0, membros_total: 0, casos_semana: 0 },
  }
}

function iniciaisDe(nome: string | null) {
  if (!nome) return null
  return nome.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}
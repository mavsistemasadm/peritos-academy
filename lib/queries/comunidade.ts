// lib/queries/comunidade.ts
// Carrega tudo que a página da Comunidade precisa, numa passada só.
import { criarClienteServidor } from '@/lib/supabase/server'
import { carregarMetricasComunidade } from '@/lib/queries/comunidade-metricas'

export type Espaco = {
  id: string
  nome: string
  slug: string
  qtd: number          // contagem real de posts (comunidade_espacos.qtd_base não é mais somado)
  temNovo: boolean     // post nas últimas 24h
}

export type MelhorResposta = {
  autor_nome: string
  autor_selo: string | null
  corpo: string
}

export type Comentario = {
  id: string
  autor_nome: string | null
  autor_selo: string | null
  corpo: string | null
  criado_em: string
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
  uteis: number             // reações reais (comunidade_reacoes), sem baseline
  comentarios: number        // comentários reais, sem baseline
  outrosComentarios: Comentario[]  // todos os comentários exceto o melhor_resposta — pra expandir no clique do título
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
  eh_voce: boolean
}

// Estado nascente: enquanto a comunidade não tem massa crítica de XP real
// (< 5 usuários com xp>0), não faz sentido fingir um ranking — mostra só a
// posição do próprio usuário e um convite. "aberto" liga quando há gente
// suficiente pra um ranking de verdade fazer sentido (ver carregarComunidade).
export type RankingComunidade =
  | { aberto: true; linhas: LinhaRanking[] }
  | { aberto: false; voce: { nome: string; iniciais: string; xp: number } | null }

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
  ranking: RankingComunidade
  eventoProximo: EventoRail
  metricas: { totalPeritos: number; postsSemana: number }
}

export async function carregarComunidade(): Promise<DadosComunidade> {
  const supabase = await criarClienteServidor()

  const [
    { data: espacosRaw },
    { data: postsRaw },
    { data: comentarios },
    { data: eventos },
    { data: auth },
    metricas,
  ] = await Promise.all([
    supabase.from('comunidade_espacos').select('*').order('ordem'),
    supabase.from('comunidade_posts').select('*').order('fixado', { ascending: false }).order('criado_em', { ascending: false }),
    supabase.from('comunidade_comentarios').select('*'),
    supabase.from('eventos').select('id, titulo, descricao, inicia_em, gravacao_url')
      .eq('publicado', true).gt('inicia_em', new Date().toISOString())
      .order('inicia_em').limit(1),
    supabase.auth.getUser(),
    carregarMetricasComunidade(),
  ])

  const usuario = auth?.user ?? null

  // perfil do usuário (nav) + reações próprias (RLS devolve só as suas)
  let usuarioNome: string | null = null
  let usuarioNivel = 1, usuarioTitulo = 'Perito Iniciante'
  // XP real: mesma fonte que o header/nav usa (gamificacao_saldo, soma do
  // ledger) — não perfis.xp em cache, pelo mesmo motivo documentado em
  // lib/queries/nav.ts (evita depender de um valor que pode dessincronizar).
  let usuarioXp = 0
  let minhasReacoes = new Map<string, Set<string>>() // post_id -> tipos
  if (usuario) {
    const [{ data: perfil }, { data: saldo }, { data: reacoes }] = await Promise.all([
      supabase.from('perfis').select('nome, nivel, titulo').eq('id', usuario.id).single(),
      supabase.from('gamificacao_saldo').select('xp_total').eq('usuario_id', usuario.id).maybeSingle(),
      supabase.from('comunidade_reacoes').select('post_id, tipo'),
    ])
    usuarioNome = perfil?.nome ?? null
    usuarioNivel = perfil?.nivel ?? 1
    usuarioTitulo = perfil?.titulo ?? 'Perito Iniciante'
    usuarioXp = saldo?.xp_total ?? 0
    for (const r of reacoes ?? []) {
      if (!minhasReacoes.has(r.post_id)) minhasReacoes.set(r.post_id, new Set())
      minhasReacoes.get(r.post_id)!.add(r.tipo)
    }
  }

  const brutos = postsRaw ?? []
  const nomesEspacos = new Map((espacosRaw ?? []).map(e => [e.id, e.nome as string]))
  const coments = comentarios ?? []

  // espaços: contagem real (qtd_base não é mais somado) + "novo" nas últimas 24h
  const limite24h = Date.now() - 24 * 3600 * 1000
  const espacos: Espaco[] = (espacosRaw ?? []).map(e => {
    const doEspaco = brutos.filter(p => p.espaco_id === e.id)
    return {
      id: e.id, nome: e.nome, slug: e.slug,
      qtd: doEspaco.length,
      temNovo: doEspaco.some(p => +new Date(p.criado_em) > limite24h),
    }
  })

  // reações reais por post (contar_reacoes não soma mais baseline nenhum)
  const posts: Post[] = await Promise.all(brutos.map(async p => {
    const { data: uteis } = await supabase.rpc('contar_reacoes', {
      p_post: p.id, p_tipo: p.tipo === 'vitoria' ? 'parabens' : 'util',
    })
    const doPost = coments.filter(c => c.post_id === p.id)
    const melhor = doPost.find(c => c.melhor_resposta) ?? null
    const outros = doPost
      .filter(c => !c.melhor_resposta)
      .sort((a, b) => +new Date(a.criado_em) - +new Date(b.criado_em))
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
      uteis: typeof uteis === 'number' ? uteis : 0,
      comentarios: outros.length,
      outrosComentarios: outros.map(c => ({
        id: c.id, autor_nome: c.autor_nome, autor_selo: c.autor_selo, corpo: c.corpo, criado_em: c.criado_em,
      })),
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

  // ranking real: só "abre" com massa crítica (5+ perfis com xp>0). até lá,
  // mostra só a linha do próprio usuário — nunca gente fictícia.
  const { count: usuariosComXp } = await supabase
    .from('perfis').select('id', { count: 'exact', head: true }).gt('xp', 0)

  let ranking: RankingComunidade
  if ((usuariosComXp ?? 0) >= 5) {
    const { data: topPerfis } = await supabase
      .from('perfis').select('id, nome, xp')
      .gt('xp', 0).order('xp', { ascending: false }).limit(10)
    ranking = {
      aberto: true,
      linhas: (topPerfis ?? []).map((p, i) => {
        const ehVoce = !!usuario && p.id === usuario.id
        return {
          posicao: i + 1,
          nome: ehVoce ? 'Você' : (p.nome ?? 'Perito'),
          iniciais: iniciaisDe(p.nome) ?? 'PA',
          xp: ehVoce ? usuarioXp : (p.xp ?? 0),
          eh_voce: ehVoce,
        }
      }),
    }
  } else {
    ranking = {
      aberto: false,
      voce: usuario ? { nome: usuarioNome ?? 'Você', iniciais: iniciaisDe(usuarioNome) ?? 'PA', xp: usuarioXp } : null,
    }
  }

  const proximoEv = (eventos ?? []).find(e => !e.gravacao_url) ?? null

  return {
    usuarioNome, usuarioXp, usuarioNivel, usuarioTitulo,
    espacos, posts,
    ranking,
    eventoProximo: proximoEv
      ? { id: proximoEv.id, titulo: proximoEv.titulo, descricao: proximoEv.descricao, inicia_em: proximoEv.inicia_em }
      : null,
    metricas,
  }
}

function iniciaisDe(nome: string | null) {
  if (!nome) return null
  return nome.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

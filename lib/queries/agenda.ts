// lib/queries/agenda.ts
// Carrega tudo que a página da Agenda precisa, numa passada só.
import { criarClienteServidor } from '@/lib/supabase/server'
import { carregarMetricasComunidade } from '@/lib/queries/comunidade-metricas'

export type Evento = {
  id: string
  titulo: string
  descricao: string | null
  tipo: 'sala_analise' | 'aula_ao_vivo' | 'plantao' | 'mentoria' | 'lancamento'
  inicia_em: string
  duracao_seg: number
  link_transmissao: string | null
  apresentador_nome: string | null
  apresentador_cargo: string | null
  meta_extra: string | null
  visibilidade: 'todos' | 'curso' | 'assinatura' | 'turma'
  alvo_rotulo: string | null
  gravacao_url: string | null
  gravacao_thumb_url: string | null
  visualizacoes: number
  confirmados_base: number
  confirmados: number      // base + reservas reais (via RPC)
  reservado: boolean       // o usuário logado já reservou?
}

export type DadosAgenda = {
  usuarioNome: string | null
  aoVivo: Evento[]         // começaram e ainda não terminaram
  proximos: Evento[]       // ainda não começaram (o [0] é o hero)
  gravacoes: Evento[]      // já têm gravacao_url
  totalPeritos: number     // real, mesma fonte do header da Comunidade — pro modal "Novo evento"
}

export async function carregarAgenda(): Promise<DadosAgenda> {
  const supabase = await criarClienteServidor()

  const [{ data: eventos }, { data: auth }, metricas] = await Promise.all([
    supabase
      .from('eventos')
      .select('*')
      .eq('publicado', true)
      .order('inicia_em', { ascending: true }),
    supabase.auth.getUser(),
    carregarMetricasComunidade(),
  ])

  const usuario = auth?.user ?? null

  // nome do perfil (pras iniciais do avatar) + reservas do usuário
  let usuarioNome: string | null = null
  let reservadas = new Set<string>()
  if (usuario) {
    const [{ data: perfil }, { data: reservas }] = await Promise.all([
      supabase.from('perfis').select('nome').eq('id', usuario.id).single(),
      supabase.from('evento_reservas').select('evento_id'), // RLS: só as próprias
    ])
    usuarioNome = perfil?.nome ?? null
    reservadas = new Set((reservas ?? []).map(r => r.evento_id))
  }

  const agora = Date.now()

  // ⚠️ `visibilidade` existia desde o Bloco 2 e não filtrava nada: o rótulo
  // "Exclusivo · Turma X" no card era só texto, e a mentoria fechada de uma
  // turma aparecia para a base inteira. Ninguém ganhava acesso indevido com
  // isso (a sala é outro portão), mas a tela prometia uma coisa e fazia outra.
  //
  // A regra mora em `evento_visivel_para` e é a mesma que decide o público de
  // um anúncio por email — com uma diferença deliberada, documentada lá:
  // quando não se sabe (assinatura, turma), a tela MOSTRA e o email NÃO SAI.
  // Errar para mais aqui custa um card que a pessoa não podia ver; errar para
  // mais no email é irreversível.
  const visiveis: typeof eventos = []
  for (const ev of eventos ?? []) {
    const { data: pode } = await supabase.rpc('evento_visivel_para', {
      p_evento: ev.id,
      p_usuario: usuario?.id ?? null,
    })
    if (pode !== false) visiveis.push(ev)
  }

  const brutos = visiveis as Omit<Evento, 'confirmados' | 'reservado'>[]

  const aoVivoBruto: typeof brutos = []
  const proximosBruto: typeof brutos = []
  const gravacoesBruto: typeof brutos = []

  for (const ev of brutos) {
    const inicio = new Date(ev.inicia_em).getTime()
    const fim = inicio + ev.duracao_seg * 1000
    if (ev.gravacao_url) {
      gravacoesBruto.push(ev)
    } else if (inicio <= agora && fim > agora) {
      aoVivoBruto.push(ev)
    } else if (inicio > agora) {
      proximosBruto.push(ev)
    }
    // eventos passados sem gravação simplesmente não aparecem
  }

  // confirmados reais (reservas de evento_reservas), sem expor quem reservou
  const comContagem = async (ev: (typeof brutos)[number]): Promise<Evento> => {
    const { data } = await supabase.rpc('contar_confirmados', { p_evento: ev.id })
    return {
      ...ev,
      confirmados: typeof data === 'number' ? data : 0,
      reservado: reservadas.has(ev.id),
    }
  }

  const [aoVivo, proximos, gravacoes] = await Promise.all([
    Promise.all(aoVivoBruto.map(comContagem)),
    Promise.all(proximosBruto.map(comContagem)),
    Promise.all(gravacoesBruto.map(comContagem)),
  ])
  gravacoes.sort((a, b) => +new Date(b.inicia_em) - +new Date(a.inicia_em))

  return { usuarioNome, aoVivo, proximos, gravacoes, totalPeritos: metricas.totalPeritos }
}
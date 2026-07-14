    // lib/queries/avisos.ts
// Alimenta o sistema global de avisos: o popup de novidades
// e o sino de notificações, presentes em todas as páginas.
import { criarClienteServidor } from '@/lib/supabase/server'

export type Novidade = {
  id: string
  titulo: string
  corpo: string[]          // parágrafos
  imagem_url: string | null
  link_url: string | null
  link_rotulo: string | null
  selo: string | null
  criado_em: string
  lida: boolean
}

export type TipoNotificacao =
  | 'comunidade' | 'evento' | 'jornada' | 'geral'
  // celebrações (também viram toast, ver ConquistaToast.tsx)
  | 'nivel_up' | 'curso_concluido' | 'avaliacao_aprovada' | 'streak' | 'primeira_aula'
  // sino-only
  | 'modulo_concluido' | 'desafio_entrega' | 'certificado_disponivel'
  | 'comunidade_resposta' | 'comunidade_melhor_resposta' | 'duvida_respondida'

export type Notificacao = {
  id: string
  tipo: TipoNotificacao
  prefixo: string | null
  destaque: string | null
  sufixo: string | null
  link_url: string | null
  emblema: string | null
  dados: Record<string, unknown>
  celebracao: boolean
  lida: boolean
  criado_em: string
}

export type DadosAvisos = {
  logado: boolean
  novidades: Novidade[]        // publicadas, mais recente primeiro
  temNovidadeNaoLida: boolean  // controla o popup automático
  notificacoes: Notificacao[]  // as 12 mais recentes
  naoLidas: number             // contador do sino (novidades + pessoais)
  sonsConquista: boolean       // preferência do usuário pra som de toast
}

const VAZIO: DadosAvisos = {
  logado: false, novidades: [], temNovidadeNaoLida: false,
  notificacoes: [], naoLidas: 0, sonsConquista: true,
}

export async function carregarAvisos(): Promise<DadosAvisos> {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return VAZIO   // deslogado: sem popup, sem sino

  const [{ data: novidadesRaw }, { data: leituras }, { data: notifRaw }, { data: perfil }] =
    await Promise.all([
      supabase.from('novidades').select('*')
        .eq('publicado', true).order('criado_em', { ascending: false }).limit(10),
      supabase.from('novidade_leituras').select('novidade_id'),
      supabase.from('notificacoes').select('*')
        .order('criado_em', { ascending: false }).limit(12),
      supabase.from('perfis').select('sons_conquista').eq('id', auth.user.id).single(),
    ])

  const lidas = new Set((leituras ?? []).map(l => l.novidade_id))

  const novidades: Novidade[] = (novidadesRaw ?? []).map(n => ({
    id: n.id,
    titulo: n.titulo,
    corpo: Array.isArray(n.corpo) ? n.corpo : [],
    imagem_url: n.imagem_url,
    link_url: n.link_url,
    link_rotulo: n.link_rotulo,
    selo: n.selo,
    criado_em: n.criado_em,
    lida: lidas.has(n.id),
  }))

  const notificacoes = (notifRaw ?? []) as Notificacao[]
  const naoLidas =
    novidades.filter(n => !n.lida).length +
    notificacoes.filter(n => !n.lida).length

  return {
    logado: true,
    novidades,
    temNovidadeNaoLida: novidades.some(n => !n.lida),
    notificacoes,
    naoLidas,
    sonsConquista: perfil?.sons_conquista ?? true,
  }
}
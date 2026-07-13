// lib/queries/admin-suporte.ts
// Módulo Usuários (suporte ao aluno) — leitura via RPCs de consolidação
// (ver supabase/migrations/20260713_usuarios_suporte.sql).
import { criarClienteServidor } from '@/lib/supabase/server'

export type StatusConta = 'ativo' | 'suspenso' | 'banido'
export type StatusAssinaturaAluno = 'ativa' | 'inadimplente' | 'suspensa' | 'cancelada' | 'cortesia' | 'sem_assinatura'

export type UsuarioLinha = {
  id: string
  nome: string
  email: string | null
  fotoUrl: string | null
  slug: string | null
  status: StatusConta
  criadoEm: string
  ultimoAcesso: string | null
  assinaturaStatus: StatusAssinaturaAluno
  nivel: number
  nivelNome: string | null
}

export type FiltrosUsuarios = {
  busca?: string
  statusConta?: StatusConta
  statusAssinatura?: StatusAssinaturaAluno
  nivel?: number
  ativosDias?: number
  ordenarPor?: 'criado_em' | 'ultimo_acesso' | 'nome' | 'nivel'
  ordenarDir?: 'asc' | 'desc'
  pagina?: number
}

export type ListaUsuarios = {
  linhas: UsuarioLinha[]
  totalCount: number
}

const POR_PAGINA = 25

export async function listarUsuariosAdmin(filtros: FiltrosUsuarios): Promise<ListaUsuarios> {
  const supabase = await criarClienteServidor()
  const pagina = Math.max(1, filtros.pagina ?? 1)

  const { data, error } = await supabase.rpc('admin_listar_usuarios', {
    p_busca: filtros.busca?.trim() || null,
    p_status_conta: filtros.statusConta ?? null,
    p_status_assinatura: filtros.statusAssinatura ?? null,
    p_nivel: filtros.nivel ?? null,
    p_ativos_dias: filtros.ativosDias ?? null,
    p_ordenar_por: filtros.ordenarPor ?? 'criado_em',
    p_ordenar_dir: filtros.ordenarDir ?? 'desc',
    p_offset: (pagina - 1) * POR_PAGINA,
    p_limit: POR_PAGINA,
  })
  if (error) throw new Error(error.message)

  const linhas: UsuarioLinha[] = (data ?? []).map((r: any) => ({
    id: r.id, nome: r.nome, email: r.email, fotoUrl: r.foto_url, slug: r.slug,
    status: r.status, criadoEm: r.criado_em, ultimoAcesso: r.ultimo_acesso,
    assinaturaStatus: r.assinatura_status, nivel: r.nivel, nivelNome: r.nivel_nome,
  }))

  return { linhas, totalCount: Number((data?.[0] as any)?.total_count ?? 0) }
}

export { POR_PAGINA as usuariosPorPagina }

export type FichaCurso = { cursoId: string; titulo: string; slug: string; totalAulas: number; aulasConcluidas: number; pct: number }
export type FichaAvaliacao = { avaliacaoId: string; titulo: string; cursoTitulo: string; melhorNota: number | null; aprovado: boolean; tentativas: number }
export type FichaCertificado = { id: string; numero: string; cursoTitulo: string; nota: number | null; emitidoEm: string }
export type FichaCobranca = { id: string; valorCentavos: number; status: string; vencimento: string; pagoEm: string | null; metodo: string | null }
export type FichaAssinatura = {
  id: string; status: string; planoNome: string; proximaCobranca: string | null; iniciadaEm: string; observacao: string | null
  cobrancas: FichaCobranca[]
} | null

export type FichaUsuario = {
  id: string
  nome: string
  email: string | null
  fotoUrl: string | null
  slug: string | null
  status: StatusConta
  criadoEm: string
  ultimoAcesso: string | null
  cidade: string | null
  estado: string | null
  assinatura: FichaAssinatura
  xp: number
  moedas: number
  nivel: number
  nivelNome: string
  streak: number
  cursos: FichaCurso[]
  avaliacoes: FichaAvaliacao[]
  certificados: FichaCertificado[]
  postsCount: number
  comentariosCount: number
}

export async function carregarFichaUsuario(usuarioId: string): Promise<FichaUsuario> {
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.rpc('admin_usuario_ficha', { p_usuario_id: usuarioId })
  if (error) throw new Error(error.message)

  const f = data as any
  return {
    id: f.id, nome: f.nome, email: f.email, fotoUrl: f.foto_url, slug: f.slug, status: f.status,
    criadoEm: f.criado_em, ultimoAcesso: f.ultimo_acesso, cidade: f.cidade, estado: f.estado,
    assinatura: f.assinatura ? {
      id: f.assinatura.id, status: f.assinatura.status, planoNome: f.assinatura.plano_nome,
      proximaCobranca: f.assinatura.proxima_cobranca, iniciadaEm: f.assinatura.iniciada_em, observacao: f.assinatura.observacao,
      cobrancas: (f.assinatura.cobrancas ?? []).map((c: any) => ({
        id: c.id, valorCentavos: c.valor_centavos, status: c.status, vencimento: c.vencimento, pagoEm: c.pago_em, metodo: c.metodo,
      })),
    } : null,
    xp: f.xp, moedas: f.moedas, nivel: f.nivel, nivelNome: f.nivel_nome, streak: f.streak,
    cursos: (f.cursos ?? []).map((c: any) => ({
      cursoId: c.curso_id, titulo: c.titulo, slug: c.slug, totalAulas: c.total_aulas, aulasConcluidas: c.aulas_concluidas, pct: c.pct,
    })),
    avaliacoes: (f.avaliacoes ?? []).map((a: any) => ({
      avaliacaoId: a.avaliacao_id, titulo: a.titulo, cursoTitulo: a.curso_titulo, melhorNota: a.melhor_nota, aprovado: a.aprovado, tentativas: a.tentativas,
    })),
    certificados: (f.certificados ?? []).map((c: any) => ({
      id: c.id, numero: c.numero, cursoTitulo: c.curso_titulo, nota: c.nota, emitidoEm: c.emitido_em,
    })),
    postsCount: f.posts_count, comentariosCount: f.comentarios_count,
  }
}

export type ExtratoLinha = { id: string; gatilhoCodigo: string; gatilhoNome: string | null; pontos: number; moedas: number; criadoEm: string }
export type ExtratoPaginado = { linhas: ExtratoLinha[]; totalCount: number }

export async function carregarExtratoUsuario(usuarioId: string, pagina: number): Promise<ExtratoPaginado> {
  const supabase = await criarClienteServidor()
  const porPagina = 20
  const { data, error } = await supabase.rpc('admin_usuario_extrato', {
    p_usuario_id: usuarioId, p_offset: (Math.max(1, pagina) - 1) * porPagina, p_limit: porPagina,
  })
  if (error) throw new Error(error.message)

  const linhas: ExtratoLinha[] = (data ?? []).map((r: any) => ({
    id: r.id, gatilhoCodigo: r.gatilho_codigo, gatilhoNome: r.gatilho_nome, pontos: r.pontos, moedas: r.moedas, criadoEm: r.criado_em,
  }))
  return { linhas, totalCount: Number((data?.[0] as any)?.total_count ?? 0) }
}

export type ComunidadePost = { id: string; titulo: string | null; corpo: string | null; tipo: string; criadoEm: string }
export type ComunidadeComentario = { id: string; postId: string | null; corpo: string | null; criadoEm: string }
export type ComunidadeUsuario = { posts: ComunidadePost[]; comentarios: ComunidadeComentario[] }

export async function carregarComunidadeUsuario(usuarioId: string): Promise<ComunidadeUsuario> {
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.rpc('admin_usuario_comunidade', { p_usuario_id: usuarioId })
  if (error) throw new Error(error.message)

  const d = data as any
  return {
    posts: (d.posts ?? []).map((p: any) => ({ id: p.id, titulo: p.titulo, corpo: p.corpo, tipo: p.tipo, criadoEm: p.criado_em })),
    comentarios: (d.comentarios ?? []).map((c: any) => ({ id: c.id, postId: c.post_id, corpo: c.corpo, criadoEm: c.criado_em })),
  }
}

export type AuditoriaLinha = { id: string; adminNome: string; acao: string; justificativa: string | null; detalhe: any; criadoEm: string }

export async function carregarAuditoriaUsuario(usuarioId: string): Promise<AuditoriaLinha[]> {
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.rpc('admin_usuario_auditoria', { p_usuario_id: usuarioId })
  if (error) throw new Error(error.message)

  return (data ?? []).map((r: any) => ({
    id: r.id, adminNome: r.admin_nome, acao: r.acao, justificativa: r.justificativa, detalhe: r.detalhe, criadoEm: r.criado_em,
  }))
}

export type CursoParaCertificado = { id: string; titulo: string }

export async function carregarCursosParaCertificado(): Promise<CursoParaCertificado[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('cursos').select('id, titulo').order('titulo')
  return data ?? []
}

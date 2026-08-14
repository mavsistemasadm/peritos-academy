// lib/queries/admin-acessos.ts
// Leitura do módulo "Acessos" do admin — concessões de conteúdo por aluno.
//
// O modelo é o de `acessos_conteudo`, criado na migração da Ensinio: uma linha
// por direito concedido, com `escopo` (`total` / `curso` / `biblioteca`),
// `curso_id` quando é de um curso, e vigência que é **ou** `vitalicio` **ou**
// `expira_em` — nunca os dois, garantido por check constraint no banco.
//
// ⚠️ **A leitura aqui usa a mesma expressão de vigência que os gates.**
// `tem_acesso_curso` decide com `vitalicio or expira_em >= current_date`, e
// `current_date` no Supabase roda em **UTC**. Se esta tela calculasse "vigente"
// pelo fuso de Brasília, ela diria "vigente" das 21h à meia-noite sobre um
// acesso que a plataforma já está recusando — e o suporte olharia a tela,
// veria verde, e diria ao aluno que o problema é com ele. Concordar com o gate
// vale mais do que estar certo sozinho.
import { criarClienteServico } from '@/lib/supabase/servico'

export type Escopo = 'total' | 'curso' | 'biblioteca'
export type StatusAcesso = 'vigentes' | 'vencidos' | 'revogados' | 'todos'

export type AcessoLinha = {
  id: string
  usuarioId: string
  alunoNome: string
  alunoEmail: string | null
  escopo: Escopo
  cursoId: string | null
  cursoTitulo: string | null
  vitalicio: boolean
  expiraEm: string | null
  vigente: boolean
  ativo: boolean
  origem: string
  observacao: string | null
  criadoEm: string
}

export type CursoOpcao = { id: string; titulo: string; publicado: boolean }

export const acessosPorPagina = 25

/** A data que o banco usa para decidir vigência. Ver o aviso no topo do arquivo. */
export function hojeDoGate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function estaVigente(a: { vitalicio: boolean; expiraEm: string | null; ativo: boolean }): boolean {
  if (!a.ativo) return false
  if (a.vitalicio) return true
  return !!a.expiraEm && a.expiraEm >= hojeDoGate()
}

export type FiltrosAcessos = {
  busca?: string
  escopo?: Escopo
  cursoId?: string
  status?: StatusAcesso
  pagina?: number
  /**
   * Filtro por aluno já resolvido. Existe porque o e-mail mora em `auth.users`,
   * que o PostgREST não alcança: buscar "fulano@x.com" na coluna de nome não
   * acha nada, e a tela pareceria dizer que a pessoa não tem acesso nenhum
   * quando ela tem. Quem digita um e-mail resolve o id ANTES (ver `page.tsx`) e
   * passa por aqui.
   */
  usuarioId?: string
  /** Nenhum aluno casou com o e-mail buscado — a lista tem que sair vazia. */
  semResultado?: boolean
}

/**
 * Acha o aluno pelo e-mail, exato.
 *
 * O e-mail mora em `auth.users`, que o PostgREST não expõe — por isso a busca
 * passa pela RPC `admin_listar_usuarios`, que já existe, é security definer e
 * casa por nome OU e-mail. O `find` depois é que torna o resultado exato: a
 * RPC faz `ilike %termo%`, então "ana@x.com" também traria "mariana@x.com.br"
 * se alguém confiasse na primeira linha.
 *
 * Devolve `null` quando não existe conta — que não é erro, é o caso que faz a
 * tela criar a conta.
 */
export async function acharAlunoPorEmail(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').criarClienteServidor>>,
  email: string
): Promise<{ id: string; nome: string; email: string } | null> {
  const alvo = email.trim().toLowerCase()
  if (!alvo) return null

  const { data, error } = await supabase.rpc('admin_listar_usuarios', {
    p_busca: alvo,
    p_status_conta: null,
    p_status_assinatura: null,
    p_nivel: null,
    p_ativos_dias: null,
    p_ordenar_por: 'criado_em',
    p_ordenar_dir: 'desc',
    p_offset: 0,
    p_limit: 50,
  })
  if (error) throw new Error(error.message)

  const achado = (data ?? []).find((r: { email: string | null }) => (r.email ?? '').toLowerCase() === alvo)
  return achado ? { id: achado.id, nome: achado.nome, email: achado.email } : null
}

export async function listarAcessos(filtros: FiltrosAcessos): Promise<{ linhas: AcessoLinha[]; total: number }> {
  // E-mail que não casou com conta nenhuma: lista vazia, sem ir ao banco. Sem
  // isto o filtro sumiria e a tela devolveria a base inteira — a resposta mais
  // enganosa possível para "esta pessoa tem acesso?".
  if (filtros.semResultado) return { linhas: [], total: 0 }

  const supabase = criarClienteServico()
  const pagina = Math.max(1, filtros.pagina ?? 1)
  const de = (pagina - 1) * acessosPorPagina
  const hoje = hojeDoGate()

  let q = supabase
    .from('acessos_conteudo')
    .select(
      'id, usuario_id, escopo, curso_id, vitalicio, expira_em, ativo, origem, observacao, criado_em, perfis!inner(nome), cursos(titulo)',
      { count: 'exact' }
    )

  if (filtros.escopo) q = q.eq('escopo', filtros.escopo)
  if (filtros.cursoId) q = q.eq('curso_id', filtros.cursoId)
  if (filtros.usuarioId) q = q.eq('usuario_id', filtros.usuarioId)

  const busca = filtros.busca?.trim()
  if (busca && !filtros.usuarioId) q = q.ilike('perfis.nome', `%${busca}%`)

  switch (filtros.status ?? 'vigentes') {
    case 'vigentes':
      q = q.eq('ativo', true).or(`vitalicio.eq.true,expira_em.gte.${hoje}`)
      break
    case 'vencidos':
      q = q.eq('ativo', true).eq('vitalicio', false).lt('expira_em', hoje)
      break
    case 'revogados':
      q = q.eq('ativo', false)
      break
    // 'todos' não filtra
  }

  // Vencendo primeiro: a pergunta que se faz a esta tela é "de quem eu preciso
  // cuidar", e vitalício nunca é a resposta.
  const { data, count, error } = await q
    .order('ativo', { ascending: false })
    .order('vitalicio', { ascending: true })
    .order('expira_em', { ascending: true, nullsFirst: false })
    .order('criado_em', { ascending: false })
    .range(de, de + acessosPorPagina - 1)

  if (error) throw new Error(error.message)

  const brutas = (data ?? []) as unknown as Array<{
    id: string; usuario_id: string; escopo: Escopo; curso_id: string | null
    vitalicio: boolean; expira_em: string | null; ativo: boolean; origem: string
    observacao: string | null; criado_em: string
    perfis: { nome: string } | null
    cursos: { titulo: string } | null
  }>

  // O e-mail vem um a um, e isso é deliberado: `auth.admin.listUsers()` é
  // paginado, e uma página de mil é um teto — no dia em que a base passar
  // disso, quem estiver da segunda página em diante sumiria desta tela sem
  // nada acusando. Aqui o número de chamadas é o tamanho da PÁGINA (25), não o
  // da tabela, então não cresce com a base.
  const ids = [...new Set(brutas.map(r => r.usuario_id))]
  const emails = new Map<string, string | null>()
  await Promise.all(
    ids.map(async id => {
      const { data: u } = await supabase.auth.admin.getUserById(id)
      emails.set(id, u?.user?.email ?? null)
    })
  )

  const linhas: AcessoLinha[] = brutas.map(r => ({
    id: r.id,
    usuarioId: r.usuario_id,
    alunoNome: r.perfis?.nome ?? '(sem nome)',
    alunoEmail: emails.get(r.usuario_id) ?? null,
    escopo: r.escopo,
    cursoId: r.curso_id,
    cursoTitulo: r.cursos?.titulo ?? null,
    vitalicio: r.vitalicio,
    expiraEm: r.expira_em,
    vigente: estaVigente({ vitalicio: r.vitalicio, expiraEm: r.expira_em, ativo: r.ativo }),
    ativo: r.ativo,
    origem: r.origem,
    observacao: r.observacao,
    criadoEm: r.criado_em,
  }))

  return { linhas, total: count ?? 0 }
}

export async function listarCursosParaAcesso(): Promise<CursoOpcao[]> {
  const supabase = criarClienteServico()
  const { data, error } = await supabase
    .from('cursos')
    .select('id, titulo, publicado')
    .order('titulo')
  if (error) throw new Error(error.message)
  return (data ?? []).map(c => ({ id: c.id, titulo: c.titulo, publicado: c.publicado }))
}

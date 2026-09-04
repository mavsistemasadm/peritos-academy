import { criarClienteServidor } from '@/lib/supabase/server'

export type StatusAcesso = { logado: boolean; permitido: boolean }

/**
 * O mesmo, mais a marca de turma fechada.
 *
 * ⚠️ Existe por causa da MENSAGEM, não do portão. Recusar um curso restrito com
 * a tela de "assine para ter acesso" é mentira: assinar não abre turma fechada,
 * e a pessoa pagaria por uma promessa que a plataforma não cumpre. Curso
 * restrito que a pessoa não pode ver responde 404, como todo conteúdo que não
 * é dela.
 */
export type StatusAcessoCurso = StatusAcesso & {
  restrito: boolean
  /**
   * O curso que precisa ser concluído antes deste.
   *
   * ⚠️ **É UM TERCEIRO ESTADO, e não uma variação de `permitido`.** A pessoa
   * TEM direito a este curso — ela assinou, ou recebeu a concessão. O que falta
   * é a PROGRESSÃO: o selo de qualidade exige que a Formação Pericial venha
   * antes, e em ordem.
   *
   * Recusar isso com a tela de "assine para ter acesso" seria mentira para quem
   * acabou de pagar — a mesma armadilha que a turma fechada já ensinou aqui. Por
   * isso o campo carrega o NOME do curso pendente: sem ele, a trava é recusa sem
   * caminho.
   */
  pendente: { titulo: string; slug: string } | null
}

/** O que a pessoa tem hoje — usado para gatear E para a tela de bloqueio dizer o que ela tem. */
export type ResumoAcesso = {
  logado: boolean
  /**
   * Acesso ao plano completo: assinatura Asaas vigente OU concessão de escopo
   * `total` vigente. É isto, e só isto, que abre as seções que não são de um
   * curso.
   */
  completo: boolean
  /** Os cursos avulsos que ela comprou, com a vigência de cada um. */
  cursos: Array<{ titulo: string | null; vitalicio: boolean; expiraEm: string | null }>
  /** Biblioteca de planilhas por concessão de escopo `biblioteca`. */
  biblioteca: boolean
}

/**
 * A data que o banco usa para decidir vigência.
 *
 * `current_date` no Postgres do Supabase roda em UTC, e os gates de SQL
 * comparam com ele. Calcular aqui pelo fuso de Brasília faria esta camada
 * discordar do banco das 21h à meia-noite: a tela liberaria uma seção que o
 * `tem_acesso_curso` já recusa, ou o contrário. Discordar do gate é pior do
 * que a imprecisão de três horas.
 */
function hojeDoGate(): string {
  return new Date().toISOString().slice(0, 10)
}

function vigente(c: { vitalicio: boolean; expira_em: string | null }): boolean {
  return c.vitalicio || (!!c.expira_em && c.expira_em >= hojeDoGate())
}

/**
 * ⚠️ **NÃO usa `tem_acesso_plataforma`, e essa é a decisão do arquivo.**
 *
 * Aquela função responde "tem assinatura ativa OU **qualquer** concessão
 * vigente" — então comprar um curso avulso abria Comunidade, Agenda e Desafios
 * junto. Era decisão deliberada de 05/08/2026, tomada para o aluno migrado
 * "Apenas PASEP" não ficar fora da Comunidade.
 *
 * Foi revertida em 14/08/2026, por decisão comercial: quem comprou um curso vê
 * aquele curso, e o resto da plataforma é o que se está vendendo a ele. Uma
 * pessoa que já tem Comunidade, Agenda e Desafios de graça não tem motivo para
 * assinar.
 *
 * A checagem ficou aqui, no TypeScript, e não dentro da função SQL, porque
 * `tem_acesso_plataforma` também é lida por policies de RLS: mudá-la mexeria em
 * quem enxerga linha de material e de storage, que é outra pergunta com outras
 * consequências. Este é o portão das PÁGINAS.
 */
export async function carregarResumoAcesso(): Promise<ResumoAcesso> {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return { logado: false, completo: false, cursos: [], biblioteca: false }

  const [{ data: assinatura }, { data: concessoes }] = await Promise.all([
    supabase.rpc('tem_acesso_ativo', { p_usuario_id: auth.user.id }),
    // A policy `acessos_conteudo_leitura_propria` deixa cada aluno ler as
    // próprias concessões, então não precisa de RPC nem de service role.
    supabase
      .from('acessos_conteudo')
      .select('escopo, vitalicio, expira_em, cursos(titulo)')
      .eq('usuario_id', auth.user.id)
      .eq('ativo', true),
  ])

  const vivas = ((concessoes ?? []) as unknown as Array<{
    escopo: string; vitalicio: boolean; expira_em: string | null; cursos: { titulo: string } | null
  }>).filter(vigente)

  return {
    logado: true,
    completo: assinatura === true || vivas.some(c => c.escopo === 'total'),
    cursos: vivas
      .filter(c => c.escopo === 'curso')
      .map(c => ({ titulo: c.cursos?.titulo ?? null, vitalicio: c.vitalicio, expiraEm: c.expira_em })),
    biblioteca: vivas.some(c => c.escopo === 'biblioteca'),
  }
}

/**
 * Acesso a uma seção do plano completo — Comunidade, Agenda, Desafios, Jornada,
 * Rota do Perito, Gamificação.
 *
 * Passa quem tem assinatura vigente ou concessão de escopo `total`. Quem
 * comprou um curso avulso NÃO passa: ele entra pelo curso dele e vê a tela de
 * bloqueio no resto, com o convite para assinar.
 */
export async function verificarAcessoConteudo(): Promise<StatusAcesso> {
  const resumo = await carregarResumoAcesso()
  return { logado: resumo.logado, permitido: resumo.completo }
}

/**
 * Acesso a UM curso específico — usar em toda página de conteúdo de curso
 * (curso, aula, avaliação).
 *
 * Continua na RPC: a regra de curso tem exceção por trilha e por curso
 * (`acessos_excecoes`), e reimplementar isso aqui criaria uma segunda fonte da
 * mesma regra, que diverge no dia em que alguém acrescentar uma exceção.
 */
export async function verificarAcessoCurso(slugCurso: string): Promise<StatusAcessoCurso> {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()

  // `restrito` é lido para todo mundo, inclusive deslogado: é ele que decide se
  // a recusa vira 404 ou paywall, e essa escolha não depende de quem está
  // olhando. `cursos` tem leitura pública, então não precisa de sessão.
  const { data: curso } = await supabase
    .from('cursos').select('id, restrito').eq('slug', slugCurso).maybeSingle()
  const restrito = curso?.restrito === true

  if (!auth?.user) return { logado: false, permitido: false, restrito, pendente: null }

  const { data } = await supabase.rpc('tem_acesso_curso', {
    p_usuario_id: auth.user.id,
    p_curso_slug: slugCurso,
  })
  const permitido = data === true

  // ⚠️ **A PROGRESSÃO SÓ É PERGUNTADA DEPOIS DO DIREITO**, e a ordem importa:
  // quem NÃO comprou não deve ver "conclua a Formação Pericial" — deve ver o
  // convite para assinar. Dizer a um visitante que ele precisa concluir uma
  // trilha que ele nem pode abrir é conselho para uma porta que não é a dele.
  if (!permitido || !curso?.id) {
    return { logado: true, permitido, restrito, pendente: null }
  }

  const { data: liberou } = await supabase.rpc('formacao_liberou_curso', {
    p_usuario: auth.user.id,
    p_curso_id: curso.id,
  })

  // ⚠️ **FALHA ABERTA.** RPC que não responde devolve `undefined`, e aqui isso
  // libera. A trava é o selo de qualidade, não uma fechadura de acesso: barrar
  // por um erro de leitura tiraria de quem pagou um curso que ele tem direito
  // de abrir. Errar para o lado de destravar custa uma ordem quebrada; errar
  // para o outro custa o acesso.
  if (liberou !== false) {
    return { logado: true, permitido: true, restrito, pendente: null }
  }

  const { data: falta } = await supabase.rpc('formacao_curso_pendente', {
    p_usuario: auth.user.id,
    p_curso_id: curso.id,
  })
  const primeiro = Array.isArray(falta) ? falta[0] : falta

  return {
    logado: true,
    permitido: false,
    restrito,
    // Sem o nome do curso pendente, a tela só sabe dizer "ainda não liberado" —
    // que é a recusa sem caminho. O nome é o que transforma trava em sequência.
    pendente: primeiro?.titulo
      ? { titulo: String(primeiro.titulo), slug: String(primeiro.slug) }
      : { titulo: 'a Formação Pericial de Alta Performance', slug: '' },
  }
}

/** Acesso à Biblioteca de Planilhas (flag do perfil ou concessão vigente). */
export async function verificarAcessoBiblioteca(): Promise<StatusAcesso> {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return { logado: false, permitido: false }

  const { data } = await supabase.rpc('tem_acesso_biblioteca', { p_usuario_id: auth.user.id })
  return { logado: true, permitido: data === true }
}

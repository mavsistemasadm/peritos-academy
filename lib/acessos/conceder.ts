// ══════════════════════════════════════════════════════
// LIBERAR CONTEÚDO PARA UMA PESSOA — o núcleo, com dois chamadores
//
// Duas portas concedem acesso na Academy, e é por isso que o núcleo mora aqui:
//
//   1. `/admin/acessos` — o operador cadastrando um comprador antigo à mão.
//   2. `/api/integracoes/conceder-acesso` — o webhook de pagamento do Nexus,
//      quando alguém compra um curso avulso.
//
// Duas implementações da mesma regra divergem no dia em que uma ganhar uma
// recusa que a outra não tem — e o sintoma seria uma venda automática gravando
// concessão duplicada, ou nascida vencida, que a tela do admin já recusava.
// É o mesmo raciocínio de `cobrancaEhDoNexus` no Nexus: a pergunta tem UM dono.
//
// Este módulo NÃO checa permissão e NÃO fala com o Nexus. Quem chama é que
// sabe se pode: a tela confere o papel do admin, a rota confere a chave
// compartilhada. Misturar autorização aqui dentro faria a rota precisar fingir
// uma sessão de admin que ela não tem.
// ══════════════════════════════════════════════════════
import { criarClienteServico } from '@/lib/supabase/servico'
import { hojeDoGate, type Escopo } from '@/lib/queries/admin-acessos'

export type EntradaConcessao = {
  email: string
  /** Usado só quando a conta ainda não existe. */
  nome: string
  escopo: Escopo
  cursoId: string | null
  vitalicio: boolean
  expiraEm: string | null
  observacao: string
  /**
   * Deixar `false` proíbe criar conta: e-mail sem conta vira recusa
   * `motivo: 'sem_conta'` em vez de um cadastro novo.
   *
   * Existe para a matrícula em lote. Colar sessenta e-mails e ganhar contas
   * novas por causa de dois erros de digitação é o tipo de efeito que ninguém
   * pede e ninguém percebe — e cada conta fantasma dessas fica na base para
   * sempre, contando como aluno. Nas portas de uma pessoa só (a tela e o
   * webhook de venda), criar é o comportamento certo e continua sendo o padrão.
   */
  permitirCriarConta?: boolean
  /**
   * A conta já resolvida por quem chama, para pular a varredura do Auth.
   *
   * O lote resolve os sessenta e-mails numa passada só sobre `listUsers`; sem
   * isto seriam sessenta varreduras da base inteira, e o lote estouraria o
   * tempo da requisição antes de gravar a metade. As regras abaixo não mudam:
   * o que se pula é a BUSCA, não nenhuma checagem.
   */
  contaConhecida?: { id: string; nome: string } | null
}

export type ResultadoConcessao =
  | { ok: true; usuarioId: string; nome: string; contaCriada: boolean; redundante: boolean; jaTinha: false }
  | { ok: true; usuarioId: string; nome: string; contaCriada: boolean; redundante: false; jaTinha: true; ate: string }
  | { ok: false; erro: string; motivo?: 'sem_conta' }

/**
 * Um e-mail por linha, por vírgula ou por ponto e vírgula.
 *
 * Cola de planilha, cola de grupo de WhatsApp e lista escrita à mão chegam nos
 * três formatos, e exigir um deles só faz o operador limpar a lista no Bloco de
 * Notas antes. Duplicata sai fora aqui: dois "concedido" para a mesma pessoa
 * seria um relatório que conta 61 numa turma de 60.
 */
export function separarEmails(texto: string): string[] {
  const brutos = texto
    .split(/[\s,;]+/)
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
  return [...new Set(brutos)]
}

export function formatarBR(iso: string): string {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

/** `2026-08-14` + 12 meses → `2027-08-14`. Usa UTC, o mesmo relógio do gate. */
export function daquiAMeses(meses: number): string {
  const d = new Date()
  d.setUTCMonth(d.getUTCMonth() + meses)
  return d.toISOString().slice(0, 10)
}

/**
 * Acha a conta pelo e-mail varrendo TODAS as páginas do Auth.
 *
 * Pelo service role, e não pela RPC `admin_listar_usuarios`, porque o webhook
 * não tem sessão de admin nenhuma. Uma página de mil é teto, não folga: a base
 * saltou de 0 para 405 numa migração só, e quem ficasse fora da primeira página
 * não seria encontrado — o efeito não é erro, é uma SEGUNDA conta criada para
 * quem já tinha uma, e o acesso indo para a conta errada.
 */
async function acharPorEmail(email: string) {
  const servico = criarClienteServico()
  const alvo = email.trim().toLowerCase()
  for (let pagina = 1; pagina <= 50; pagina++) {
    const { data, error } = await servico.auth.admin.listUsers({ page: pagina, perPage: 1000 })
    if (error) throw new Error(`listUsers: ${error.message}`)
    const achado = (data?.users ?? []).find(u => (u.email ?? '').toLowerCase() === alvo)
    if (achado) return achado
    if ((data?.users ?? []).length < 1000) return null
  }
  return null
}

export async function concederAcessoNaAcademy(entrada: EntradaConcessao): Promise<ResultadoConcessao> {
  const email = entrada.email.trim().toLowerCase()
  if (!email || !email.includes('@')) return { ok: false, erro: 'Informe um e-mail válido.' }

  if (!['total', 'curso', 'biblioteca'].includes(entrada.escopo)) {
    return { ok: false, erro: 'Escopo inválido.' }
  }
  if (entrada.escopo === 'curso' && !entrada.cursoId) return { ok: false, erro: 'Escolha o curso.' }
  if (entrada.escopo !== 'curso' && entrada.cursoId) {
    return { ok: false, erro: `Acesso "${entrada.escopo}" não é de um curso específico.` }
  }

  // A vigência é exclusiva no banco (check `acessos_conteudo_vigencia`). Recusar
  // aqui é só para a mensagem ser legível em vez de erro de constraint.
  if (entrada.vitalicio === !!entrada.expiraEm) {
    return { ok: false, erro: 'Escolha vitalício OU uma data de expiração — nunca os dois, nem nenhum.' }
  }

  // Prazo no passado grava concessão que já nasce vencida: a tela diria
  // "concedido", a pessoa entraria e não veria nada, e ninguém ligaria uma
  // coisa à outra.
  if (!entrada.vitalicio && entrada.expiraEm! < hojeDoGate()) {
    return { ok: false, erro: `A data ${formatarBR(entrada.expiraEm!)} já passou — o acesso nasceria vencido.` }
  }

  const servico = criarClienteServico()
  let conta: { id: string } | null = entrada.contaConhecida
    ? { id: entrada.contaConhecida.id }
    : await acharPorEmail(email)
  let contaCriada = false
  let nome = entrada.contaConhecida?.nome?.trim() || entrada.nome.trim()

  if (!conta) {
    if (entrada.permitirCriarConta === false) {
      return { ok: false, erro: 'Esse e-mail não tem conta na plataforma.', motivo: 'sem_conta' }
    }
    if (!nome) return { ok: false, erro: 'Esse e-mail ainda não tem conta. Informe o nome para criá-la.', motivo: 'sem_conta' }

    // Senha aleatória e desconhecida: a entrada é pelo convite do Nexus.
    // `migrado_de` é o que segura o e-mail automático de boas-vindas — o
    // trigger `criar_perfil` retorna antes do net.http_post quando essa chave
    // existe. Sem ela, uma venda dispararia dois e-mails concorrentes: o
    // "Dar meu primeiro passo" daqui e o convite de senha do Nexus.
    const senha = crypto.randomUUID() + crypto.randomUUID()
    const { data: criado, error } = await servico.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome, migrado_de: 'cadastro_admin' },
    })
    if (error || !criado?.user) {
      return { ok: false, erro: `Não consegui criar a conta: ${error?.message ?? 'erro desconhecido'}` }
    }
    conta = criado.user
    contaCriada = true
  } else if (!entrada.contaConhecida) {
    const { data: perfil } = await servico.from('perfis').select('nome').eq('id', conta.id).maybeSingle()
    nome = perfil?.nome || nome || email.split('@')[0]
  } else {
    nome = nome || email.split('@')[0]
  }

  // Concessão vigente igual já existente vira DUAS linhas para o mesmo direito
  // — e no dia em que alguém revogasse uma, o acesso seguiria de pé pela outra.
  let consulta = servico
    .from('acessos_conteudo')
    .select('id, vitalicio, expira_em')
    .eq('usuario_id', conta.id)
    .eq('escopo', entrada.escopo)
    .eq('ativo', true)
  // `.eq(col, null)` não casa com NULL em SQL — precisa ser `is`.
  consulta = entrada.cursoId ? consulta.eq('curso_id', entrada.cursoId) : consulta.is('curso_id', null)

  const { data: existentes, error: erroExistente } = await consulta
  if (erroExistente) return { ok: false, erro: erroExistente.message }

  const hoje = hojeDoGate()
  const vigenteIgual = (existentes ?? []).find(e => e.vitalicio || (e.expira_em && e.expira_em >= hoje))

  // ⚠️ **"Já tinha" NÃO é erro para quem chama pelo pagamento.**
  //
  // O Asaas confirma uma parcela por mês numa venda parcelada, e o webhook roda
  // em cada uma. A segunda parcela encontraria a concessão da primeira: tratar
  // isso como falha faria o log gritar erro doze vezes por venda bem-sucedida —
  // e erro que grita sem haver problema é erro que ninguém lê mais quando há.
  // Por isso volta `jaTinha: true` em vez de `ok: false`, e quem chama decide.
  if (vigenteIgual) {
    return {
      ok: true,
      jaTinha: true,
      usuarioId: conta.id,
      nome,
      contaCriada,
      redundante: false,
      ate: vigenteIgual.vitalicio ? 'vitalício' : formatarBR(vigenteIgual.expira_em!),
    }
  }

  const { error: erroInsert } = await servico.from('acessos_conteudo').insert({
    usuario_id: conta.id,
    escopo: entrada.escopo,
    curso_id: entrada.cursoId,
    vitalicio: entrada.vitalicio,
    expira_em: entrada.expiraEm,
    origem: 'admin',
    observacao: entrada.observacao.trim() || null,
  })
  if (erroInsert) return { ok: false, erro: erroInsert.message }

  // Aviso, não recusa: conceder curso a quem já tem `total` vigente é
  // redundante, não errado — o `total` pode ser temporário e o curso, não.
  let redundante = false
  if (entrada.escopo === 'curso') {
    const { data: total } = await servico
      .from('acessos_conteudo')
      .select('vitalicio, expira_em')
      .eq('usuario_id', conta.id)
      .eq('escopo', 'total')
      .eq('ativo', true)
    redundante = (total ?? []).some(t => t.vitalicio || (t.expira_em && t.expira_em >= hoje))
  }

  return { ok: true, jaTinha: false, usuarioId: conta.id, nome, contaCriada, redundante }
}

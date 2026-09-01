'use server'

// app/admin/acessos/actions.ts
// Conceder, alterar prazo e revogar acesso a conteúdo — e criar a conta do
// aluno quando ela ainda não existe.
//
// ⚠️ **Por que a escrita é pela service role, e não por RPC.**
// `acessos_conteudo` tem policy de SELECT para super_admin/suporte e NENHUMA
// policy de INSERT ou UPDATE — o admin não é dono da linha do aluno. As outras
// ações administrativas resolvem isso com RPC security definer
// (`adm_suspender_usuario` e irmãs), que confere o papel dentro do banco. Aqui
// não há RPC nova, então **o portão é este arquivo**: nenhuma função toca o
// cliente de serviço antes de `checarPermissao()` passar.
//
// A consequência de não haver RPC está escrita para quem vier depois: estas
// operações **não entram em `admin_log_acoes_usuario`** (o `acao` daquela
// tabela é lista fechada por check constraint, e estender é migração). O
// rastro fica no campo `observacao` da própria concessão, onde a assinatura de
// quem concedeu é gravada junto — ver `assinar()`. É rastro mais fraco: dá para
// editar e não registra revogação. Se um dia auditar acesso virar requisito de
// verdade, o caminho é a RPC.
import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { criarClienteServico } from '@/lib/supabase/servico'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'
import { hojeDoGate, type Escopo } from '@/lib/queries/admin-acessos'
import { concederAcessoNaAcademy, separarEmails } from '@/lib/acessos/conceder'

type Resultado = { ok: true; aviso?: string } | { ok: false; erro: string }

async function checarPermissao() {
  const admin = await obterAdminAtual()
  if (!temPermissao(admin, 'acessos')) return null
  return admin
}

/** O e-mail de quem operou, para assinar a observação da concessão. */
async function emailDoAdmin(): Promise<string> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.auth.getUser()
  return data?.user?.email ?? 'admin'
}

function assinar(observacao: string, quem: string): string {
  const nota = observacao.trim()
  const carimbo = `[${quem} · ${hojeDoGate()}]`
  return nota ? `${nota} ${carimbo}` : carimbo
}

function revalidar() {
  revalidatePath('/admin/acessos')
}

// ============================================================
// Conceder
// ============================================================
export type EntradaConcessao = {
  email: string
  nome: string
  escopo: Escopo
  cursoId: string | null
  /** `cursos.slug` — vira a tag do recorte no Nexus. */
  cursoSlug: string | null
  vitalicio: boolean
  expiraEm: string | null
  observacao: string
}

export type ResultadoConcessao =
  | {
      ok: true
      usuarioId: string
      contaCriada: boolean
      redundante: boolean
      nome: string
      /** Como foi a criação da conta do Nexus — é por lá que ele entra. */
      nexus: { ok: boolean; criada: boolean; jaEraAssinante: boolean; tags?: string[]; erro?: string }
    }
  | { ok: false; erro: string }

// ============================================================
// A conta do NEXUS — é por lá que ele entra
// ============================================================
// ⚠️ **O login desta pessoa é o do Nexus, não o daqui.** A conta da Academy
// existe para o SSO achar (e é ela que carrega a concessão do curso), mas quem
// abre a porta todo dia é o painel do Nexus em modo vitrine: cinco cartões
// trancados e a oferta no lugar da ação recomendada. Esse painel é o argumento
// de venda. Se ela entrasse direto aqui, nunca mais ouviria falar do Nexus.
//
// A criação é fire and forget do ponto de vista da CONCESSÃO, e deliberadamente
// não é do ponto de vista da TELA: se o Nexus estiver fora do ar, a concessão
// aqui já está gravada e não deve ser desfeita — mas o operador PRECISA saber
// que a pessoa ficou sem porta de entrada, senão ele fecha a tela achando que
// terminou. Por isso o erro volta no resultado em vez de virar log.
async function garantirContaNoNexus(
  email: string,
  nome: string,
  academyUserId: string,
  enviarConvite: boolean,
  /** O que ele comprou — só viaja quando o convite vai junto. */
  acesso?: { oQue: string; ate: string | null; busca?: string } | null,
  /** Decide a tag do recorte na base do Nexus: `aluno-avulso-<slug>`. */
  recorte?: { escopo: Escopo; cursoSlug: string | null } | null
): Promise<{ ok: boolean; criada: boolean; jaEraAssinante: boolean; tags?: string[]; erro?: string }> {
  const base = process.env.NEXUS_URL?.trim() || 'https://www.nexuspericial.com.br'
  const chave = process.env.NEXUS_INTEGRACAO_KEY?.trim()
  if (!chave) {
    return { ok: false, criada: false, jaEraAssinante: false, erro: 'NEXUS_INTEGRACAO_KEY não configurada neste ambiente.' }
  }

  try {
    const r = await fetch(`${base}/api/integracoes/aluno-curso`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-integracao-key': chave },
      body: JSON.stringify({
        email, nome, academyUserId, enviarConvite,
        acesso: acesso ?? null,
        escopo: recorte?.escopo ?? null,
        cursoSlug: recorte?.cursoSlug ?? null,
      }),
      cache: 'no-store',
    })
    const corpo = await r.json().catch(() => ({}))
    if (!r.ok) {
      return { ok: false, criada: false, jaEraAssinante: false, erro: corpo?.error ?? `Nexus respondeu ${r.status}.` }
    }
    return {
      ok: true,
      criada: corpo.criado === true,
      tags: Array.isArray(corpo.tags) ? corpo.tags : [],
      // Conta que já existia com tier de assinante: o Nexus se recusa a
      // rebaixá-la, e a tela precisa dizer isso — essa pessoa já tem acesso a
      // tudo, e o cadastro do curso avulso pode ter sido engano.
      jaEraAssinante: corpo.criado === false && corpo.ehAluno === false,
      erro: corpo.convite?.enviado === false && enviarConvite
        ? `Conta pronta, mas o convite de senha não saiu (${corpo.convite?.motivo ?? 'motivo desconhecido'}).`
        : undefined,
    }
  } catch (e) {
    return { ok: false, criada: false, jaEraAssinante: false, erro: e instanceof Error ? e.message : 'Nexus inacessível.' }
  }
}

export async function concederAcesso(entrada: EntradaConcessao): Promise<ResultadoConcessao> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  // As recusas e a criação de conta são do núcleo (lib/acessos/conceder.ts),
  // compartilhado com a rota que o webhook de venda do Nexus chama. O que é
  // exclusivo desta porta fica aqui: o papel do admin, a assinatura de quem
  // concedeu, e a conta do Nexus.
  const r = await concederAcessoNaAcademy({
    ...entrada,
    email: entrada.email.trim().toLowerCase(),
    observacao: assinar(entrada.observacao, await emailDoAdmin()),
  })
  if (!r.ok) return { ok: false, erro: r.erro }

  // Pela TELA, "já tem" é erro: o operador precisa saber que não fez nada, e
  // que o caminho é alterar o prazo da linha existente. Pelo pagamento é o
  // oposto — ver o bloco de idempotência no núcleo.
  if (r.jaTinha) {
    return {
      ok: false,
      erro: `Esse aluno já tem esse acesso vigente (${r.ate === 'vitalício' ? 'vitalício' : `até ${r.ate}`}). Use "Alterar prazo" na linha existente.`,
    }
  }

  const nexus = await garantirContaNoNexus(entrada.email.trim().toLowerCase(), r.nome, r.usuarioId, false, null, {
    escopo: entrada.escopo,
    cursoSlug: entrada.cursoSlug,
  })

  revalidar()
  return {
    ok: true,
    usuarioId: r.usuarioId,
    contaCriada: r.contaCriada,
    redundante: r.redundante,
    nome: r.nome,
    nexus,
  }
}

// ============================================================
// Alterar prazo
// ============================================================
// Separada de conceder porque é a operação do dia a dia — renovou, pediu mais
// um mês — e porque é a única que ressuscita um acesso vencido sem criar linha
// nova. Aceita data no passado de propósito: encurtar prazo é caso legítimo
// (estorno, venda cancelada), e recusar obrigaria a revogar e reconceder, o
// que perderia a linha original.
export async function alterarPrazoAcesso(
  acessoId: string,
  vitalicio: boolean,
  expiraEm: string | null
): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  if (vitalicio === !!expiraEm) {
    return { ok: false, erro: 'Escolha vitalício OU uma data de expiração — nunca os dois, nem nenhum.' }
  }

  const servico = criarClienteServico()
  const { error } = await servico
    .from('acessos_conteudo')
    .update({ vitalicio, expira_em: expiraEm, ativo: true })
    .eq('id', acessoId)
  if (error) return { ok: false, erro: error.message }

  revalidar()
  return { ok: true }
}

// ============================================================
// Revogar
// ============================================================
// `ativo = false`, nunca `delete`. Desativar é reversível pela mesma tela e
// preserva o histórico pendurado na linha; apagar levaria junto as exceções
// (`acessos_excecoes` tem `on delete cascade`) e deixaria sem resposta a
// pergunta "por que este aluno perdeu o acesso?".
export async function revogarAcesso(acessoId: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const servico = criarClienteServico()
  const { error } = await servico.from('acessos_conteudo').update({ ativo: false }).eq('id', acessoId)
  if (error) return { ok: false, erro: error.message }

  revalidar()
  return { ok: true }
}

export async function reativarAcesso(acessoId: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const servico = criarClienteServico()
  const { error } = await servico.from('acessos_conteudo').update({ ativo: true }).eq('id', acessoId)
  if (error) return { ok: false, erro: error.message }

  revalidar()
  return { ok: true }
}

// ============================================================
// Avisar o aluno
// ============================================================
// Nunca automático. O cadastro grava o acesso e para aí; este envio é um
// botão. A plataforma já disparou 3 e-mails de boas-vindas por engano num
// ensaio de migração, e cadastro em lote é justamente onde um envio automático
// vira 264 e-mails antes de alguém conferir a lista.
//
// O motivo de não-envio é DEVOLVIDO, nunca engolido: `enviarEmail` recusa em
// silêncio quem desligou os e-mails no perfil, e essa é gente que precisa
// justamente saber que ganhou acesso. A tela mostra o motivo e o link para
// avisar por fora.
// ⚠️ **O convite é o do NEXUS, não o daqui.** A porta de entrada desta pessoa é
// o painel do Nexus; mandá-la para o `/primeiro-acesso` da Academy criaria uma
// senha que ela usaria uma vez e nunca mais, e a pularia justamente da tela que
// existe para vender a assinatura a ela.
//
// Isso também evita duas redações para o mesmo evento: quem escreve o e-mail de
// criação de senha é `lib/acesso/convite-senha.ts`, no Nexus, que já é
// transacional, já sai pelo remetente do domínio principal e já distingue "não
// tinha para quem mandar" de "mandei".
export async function enviarEmailDeAcesso(
  email: string,
  nome: string,
  academyUserId: string,
  /** "o curso Revisão do saldo da conta PASEP" — já escrito pela tela. */
  oQueGanhou: string,
  /** "30/09/2026", ou null quando é vitalício. */
  ate: string | null,
  recorte: { escopo: Escopo; cursoSlug: string | null },
  /** O que digitar na busca do catálogo — o título do curso, sem a frase em volta. */
  busca: string | null
): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const r = await garantirContaNoNexus(email, nome, academyUserId, true, { oQue: oQueGanhou, ate, busca: busca ?? undefined }, recorte)
  if (!r.ok) return { ok: false, erro: r.erro ?? 'Não consegui falar com o Nexus.' }
  if (r.erro) return { ok: false, erro: r.erro }
  return { ok: true }
}

/** Onde essa pessoa entra. É o Nexus, não a Academy. */
export async function linkDeEntrada(): Promise<string> {
  const base = process.env.NEXUS_URL?.trim() || 'https://www.nexuspericial.com.br'
  return `${base}/login`
}

function formatarBR(iso: string): string {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

// ============================================================
// Matricular uma turma inteira
// ============================================================
// Nasceu da mentoria: 60 pessoas, um formulário de uma pessoa por vez. Sessenta
// idas ao mesmo formulário não é só chato — é onde alguém perde a conta de quem
// já cadastrou e descobre no dia da aula que faltaram três.
//
// ⚠️ **O lote NÃO cria conta, e NÃO fala com o Nexus.** As duas coisas são
// deliberadas e diferentes do formulário de uma pessoa:
//
//   · Criar conta em lote transforma dois erros de digitação em duas contas
//     fantasmas permanentes, que ninguém vai procurar depois. E-mail sem conta
//     vira uma linha "sem conta" no relatório, para quem operou decidir.
//   · A conta do Nexus existe para o COMPRADOR DE CURSO AVULSO, que entra por
//     lá. Turma de mentoria é gente que já é aluna daqui e já tem por onde
//     entrar; criar sessenta contas de vitrine seria um efeito que ninguém
//     pediu.
//
// E, como sempre nesta tela, **nenhum e-mail sai**. O lote grava o acesso e
// para. Avisar é outro botão, e é assim desde os 3 e-mails de boas-vindas
// disparados por engano no ensaio da migração.
export type LinhaLote = {
  email: string
  /** `concedido` · `ja_tinha` · `sem_conta` · `erro` */
  situacao: 'concedido' | 'ja_tinha' | 'sem_conta' | 'erro'
  nome?: string
  detalhe?: string
}

export type ResultadoLote =
  | { ok: true; linhas: LinhaLote[]; concedidos: number }
  | { ok: false; erro: string }

export async function concederAcessoEmLote(entrada: {
  emails: string
  cursoId: string
  vitalicio: boolean
  expiraEm: string | null
  observacao: string
}): Promise<ResultadoLote> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const emails = separarEmails(entrada.emails)
  if (emails.length === 0) return { ok: false, erro: 'Cole ao menos um e-mail.' }
  // Teto de sanidade: acima disto o que se quer é um script com relatório em
  // arquivo, não uma tela que fica dez minutos girando e morre no timeout.
  if (emails.length > 300) return { ok: false, erro: `São ${emails.length} e-mails. O lote vai até 300 por vez.` }
  if (!entrada.cursoId) return { ok: false, erro: 'Escolha o curso.' }

  // Uma varredura do Auth para os N e-mails, em vez de N varreduras. Ver o
  // comentário de `contaConhecida` em lib/acessos/conceder.ts.
  const servico = criarClienteServico()
  const contas = new Map<string, { id: string; nome: string }>()
  for (let pagina = 1; pagina <= 50; pagina++) {
    const { data, error } = await servico.auth.admin.listUsers({ page: pagina, perPage: 1000 })
    if (error) return { ok: false, erro: `Não consegui ler a base de contas: ${error.message}` }
    for (const u of data?.users ?? []) {
      const e = (u.email ?? '').toLowerCase()
      if (e) contas.set(e, { id: u.id, nome: (u.user_metadata?.nome as string) ?? '' })
    }
    if ((data?.users ?? []).length < 1000) break
  }

  // O nome do perfil, para o relatório dizer quem é cada linha em vez de repetir
  // o e-mail. Uma consulta para o lote todo.
  const ids = emails.map(e => contas.get(e)?.id).filter(Boolean) as string[]
  if (ids.length) {
    const { data: perfis } = await servico.from('perfis').select('id, nome').in('id', ids)
    const nomePorId = new Map((perfis ?? []).map(p => [p.id, p.nome as string]))
    for (const [email, c] of contas) {
      const nome = nomePorId.get(c.id)
      if (nome) contas.set(email, { ...c, nome })
    }
  }

  const quem = await emailDoAdmin()
  const observacao = assinar(entrada.observacao, quem)
  const linhas: LinhaLote[] = []

  // Em série, de propósito: sessenta gravações concorrentes na mesma tabela
  // disputam a checagem de "já tem" e podem gravar duas linhas para a mesma
  // pessoa. O lote é de dezenas, não de milhares — a lentidão é aceitável, a
  // duplicata não.
  for (const email of emails) {
    const conta = contas.get(email) ?? null
    const r = await concederAcessoNaAcademy({
      email,
      nome: conta?.nome ?? '',
      escopo: 'curso',
      cursoId: entrada.cursoId,
      vitalicio: entrada.vitalicio,
      expiraEm: entrada.expiraEm,
      observacao,
      permitirCriarConta: false,
      contaConhecida: conta,
    })

    if (!r.ok) {
      linhas.push({
        email,
        situacao: r.motivo === 'sem_conta' ? 'sem_conta' : 'erro',
        detalhe: r.erro,
        nome: conta?.nome,
      })
      continue
    }
    linhas.push({
      email,
      situacao: r.jaTinha ? 'ja_tinha' : 'concedido',
      nome: r.nome,
      detalhe: r.jaTinha ? `já vigente (${r.ate})` : undefined,
    })
  }

  revalidar()
  return { ok: true, linhas, concedidos: linhas.filter(l => l.situacao === 'concedido').length }
}

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
import { acharAlunoPorEmail, hojeDoGate, type Escopo } from '@/lib/queries/admin-acessos'
import { emailAcessoLiberado } from '@/lib/email/templates/acessoLiberado'
import { enviarEmail } from '@/lib/email/enviar'
import { SITE_URL } from '@/lib/site'

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
  vitalicio: boolean
  expiraEm: string | null
  observacao: string
}

export type ResultadoConcessao =
  | { ok: true; usuarioId: string; contaCriada: boolean; redundante: boolean; nome: string }
  | { ok: false; erro: string }

export async function concederAcesso(entrada: EntradaConcessao): Promise<ResultadoConcessao> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const email = entrada.email.trim().toLowerCase()
  if (!email || !email.includes('@')) return { ok: false, erro: 'Informe um e-mail válido.' }

  if (!['total', 'curso', 'biblioteca'].includes(entrada.escopo)) {
    return { ok: false, erro: 'Escopo inválido.' }
  }
  if (entrada.escopo === 'curso' && !entrada.cursoId) {
    return { ok: false, erro: 'Escolha o curso.' }
  }
  if (entrada.escopo !== 'curso' && entrada.cursoId) {
    return { ok: false, erro: `Acesso "${entrada.escopo}" não é de um curso específico.` }
  }

  // A vigência é exclusiva no banco (check constraint `acessos_conteudo_vigencia`).
  // Recusar aqui é só para a mensagem ser legível em vez de um erro de constraint.
  if (entrada.vitalicio === !!entrada.expiraEm) {
    return { ok: false, erro: 'Escolha vitalício OU uma data de expiração — nunca os dois, nem nenhum.' }
  }

  // Prazo no passado grava uma concessão que já nasce vencida. A tela diria
  // "concedido com sucesso", o aluno entraria e não veria nada, e ninguém
  // ligaria uma coisa à outra. Erro de digitação de ano é comum.
  if (!entrada.vitalicio && entrada.expiraEm! < hojeDoGate()) {
    return { ok: false, erro: `A data ${formatarBR(entrada.expiraEm!)} já passou — o acesso nasceria vencido.` }
  }

  const servidor = await criarClienteServidor()
  const servico = criarClienteServico()

  let aluno = await acharAlunoPorEmail(servidor, email)
  let contaCriada = false

  if (!aluno) {
    const nome = entrada.nome.trim()
    if (!nome) return { ok: false, erro: 'Esse e-mail ainda não tem conta. Informe o nome para criá-la.' }

    // Senha aleatória que ninguém conhece, como na migração da Ensinio: a
    // entrada é por /primeiro-acesso. `email_confirm: true` evita o e-mail de
    // confirmação do Supabase, e `migrado_de` é o que segura o e-mail
    // automático de boas-vindas — o trigger `criar_perfil` devolve antes do
    // net.http_post quando essa chave existe. Sem ela, cadastrar 264 pessoas
    // dispararia 264 "Dar meu primeiro passo" sem ninguém pedir, que foi
    // exatamente o incidente do ensaio da migração.
    const senha = crypto.randomUUID() + crypto.randomUUID()
    const { data: criado, error: erroCriar } = await servico.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome, migrado_de: 'cadastro_admin' },
    })
    if (erroCriar || !criado?.user) {
      return { ok: false, erro: `Não consegui criar a conta: ${erroCriar?.message ?? 'erro desconhecido'}` }
    }
    aluno = { id: criado.user.id, nome, email }
    contaCriada = true
  }

  // Uma concessão vigente igual já existente vira DUAS linhas para o mesmo
  // direito — e no dia em que alguém revogasse uma, o acesso seguiria de pé
  // pela outra. Revogação que não revoga é pior que revogação que falha.
  let consulta = servico
    .from('acessos_conteudo')
    .select('id, vitalicio, expira_em')
    .eq('usuario_id', aluno.id)
    .eq('escopo', entrada.escopo)
    .eq('ativo', true)
  // `curso_id` é nulo nos escopos `total` e `biblioteca`, e `.eq(col, null)`
  // não casa com NULL em SQL — precisa ser `is`.
  consulta = entrada.cursoId ? consulta.eq('curso_id', entrada.cursoId) : consulta.is('curso_id', null)

  const { data: existentes, error: erroExistente } = await consulta
  if (erroExistente) return { ok: false, erro: erroExistente.message }

  const hoje = hojeDoGate()
  const vigenteIgual = (existentes ?? []).find(
    e => e.vitalicio || (e.expira_em && e.expira_em >= hoje)
  )
  if (vigenteIgual) {
    const ate = vigenteIgual.vitalicio ? 'vitalício' : `até ${formatarBR(vigenteIgual.expira_em!)}`
    return { ok: false, erro: `Esse aluno já tem esse acesso vigente (${ate}). Use "Alterar prazo" na linha existente.` }
  }

  const { error: erroInsert } = await servico.from('acessos_conteudo').insert({
    usuario_id: aluno.id,
    escopo: entrada.escopo,
    curso_id: entrada.cursoId,
    vitalicio: entrada.vitalicio,
    expira_em: entrada.expiraEm,
    origem: 'admin',
    observacao: assinar(entrada.observacao, await emailDoAdmin()),
  })
  if (erroInsert) return { ok: false, erro: erroInsert.message }

  // Não é recusa: conceder curso a quem já tem `total` vigente é redundante,
  // não errado (o `total` pode ser temporário e o curso, vitalício). A tela
  // avisa e a decisão fica com quem opera.
  let redundante = false
  if (entrada.escopo === 'curso') {
    const { data: total } = await servico
      .from('acessos_conteudo')
      .select('id, vitalicio, expira_em')
      .eq('usuario_id', aluno.id)
      .eq('escopo', 'total')
      .eq('ativo', true)
    redundante = (total ?? []).some(t => t.vitalicio || (t.expira_em && t.expira_em >= hoje))
  }

  revalidar()
  return { ok: true, usuarioId: aluno.id, contaCriada, redundante, nome: aluno.nome }
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
export async function enviarEmailDeAcesso(
  usuarioId: string,
  nome: string,
  oQueGanhou: string,
  vigencia: string
): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const { assunto, html } = emailAcessoLiberado({
    primeiroNome: (nome || '').trim().split(/\s+/)[0] || 'Olá',
    oQueGanhou,
    vigencia,
  })

  const r = await enviarEmail({
    usuarioId,
    tipo: 'acesso_liberado',
    // `refId` único por envio: sem ele, o dedupe de `enviarEmail` (mesmo tipo +
    // mesmo refId) bloquearia o segundo aviso para sempre — e o segundo aviso é
    // caso real, porque a pessoa renova, ganha outro curso, ou não achou o
    // primeiro e-mail.
    refId: `${Date.now()}`,
    assunto,
    html,
    remetente: 'automatico',
  })

  if (!r.enviado) {
    const motivos: Record<string, string> = {
      preferencia_desligada: 'Esse aluno desligou os e-mails da plataforma. Avise por fora — o link está aqui do lado.',
      sem_email: 'A conta não tem e-mail utilizável.',
      falha_resend: 'O provedor de e-mail recusou o envio. Tente de novo em alguns minutos.',
      duplicado: 'Esse aviso já foi enviado.',
      limite_diario: 'O aluno já recebeu um e-mail hoje pelo limite diário.',
    }
    return { ok: false, erro: motivos[r.motivo ?? ''] ?? `Não enviado (${r.motivo ?? 'motivo desconhecido'}).` }
  }

  return { ok: true }
}

/** O link que o aluno usa para entrar pela primeira vez. */
export async function linkDePrimeiroAcesso(): Promise<string> {
  return `${SITE_URL}/primeiro-acesso`
}

function formatarBR(iso: string): string {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'
import { carregarExtratoUsuario, type ExtratoPaginado } from '@/lib/queries/admin-suporte'
import { SITE_URL } from '@/lib/site'
// Service role só nos caminhos de exclusão, que precisam ler auth.users e
// apagar a conta — e sempre depois de `checarPermissao()`.
import { criarClienteServico } from '@/lib/supabase/servico'

type Resultado = { ok: true } | { ok: false; erro: string }

async function checarPermissao() {
  const admin = await obterAdminAtual()
  if (!temPermissao(admin, 'usuarios')) return null
  return admin
}

function revalidar(usuarioId: string) {
  revalidatePath('/admin/usuarios')
  revalidatePath(`/admin/usuarios/${usuarioId}`)
}

export async function suspenderUsuario(usuarioId: string, justificativa: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('adm_suspender_usuario', { p_usuario_id: usuarioId, p_justificativa: justificativa })
  if (error) return { ok: false, erro: error.message }
  revalidar(usuarioId)
  return { ok: true }
}

export async function reativarUsuario(usuarioId: string, justificativa: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('adm_reativar_usuario', { p_usuario_id: usuarioId, p_justificativa: justificativa })
  if (error) return { ok: false, erro: error.message }
  revalidar(usuarioId)
  return { ok: true }
}

export async function banirUsuario(usuarioId: string, justificativa: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('adm_banir_usuario', { p_usuario_id: usuarioId, p_justificativa: justificativa })
  if (error) return { ok: false, erro: error.message }
  revalidar(usuarioId)
  return { ok: true }
}

export async function resetarSenhaUsuario(usuarioId: string, justificativa: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const supabase = await criarClienteServidor()
  const { data: email, error } = await supabase.rpc('adm_resetar_senha', { p_usuario_id: usuarioId, p_justificativa: justificativa })
  if (error) return { ok: false, erro: error.message }

  // O destino do link de redefinição é o endereço da plataforma, sem env no
  // meio: `NEXT_PUBLIC_SITE_URL` nunca esteve definida em produção, então o
  // fallback é que era o valor real — e um endereço que uma env pode mudar sem
  // revisão é um endereço que ninguém confere. Ele também precisa estar na
  // allowlist de Redirect URLs do Auth do Supabase, senão o Supabase troca por
  // silêncio o destino pelo Site URL do projeto.
  const { error: erroEmail } = await supabase.auth.resetPasswordForEmail(email as string, {
    redirectTo: `${SITE_URL}/redefinir-senha`,
  })
  if (erroEmail) return { ok: false, erro: erroEmail.message }

  revalidar(usuarioId)
  return { ok: true }
}

export async function concederCortesiaUsuario(usuarioId: string, observacao: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('fin_conceder_cortesia', { p_usuario_id: usuarioId, p_observacao: observacao.trim() || null })
  if (error) return { ok: false, erro: error.message }
  revalidar(usuarioId)
  return { ok: true }
}

export async function ajustarGamificacaoUsuario(
  usuarioId: string, pontos: number, moedas: number, justificativa: string
): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('adm_ajustar_gamificacao', {
    p_usuario_id: usuarioId, p_pontos: pontos, p_moedas: moedas, p_justificativa: justificativa,
  })
  if (error) return { ok: false, erro: error.message }
  revalidar(usuarioId)
  return { ok: true }
}

export async function carregarMaisExtrato(usuarioId: string, pagina: number): Promise<{ ok: true; dados: ExtratoPaginado } | { ok: false; erro: string }> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  try {
    return { ok: true, dados: await carregarExtratoUsuario(usuarioId, pagina) }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Erro ao carregar extrato.' }
  }
}

export async function emitirCertificadoManual(usuarioId: string, cursoId: string, justificativa: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('adm_emitir_certificado_manual', {
    p_usuario_id: usuarioId, p_curso_id: cursoId, p_justificativa: justificativa,
  })
  if (error) return { ok: false, erro: error.message }
  revalidar(usuarioId)
  return { ok: true }
}

// ============================================================
// Status do aluno no MH Nexus (flag manual)
// ============================================================
// Enquanto não existe integração de assinatura entre as plataformas, quem
// marca é o admin. 'active' desliga TODAS as sugestões do Nexus para o aluno;
// 'cancelled' faz voltarem, com o pool de copies de ex-assinante.
//
// Via RPC security definer (não escrita direta) porque a policy de update de
// `perfis` é por linha e o admin não é dono da linha do aluno — mesmo motivo
// das outras ações administrativas. A RPC também grava em
// admin_log_acoes_usuario com a ação 'nexus_status'.
export async function definirNexusStatusUsuario(
  usuarioId: string,
  status: 'none' | 'active' | 'cancelled',
  justificativa: string
): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  if (!justificativa?.trim()) return { ok: false, erro: 'Justificativa é obrigatória.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('adm_definir_nexus_status', {
    p_usuario_id: usuarioId,
    p_status: status,
    p_justificativa: justificativa.trim(),
  })
  if (error) return { ok: false, erro: error.message }

  revalidar(usuarioId)
  return { ok: true }
}

// ============================================================
// Excluir de vez — os dois bancos
// ============================================================
// ⚠️ **IRREVERSÍVEL, e o alcance não é óbvio.** Apagar a conta do Auth da
// Academy carrega junto, por `on delete cascade`, 48 tabelas: a concessão de
// acesso, os certificados emitidos, o progresso de todas as aulas, as
// matrículas, o extrato de gamificação, as respostas da Rota do Perito, as
// reservas de evento. Post e comentário na comunidade FICAM, sem autor
// (`set null`) — some o nome, não o texto.
//
// No Nexus vai junto o contato, com as etiquetas, as inscrições em esteira e o
// histórico de envios de marketing.
//
// A regra da casa é desativar antes de apagar, e ela continua valendo: suspender
// e banir existem para quase todos os casos. Isto aqui é para quando apagar É o
// pedido — conta de teste, cadastro errado, ou pedido de remoção pelo titular.
//
// Por isso são DUAS funções: `previaDeExclusao` mostra o estrago, e só depois a
// tela pergunta. Botão de excluir que apaga no primeiro clique, sem dizer o que
// leva junto, é o desenho que produz o arrependimento.
export type PreviaExclusao = {
  email: string
  nome: string
  academy: {
    certificados: number
    acessos: number
    progressoAulas: number
    postsComunidade: number
    ehAdmin: boolean
  }
  nexus: {
    ok: boolean
    contaNoAuth: boolean
    contatoNaBase: boolean
    tags: number
    inscricoesEmEsteira: number
    enviosDeMarketing: number
    ehOperador: boolean
    erro?: string
  }
}

async function chamarNexusRemocao(email: string, simular: boolean) {
  const base = process.env.NEXUS_URL?.trim() || 'https://www.nexuspericial.com.br'
  const chave = process.env.NEXUS_INTEGRACAO_KEY?.trim()
  if (!chave) return { ok: false, erro: 'NEXUS_INTEGRACAO_KEY não configurada.' }
  try {
    const r = await fetch(`${base}/api/integracoes/aluno-remover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-integracao-key': chave },
      body: JSON.stringify({ email, simular }),
      cache: 'no-store',
    })
    const corpo = await r.json().catch(() => ({}))
    if (!r.ok) return { ok: false, erro: corpo?.error ?? `Nexus respondeu ${r.status}.`, ...corpo }
    return { ok: true, ...corpo }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Nexus inacessível.' }
  }
}

export async function previaDeExclusao(usuarioId: string): Promise<{ ok: true; previa: PreviaExclusao } | { ok: false; erro: string }> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const servico = criarClienteServico()
  const { data: conta } = await servico.auth.admin.getUserById(usuarioId)
  const email = conta?.user?.email
  if (!email) return { ok: false, erro: 'Conta não encontrada.' }

  const contar = async (tabela: string, coluna = 'usuario_id') => {
    const { count } = await servico.from(tabela).select('*', { count: 'exact', head: true }).eq(coluna, usuarioId)
    return count ?? 0
  }

  const [perfil, certificados, acessos, progresso, posts, admin] = await Promise.all([
    servico.from('perfis').select('nome').eq('id', usuarioId).maybeSingle(),
    contar('certificados'),
    contar('acessos_conteudo'),
    contar('aula_progresso'),
    contar('comunidade_posts'),
    servico.from('admin_usuarios').select('id').eq('usuario_id', usuarioId).limit(1),
  ])

  const nexus = await chamarNexusRemocao(email, true)

  return {
    ok: true,
    previa: {
      email,
      nome: perfil.data?.nome ?? email,
      academy: {
        certificados, acessos, progressoAulas: progresso, postsComunidade: posts,
        ehAdmin: (admin.data?.length ?? 0) > 0,
      },
      nexus: {
        ok: nexus.ok === true,
        contaNoAuth: !!(nexus as any).contaNoAuth,
        contatoNaBase: !!(nexus as any).contatoNaBase,
        tags: (nexus as any).tags ?? 0,
        inscricoesEmEsteira: (nexus as any).inscricoesEmEsteira ?? 0,
        enviosDeMarketing: (nexus as any).enviosDeMarketing ?? 0,
        ehOperador: !!(nexus as any).ehOperador,
        erro: (nexus as any).erro,
      },
    },
  }
}

export async function excluirUsuario(
  usuarioId: string,
  emailDigitado: string,
  justificativa: string
): Promise<{ ok: true; nexus: string } | { ok: false; erro: string }> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  if (!justificativa?.trim()) return { ok: false, erro: 'Justificativa é obrigatória.' }

  const servico = criarClienteServico()
  const { data: conta } = await servico.auth.admin.getUserById(usuarioId)
  const email = conta?.user?.email
  if (!email) return { ok: false, erro: 'Conta não encontrada.' }

  // O e-mail digitado é a trava. Um `confirm()` do navegador é clicado sem ler;
  // digitar o endereço obriga a olhar QUEM está sendo apagado — e é o erro mais
  // provável aqui, apagar a pessoa errada da lista.
  if (emailDigitado.trim().toLowerCase() !== email.toLowerCase()) {
    return { ok: false, erro: 'O e-mail digitado não confere com o da conta.' }
  }

  // Admin da Academy não é apagado: `admin_log_acoes_usuario.admin_id` é
  // NO ACTION, então o delete falharia no meio se essa pessoa já tiver operado
  // o painel — com parte do rastro perdido e a conta ainda de pé.
  const { data: ehAdmin } = await servico.from('admin_usuarios').select('id').eq('usuario_id', usuarioId).limit(1)
  if ((ehAdmin?.length ?? 0) > 0) {
    return { ok: false, erro: 'Esta conta é administradora da plataforma. Remova o papel de admin antes de excluir.' }
  }

  // Nexus primeiro. Se falhar, nada foi apagado aqui e dá para tentar de novo;
  // na ordem inversa, uma falha lá deixaria a pessoa sem conta na Academy e
  // ainda recebendo campanha do Nexus.
  const nexus = await chamarNexusRemocao(email, false)
  if (!nexus.ok) return { ok: false, erro: `Nada foi apagado. O Nexus recusou: ${(nexus as any).erro}` }

  const { error } = await servico.auth.admin.deleteUser(usuarioId)
  if (error) {
    return { ok: false, erro: `A pessoa foi removida do Nexus, mas a conta da Academy resistiu: ${error.message}` }
  }

  console.warn(`[EXCLUIR-USUARIO] ${email} removido dos dois bancos. Motivo: ${justificativa.trim()}`)
  revalidatePath('/admin/usuarios')
  return {
    ok: true,
    nexus: (nexus as any).contaApagada || (nexus as any).contatoApagado
      ? 'conta e contato removidos do Nexus'
      : 'não havia nada no Nexus',
  }
}

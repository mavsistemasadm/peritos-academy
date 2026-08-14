'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'
import { carregarExtratoUsuario, type ExtratoPaginado } from '@/lib/queries/admin-suporte'
import { SITE_URL } from '@/lib/site'

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

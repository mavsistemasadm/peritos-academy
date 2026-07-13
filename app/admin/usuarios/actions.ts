'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'
import { carregarExtratoUsuario, type ExtratoPaginado } from '@/lib/queries/admin-suporte'

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

  const origem = process.env.NEXT_PUBLIC_SITE_URL || 'https://peritos-academy.vercel.app'
  const { error: erroEmail } = await supabase.auth.resetPasswordForEmail(email as string, {
    redirectTo: `${origem}/redefinir-senha`,
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

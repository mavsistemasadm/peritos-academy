'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'

type Resultado = { ok: true; id?: string } | { ok: false; erro: string }

async function checarPermissao() {
  const admin = await obterAdminAtual()
  if (!temPermissao(admin, 'financeiro')) return null
  return admin
}

function revalidar() {
  revalidatePath('/admin/financeiro')
}

// ---------- Assinaturas ----------

export async function buscarUsuarioPorEmail(email: string): Promise<
  Resultado & { usuario?: { id: string; nome: string; jaTemAssinatura: boolean } }
> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const emailLimpo = email.trim()
  if (!emailLimpo) return { ok: false, erro: 'Informe um e-mail.' }

  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.rpc('admin_buscar_usuario_por_email', { p_email: emailLimpo })
  if (error) return { ok: false, erro: error.message }
  const usuario = data?.[0]
  if (!usuario) return { ok: false, erro: 'Nenhum usuário encontrado com esse e-mail.' }

  return { ok: true, usuario: { id: usuario.id, nome: usuario.nome, jaTemAssinatura: usuario.ja_tem_assinatura } }
}

export async function concederCortesia(usuarioId: string, observacao: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.rpc('fin_conceder_cortesia', {
    p_usuario_id: usuarioId, p_observacao: observacao.trim() || null,
  })
  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true, id: data as string }
}

export async function suspenderAssinatura(assinaturaId: string, observacao: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('fin_suspender_assinatura', {
    p_assinatura_id: assinaturaId, p_observacao: observacao.trim() || null,
  })
  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true }
}

export async function reativarAssinatura(assinaturaId: string, observacao: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('fin_reativar_assinatura', {
    p_assinatura_id: assinaturaId, p_observacao: observacao.trim() || null,
  })
  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true }
}

export async function cancelarAssinatura(assinaturaId: string, observacao: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('fin_cancelar_assinatura', {
    p_assinatura_id: assinaturaId, p_observacao: observacao.trim() || null,
  })
  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true }
}

// ---------- Planos ----------

export async function criarPlano(formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const nome = (formData.get('nome') as string)?.trim()
  const valorReais = Number((formData.get('valor_reais') as string)?.replace(',', '.') || 0)
  const periodicidade = formData.get('periodicidade') as string
  if (!nome) return { ok: false, erro: 'Nome é obrigatório.' }
  if (!['mensal', 'anual'].includes(periodicidade)) return { ok: false, erro: 'Periodicidade inválida.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('planos_assinatura').insert({
    nome,
    descricao: (formData.get('descricao') as string)?.trim() || null,
    valor_centavos: Math.round(valorReais * 100),
    periodicidade,
    ativo: formData.get('ativo') === 'on',
  })
  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true }
}

export async function atualizarPlano(id: string, formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const nome = (formData.get('nome') as string)?.trim()
  const valorReais = Number((formData.get('valor_reais') as string)?.replace(',', '.') || 0)
  const periodicidade = formData.get('periodicidade') as string
  if (!nome) return { ok: false, erro: 'Nome é obrigatório.' }
  if (!['mensal', 'anual'].includes(periodicidade)) return { ok: false, erro: 'Periodicidade inválida.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('planos_assinatura').update({
    nome,
    descricao: (formData.get('descricao') as string)?.trim() || null,
    valor_centavos: Math.round(valorReais * 100),
    periodicidade,
    ativo: formData.get('ativo') === 'on',
  }).eq('id', id)
  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true }
}

export async function excluirPlano(id: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('planos_assinatura').delete().eq('id', id)
  if (error) {
    const msg = error.message.includes('foreign key')
      ? 'Esse plano já tem assinaturas vinculadas — desative em vez de excluir.'
      : error.message
    return { ok: false, erro: msg }
  }
  revalidar()
  return { ok: true }
}

// ---------- Configurações ----------

export async function atualizarDiasCarencia(formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const dias = Number((formData.get('dias_carencia') as string) || 3)
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('config_financeiro').update({ dias_carencia: dias }).eq('id', 1)
  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true }
}

'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'

type Resultado = { ok: true } | { ok: false; erro: string }

async function checarPermissao() {
  const admin = await obterAdminAtual()
  if (!temPermissao(admin, 'certificados')) return null
  return admin
}

function revalidar() {
  revalidatePath('/admin/certificados')
}

export async function revogarCertificado(id: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase
    .from('certificados')
    .update({ numero: null, emitido_em: null, emitido_rotulo: null })
    .eq('id', id)

  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true }
}

export async function reemitirCertificado(id: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const supabase = await criarClienteServidor()
  const { data: seqData, error: seqErr } = await supabase.rpc('nextval_certificado')
  if (seqErr) return { ok: false, erro: seqErr.message }

  const ano = new Date().getFullYear()
  const numero = `PA-${ano}-${String(seqData).padStart(5, '0')}`
  const agora = new Date()
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  const emitido_rotulo = `${meses[agora.getMonth()]} de ${agora.getFullYear()}`

  const { error } = await supabase
    .from('certificados')
    .update({ numero, emitido_em: agora.toISOString(), emitido_rotulo })
    .eq('id', id)

  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true }
}

export async function atualizarCursoCertificado(cursoId: string, formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const cargaHorasRaw = (formData.get('carga_horas') as string)?.trim()
  const supabase = await criarClienteServidor()
  const { error } = await supabase
    .from('cursos')
    .update({
      emite_certificado: formData.get('emite_certificado') === 'on',
      carga_horas: cargaHorasRaw ? Number(cargaHorasRaw) : null,
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', cursoId)

  if (error) return { ok: false, erro: error.message }
  revalidar()
  revalidatePath('/admin/cursos')
  return { ok: true }
}

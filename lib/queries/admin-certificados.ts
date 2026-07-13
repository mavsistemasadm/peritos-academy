// lib/queries/admin-certificados.ts
import { criarClienteServidor } from '@/lib/supabase/server'

export type CertificadoAdmin = {
  id: string
  numero: string
  usuarioId: string
  usuarioNome: string
  cursoId: string | null
  cursoTitulo: string
  nota: number | null
  cargaHoras: number | null
  emitidoEm: string
}

export type CursoCertificavel = {
  id: string
  titulo: string
  emiteCertificado: boolean
  cargaHoras: number | null
}

export async function carregarCertificadosAdmin(): Promise<CertificadoAdmin[]> {
  const supabase = await criarClienteServidor()
  const { data: certs } = await supabase
    .from('certificados')
    .select('id, numero, usuario_id, curso_id, curso_titulo, nota, carga_horas, emitido_em')
    .not('numero', 'is', null)
    .not('emitido_em', 'is', null)
    .order('emitido_em', { ascending: false })
  if (!certs || certs.length === 0) return []

  const userIds = [...new Set(certs.map(c => c.usuario_id).filter(Boolean) as string[])]
  const { data: perfis } = userIds.length
    ? await supabase.from('perfis').select('id, nome').in('id', userIds)
    : { data: [] as any[] }
  const perfisMap = new Map((perfis ?? []).map(p => [p.id, p.nome as string]))

  return certs.map(c => ({
    id: c.id, numero: c.numero as string, usuarioId: c.usuario_id,
    usuarioNome: c.usuario_id ? perfisMap.get(c.usuario_id) ?? 'Perito' : 'Perito',
    cursoId: c.curso_id, cursoTitulo: c.curso_titulo ?? 'Curso',
    nota: c.nota === null ? null : Number(c.nota), cargaHoras: c.carga_horas, emitidoEm: c.emitido_em as string,
  }))
}

export async function carregarCursosCertificaveis(): Promise<CursoCertificavel[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('cursos')
    .select('id, titulo, emite_certificado, carga_horas')
    .order('titulo', { ascending: true })
  return (data ?? []).map(c => ({
    id: c.id, titulo: c.titulo, emiteCertificado: c.emite_certificado, cargaHoras: c.carga_horas,
  }))
}

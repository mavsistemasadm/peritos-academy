// lib/queries/certificado-publico.ts
// Um certificado pelo número, para a página de verificação e para o PDF.
// Público de propósito (sem login): é o link que o perito manda para um juiz
// ou cliente conferir. A RPC devolve só o nome de quem recebeu, nada mais do
// perfil. Ver supabase/migrations/20261117_certificado_publico.sql.
import { criarClienteServidor } from '@/lib/supabase/server'

export type CertificadoPublico = {
  numero: string
  nome: string
  cursoTitulo: string
  cursoSlug: string | null
  nota: number | null
  cargaHoras: number | null
  emitidoEm: string
  /** Data por extenso em Brasília: "16 de novembro de 2026". */
  emitidoRotulo: string
  /** Só quando o perfil é público. */
  peritoSlug: string | null
}

const FORMATO_NUMERO = /^PA-\d{4}-\d{5}$/

export async function carregarCertificadoPublico(numeroBruto: string): Promise<CertificadoPublico | null> {
  const numero = decodeURIComponent(numeroBruto ?? '').trim().toUpperCase()
  if (!FORMATO_NUMERO.test(numero)) return null

  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.rpc('certificado_publico', { p_numero: numero })
  if (error) {
    console.error('[certificado-publico]', error)
    return null
  }
  const c = Array.isArray(data) ? data[0] : data
  if (!c) return null

  return {
    numero: c.numero,
    nome: (c.nome ?? '').trim() || 'Aluno Peritos Academy',
    cursoTitulo: c.curso_titulo ?? '',
    cursoSlug: c.curso_slug ?? null,
    nota: c.nota == null ? null : Number(c.nota),
    cargaHoras: c.carga_horas == null || Number(c.carga_horas) <= 0 ? null : Number(c.carga_horas),
    emitidoEm: c.emitido_em,
    emitidoRotulo: new Date(c.emitido_em).toLocaleDateString('pt-BR', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo',
    }),
    peritoSlug: c.perito_slug ?? null,
  }
}

/** "Carga horária de 8h · Nota final 9,5": só o que existe, nada em branco. */
export function detalhesDoCertificado(c: Pick<CertificadoPublico, 'cargaHoras' | 'nota'>): string[] {
  const partes: string[] = []
  if (c.cargaHoras) partes.push(`Carga horária de ${c.cargaHoras}h`)
  if (c.nota != null) partes.push(`Nota final ${c.nota.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`)
  return partes
}

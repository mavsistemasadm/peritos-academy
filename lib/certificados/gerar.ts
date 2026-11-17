// lib/certificados/gerar.ts
// Verifica se o aluno completou 100% do curso + passou nas provas e emite o certificado.
import { SupabaseClient } from '@supabase/supabase-js'

export type CertificadoGerado = {
  gerado: boolean
  numero?: string
  curso_titulo?: string
  nota?: number
  carga_horas?: number
}

export async function verificarEEmitirCertificado(
  supabase: SupabaseClient,
  userId: string,
  cursoId: string
): Promise<CertificadoGerado> {
  // 1. Curso emite certificado?
  const { data: curso } = await supabase
    .from('cursos')
    .select('id, titulo, slug, emite_certificado, carga_horas')
    .eq('id', cursoId)
    .single()

  if (!curso || !curso.emite_certificado) return { gerado: false }

  // 2. Já tem certificado emitido?
  //    Desde 17/11/2026 quem emite é o banco (emitir_certificado_interno, chamado
  //    por gam_verificar_progresso_curso no instante da conclusão, seja por aula
  //    ou por avaliação). Quando a tela chega aqui o certificado já existe:
  //    se nasceu agora há pouco, devolve como "gerado" só para abrir o popup.
  const { data: certExistente } = await supabase
    .from('certificados')
    .select('numero, curso_titulo, nota, carga_horas, emitido_em')
    .eq('usuario_id', userId)
    .eq('curso_id', cursoId)
    .not('numero', 'is', null)
    .maybeSingle()

  if (certExistente) {
    const recente = certExistente.emitido_em
      && Date.now() - new Date(certExistente.emitido_em).getTime() < 2 * 60 * 1000
    if (!recente) return { gerado: false }
    return {
      gerado: true,
      numero: certExistente.numero,
      curso_titulo: certExistente.curso_titulo ?? curso.titulo,
      nota: certExistente.nota ?? undefined,
      carga_horas: certExistente.carga_horas ?? undefined,
    }
  }

  // 3. Reserva: a emissão do banco não aconteceu (não deveria, mas a tela da
  //    aula chega aqui logo após concluir). Pede ao banco pela mesma função,
  //    que confere o curso completo e calcula nota e número. O aluno não
  //    grava mais na tabela: desde 17/11/2026 as policies de escrita do dono
  //    saíram, porque com a verificação pública no ar elas permitiam forjar
  //    certificado pelo console.
  const { data: novoId, error } = await supabase.rpc('emitir_meu_certificado', { p_curso_id: cursoId })
  if (error) {
    console.error('[certificado] erro ao emitir:', error)
    return { gerado: false }
  }
  if (!novoId) return { gerado: false }

  const { data: cert } = await supabase
    .from('certificados')
    .select('numero, curso_titulo, nota, carga_horas')
    .eq('id', novoId)
    .maybeSingle()
  if (!cert?.numero) return { gerado: false }

  return {
    gerado: true,
    numero: cert.numero,
    curso_titulo: cert.curso_titulo ?? curso.titulo,
    nota: cert.nota ?? undefined,
    carga_horas: cert.carga_horas ?? undefined,
  }
}

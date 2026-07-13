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
  const { data: certExistente } = await supabase
    .from('certificados')
    .select('numero')
    .eq('usuario_id', userId)
    .eq('curso_id', cursoId)
    .not('numero', 'is', null)
    .maybeSingle()

  if (certExistente) return { gerado: false }

  // 3. Curso 100% completo (aulas + avaliações)? Checagem única via RPC
  //    (fonte da verdade compartilhada com o motor de gamificação —
  //    ver gam_curso_completo() na migração de gamificação).
  const { data: completo } = await supabase.rpc('gam_curso_completo', {
    p_usuario: userId,
    p_curso_id: cursoId,
  })

  if (!completo) return { gerado: false }

  const { data: avaliacoes } = await supabase
    .from('avaliacoes')
    .select('id, nota_minima')
    .eq('curso_id', cursoId)

  // 5. Calcula nota média das avaliações
  let notaMedia: number | null = null
  if (avaliacoes && avaliacoes.length > 0) {
    const notas: number[] = []
    for (const av of avaliacoes) {
      const { data: melhor } = await supabase
        .from('avaliacao_tentativas')
        .select('nota')
        .eq('avaliacao_id', av.id)
        .eq('usuario_id', userId)
        .order('nota', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (melhor) notas.push(melhor.nota)
    }
    if (notas.length > 0) {
      notaMedia = Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 10) / 10
    }
  }

  // 6. Gera número sequencial
  const ano = new Date().getFullYear()
  const { data: seqData } = await supabase.rpc('nextval_certificado')
  const seq = seqData ?? Math.floor(Math.random() * 99999)
  const numero = `PA-${ano}-${String(seq).padStart(5, '0')}`

  // 7. Formata data
  const agora = new Date()
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
  const emitido_rotulo = `${meses[agora.getMonth()]} de ${agora.getFullYear()}`

  // 8. Upsert certificado
  const { error } = await supabase
    .from('certificados')
    .upsert({
      usuario_id: userId,
      curso_id: cursoId,
      curso_titulo: curso.titulo,
      curso_slug: curso.slug,
      numero,
      nota: notaMedia,
      carga_horas: curso.carga_horas,
      emitido_em: agora.toISOString(),
      emitido_rotulo,
      progresso_pct: 100,
    }, { onConflict: 'usuario_id,curso_id' })

  if (error) {
    console.error('[certificado] erro ao emitir:', error)
    return { gerado: false }
  }

  return {
    gerado: true,
    numero,
    curso_titulo: curso.titulo,
    nota: notaMedia ?? undefined,
    carga_horas: curso.carga_horas ?? undefined,
  }
}
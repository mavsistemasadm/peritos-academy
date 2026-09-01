// lib/acesso/restritos.ts
// Esconder das listagens o curso de turma fechada.
//
// `cursos.restrito` (2026-09-01) é o curso publicado que só existe para quem
// foi matriculado nominalmente. Quem decide isso é o banco — `tem_acesso_curso`
// desvia para `matriculado_no_curso` quando o curso é restrito — e este arquivo
// é só a ponte para as telas que montam LISTA.
//
// ⚠️ **A regra não é reimplementada aqui, e não deve ser.** Toda listagem
// pergunta a mesma coisa ao banco (`cursos_restritos_visiveis`) e usa a
// resposta para filtrar. Repetir "tem linha em acessos_conteudo com escopo
// curso" em TypeScript criaria uma segunda fonte da mesma regra, que diverge no
// dia em que uma ganhar a exceção que a outra não tem — e o sintoma seria o
// card aparecendo para quem a página de dentro recusa, ou o contrário.
//
// Uma chamada por página, não uma por card: são 73 cursos publicados e a
// pergunta é a mesma para todos.
import type { SupabaseClient } from '@supabase/supabase-js'

/** Os ids de curso restrito que ESTA pessoa pode ver. Deslogado recebe vazio. */
export async function cursosRestritosVisiveis(supabase: SupabaseClient): Promise<Set<string>> {
  const { data } = await supabase.rpc('cursos_restritos_visiveis')
  // A RPC devolve `setof uuid`, que o PostgREST entrega como lista de strings.
  return new Set(((data ?? []) as unknown[]).map(v => String(v)))
}

/**
 * Tira da lista o curso restrito que a pessoa não pode ver.
 *
 * Curso sem a coluna carregada (`restrito` ausente) fica — o filtro nunca
 * esconde por falta de informação, porque o efeito de um `select` que esqueceu
 * a coluna seria o catálogo inteiro sumindo, e ninguém ligaria uma coisa à
 * outra.
 */
export function semRestritosOcultos<T extends { id: string; restrito?: boolean | null }>(
  cursos: T[],
  visiveis: Set<string>,
): T[] {
  return cursos.filter(c => !c.restrito || visiveis.has(c.id))
}

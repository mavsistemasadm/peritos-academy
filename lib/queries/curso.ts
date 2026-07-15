import { criarClienteServidor } from "@/lib/supabase/server";

export async function buscarCurso(slug: string) {
  const supabase = await criarClienteServidor();

  // 1. curso pelo slug
  const { data: curso } = await supabase
    .from("cursos")
    .select("*")
    .eq("slug", slug)
    .eq("publicado", true)
    .single();

  if (!curso) return null;

  // 2. trilha (chip do hero) — via view curso_trilha
  const { data: ct } = await supabase
    .from("curso_trilha")
    .select("trilha_nome, etapa_nome")
    .eq("curso_id", curso.id)
    .maybeSingle();

  // 3. módulos + aulas (aninhado, ordenado)
  const { data: modulos } = await supabase
    .from("modulos")
    .select(`
      id, titulo, ordem,
      aulas ( id, titulo, descricao, duracao_seg, ordem, xp, tipo )
    `)
    .eq("curso_id", curso.id)
    .order("ordem", { ascending: true });

  // ordena as aulas dentro de cada módulo
  const modulosOrdenados = (modulos ?? []).map((m) => ({
    ...m,
    aulas: (m.aulas ?? []).sort((a, b) => a.ordem - b.ordem),
  }));

  // 4. conquistas do curso
  const { data: conquistas } = await supabase
    .from("conquistas")
    .select("id, slug, nome, descricao, xp, icone, ordem")
    .eq("curso_id", curso.id)
    .order("ordem", { ascending: true });

  // 5. cursos relacionados (mesmo catálogo, exclui o atual)
  const { data: relacionados } = await supabase
    .from("cursos")
    .select("id, slug, titulo, capa_url, capa_vertical_url")
    .eq("publicado", true)
    .neq("id", curso.id)
    .limit(4);

  return {
    curso: {
      ...curso,
      trilha_nome: ct?.trilha_nome ?? null,
      etapa_nome: ct?.etapa_nome ?? null,
    },
    modulos: modulosOrdenados,
    conquistas: conquistas ?? [],
    relacionados: relacionados ?? [],
  };
}
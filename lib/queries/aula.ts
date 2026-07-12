// lib/queries/aula.ts
// Busca TUDO que a página da aula precisa, 100% do Supabase.
import { criarClienteServidor } from "@/lib/supabase/server";

export type Capitulo = { id: string; titulo: string; tempo_seg: number; ordem: number };
export type Material = { id: string; nome: string; descricao: string | null; tipo: "pdf" | "xls"; arquivo_url: string | null; ordem: number };
export type Duvida = {
  id: string; parent_id: string | null; autor_nome: string; autor_iniciais: string;
  e_especialista: boolean; tempo_seg: number | null; texto: string; uteis: number; criada_em: string;
  respostas?: Duvida[];
};
export type Anotacao = { id: string; tempo_seg: number; texto: string; criada_em: string };
export type AulaTrilho = {
  id: string; titulo: string; ordem: number; duracaoSeg: number; tipo?: string | null;
  concluida: boolean; atual: boolean;
};

export type AulaCompleta = {
  curso: { id: string; slug: string; titulo: string };
  modulo: { id: string; titulo: string; ordem: number; totalAulas: number; concluidasNoModulo: number; duracaoModuloSeg: number };
  aula: {
    id: string; titulo: string; ordem: number; duracaoSeg: number; xp: number;
    video_url: string | null; capa_url: string | null; sobre: string[];
    concluida: boolean;
  };
  capitulos: Capitulo[];
  materiais: Material[];
  duvidas: Duvida[];
  anotacoes: Anotacao[];
  trilho: AulaTrilho[];
  anterior: { id: string } | null;
  proxima: { id: string; titulo: string; duracaoSeg: number } | null;
  proximoModulo: { titulo: string; ordem: number; totalAulas: number; duracaoModuloSeg: number } | null;
  progressoCurso: { concluidas: number; total: number; pct: number; xpTotal: number; nivel: number };
};

// duração das aulas vem em SEGUNDOS (coluna duracao_seg)
const dur = (a: any): number => a?.duracao_seg ?? 0;

export async function getAula(slug: string, aulaId: string): Promise<AulaCompleta | null> {
  const supabase = await criarClienteServidor();

  // curso pelo slug (mesmo filtro publicado da página do curso)
  const { data: curso } = await supabase
    .from("cursos")
    .select("id, slug, titulo")
    .eq("slug", slug)
    .eq("publicado", true)
    .single();
  if (!curso) return null;

  // módulos + aulas (aninhado)
  const { data: modulosRaw } = await supabase
    .from("modulos")
    .select("id, titulo, ordem, aulas ( id, titulo, descricao, duracao_seg, ordem, xp, tipo, video_url, capa_url, sobre )")
    .eq("curso_id", curso.id)
    .order("ordem", { ascending: true });

  const modulos = (modulosRaw ?? []).map((m: any) => ({
    ...m,
    aulas: (m.aulas ?? []).sort((a: any, b: any) => a.ordem - b.ordem),
  }));

  const moduloAtual = modulos.find((m: any) => m.aulas?.some((a: any) => a.id === aulaId));
  if (!moduloAtual) return null;
  const aulaRaw = moduloAtual.aulas.find((a: any) => a.id === aulaId);

  // lista plana ordenada de todas as aulas do curso
  const todas: any[] = modulos.flatMap((m: any) => m.aulas ?? []);
  const idx = todas.findIndex((a) => a.id === aulaId);

  // usuário logado (se houver) → progresso e anotações
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id ?? null;

  const [capRes, matRes, duvRes, progRes, notaRes] = await Promise.all([
    supabase.from("aula_capitulos").select("*").eq("aula_id", aulaId).order("ordem"),
    supabase.from("aula_materiais").select("*").eq("aula_id", aulaId).order("ordem"),
    supabase.from("aula_duvidas").select("*").eq("aula_id", aulaId).order("criada_em", { ascending: false }),
    userId
      ? supabase.from("aula_progresso").select("aula_id").eq("usuario_id", userId).in("aula_id", todas.map((a) => a.id))
      : Promise.resolve({ data: [] as { aula_id: string }[] }),
    userId
      ? supabase.from("aula_anotacoes").select("id, tempo_seg, texto, criada_em").eq("usuario_id", userId).eq("aula_id", aulaId).order("criada_em", { ascending: false })
      : Promise.resolve({ data: [] as Anotacao[] }),
  ]);

  const concluidasSet = new Set(((progRes.data as any[]) ?? []).map((p) => p.aula_id));

  // dúvidas → árvore (perguntas + respostas)
  const duvidasFlat = (duvRes.data as Duvida[]) ?? [];
  const perguntas = duvidasFlat.filter((d) => !d.parent_id);
  perguntas.forEach((p) => {
    p.respostas = duvidasFlat
      .filter((d) => d.parent_id === p.id)
      .sort((a, b) => a.criada_em.localeCompare(b.criada_em));
  });

  const trilho: AulaTrilho[] = moduloAtual.aulas.map((a: any) => ({
    id: a.id, titulo: a.titulo, ordem: a.ordem, duracaoSeg: dur(a), tipo: a.tipo ?? null,
    concluida: concluidasSet.has(a.id), atual: a.id === aulaId,
  }));

  const proxModuloRaw = modulos[modulos.findIndex((m: any) => m.id === moduloAtual.id) + 1] ?? null;

  const concluidas = todas.filter((a) => concluidasSet.has(a.id)).length;
  const xpTotal = todas.filter((a) => concluidasSet.has(a.id)).reduce((s, a) => s + (a.xp ?? 40), 0);

  return {
    curso: { id: curso.id, slug: curso.slug, titulo: curso.titulo },
    modulo: {
      id: moduloAtual.id, titulo: moduloAtual.titulo, ordem: moduloAtual.ordem,
      totalAulas: moduloAtual.aulas.length,
      concluidasNoModulo: moduloAtual.aulas.filter((a: any) => concluidasSet.has(a.id)).length,
      duracaoModuloSeg: moduloAtual.aulas.reduce((s: number, a: any) => s + dur(a), 0),
    },
    aula: {
      id: aulaRaw.id, titulo: aulaRaw.titulo, ordem: aulaRaw.ordem, duracaoSeg: dur(aulaRaw),
      xp: aulaRaw.xp ?? 40, video_url: aulaRaw.video_url ?? null, capa_url: aulaRaw.capa_url ?? null,
      sobre: Array.isArray(aulaRaw.sobre) ? aulaRaw.sobre : (aulaRaw.descricao ? [aulaRaw.descricao] : []),
      concluida: concluidasSet.has(aulaRaw.id),
    },
    capitulos: (capRes.data as Capitulo[]) ?? [],
    materiais: (matRes.data as Material[]) ?? [],
    duvidas: perguntas,
    anotacoes: (notaRes.data as Anotacao[]) ?? [],
    trilho,
    anterior: idx > 0 ? { id: todas[idx - 1].id } : null,
    proxima: idx < todas.length - 1
      ? { id: todas[idx + 1].id, titulo: todas[idx + 1].titulo, duracaoSeg: dur(todas[idx + 1]) }
      : null,
    proximoModulo: proxModuloRaw
      ? {
          titulo: proxModuloRaw.titulo, ordem: proxModuloRaw.ordem,
          totalAulas: proxModuloRaw.aulas?.length ?? 0,
          duracaoModuloSeg: (proxModuloRaw.aulas ?? []).reduce((s: number, a: any) => s + dur(a), 0),
        }
      : null,
    progressoCurso: {
      concluidas, total: todas.length,
      pct: todas.length ? Math.round((concluidas / todas.length) * 100) : 0,
      xpTotal, nivel: Math.floor(xpTotal / 100) + 1,
    },
  };
}
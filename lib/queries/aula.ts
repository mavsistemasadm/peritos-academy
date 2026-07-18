// lib/queries/aula.ts
// Busca TUDO que a página da aula precisa, 100% do Supabase.
import { criarClienteServidor } from "@/lib/supabase/server";

export type Capitulo = { id: string; titulo: string; tempo_seg: number; ordem: number };
export type Material = { id: string; nome: string; descricao: string | null; tipo: "pdf" | "xlsx" | "docx" | "zip" | "outro"; arquivo_url: string | null; ordem: number };
export type Duvida = {
  id: string; parent_id: string | null; autor_nome: string; autor_iniciais: string;
  e_especialista: boolean; tempo_seg: number | null; texto: string; uteis: number; criada_em: string;
  respostas?: Duvida[];
};
export type Anotacao = { id: string; tempo_seg: number; texto: string; criada_em: string };
export type AulaTrilho = {
  id: string; titulo: string; ordem: number; duracaoSeg: number; tipo?: string | null;
  concluida: boolean; atual: boolean; bloqueada: boolean;
};

export type AulaCompleta = {
  curso: { id: string; slug: string; titulo: string };
  modulo: { id: string; titulo: string; ordem: number; totalAulas: number; concluidasNoModulo: number; duracaoModuloSeg: number };
  aula: {
    id: string; titulo: string; ordem: number; duracaoSeg: number; xp: number;
    video_url: string | null; capa_url: string | null; sobre: string[];
    concluida: boolean; bloqueada: boolean; segundosAssistidos: number; videoTerminou: boolean;
  };
  capitulos: Capitulo[];
  materiais: Material[];
  materiaisBaixadosIds: string[];
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

  const [capRes, matRes, duvRes, progRes, segRes, notaRes, avalRes, tentRes] = await Promise.all([
    supabase.from("aula_capitulos").select("*").eq("aula_id", aulaId).order("ordem"),
    supabase.from("aula_materiais").select("*").eq("aula_id", aulaId).order("ordem"),
    supabase.from("aula_duvidas").select("*").eq("aula_id", aulaId).order("criada_em", { ascending: false }),
    userId
      // .eq('concluida', true) é essencial: a linha agora também existe pra
      // progresso PARCIAL (segundos_assistidos), então existência != concluída.
      ? supabase.from("aula_progresso").select("aula_id").eq("usuario_id", userId).eq("concluida", true).in("aula_id", todas.map((a) => a.id))
      : Promise.resolve({ data: [] as { aula_id: string }[] }),
    userId
      ? supabase.from("aula_progresso").select("segundos_assistidos, video_terminou").eq("usuario_id", userId).eq("aula_id", aulaId).maybeSingle()
      : Promise.resolve({ data: null as { segundos_assistidos: number; video_terminou: boolean } | null }),
    userId
      ? supabase.from("aula_anotacoes").select("id, tempo_seg, texto, criada_em").eq("usuario_id", userId).eq("aula_id", aulaId).order("criada_em", { ascending: false })
      : Promise.resolve({ data: [] as Anotacao[] }),
    // avaliações de módulo (publicadas) — travam o módulo seguinte até aprovação.
    // provas de curso (modulo_id null) não travam navegação entre aulas: travam
    // a conclusão do curso/certificado, já coberto por gam_curso_completo.
    supabase.from("avaliacoes").select("id, modulo_id").eq("curso_id", curso.id).eq("tipo", "avaliacao").eq("publicado", true).not("modulo_id", "is", null),
    userId
      ? supabase.from("avaliacao_tentativas").select("avaliacao_id").eq("usuario_id", userId).eq("aprovado", true)
      : Promise.resolve({ data: [] as { avaliacao_id: string }[] }),
  ]);

  const concluidasSet = new Set(((progRes.data as any[]) ?? []).map((p) => p.aula_id));
  const segundosAssistidos = (segRes.data as any)?.segundos_assistidos ?? 0;
  const videoTerminou = (segRes.data as any)?.video_terminou ?? false;

  const aprovadasSet = new Set(((tentRes.data as any[]) ?? []).map((t) => t.avaliacao_id));
  const avalsPorModulo = new Map<string, string[]>();
  for (const av of (avalRes.data as any[]) ?? []) {
    const lista = avalsPorModulo.get(av.modulo_id) ?? [];
    lista.push(av.id);
    avalsPorModulo.set(av.modulo_id, lista);
  }
  const moduloLiberado = (moduloId: string) => {
    const avals = avalsPorModulo.get(moduloId);
    if (!avals || avals.length === 0) return true;
    return avals.every((id) => aprovadasSet.has(id));
  };

  // dúvidas → árvore (perguntas + respostas)
  const duvidasFlat = (duvRes.data as Duvida[]) ?? [];
  const perguntas = duvidasFlat.filter((d) => !d.parent_id);
  perguntas.forEach((p) => {
    p.respostas = duvidasFlat
      .filter((d) => d.parent_id === p.id)
      .sort((a, b) => a.criada_em.localeCompare(b.criada_em));
  });

  // bloqueio sequencial: aula[i] só libera se aula[i-1] estiver concluída E,
  // ao cruzar de módulo, todas as avaliações do módulo anterior aprovadas.
  const bloqueadaPorAula = new Map<string, boolean>();
  for (let i = 0; i < todas.length; i++) {
    const a = todas[i];
    if (i === 0) {
      bloqueadaPorAula.set(a.id, false);
      continue;
    }
    const anterior = todas[i - 1];
    const anteriorConcluida = concluidasSet.has(anterior.id);
    const cruzouModulo = a.modulo_id !== anterior.modulo_id;
    const gateModulo = cruzouModulo ? moduloLiberado(anterior.modulo_id) : true;
    bloqueadaPorAula.set(a.id, !(anteriorConcluida && gateModulo));
  }

  const trilho: AulaTrilho[] = moduloAtual.aulas.map((a: any) => ({
    id: a.id, titulo: a.titulo, ordem: a.ordem, duracaoSeg: dur(a), tipo: a.tipo ?? null,
    concluida: concluidasSet.has(a.id), atual: a.id === aulaId, bloqueada: bloqueadaPorAula.get(a.id) ?? false,
  }));

  const proxModuloRaw = modulos[modulos.findIndex((m: any) => m.id === moduloAtual.id) + 1] ?? null;

  const concluidas = todas.filter((a) => concluidasSet.has(a.id)).length;
  const xpTotal = todas.filter((a) => concluidasSet.has(a.id)).reduce((s, a) => s + (a.xp ?? 40), 0);

  const materiais = (matRes.data as Material[]) ?? [];
  const materialIds = materiais.filter((m) => m.arquivo_url).map((m) => m.id);
  const { data: baixadosRaw } = userId && materialIds.length
    ? await supabase.from("material_downloads").select("material_id").eq("usuario_id", userId).in("material_id", materialIds)
    : { data: [] as { material_id: string }[] };

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
      bloqueada: bloqueadaPorAula.get(aulaRaw.id) ?? false,
      segundosAssistidos,
      videoTerminou,
    },
    capitulos: (capRes.data as Capitulo[]) ?? [],
    materiais,
    materiaisBaixadosIds: ((baixadosRaw as any[]) ?? []).map((b) => b.material_id),
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

// Primeira aula bloqueada do curso (ou a própria aulaId se ela já estiver liberada) —
// usado por page.tsx pra redirecionar acesso direto por URL a uma aula travada.
export async function primeiraAulaLiberada(slug: string): Promise<string | null> {
  const supabase = await criarClienteServidor();
  const { data: curso } = await supabase.from("cursos").select("id").eq("slug", slug).eq("publicado", true).single();
  if (!curso) return null;

  const { data: modulosRaw } = await supabase
    .from("modulos")
    .select("id, ordem, aulas ( id, ordem )")
    .eq("curso_id", curso.id)
    .order("ordem", { ascending: true });
  const modulos = (modulosRaw ?? []).map((m: any) => ({ ...m, aulas: (m.aulas ?? []).sort((a: any, b: any) => a.ordem - b.ordem) }));
  const todas: any[] = modulos.flatMap((m: any) => (m.aulas ?? []).map((a: any) => ({ ...a, modulo_id: m.id })));
  if (todas.length === 0) return null;

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id ?? null;
  if (!userId) return todas[0].id;

  const [{ data: prog }, { data: avals }, { data: tent }] = await Promise.all([
    supabase.from("aula_progresso").select("aula_id").eq("usuario_id", userId).eq("concluida", true).in("aula_id", todas.map((a) => a.id)),
    supabase.from("avaliacoes").select("id, modulo_id").eq("curso_id", curso.id).eq("tipo", "avaliacao").eq("publicado", true).not("modulo_id", "is", null),
    supabase.from("avaliacao_tentativas").select("avaliacao_id").eq("usuario_id", userId).eq("aprovado", true),
  ]);
  const concluidasSet = new Set((prog ?? []).map((p) => p.aula_id));
  const aprovadasSet = new Set((tent ?? []).map((t) => t.avaliacao_id));
  const avalsPorModulo = new Map<string, string[]>();
  for (const av of avals ?? []) {
    const lista = avalsPorModulo.get(av.modulo_id) ?? [];
    lista.push(av.id);
    avalsPorModulo.set(av.modulo_id, lista);
  }
  const moduloLiberado = (moduloId: string) => {
    const ids = avalsPorModulo.get(moduloId);
    if (!ids || ids.length === 0) return true;
    return ids.every((id) => aprovadasSet.has(id));
  };

  for (let i = 0; i < todas.length; i++) {
    if (i === 0) continue;
    const anterior = todas[i - 1];
    const anteriorConcluida = concluidasSet.has(anterior.id);
    const cruzouModulo = todas[i].modulo_id !== anterior.modulo_id;
    const gateModulo = cruzouModulo ? moduloLiberado(anterior.modulo_id) : true;
    if (!(anteriorConcluida && gateModulo)) return todas[i - 1].id;
  }
  return todas[todas.length - 1].id;
}

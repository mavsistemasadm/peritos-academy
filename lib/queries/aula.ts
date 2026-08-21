// lib/queries/aula.ts
// Busca TUDO que a página da aula precisa, 100% do Supabase.
import { criarClienteServidor } from "@/lib/supabase/server";
import { carregarSequencia, hrefDoItem, motivoDe, type TipoItem } from "@/lib/progresso/sequencia";

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
  // o trilho lista a jornada do módulo inteira — aula E avaliação, cada uma na
  // posição real. Antes só listava aulas, e era por isso que o aluno navegando
  // de aula em aula nunca via que existia uma prova no caminho.
  tipoItem: TipoItem; href: string; motivo: string | null;
};

export type AulaCompleta = {
  curso: { id: string; slug: string; titulo: string };
  modulo: { id: string; titulo: string; ordem: number; totalAulas: number; concluidasNoModulo: number; duracaoModuloSeg: number };
  aula: {
    id: string; titulo: string; ordem: number; duracaoSeg: number; xp: number;
    video_url: string | null; capa_url: string | null; sobre: string[];
    concluida: boolean; bloqueada: boolean; motivo: string | null;
    segundosAssistidos: number; videoTerminou: boolean;
  };
  capitulos: Capitulo[];
  materiais: Material[];
  materiaisBaixadosIds: string[];
  duvidas: Duvida[];
  anotacoes: Anotacao[];
  trilho: AulaTrilho[];
  anterior: { id: string; href: string } | null;
  proxima: { id: string; titulo: string; duracaoSeg: number; tipoItem: TipoItem; href: string } | null;
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

  // usuário logado (se houver) → progresso e anotações
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id ?? null;

  const [capRes, matRes, duvRes, segRes, notaRes] = await Promise.all([
    supabase.from("aula_capitulos").select("*").eq("aula_id", aulaId).order("ordem"),
    supabase.from("aula_materiais").select("*").eq("aula_id", aulaId).order("ordem"),
    supabase.from("aula_duvidas").select("*").eq("aula_id", aulaId).order("criada_em", { ascending: false }),
    userId
      ? supabase.from("aula_progresso").select("segundos_assistidos, video_terminou").eq("usuario_id", userId).eq("aula_id", aulaId).maybeSingle()
      : Promise.resolve({ data: null as { segundos_assistidos: number; video_terminou: boolean } | null }),
    userId
      ? supabase.from("aula_anotacoes").select("id, tempo_seg, texto, criada_em").eq("usuario_id", userId).eq("aula_id", aulaId).order("criada_em", { ascending: false })
      : Promise.resolve({ data: [] as Anotacao[] }),
  ]);

  // ordem e trava vêm da sequência única do curso (lib/progresso/sequencia.ts),
  // a mesma que as RPCs de escrita usam. Ver o comentário lá sobre por que isso
  // não é mais recalculado aqui.
  const sequencia = await carregarSequencia(supabase, curso.id, userId);

  const segundosAssistidos = (segRes.data as any)?.segundos_assistidos ?? 0;
  const videoTerminou = (segRes.data as any)?.video_terminou ?? false;

  // dúvidas → árvore (perguntas + respostas)
  const duvidasFlat = (duvRes.data as Duvida[]) ?? [];
  const perguntas = duvidasFlat.filter((d) => !d.parent_id);
  perguntas.forEach((p) => {
    p.respostas = duvidasFlat
      .filter((d) => d.parent_id === p.id)
      .sort((a, b) => a.criada_em.localeCompare(b.criada_em));
  });

  // trilho do módulo: a jornada inteira daqui, aulas e avaliações intercaladas
  // na posição real (ver lib/progresso/sequencia.ts).
  const itensDoModulo = sequencia.itens.filter((i) => i.moduloId === moduloAtual.id);
  const duracaoDe = (id: string) => dur(todas.find((a) => a.id === id));

  const trilho: AulaTrilho[] = itensDoModulo.map((item, i) => ({
    id: item.id,
    titulo: item.titulo,
    ordem: i + 1,
    duracaoSeg: item.tipo === "aula" ? duracaoDe(item.id) : 0,
    tipo: item.tipo === "avaliacao" ? "avaliacao" : (todas.find((a) => a.id === item.id)?.tipo ?? null),
    concluida: item.cumprido && !item.bloqueado,
    atual: item.id === aulaId,
    bloqueada: item.bloqueado,
    tipoItem: item.tipo,
    href: hrefDoItem(curso.slug, item),
    motivo: motivoDe(item.pendencia),
  }));

  // navegação: anda pela sequência, não pela lista de aulas — senão o "Próxima"
  // pula por cima da avaliação, que foi exatamente o que empurrou aluno pra
  // dentro de aula trancada e o deixou sem saber que existia uma prova.
  const idxSeq = sequencia.itens.findIndex((i) => i.id === aulaId);
  const itemAnterior = idxSeq > 0 ? sequencia.itens[idxSeq - 1] : null;
  const itemProximo = idxSeq >= 0 && idxSeq < sequencia.itens.length - 1 ? sequencia.itens[idxSeq + 1] : null;
  const estadoAtual = sequencia.porId.get(aulaId) ?? null;

  const proxModuloRaw = modulos[modulos.findIndex((m: any) => m.id === moduloAtual.id) + 1] ?? null;

  const cumpridos = sequencia.itens.filter((i) => i.cumprido && !i.bloqueado);
  const concluidas = cumpridos.length;
  const xpTotal = cumpridos
    .filter((i) => i.tipo === "aula")
    .reduce((s, i) => s + (todas.find((a) => a.id === i.id)?.xp ?? 40), 0);

  const materiais = (matRes.data as Material[]) ?? [];
  const materialIds = materiais.filter((m) => m.arquivo_url).map((m) => m.id);
  const { data: baixadosRaw } = userId && materialIds.length
    ? await supabase.from("material_downloads").select("material_id").eq("usuario_id", userId).in("material_id", materialIds)
    : { data: [] as { material_id: string }[] };

  return {
    curso: { id: curso.id, slug: curso.slug, titulo: curso.titulo },
    modulo: {
      id: moduloAtual.id, titulo: moduloAtual.titulo, ordem: moduloAtual.ordem,
      totalAulas: itensDoModulo.length,
      concluidasNoModulo: itensDoModulo.filter((i) => i.cumprido && !i.bloqueado).length,
      duracaoModuloSeg: moduloAtual.aulas.reduce((s: number, a: any) => s + dur(a), 0),
    },
    aula: {
      id: aulaRaw.id, titulo: aulaRaw.titulo, ordem: aulaRaw.ordem, duracaoSeg: dur(aulaRaw),
      xp: aulaRaw.xp ?? 40, video_url: aulaRaw.video_url ?? null, capa_url: aulaRaw.capa_url ?? null,
      sobre: Array.isArray(aulaRaw.sobre) ? aulaRaw.sobre : (aulaRaw.descricao ? [aulaRaw.descricao] : []),
      // aula bloqueada nunca conta como concluída, mesmo com a linha gravada:
      // é a decisão de 21/08/2026 de re-trancar o que passou por cima da prova.
      concluida: !!estadoAtual?.cumprido && !estadoAtual?.bloqueado,
      bloqueada: !!estadoAtual?.bloqueado,
      motivo: motivoDe(estadoAtual?.pendencia ?? null),
      segundosAssistidos,
      videoTerminou,
    },
    capitulos: (capRes.data as Capitulo[]) ?? [],
    materiais,
    materiaisBaixadosIds: ((baixadosRaw as any[]) ?? []).map((b) => b.material_id),
    duvidas: perguntas,
    anotacoes: (notaRes.data as Anotacao[]) ?? [],
    trilho,
    anterior: itemAnterior ? { id: itemAnterior.id, href: hrefDoItem(curso.slug, itemAnterior) } : null,
    proxima: itemProximo
      ? {
          id: itemProximo.id,
          titulo: itemProximo.titulo,
          duracaoSeg: itemProximo.tipo === "aula" ? duracaoDe(itemProximo.id) : 0,
          tipoItem: itemProximo.tipo,
          href: hrefDoItem(curso.slug, itemProximo),
        }
      : null,
    proximoModulo: proxModuloRaw
      ? {
          titulo: proxModuloRaw.titulo, ordem: proxModuloRaw.ordem,
          totalAulas: proxModuloRaw.aulas?.length ?? 0,
          duracaoModuloSeg: (proxModuloRaw.aulas ?? []).reduce((s: number, a: any) => s + dur(a), 0),
        }
      : null,
    progressoCurso: {
      concluidas, total: sequencia.itens.length,
      pct: sequencia.itens.length ? Math.round((concluidas / sequencia.itens.length) * 100) : 0,
      xpTotal, nivel: Math.floor(xpTotal / 100) + 1,
    },
  };
}

// Próximo passo REAL da jornada do curso — pode ser uma aula ou uma avaliação.
// É pra onde page.tsx manda quem tenta abrir por URL algo ainda trancado. Antes
// isto devolvia sempre uma aula, e por isso o aluno barrado por uma prova era
// devolvido pra aula anterior sem nunca ser apresentado à prova.
export async function proximoPassoDoCurso(
  slug: string
): Promise<{ tipo: TipoItem; id: string; href: string } | null> {
  const supabase = await criarClienteServidor();
  const { data: curso } = await supabase.from("cursos").select("id, slug").eq("slug", slug).eq("publicado", true).single();
  if (!curso) return null;

  const { data: auth } = await supabase.auth.getUser();
  const sequencia = await carregarSequencia(supabase, curso.id, auth?.user?.id ?? null);

  const alvo = sequencia.proximoPasso ?? sequencia.itens[sequencia.itens.length - 1] ?? null;
  if (!alvo) return null;
  return { tipo: alvo.tipo, id: alvo.id, href: hrefDoItem(curso.slug, alvo) };
}

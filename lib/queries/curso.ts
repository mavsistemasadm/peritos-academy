import { criarClienteServidor } from "@/lib/supabase/server";

type ModuloEstado = "concluido" | "bloqueado" | "andamento" | "nao_iniciado";

export type AulaComEstado = {
  id: string;
  titulo: string;
  descricao: string | null;
  duracao_seg: number;
  ordem: number;
  xp: number;
  tipo: string | null;
  concluida: boolean;
  atual: boolean;
  bloqueada: boolean;
  motivoBloqueio: string | null;
};

export type ModuloComEstado = {
  id: string;
  titulo: string;
  ordem: number;
  aulas: AulaComEstado[];
  totalAulas: number;
  concluidasNoModulo: number;
  duracaoModuloSeg: number;
  xpModulo: number;
  bloqueado: boolean;
  estado: ModuloEstado;
  ehAtual: boolean;
};

export type ProgressoCurso = {
  concluidas: number;
  total: number;
  pct: number;
  duracaoTotalSeg: number;
  xpTotal: number;
  cursoCompleto: boolean;
  aulaAtualId: string | null;
  aulaAtualTitulo: string | null;
  aulaAtualBloqueada: boolean;
  moduloAtualOrdem: number | null;
  aulaAtualDetalhe: { segundosAssistidos: number; duracaoSeg: number; materiaisTotal: number; materiaisBaixados: number } | null;
};

const dur = (a: { duracao_seg: number | null }) => a?.duracao_seg ?? 0;
const xpDe = (a: { xp: number | null }) => a?.xp ?? 0;

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
  const { data: modulosRaw } = await supabase
    .from("modulos")
    .select(`
      id, titulo, ordem,
      aulas ( id, titulo, descricao, duracao_seg, ordem, xp, tipo )
    `)
    .eq("curso_id", curso.id)
    .order("ordem", { ascending: true });

  const modulosBase = (modulosRaw ?? []).map((m) => ({
    ...m,
    aulas: (m.aulas ?? []).sort((a, b) => a.ordem - b.ordem),
  }));

  // lista plana ordenada (módulo -> aula), cada item carrega o modulo_id
  const todas = modulosBase.flatMap((m) => m.aulas.map((a) => ({ ...a, modulo_id: m.id })));

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

  // 6. progresso do aluno logado — a rota já gateia por verificarAcessoConteudo,
  // então userId normalmente existe; mesmo assim tratamos null defensivamente
  // (concluidasSet vazio = tudo trava a partir da 2ª aula, mesmo comportamento
  // do algoritmo em lib/queries/aula.ts).
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id ?? null;

  let concluidasSet = new Set<string>();
  const avalsPorModulo = new Map<string, string[]>();
  let aprovadasSet = new Set<string>();

  if (userId && todas.length > 0) {
    const [{ data: prog }, { data: avals }, { data: tent }] = await Promise.all([
      supabase.from("aula_progresso").select("aula_id").eq("usuario_id", userId).eq("concluida", true).in("aula_id", todas.map((a) => a.id)),
      supabase.from("avaliacoes").select("id, modulo_id").eq("curso_id", curso.id).eq("tipo", "avaliacao").eq("publicado", true).not("modulo_id", "is", null),
      supabase.from("avaliacao_tentativas").select("avaliacao_id").eq("usuario_id", userId).eq("aprovado", true),
    ]);
    concluidasSet = new Set((prog ?? []).map((p) => p.aula_id));
    aprovadasSet = new Set((tent ?? []).map((t) => t.avaliacao_id));
    for (const av of avals ?? []) {
      const lista = avalsPorModulo.get(av.modulo_id) ?? [];
      lista.push(av.id);
      avalsPorModulo.set(av.modulo_id, lista);
    }
  }

  const moduloLiberado = (moduloId: string) => {
    const ids = avalsPorModulo.get(moduloId);
    if (!ids || ids.length === 0) return true;
    return ids.every((id) => aprovadasSet.has(id));
  };

  // trava sequencial: mesmo algoritmo de lib/queries/aula.ts (aula[i] só libera
  // se aula[i-1] concluída e, ao cruzar módulo, avaliações do módulo anterior aprovadas).
  // motivoBloqueio nomeia o que falta, pro toast de clique na aula travada (B2).
  const bloqueadaPorAula = new Map<string, boolean>();
  const motivoBloqueioPorAula = new Map<string, string>();
  for (let i = 0; i < todas.length; i++) {
    const a = todas[i];
    if (i === 0) { bloqueadaPorAula.set(a.id, false); continue; }
    const anterior = todas[i - 1];
    const anteriorConcluida = concluidasSet.has(anterior.id);
    const cruzouModulo = a.modulo_id !== anterior.modulo_id;
    const gateModulo = cruzouModulo ? moduloLiberado(anterior.modulo_id) : true;
    const bloqueada = !(anteriorConcluida && gateModulo);
    bloqueadaPorAula.set(a.id, bloqueada);
    if (bloqueada) {
      if (!anteriorConcluida) {
        motivoBloqueioPorAula.set(a.id, "Conclua a aula anterior para desbloquear.");
      } else {
        const moduloAnterior = modulosBase.find((m) => m.id === anterior.modulo_id);
        const numMod = moduloAnterior ? String(moduloAnterior.ordem).padStart(2, "0") : "";
        motivoBloqueioPorAula.set(a.id, `Conclua a avaliação do Módulo ${numMod} para desbloquear este módulo.`);
      }
    }
  }

  // "aula atual": primeira não concluída E acessível. No raro caso em que a
  // única aula não concluída está travada por uma avaliação de módulo
  // pendente, cai no fallback (mostra ela mesma, já marcada bloqueada — o
  // toast de clique explica que falta a avaliação).
  const aulaAtual =
    todas.find((a) => !concluidasSet.has(a.id) && !bloqueadaPorAula.get(a.id)) ??
    todas.find((a) => !concluidasSet.has(a.id)) ??
    null;

  // progresso detalhado só da aula atual, pra "45% assistido · 1 de 2 materiais"
  let aulaAtualDetalhe: ProgressoCurso["aulaAtualDetalhe"] = null;
  if (userId && aulaAtual) {
    const [{ data: progAtual }, { data: materiaisAtual }] = await Promise.all([
      supabase.from("aula_progresso").select("segundos_assistidos").eq("usuario_id", userId).eq("aula_id", aulaAtual.id).maybeSingle(),
      supabase.from("aula_materiais").select("id").eq("aula_id", aulaAtual.id).not("arquivo_url", "is", null),
    ]);
    const materiaisIds = (materiaisAtual ?? []).map((m) => m.id);
    let materiaisBaixados = 0;
    if (materiaisIds.length > 0) {
      const { count } = await supabase
        .from("material_downloads")
        .select("material_id", { count: "exact", head: true })
        .eq("usuario_id", userId)
        .in("material_id", materiaisIds);
      materiaisBaixados = count ?? 0;
    }
    aulaAtualDetalhe = {
      segundosAssistidos: progAtual?.segundos_assistidos ?? 0,
      duracaoSeg: dur(aulaAtual),
      materiaisTotal: materiaisIds.length,
      materiaisBaixados,
    };
  }

  const modulos: ModuloComEstado[] = modulosBase.map((m) => {
    const aulasComEstado: AulaComEstado[] = m.aulas.map((a) => ({
      id: a.id, titulo: a.titulo, descricao: a.descricao, duracao_seg: dur(a),
      ordem: a.ordem, xp: xpDe(a), tipo: a.tipo ?? null,
      concluida: concluidasSet.has(a.id),
      atual: aulaAtual?.id === a.id,
      bloqueada: bloqueadaPorAula.get(a.id) ?? false,
      motivoBloqueio: motivoBloqueioPorAula.get(a.id) ?? null,
    }));
    const totalAulas = aulasComEstado.length;
    const concluidasNoModulo = aulasComEstado.filter((a) => a.concluida).length;
    const bloqueado = totalAulas > 0 ? (bloqueadaPorAula.get(aulasComEstado[0].id) ?? false) : false;
    const estado: ModuloEstado =
      totalAulas > 0 && concluidasNoModulo === totalAulas ? "concluido"
        : bloqueado ? "bloqueado"
        : concluidasNoModulo > 0 ? "andamento"
        : "nao_iniciado";
    return {
      id: m.id, titulo: m.titulo, ordem: m.ordem,
      aulas: aulasComEstado, totalAulas, concluidasNoModulo,
      duracaoModuloSeg: aulasComEstado.reduce((s, a) => s + a.duracao_seg, 0),
      xpModulo: aulasComEstado.reduce((s, a) => s + a.xp, 0),
      bloqueado, estado,
      ehAtual: aulasComEstado.some((a) => a.atual),
    };
  });

  const concluidas = todas.filter((a) => concluidasSet.has(a.id)).length;
  const total = todas.length;
  const moduloAtual = modulos.find((m) => m.ehAtual) ?? modulos[0] ?? null;

  const progresso: ProgressoCurso = {
    concluidas, total,
    pct: total ? Math.round((concluidas / total) * 100) : 0,
    duracaoTotalSeg: todas.reduce((s, a) => s + dur(a), 0),
    xpTotal: todas.reduce((s, a) => s + xpDe(a), 0),
    cursoCompleto: total > 0 && concluidas === total,
    aulaAtualId: aulaAtual?.id ?? (todas[0]?.id ?? null),
    aulaAtualTitulo: aulaAtual?.titulo ?? null,
    aulaAtualBloqueada: aulaAtual ? (bloqueadaPorAula.get(aulaAtual.id) ?? false) : false,
    moduloAtualOrdem: moduloAtual?.ordem ?? null,
    aulaAtualDetalhe,
  };

  return {
    curso: {
      ...curso,
      trilha_nome: ct?.trilha_nome ?? null,
      etapa_nome: ct?.etapa_nome ?? null,
    },
    modulos,
    conquistas: conquistas ?? [],
    relacionados: relacionados ?? [],
    progresso,
  };
}

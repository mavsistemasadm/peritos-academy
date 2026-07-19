import { criarClienteServidor } from "@/lib/supabase/server";

type ModuloEstado = "concluido" | "bloqueado" | "andamento" | "nao_iniciado";

export type AvaliacaoComEstado = {
  id: string;
  numeroCaso: string | null;
  titulo: string;
  nQuestoes: number;
  notaMinima: number;
  estado: "aprovada" | "disponivel" | "bloqueada";
  nota: number | null;
};

export type ProximoPasso =
  | { tipo: "aula"; aulaId: string; titulo: string }
  | { tipo: "avaliacao"; avaliacaoId: string; numeroCaso: string | null; titulo: string }
  | { tipo: "nenhum" };

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
  avaliacoes: AvaliacaoComEstado[];
  totalAulas: number;
  concluidasNoModulo: number;
  duracaoModuloSeg: number;
  xpModulo: number;
  bloqueado: boolean;
  estado: ModuloEstado;
  ehAtual: boolean;
  motivoBloqueio: string | null;
};

export type ProgressoCurso = {
  concluidas: number;
  total: number;
  pct: number;
  duracaoTotalSeg: number;
  xpTotal: number;
  xpTotalAvaliacoes: number;
  totalAvaliacoes: number;
  avaliacoesAprovadas: number;
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

  // 5. avaliações de módulo (publicadas) — mesma trava que já existia (gate de
  // módulo), agora também exibidas no acordeão (ver "beco invisível" na tarefa).
  // Buscadas sempre (não só quando logado), pois título/nº de questões não
  // dependem de auth; só o estado (aprovada/nota) depende do usuário.
  const { data: avaliacoesRaw } = await supabase
    .from("avaliacoes")
    .select("id, modulo_id, numero_caso, titulo, ordem, nota_minima, peso")
    .eq("curso_id", curso.id)
    .eq("tipo", "avaliacao")
    .eq("publicado", true)
    .not("modulo_id", "is", null)
    .order("ordem", { ascending: true });

  const idsAvaliacoes = (avaliacoesRaw ?? []).map((a) => a.id);
  const { data: questoesPorAvaliacao } = idsAvaliacoes.length
    ? await supabase.from("avaliacao_questoes").select("avaliacao_id").in("avaliacao_id", idsAvaliacoes)
    : { data: [] as { avaliacao_id: string }[] };
  const nQuestoesPorAvaliacao = new Map<string, number>();
  for (const q of questoesPorAvaliacao ?? []) {
    nQuestoesPorAvaliacao.set(q.avaliacao_id, (nQuestoesPorAvaliacao.get(q.avaliacao_id) ?? 0) + 1);
  }

  const { data: configGam } = await supabase.from("config_gamificacao").select("avaliacao_xp_base, bonus_curso_concluido").eq("id", 1).maybeSingle();
  const avaliacaoXpBase = configGam?.avaliacao_xp_base ?? 200;
  const bonusCursoConcluido = configGam?.bonus_curso_concluido ?? 100;

  type AvaliacaoRaw = { id: string; modulo_id: string; numero_caso: string | null; titulo: string; ordem: number; nota_minima: number; peso: number };
  const avaliacoesDoModulo = (avaliacoesRaw ?? []).filter((av): av is AvaliacaoRaw => av.modulo_id !== null);

  const avalsPorModulo = new Map<string, AvaliacaoRaw[]>();
  for (const av of avaliacoesDoModulo) {
    const lista = avalsPorModulo.get(av.modulo_id) ?? [];
    lista.push(av);
    avalsPorModulo.set(av.modulo_id, lista);
  }
  const moduloLiberadoPorAvaliacoes = (moduloId: string) => {
    const avs = avalsPorModulo.get(moduloId);
    if (!avs || avs.length === 0) return true;
    return avs.every((av) => aprovadasSet.has(av.id));
  };

  // 6. progresso do aluno logado — a rota já gateia por verificarAcessoConteudo,
  // então userId normalmente existe; mesmo assim tratamos null defensivamente
  // (concluidasSet vazio = tudo trava a partir da 2ª aula, mesmo comportamento
  // do algoritmo em lib/queries/aula.ts).
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id ?? null;

  let concluidasSet = new Set<string>();
  let aprovadasSet = new Set<string>();
  const notaPorAvaliacao = new Map<string, number>();

  if (userId) {
    const [{ data: prog }, { data: tent }] = await Promise.all([
      todas.length > 0
        ? supabase.from("aula_progresso").select("aula_id").eq("usuario_id", userId).eq("concluida", true).in("aula_id", todas.map((a) => a.id))
        : Promise.resolve({ data: [] as { aula_id: string }[] }),
      idsAvaliacoes.length > 0
        ? supabase.from("avaliacao_tentativas").select("avaliacao_id, nota, aprovado").eq("usuario_id", userId).eq("aprovado", true).in("avaliacao_id", idsAvaliacoes)
        : Promise.resolve({ data: [] as { avaliacao_id: string; nota: number; aprovado: boolean }[] }),
    ]);
    concluidasSet = new Set((prog ?? []).map((p) => p.aula_id));
    aprovadasSet = new Set((tent ?? []).map((t) => t.avaliacao_id));
    for (const t of tent ?? []) {
      const atual = notaPorAvaliacao.get(t.avaliacao_id) ?? -1;
      if (t.nota > atual) notaPorAvaliacao.set(t.avaliacao_id, t.nota);
    }
  }

  // primeira avaliação não aprovada (por ordem) de um módulo — pra nomear
  // exatamente o que falta, em vez de só apontar o número do módulo.
  const primeiraAvaliacaoPendente = (moduloId: string): AvaliacaoRaw | null => {
    const avs = avalsPorModulo.get(moduloId);
    if (!avs) return null;
    return avs.find((av) => !aprovadasSet.has(av.id)) ?? null;
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
    const gateModulo = cruzouModulo ? moduloLiberadoPorAvaliacoes(anterior.modulo_id) : true;
    const bloqueada = !(anteriorConcluida && gateModulo);
    bloqueadaPorAula.set(a.id, bloqueada);
    if (bloqueada) {
      if (!anteriorConcluida) {
        motivoBloqueioPorAula.set(a.id, "Conclua a aula anterior para desbloquear.");
      } else {
        const pendente = primeiraAvaliacaoPendente(anterior.modulo_id);
        motivoBloqueioPorAula.set(
          a.id,
          pendente
            ? `Falta a aprovação na avaliação Caso ${pendente.numero_caso ?? pendente.titulo} para desbloquear este módulo.`
            : "Conclua a avaliação do módulo anterior para desbloquear."
        );
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

  const modulos: ModuloComEstado[] = modulosBase.map((m, idx) => {
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
    const aulasDoModuloConcluidas = totalAulas === 0 || concluidasNoModulo === totalAulas;
    const bloqueado = totalAulas > 0 ? (bloqueadaPorAula.get(aulasComEstado[0].id) ?? false) : false;

    // avaliações do módulo, na sequência de avaliacoes.ordem: aprovada (real),
    // disponível (aulas do módulo prontas + avaliações anteriores do módulo
    // aprovadas) ou bloqueada — mesma fonte de dado que já trava o módulo
    // seguinte, nunca um estado inventado à parte.
    let avaliacoesAnterioresAprovadas = true;
    const avaliacoesComEstado: AvaliacaoComEstado[] = (avalsPorModulo.get(m.id) ?? []).map((av) => {
      const aprovada = aprovadasSet.has(av.id);
      const estado: AvaliacaoComEstado["estado"] = aprovada
        ? "aprovada"
        : aulasDoModuloConcluidas && avaliacoesAnterioresAprovadas
          ? "disponivel"
          : "bloqueada";
      if (!aprovada) avaliacoesAnterioresAprovadas = false;
      return {
        id: av.id,
        numeroCaso: av.numero_caso,
        titulo: av.titulo,
        nQuestoes: nQuestoesPorAvaliacao.get(av.id) ?? 0,
        notaMinima: Number(av.nota_minima ?? 7),
        estado,
        nota: notaPorAvaliacao.get(av.id) ?? null,
      };
    });

    const moduloConcluido = totalAulas > 0 && concluidasNoModulo === totalAulas && moduloLiberadoPorAvaliacoes(m.id);
    const estado: ModuloEstado =
      moduloConcluido ? "concluido"
        : bloqueado ? "bloqueado"
        : (concluidasNoModulo > 0 || avaliacoesComEstado.some((a) => a.estado !== "bloqueada")) ? "andamento"
        : "nao_iniciado";

    // motivo de bloqueio do MÓDULO (tooltip do cabeçalho, distinto do motivo
    // por aula): quando o módulo anterior ainda tem aula pendente, nomeia
    // aulas + avaliação juntas; quando só falta a avaliação, nomeia o caso.
    let motivoBloqueioModulo: string | null = null;
    if (bloqueado && idx > 0) {
      const anteriorBase = modulosBase[idx - 1];
      const aulasAnteriorConcluidas = (anteriorBase.aulas ?? []).every((a) => concluidasSet.has(a.id));
      const numModAnterior = String(anteriorBase.ordem).padStart(2, "0");
      if (!aulasAnteriorConcluidas) {
        const avsAnterior = avalsPorModulo.get(anteriorBase.id) ?? [];
        motivoBloqueioModulo = avsAnterior.length > 0
          ? `Conclua as aulas e seja aprovado ${avsAnterior.length > 1 ? "nas avaliações" : "na avaliação"} do Módulo ${numModAnterior} para desbloquear.`
          : `Conclua as aulas do Módulo ${numModAnterior} para desbloquear.`;
      } else {
        const pendente = primeiraAvaliacaoPendente(anteriorBase.id);
        motivoBloqueioModulo = pendente
          ? `Falta a aprovação na avaliação Caso ${pendente.numero_caso ?? pendente.titulo} para desbloquear este módulo.`
          : `Conclua a avaliação do Módulo ${numModAnterior} para desbloquear.`;
      }
    }

    return {
      id: m.id, titulo: m.titulo, ordem: m.ordem,
      aulas: aulasComEstado, avaliacoes: avaliacoesComEstado, totalAulas, concluidasNoModulo,
      duracaoModuloSeg: aulasComEstado.reduce((s, a) => s + a.duracao_seg, 0),
      xpModulo: aulasComEstado.reduce((s, a) => s + a.xp, 0),
      bloqueado, estado,
      ehAtual: aulasComEstado.some((a) => a.atual),
      motivoBloqueio: motivoBloqueioModulo,
    };
  });

  const concluidas = todas.filter((a) => concluidasSet.has(a.id)).length;
  const total = todas.length;
  const moduloAtual = modulos.find((m) => m.ehAtual) ?? modulos[0] ?? null;

  const totalAvaliacoes = (avaliacoesRaw ?? []).length;
  const avaliacoesAprovadas = (avaliacoesRaw ?? []).filter((av) => aprovadasSet.has(av.id)).length;
  const xpTotalAvaliacoes = (avaliacoesRaw ?? []).reduce((s, av) => s + avaliacaoXpBase * Math.max(av.peso ?? 1, 1), 0);

  // XP disponível do curso = o que o motor de fato pode creditar: aulas +
  // avaliações (potencial, 100% de acerto) + bônus de conclusão do curso.
  const xpTotal = todas.reduce((s, a) => s + xpDe(a), 0) + xpTotalAvaliacoes + (total > 0 ? bonusCursoConcluido : 0);

  const cursoCompleto = total > 0 && concluidas === total && avaliacoesAprovadas === totalAvaliacoes;

  const progresso: ProgressoCurso = {
    concluidas, total,
    pct: total ? Math.round((concluidas / total) * 100) : 0,
    duracaoTotalSeg: todas.reduce((s, a) => s + dur(a), 0),
    xpTotal, xpTotalAvaliacoes, totalAvaliacoes, avaliacoesAprovadas,
    cursoCompleto,
    aulaAtualId: aulaAtual?.id ?? (todas[0]?.id ?? null),
    aulaAtualTitulo: aulaAtual?.titulo ?? null,
    aulaAtualBloqueada: aulaAtual ? (bloqueadaPorAula.get(aulaAtual.id) ?? false) : false,
    moduloAtualOrdem: moduloAtual?.ordem ?? null,
    aulaAtualDetalhe,
  };

  // próximo passo real do CTA "Continuar": normalmente a próxima aula, mas
  // quando as aulas acabaram (ou a próxima está travada) e existe uma
  // avaliação disponível pendente, o próximo passo de verdade é ela — fecha
  // o "beco invisível" (aluno travado sem saber que precisa fazer o Caso).
  let proximoPasso: ProximoPasso = { tipo: "nenhum" };
  if (!cursoCompleto) {
    if (aulaAtual && !(bloqueadaPorAula.get(aulaAtual.id) ?? false)) {
      proximoPasso = { tipo: "aula", aulaId: aulaAtual.id, titulo: aulaAtual.titulo };
    } else {
      let avalPendente: AvaliacaoComEstado | null = null;
      for (const mod of modulos) {
        const achada = mod.avaliacoes.find((a) => a.estado === "disponivel");
        if (achada) { avalPendente = achada; break; }
      }
      if (avalPendente) {
        proximoPasso = { tipo: "avaliacao", avaliacaoId: avalPendente.id, numeroCaso: avalPendente.numeroCaso, titulo: avalPendente.titulo };
      } else if (aulaAtual) {
        proximoPasso = { tipo: "aula", aulaId: aulaAtual.id, titulo: aulaAtual.titulo };
      }
    }
  }

  return {
    curso: {
      ...curso,
      trilha_nome: ct?.trilha_nome ?? null,
      etapa_nome: ct?.etapa_nome ?? null,
    },
    modulos,
    conquistas: conquistas ?? [],
    progresso,
    proximoPasso,
  };
}

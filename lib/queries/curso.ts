import { criarClienteServidor } from "@/lib/supabase/server";
import { carregarSequencia, motivoDe } from "@/lib/progresso/sequencia";

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
  // 6. estado do aluno: ordem e trava vêm da sequência única do curso
  // (lib/progresso/sequencia.ts) — a MESMA que a página da aula e as RPCs de
  // escrita usam. Esta página e a da aula calculavam isso separado, e foi a
  // divergência entre as duas cópias que deixou a trava furada por meses.
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id ?? null;

  const sequencia = await carregarSequencia(supabase, curso.id, userId);
  const estadoDe = (id: string) => sequencia.porId.get(id) ?? null;
  const cumprido = (id: string) => {
    const e = estadoDe(id);
    return !!e?.cumprido && !e.bloqueado;
  };

  // a nota exibida ao lado da avaliação continua vindo das tentativas (a
  // sequência só sabe se passou ou não, não com quanto)
  const notaPorAvaliacao = new Map<string, number>();
  if (userId && idsAvaliacoes.length > 0) {
    const { data: tent } = await supabase
      .from("avaliacao_tentativas")
      .select("avaliacao_id, nota, aprovado")
      .eq("usuario_id", userId)
      .eq("aprovado", true)
      .in("avaliacao_id", idsAvaliacoes);
    for (const t of tent ?? []) {
      const atual = notaPorAvaliacao.get(t.avaliacao_id) ?? -1;
      if (t.nota > atual) notaPorAvaliacao.set(t.avaliacao_id, t.nota);
    }
  }

  // "item atual" = primeiro não cumprido e liberado, na jornada inteira. Pode
  // ser uma avaliação: é assim que o "Continuar" para de empurrar o aluno pra
  // uma aula trancada por uma prova que ele nem sabia que existia.
  const itemAtual = sequencia.proximoPasso;
  const aulaAtual = itemAtual?.tipo === "aula"
    ? (todas.find((a) => a.id === itemAtual.id) ?? null)
    : null;

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
    const aulasComEstado: AulaComEstado[] = m.aulas.map((a) => {
      const e = estadoDe(a.id);
      return {
        id: a.id, titulo: a.titulo, descricao: a.descricao, duracao_seg: dur(a),
        ordem: a.ordem, xp: xpDe(a), tipo: a.tipo ?? null,
        // aula bloqueada não conta como concluída nem com a linha gravada: é a
        // decisão de 21/08/2026 de re-trancar o que passou por cima da prova.
        concluida: !!e?.cumprido && !e.bloqueado,
        atual: itemAtual?.id === a.id,
        bloqueada: !!e?.bloqueado,
        motivoBloqueio: motivoDe(e?.pendencia ?? null),
      };
    });
    const totalAulas = aulasComEstado.length;
    const concluidasNoModulo = aulasComEstado.filter((a) => a.concluida).length;
    // o módulo está trancado quando o PRIMEIRO item dele (que pode ser uma
    // avaliação, não necessariamente uma aula) está trancado
    const itensDoModulo = sequencia.itens.filter((i) => i.moduloId === m.id);
    const bloqueado = itensDoModulo.length > 0 ? itensDoModulo[0].bloqueado : false;

    // avaliações do módulo, na sequência de avaliacoes.ordem: aprovada (real),
    // disponível (aulas do módulo prontas + avaliações anteriores do módulo
    // aprovadas) ou bloqueada — mesma fonte de dado que já trava o módulo
    // seguinte, nunca um estado inventado à parte.
    const avaliacoesComEstado: AvaliacaoComEstado[] = (avalsPorModulo.get(m.id) ?? []).map((av) => {
      const e = estadoDe(av.id);
      const aprovada = !!e?.cumprido && !e.bloqueado;
      const estado: AvaliacaoComEstado["estado"] = aprovada
        ? "aprovada"
        : e?.bloqueado ? "bloqueada" : "disponivel";
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

    const moduloConcluido = itensDoModulo.length > 0 && itensDoModulo.every((i) => i.cumprido && !i.bloqueado);
    const estado: ModuloEstado =
      moduloConcluido ? "concluido"
        : bloqueado ? "bloqueado"
        : (concluidasNoModulo > 0 || avaliacoesComEstado.some((a) => a.estado !== "bloqueada")) ? "andamento"
        : "nao_iniciado";

    // motivo de bloqueio do MÓDULO (tooltip do cabeçalho, distinto do motivo
    // por aula): quando o módulo anterior ainda tem aula pendente, nomeia
    // aulas + avaliação juntas; quando só falta a avaliação, nomeia o caso.
    // motivo de bloqueio do MÓDULO (tooltip do cabeçalho): nomeia exatamente o
    // item que trava — aula ou avaliação, com o título dele. Genérico ("conclua
    // a avaliação do módulo anterior") é o que deixou aluno sem saída.
    const motivoBloqueioModulo = bloqueado && itensDoModulo.length > 0
      ? motivoDe(itensDoModulo[0].pendencia)
      : null;

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

  const cumpridosSeq = sequencia.itens.filter((i) => i.cumprido && !i.bloqueado);
  const concluidas = cumpridosSeq.length;
  const total = sequencia.itens.length;
  const moduloAtual = modulos.find((m) => m.ehAtual) ?? modulos[0] ?? null;

  const totalAvaliacoes = (avaliacoesRaw ?? []).length;
  const avaliacoesAprovadas = cumpridosSeq.filter((i) => i.tipo === "avaliacao").length;
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
    aulaAtualBloqueada: itemAtual ? itemAtual.bloqueado : false,
    moduloAtualOrdem: moduloAtual?.ordem ?? null,
    aulaAtualDetalhe,
  };

  // próximo passo real do CTA "Continuar": normalmente a próxima aula, mas
  // quando as aulas acabaram (ou a próxima está travada) e existe uma
  // avaliação disponível pendente, o próximo passo de verdade é ela — fecha
  // o "beco invisível" (aluno travado sem saber que precisa fazer o Caso).
  let proximoPasso: ProximoPasso = { tipo: "nenhum" };
  if (!cursoCompleto && itemAtual) {
    proximoPasso = itemAtual.tipo === "avaliacao"
      ? {
          tipo: "avaliacao",
          avaliacaoId: itemAtual.id,
          numeroCaso: (avaliacoesRaw ?? []).find((av) => av.id === itemAtual.id)?.numero_caso ?? null,
          titulo: itemAtual.titulo,
        }
      : { tipo: "aula", aulaId: itemAtual.id, titulo: itemAtual.titulo };
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

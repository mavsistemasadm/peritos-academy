// lib/queries/meuPlano.ts
// "Meu Plano" (Cena 6 viva) — o mesmo mapa da cerimônia, mas com progresso
// real do aluno nos cursos. Nenhuma lógica de prescrição é recalculada
// aqui: só lê o plano/plano_trilhas já gerados pelo motor e cruza com
// aula_progresso/avaliacao_tentativas (mesmo padrão de lib/queries/jornada.ts).
import { criarClienteServidor } from "@/lib/supabase/server";

type ClienteServidor = Awaited<ReturnType<typeof criarClienteServidor>>;

export type EstacaoViva = {
  ordem: number;
  trilhaId: string;
  trilhaSlug: string | null;
  trilhaNome: string;
  xPct: number;
  yPct: number;
  numCursos: number;
  cursosConcluidos: number;
  progressoPct: number;
  estado: "concluida" | "atual" | "futura";
  continuarHref: string | null;
};

export type PlanoVivo = {
  temPlano: boolean;
  planoId: string | null;
  horasSemanaDeclarada: number;
  mesesTotais: number;
  estacoes: EstacaoViva[];
  entradaXPct: number;
  entradaYPct: number;
};

const ENTRADA_X = 50;
const ENTRADA_Y = 95;

async function cursosDaTrilha(supabase: ClienteServidor, trilhaSlug: string) {
  const { data } = await supabase
    .from("curso_trilha")
    .select("curso_id, ordem, cursos(id, titulo, slug, publicado)")
    .eq("trilha_slug", trilhaSlug)
    .order("ordem");
  return (data ?? [])
    .map((r) => r.cursos as unknown as { id: string; titulo: string; slug: string; publicado: boolean })
    .filter((c) => c && c.publicado);
}

async function cursoCompletoEProximo(
  supabase: ClienteServidor,
  uid: string,
  cursoId: string
): Promise<{ completo: boolean; proximaAulaHref: string | null; cursoSlug: string }> {
  const { data: curso } = await supabase.from("cursos").select("slug").eq("id", cursoId).maybeSingle();
  const { data: modulos } = await supabase.from("modulos").select("id").eq("curso_id", cursoId).order("ordem");
  const moduloIds = (modulos ?? []).map((m) => m.id);
  const { data: aulas } = moduloIds.length
    ? await supabase.from("aulas").select("id, modulo_id").in("modulo_id", moduloIds).order("ordem")
    : { data: [] as { id: string; modulo_id: string }[] };
  const { data: avaliacoes } = await supabase.from("avaliacoes").select("id").eq("curso_id", cursoId).eq("publicado", true);

  const aulaIds = (aulas ?? []).map((a) => a.id);
  const { data: progresso } = aulaIds.length
    ? await supabase.from("aula_progresso").select("aula_id, concluida").eq("usuario_id", uid).eq("concluida", true).in("aula_id", aulaIds)
    : { data: [] as { aula_id: string }[] };
  const concluidas = new Set((progresso ?? []).map((p) => p.aula_id));

  const avaliacaoIds = (avaliacoes ?? []).map((a) => a.id);
  const { data: aprovadas } = avaliacaoIds.length
    ? await supabase.from("avaliacao_tentativas").select("avaliacao_id").eq("usuario_id", uid).eq("aprovado", true).in("avaliacao_id", avaliacaoIds)
    : { data: [] as { avaliacao_id: string }[] };
  const aprovadasSet = new Set((aprovadas ?? []).map((a) => a.avaliacao_id));

  const todasAulasFeitas = aulaIds.length > 0 && aulaIds.every((id) => concluidas.has(id));
  const todasAvaliacoesFeitas = avaliacaoIds.every((id) => aprovadasSet.has(id));
  const completo = todasAulasFeitas && todasAvaliacoesFeitas;

  const primeiraPendente = (aulas ?? []).find((a) => !concluidas.has(a.id));
  return {
    completo,
    proximaAulaHref: primeiraPendente ? `/curso/${curso?.slug}/aula/${primeiraPendente.id}` : null,
    cursoSlug: curso?.slug ?? "",
  };
}

export async function primeiroPendenteDaTrilha(
  trilhaSlug: string
): Promise<{ href: string | null; cursoNome: string | null }> {
  const supabase = await criarClienteServidor();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { href: null, cursoNome: null };

  const cursos = await cursosDaTrilha(supabase, trilhaSlug);
  for (const c of cursos) {
    const r = await cursoCompletoEProximo(supabase, uid, c.id);
    if (r.completo) continue;
    return { href: r.proximaAulaHref ?? `/curso/${r.cursoSlug}`, cursoNome: c.titulo };
  }
  return cursos.length ? { href: `/curso/${cursos[0].slug}`, cursoNome: cursos[0].titulo } : { href: null, cursoNome: null };
}

export async function getPlanoVivo(): Promise<PlanoVivo> {
  const supabase = await criarClienteServidor();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { temPlano: false, planoId: null, horasSemanaDeclarada: 0, mesesTotais: 0, estacoes: [], entradaXPct: ENTRADA_X, entradaYPct: ENTRADA_Y };

  const { data: plano } = await supabase
    .from("planos")
    .select("id, horas_semana_declarada, meses_totais")
    .eq("usuario_id", uid)
    .eq("origem", "anamnese")
    .eq("ativo", true)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!plano) return { temPlano: false, planoId: null, horasSemanaDeclarada: 0, mesesTotais: 0, estacoes: [], entradaXPct: ENTRADA_X, entradaYPct: ENTRADA_Y };

  const { data: trilhasPlano } = await supabase
    .from("plano_trilhas")
    .select("ordem, trilha_id, trilhas(nome, slug)")
    .eq("plano_id", plano.id)
    .order("ordem");

  const trilhaIds = (trilhasPlano ?? []).map((t) => t.trilha_id);
  const { data: territoriosRaw } = trilhaIds.length
    ? await supabase.from("anamnese_territorios").select("trilha_id, x_pct, y_pct").in("trilha_id", trilhaIds)
    : { data: [] as { trilha_id: string; x_pct: number; y_pct: number }[] };
  const territorioPorId = new Map((territoriosRaw ?? []).map((t) => [t.trilha_id, t]));

  const estacoes: EstacaoViva[] = [];
  let atualDefinida = false;
  for (const t of trilhasPlano ?? []) {
    const slug = (t.trilhas as unknown as { slug: string | null; nome: string })?.slug ?? null;
    const nome = (t.trilhas as unknown as { slug: string | null; nome: string })?.nome ?? "";
    const territorio = territorioPorId.get(t.trilha_id);

    const cursos = slug ? await cursosDaTrilha(supabase, slug) : [];
    let concluidosCount = 0;
    let continuarHref: string | null = null;
    let primeiraIncompleta: string | null = null;
    for (const c of cursos) {
      const r = await cursoCompletoEProximo(supabase, uid, c.id);
      if (r.completo) { concluidosCount++; continue; }
      if (!primeiraIncompleta) primeiraIncompleta = r.proximaAulaHref ?? `/curso/${r.cursoSlug}`;
    }
    const progressoPct = cursos.length ? Math.round((concluidosCount / cursos.length) * 100) : 0;
    const concluida = cursos.length > 0 && concluidosCount === cursos.length;

    let estado: EstacaoViva["estado"] = "futura";
    if (concluida) estado = "concluida";
    else if (!atualDefinida) { estado = "atual"; atualDefinida = true; continuarHref = primeiraIncompleta; }

    estacoes.push({
      ordem: t.ordem,
      trilhaId: t.trilha_id,
      trilhaSlug: slug,
      trilhaNome: nome,
      xPct: Number(territorio?.x_pct ?? 50),
      yPct: Number(territorio?.y_pct ?? 50),
      numCursos: cursos.length,
      cursosConcluidos: concluidosCount,
      progressoPct,
      estado,
      continuarHref,
    });
  }

  return {
    temPlano: true,
    planoId: plano.id,
    horasSemanaDeclarada: Number(plano.horas_semana_declarada ?? 0),
    mesesTotais: plano.meses_totais ?? 0,
    estacoes,
    entradaXPct: ENTRADA_X,
    entradaYPct: ENTRADA_Y,
  };
}

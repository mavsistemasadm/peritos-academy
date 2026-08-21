// lib/progresso/sequencia.ts
//
// Fonte ÚNICA da ordem e da trava de progressão do curso.
//
// A ordem vem da RPC `curso_sequencia` — a mesma que as RPCs de escrita
// (`concluir_aula`, `submeter_avaliacao`) usam pra decidir se aceitam a ação.
// Isso é o ponto: o bug que travou alunos de verdade em agosto/2026 nasceu de
// três cópias do mesmo algoritmo em TS, e uma delas montava a lista plana sem
// `modulo_id` — então comparava `undefined !== undefined`, nunca detectava a
// virada de módulo e simplesmente não travava nada. Com a ordem vindo do banco,
// só existe um lugar onde ela pode estar errada.
//
// Regra de bloqueio: um item está liberado quando TODOS os itens anteriores da
// sequência estão cumpridos — aula com `aula_progresso.concluida`, avaliação com
// `avaliacao_tentativas.aprovado`. Não há exceção para item já concluído: por
// decisão do dono do produto (21/08/2026), quem concluiu a aula de correção
// antes de fazer a prova volta a vê-la trancada até ser aprovado. O progresso
// gravado não é apagado — assim que a prova passa, a aula reaparece concluída.
import type { SupabaseClient } from "@supabase/supabase-js";

export type TipoItem = "aula" | "avaliacao";

export type ItemSequencia = {
  seq: number;
  tipo: TipoItem;
  id: string;
  titulo: string;
  moduloId: string | null;
  moduloOrdem: number | null;
  moduloTitulo: string | null;
};

export type ItemComEstado = ItemSequencia & {
  cumprido: boolean;
  bloqueado: boolean;
  /** o primeiro item pendente que trava este — null quando liberado */
  pendencia: { tipo: TipoItem; id: string; titulo: string } | null;
};

export type Sequencia = {
  itens: ItemComEstado[];
  porId: Map<string, ItemComEstado>;
  /** primeiro item não cumprido e liberado — onde o "Continuar" deve levar */
  proximoPasso: ItemComEstado | null;
};

/** Texto único de "o que falta", usado em toast, tooltip e tela de bloqueio. */
export function motivoDe(pendencia: { tipo: TipoItem; titulo: string } | null): string | null {
  if (!pendencia) return null;
  return pendencia.tipo === "avaliacao"
    ? `Você precisa ser aprovado em "${pendencia.titulo}" para desbloquear.`
    : `Conclua "${pendencia.titulo}" para desbloquear.`;
}

/** Href do item dentro do curso — aula e avaliação moram em rotas diferentes. */
export function hrefDoItem(slugCurso: string, item: { tipo: TipoItem; id: string }): string {
  return item.tipo === "avaliacao"
    ? `/curso/${slugCurso}/avaliacao/${item.id}`
    : `/curso/${slugCurso}/aula/${item.id}`;
}

export async function carregarSequencia(
  supabase: SupabaseClient,
  cursoId: string,
  userId: string | null
): Promise<Sequencia> {
  const { data: linhas } = await supabase.rpc("curso_sequencia", { p_curso_id: cursoId });

  const itens: ItemSequencia[] = ((linhas as any[]) ?? []).map((l) => ({
    seq: l.seq,
    tipo: l.tipo as TipoItem,
    id: l.item_id,
    titulo: l.titulo,
    moduloId: l.modulo_id,
    moduloOrdem: l.modulo_ordem,
    moduloTitulo: l.modulo_titulo,
  }));

  const idsAulas = itens.filter((i) => i.tipo === "aula").map((i) => i.id);
  const idsAvals = itens.filter((i) => i.tipo === "avaliacao").map((i) => i.id);

  let concluidas = new Set<string>();
  let aprovadas = new Set<string>();

  if (userId && itens.length > 0) {
    const [{ data: prog }, { data: tent }] = await Promise.all([
      idsAulas.length
        // .eq('concluida', true) é essencial: a linha também existe pra progresso
        // PARCIAL (segundos_assistidos), então existência != concluída.
        ? supabase.from("aula_progresso").select("aula_id").eq("usuario_id", userId).eq("concluida", true).in("aula_id", idsAulas)
        : Promise.resolve({ data: [] as { aula_id: string }[] }),
      idsAvals.length
        ? supabase.from("avaliacao_tentativas").select("avaliacao_id").eq("usuario_id", userId).eq("aprovado", true).in("avaliacao_id", idsAvals)
        : Promise.resolve({ data: [] as { avaliacao_id: string }[] }),
    ]);
    concluidas = new Set(((prog as any[]) ?? []).map((p) => p.aula_id));
    aprovadas = new Set(((tent as any[]) ?? []).map((t) => t.avaliacao_id));
  }

  // varredura única: o primeiro item não cumprido trava tudo que vem depois.
  let pendencia: { tipo: TipoItem; id: string; titulo: string } | null = null;
  const comEstado: ItemComEstado[] = itens.map((item) => {
    const cumprido = item.tipo === "aula" ? concluidas.has(item.id) : aprovadas.has(item.id);
    const estado: ItemComEstado = { ...item, cumprido, bloqueado: pendencia !== null, pendencia };
    if (!cumprido && pendencia === null) {
      pendencia = { tipo: item.tipo, id: item.id, titulo: item.titulo };
    }
    return estado;
  });

  return {
    itens: comEstado,
    porId: new Map(comEstado.map((i) => [i.id, i])),
    proximoPasso: comEstado.find((i) => !i.cumprido && !i.bloqueado) ?? null,
  };
}

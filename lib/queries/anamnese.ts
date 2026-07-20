// lib/queries/anamnese.ts
// Dados da cerimônia do mapa da Rota do Perito. Motor (schema/RPCs) já
// existe (ver supabase/migrations/20260720_anamnese_motor_rota_perito.sql);
// aqui só leitura pra alimentar a camada visual.
import { criarClienteServidor } from "@/lib/supabase/server";

export type AnamneseOpcao = {
  ordem: number;
  texto: string;
};

export type AnamneseQuestao = {
  ordem: number;
  enunciado: string;
  papel: "diagnostica" | "calibracao" | "emocional";
  opcoes: AnamneseOpcao[];
};

export type AnamneseProgresso = {
  respostas: { questao_ordem: number; opcao_ordem: number }[];
  totalQuestoes: number;
  questoesRespondidas: number;
  proximaQuestaoOrdem: number | null;
};

export type Territorio = {
  trilhaId: string;
  trilhaNome: string;
  xPct: number;
  yPct: number;
  descricaoCurta: string;
  justificativaUnica: string | null;
  justificativaIniciante: string | null;
  justificativaEvoluido: string | null;
};

export async function getAnamneseQuestoes(): Promise<AnamneseQuestao[]> {
  const supabase = await criarClienteServidor();
  const [{ data: questoes }, { data: opcoes }] = await Promise.all([
    supabase.from("anamnese_questoes").select("ordem, enunciado, papel").order("ordem"),
    supabase.from("anamnese_opcoes").select("questao_ordem, opcao_ordem, texto").order("questao_ordem").order("opcao_ordem"),
  ]);

  return (questoes ?? []).map((q) => ({
    ordem: q.ordem,
    enunciado: q.enunciado,
    papel: q.papel as AnamneseQuestao["papel"],
    opcoes: (opcoes ?? [])
      .filter((o) => o.questao_ordem === q.ordem)
      .map((o) => ({ ordem: o.opcao_ordem, texto: o.texto })),
  }));
}

export async function getAnamneseProgresso(): Promise<AnamneseProgresso> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.rpc("anamnese_meu_progresso");
  const d = (data ?? {}) as {
    respostas?: { questao_ordem: number; opcao_ordem: number }[];
    total_questoes?: number;
    questoes_respondidas?: number;
    proxima_questao_ordem?: number | null;
  };
  return {
    respostas: d.respostas ?? [],
    totalQuestoes: d.total_questoes ?? 16,
    questoesRespondidas: d.questoes_respondidas ?? 0,
    proximaQuestaoOrdem: d.proxima_questao_ordem ?? null,
  };
}

export async function getAnamneseTextosGerais(): Promise<Record<string, string>> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.from("anamnese_textos_gerais").select("chave, texto");
  const mapa: Record<string, string> = {};
  for (const row of data ?? []) mapa[row.chave] = row.texto;
  return mapa;
}

export async function getSonsConquista(): Promise<boolean> {
  const supabase = await criarClienteServidor();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return true;
  const { data } = await supabase.from("perfis").select("sons_conquista").eq("id", auth.user.id).maybeSingle();
  return data?.sons_conquista ?? true;
}

export async function getAnamneseTerritorios(): Promise<Territorio[]> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("anamnese_territorios")
    .select("trilha_id, x_pct, y_pct, descricao_curta, justificativa_unica, justificativa_iniciante, justificativa_evoluido, trilhas(nome)")
    .order("trilha_id");
  return (data ?? []).map((t) => ({
    trilhaId: t.trilha_id,
    trilhaNome: (t.trilhas as unknown as { nome: string })?.nome ?? "",
    xPct: Number(t.x_pct),
    yPct: Number(t.y_pct),
    descricaoCurta: t.descricao_curta,
    justificativaUnica: t.justificativa_unica,
    justificativaIniciante: t.justificativa_iniciante,
    justificativaEvoluido: t.justificativa_evoluido,
  }));
}

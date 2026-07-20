// app/anamnese/actions.ts
"use server";

import { criarClienteServidor } from "@/lib/supabase/server";

export async function buscarFraseEspelho(chave: string): Promise<string> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.from("anamnese_frases_espelho").select("texto").eq("chave", chave).maybeSingle();
  return data?.texto ?? "";
}

export async function responderQuestao(questaoOrdem: number, opcaoOrdem: number) {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("anamnese_responder", {
    p_questao_ordem: questaoOrdem,
    p_opcao_ordem: opcaoOrdem,
  });
  if (error) return { ok: false as const, erro: error.message };
  return data as { ok: boolean; questoes_respondidas: number; total_questoes: number };
}

// Escolha da frase de espelho — decisão própria (o texto aprovado não deu
// uma tabela exata de qual resposta ativa qual frase), documentada aqui
// pra revisão: prioridade por especificidade, primeira que bater vence.
function escolherFraseEspelho(respostas: Record<number, number>): string {
  const q8 = respostas[7];
  const q11 = respostas[10];
  const q12 = respostas[11];
  const q13 = respostas[12];
  const q14 = respostas[13];
  const q15 = respostas[14];

  if (q8 === 1 || q15 === 2) return "urgencia_financeira";
  if (q13 === 1) return "pode_mais";
  if (q11 === 3 || q8 === 2) return "cansaco_emprego";
  if (q13 === 3 || q13 === 6) return "ja_atua_evoluir";
  if (q15 === 4 || q12 === 6) return "reconhecimento";
  if (q11 === 1) return "transicao";
  if (q13 === 2 || q14 === 4) return "medo";
  return "fallback";
}

export type ResultadoConclusao =
  | { ok: false; motivo: string }
  | {
      ok: true;
      avatar: "iniciante_transicao" | "perito_em_evolucao";
      fraseEspelho: string;
      rotaTrilhaIds: string[];
      primeiraEstacao: {
        trilhaId: string;
        trilhaNome: string;
        numCursos: number;
        cargaHoras: number;
        justificativa: string;
        xPct: number;
        yPct: number;
        forcadaRegraIniciante: boolean;
        forcadaAncoraEspecialidade: boolean;
      };
    };

export async function concluirAnamnese(): Promise<ResultadoConclusao> {
  const supabase = await criarClienteServidor();

  const { data: prescricao, error: erroPrescricao } = await supabase.rpc("anamnese_gerar_prescricao");
  if (erroPrescricao) return { ok: false, motivo: erroPrescricao.message };
  const p = prescricao as { ok: boolean; motivo?: string; avatar?: string; plano_id?: string };
  if (!p.ok) return { ok: false, motivo: p.motivo ?? "erro_desconhecido" };

  const avatar = p.avatar as "iniciante_transicao" | "perito_em_evolucao";

  const { data: trilhasPlano } = await supabase
    .from("plano_trilhas")
    .select("ordem, trilha_id, num_cursos, carga_efetiva_horas, forcada_regra_iniciante, forcada_ancora_especialidade, trilhas(nome)")
    .eq("plano_id", p.plano_id!)
    .order("ordem");

  const primeira = (trilhasPlano ?? [])[0];
  if (!primeira) return { ok: false, motivo: "sem_trilhas" };

  const { data: territorio } = await supabase
    .from("anamnese_territorios")
    .select("x_pct, y_pct, justificativa_unica, justificativa_iniciante, justificativa_evoluido")
    .eq("trilha_id", primeira.trilha_id)
    .maybeSingle();

  const justificativa =
    territorio?.justificativa_unica ??
    (avatar === "iniciante_transicao" ? territorio?.justificativa_iniciante : territorio?.justificativa_evoluido) ??
    "";

  const { data: respostasEmocionais } = await supabase
    .from("anamnese_respostas")
    .select("questao_ordem, opcao_ordem")
    .in("questao_ordem", [7, 10, 11, 12, 13, 14]);

  const mapaRespostas: Record<number, number> = {};
  for (const r of respostasEmocionais ?? []) mapaRespostas[r.questao_ordem] = r.opcao_ordem;

  return {
    ok: true,
    avatar,
    fraseEspelho: escolherFraseEspelho(mapaRespostas),
    rotaTrilhaIds: (trilhasPlano ?? []).map((t) => t.trilha_id),
    primeiraEstacao: {
      trilhaId: primeira.trilha_id,
      trilhaNome: (primeira.trilhas as unknown as { nome: string })?.nome ?? "",
      numCursos: primeira.num_cursos ?? 0,
      cargaHoras: Math.round(Number(primeira.carga_efetiva_horas ?? 0)),
      justificativa,
      xPct: Number(territorio?.x_pct ?? 50),
      yPct: Number(territorio?.y_pct ?? 50),
      forcadaRegraIniciante: primeira.forcada_regra_iniciante,
      forcadaAncoraEspecialidade: primeira.forcada_ancora_especialidade,
    },
  };
}

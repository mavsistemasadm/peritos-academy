// app/anamnese/actions.ts
"use server";

import { criarClienteServidor } from "@/lib/supabase/server";
import { primeiroPendenteDaTrilha } from "@/lib/queries/meuPlano";

export async function buscarComecarMinhaRota(trilhaSlug: string): Promise<string> {
  const r = await primeiroPendenteDaTrilha(trilhaSlug);
  return r.href ?? "/meu-plano";
}

export async function buscarFraseEspelho(chave: string): Promise<string> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.from("anamnese_frases_espelho").select("texto").eq("chave", chave).maybeSingle();
  return data?.texto ?? "";
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

// Flexão do texto do tesouro por objetivo declarado na Q1 (questao_ordem=0)
// — decisão própria, o texto aprovado não amarrava isso a uma pergunta
// específica. Opção 4 (empreender/escalar negócio) e 5 (nomeações
// judiciais) são as únicas com uma flexão clara e dedicada no pacote de
// textos; as demais ficam só com o texto base.
function escolherObjetivo(q1: number | undefined): "nomeacoes" | "negocio" | null {
  if (q1 === 5) return "nomeacoes";
  if (q1 === 4) return "negocio";
  return null;
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

export type Estacao = {
  ordem: number;
  trilhaId: string;
  trilhaSlug: string | null;
  trilhaNome: string;
  numCursos: number;
  cargaHoras: number;
  justificativa: string;
  xPct: number;
  yPct: number;
  forcadaRegraIniciante: boolean;
  forcadaAncoraEspecialidade: boolean;
};

export type ResultadoConclusao =
  | { ok: false; motivo: string }
  | {
      ok: true;
      avatar: "iniciante_transicao" | "perito_em_evolucao";
      fraseEspelho: string;
      objetivo: "nomeacoes" | "negocio" | null;
      numeroCaso: string;
      resumo: {
        mesesTotais: number;
        excedeMetaMeses: boolean;
        horasSemanaDeclarada: number;
        horasSemanaSugerida: number;
      };
      estacoes: Estacao[];
    };

export async function concluirAnamnese(): Promise<ResultadoConclusao> {
  const supabase = await criarClienteServidor();

  const { data: prescricao, error: erroPrescricao } = await supabase.rpc("anamnese_gerar_prescricao");
  if (erroPrescricao) return { ok: false, motivo: erroPrescricao.message };
  const p = prescricao as { ok: boolean; motivo?: string; avatar?: string; plano_id?: string; numero_caso?: number };
  if (!p.ok) return { ok: false, motivo: p.motivo ?? "erro_desconhecido" };

  const avatar = p.avatar as "iniciante_transicao" | "perito_em_evolucao";
  const numeroCaso = String(p.numero_caso ?? 0).padStart(4, "0");

  const [{ data: trilhasPlano }, { data: plano }, { data: territorios }, { data: respostas }] = await Promise.all([
    supabase
      .from("plano_trilhas")
      .select("ordem, trilha_id, num_cursos, carga_efetiva_horas, forcada_regra_iniciante, forcada_ancora_especialidade, trilhas(nome, slug)")
      .eq("plano_id", p.plano_id!)
      .order("ordem"),
    supabase
      .from("planos")
      .select("meses_totais, excede_meta_meses, horas_semana_declarada, horas_semana_sugerida")
      .eq("id", p.plano_id!)
      .maybeSingle(),
    supabase
      .from("anamnese_territorios")
      .select("trilha_id, x_pct, y_pct, justificativa_unica, justificativa_iniciante, justificativa_evoluido"),
    supabase.from("anamnese_respostas").select("questao_ordem, opcao_ordem"),
  ]);

  if (!trilhasPlano || trilhasPlano.length === 0) return { ok: false, motivo: "sem_trilhas" };

  const territorioPorId = new Map((territorios ?? []).map((t) => [t.trilha_id, t]));
  const mapaRespostas: Record<number, number> = {};
  for (const r of respostas ?? []) mapaRespostas[r.questao_ordem] = r.opcao_ordem;

  const estacoes: Estacao[] = trilhasPlano.map((t) => {
    const territorio = territorioPorId.get(t.trilha_id);
    const justificativa =
      territorio?.justificativa_unica ??
      (avatar === "iniciante_transicao" ? territorio?.justificativa_iniciante : territorio?.justificativa_evoluido) ??
      "";
    return {
      ordem: t.ordem,
      trilhaId: t.trilha_id,
      trilhaSlug: (t.trilhas as unknown as { nome: string; slug: string | null })?.slug ?? null,
      trilhaNome: (t.trilhas as unknown as { nome: string; slug: string | null })?.nome ?? "",
      numCursos: t.num_cursos ?? 0,
      cargaHoras: Math.round(Number(t.carga_efetiva_horas ?? 0)),
      justificativa,
      xPct: Number(territorio?.x_pct ?? 50),
      yPct: Number(territorio?.y_pct ?? 50),
      forcadaRegraIniciante: t.forcada_regra_iniciante,
      forcadaAncoraEspecialidade: t.forcada_ancora_especialidade,
    };
  });

  return {
    ok: true,
    avatar,
    fraseEspelho: escolherFraseEspelho(mapaRespostas),
    objetivo: escolherObjetivo(mapaRespostas[0]),
    numeroCaso,
    resumo: {
      mesesTotais: plano?.meses_totais ?? 0,
      excedeMetaMeses: !!plano?.excede_meta_meses,
      horasSemanaDeclarada: Number(plano?.horas_semana_declarada ?? 0),
      horasSemanaSugerida: Number(plano?.horas_semana_sugerida ?? 0),
    },
    estacoes,
  };
}

// "Refazer minha Rota do Perito" (Cena 6 / Meu Plano): limpa só as
// respostas da anamnese e desativa o plano gerado por ela — nunca toca
// aula_progresso/avaliacao_tentativas (progresso real do aluno nos cursos).
// Ao voltar para /anamnese o aluno recomeça a questionário do zero.
export async function refazerAnamnese(): Promise<{ ok: boolean }> {
  const supabase = await criarClienteServidor();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return { ok: false };

  await supabase.from("anamnese_respostas").delete().eq("usuario_id", auth.user.id);
  await supabase.from("planos").update({ ativo: false }).eq("usuario_id", auth.user.id).eq("origem", "anamnese").eq("ativo", true);

  return { ok: true };
}

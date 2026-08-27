// app/curso/[slug]/avaliacao/[avaliacaoId]/actions.ts
// A correção da avaliação. Mora aqui, e não inline na page.tsx, porque ação
// declarada dentro do componente com `"use server"` no corpo não leva junto as
// variáveis do escopo em volta — `avaliacaoId` chegava indefinido no servidor e
// TODA submissão morria com um erro que a Vercel omite em produção
// ("An error occurred in the Server Components render"). O id agora vem por
// `.bind()`, que o Next serializa cifrado: continua fora do alcance do cliente.
"use server";

import { criarClienteServidor } from "@/lib/supabase/server";
import type { ResultadoCorrecao } from "@/lib/queries/avaliacao";

export type RespostaEnviada = {
  questao_id: string;
  opcao_id?: string;
  valor?: number;
};

export async function submeterAvaliacao(
  avaliacaoId: string,
  respostas: RespostaEnviada[]
): Promise<ResultadoCorrecao> {
  const sb = await criarClienteServidor();
  const { data, error } = await sb.rpc("submeter_avaliacao", {
    p_avaliacao: avaliacaoId,
    p_respostas: respostas,
  });
  if (error) throw new Error(error.message);
  const resultado = data as ResultadoCorrecao;

  // ---------- feedback personalizado por IA nos erros ----------
  try {
    const errados = resultado.gabarito.filter((g) => !g.correta);
    if (errados.length > 0) {
      // busca os quesitos da avaliação pra montar o contexto
      const { data: av } = await sb
        .from("avaliacoes")
        .select("titulo, briefing")
        .eq("id", avaliacaoId)
        .single();

      const { data: questoesRaw } = await sb
        .from("avaliacao_questoes")
        .select("id, enunciado, tipo")
        .eq("avaliacao_id", avaliacaoId);

      const questoesMap = new Map(
        (questoesRaw ?? []).map((q: any) => [q.id, q])
      );

      const prompt = errados
        .map((g) => {
          const q = questoesMap.get(g.questao_id);
          const enunciado = q?.enunciado ?? "Quesito";
          const tipo = q?.tipo ?? "multipla_escolha";
          const respostaAluno =
            tipo === "multipla_escolha"
              ? g.opcao_marcada
                ? `Opção: ${g.opcao_marcada}`
                : "(não respondido)"
              : g.valor_informado !== null
                ? String(g.valor_informado)
                : "(não respondido)";
          const respostaCorreta =
            tipo === "multipla_escolha"
              ? (g.opcao_correta_texto ?? "sem gabarito")
              : g.resposta_valor !== null
                ? String(g.resposta_valor)
                : "sem gabarito";

          return `QUESITO (${g.questao_id}): ${enunciado}
RESPOSTA CORRETA: ${respostaCorreta}
RESPOSTA DO ALUNO: ${respostaAluno}
PARECER ORIGINAL: ${g.parecer ?? "sem parecer"}`;
        })
        .join("\n\n---\n\n");

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
          "anthropic-version": "2023-06-01",
        },
        signal: AbortSignal.timeout(20_000),
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 2000,
          system: `Você é um perito contábil judicial experiente corrigindo uma avaliação de um aluno.${av?.titulo ? ` A avaliação é: "${av.titulo}".` : ""}

Para cada quesito errado, gere um feedback personalizado baseado no erro específico do aluno. Use o parecer original como referência mas personalize pro erro cometido.

Responda APENAS com um array JSON válido (sem markdown, sem backticks), onde cada elemento tem:
- "questao_id": string (copie exatamente o ID fornecido)
- "feedback": string com feedback construtivo em português, explicando o erro específico e como corrigir (máx 250 caracteres). NÃO use markdown.

Seja justo mas exigente.`,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const iaData = await response.json();
      const texto = iaData.content?.map((c: any) => c.text || "").join("") ?? "";
      const limpo = texto.replace(/```json|```/g, "").trim();
      const feedbacksIA: { questao_id: string; feedback: string }[] =
        JSON.parse(limpo);

      // substitui o parecer estático pelo personalizado
      const fbMap = new Map(feedbacksIA.map((f) => [f.questao_id, f.feedback]));
      resultado.gabarito = resultado.gabarito.map((g) => {
        const fb = fbMap.get(g.questao_id);
        if (fb && !g.correta) return { ...g, parecer: fb };
        return g;
      });
    }
  } catch (e) {
    console.error("[avaliacao] erro no feedback IA:", e);
    // se a IA falhar, mantém o parecer estático original — sem problema
  }

  return resultado;
}

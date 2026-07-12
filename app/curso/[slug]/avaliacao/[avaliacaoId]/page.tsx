// app/curso/[slug]/avaliacao/[avaliacaoId]/page.tsx
import { notFound } from "next/navigation";
import { getAvaliacao, type ResultadoCorrecao, type GabaritoItem } from "@/lib/queries/avaliacao";
import AvaliacaoContent from "@/components/AvaliacaoContent";
import { criarClienteServidor } from "@/lib/supabase/server";

export default async function AvaliacaoPage({ params }: {
  params: Promise<{ slug: string; avaliacaoId: string }>;
}) {
  const { slug, avaliacaoId } = await params;

  const dados = await getAvaliacao(slug, avaliacaoId);
  if (!dados) notFound();

  const supabase = await criarClienteServidor();
  const { data: auth } = await supabase.auth.getUser();
  const usuarioNome =
    (auth?.user?.user_metadata?.nome as string | undefined) ??
    (auth?.user?.user_metadata?.full_name as string | undefined) ??
    auth?.user?.email?.split("@")[0] ??
    null;

  async function submeter(
    respostas: { questao_id: string; opcao_id?: string; valor?: number }[]
  ): Promise<ResultadoCorrecao> {
    "use server";
    const sb = await criarClienteServidor();
    const { data, error } = await sb.rpc("submeter_avaliacao", {
      p_avaliacao: avaliacaoId,
      p_respostas: respostas,
    });
    if (error) throw new Error(error.message);
    const resultado = data as ResultadoCorrecao;

    // ---------- feedback personalizado por IA nos erros ----------
    try {
      const errados = resultado.gabarito.filter(g => !g.correta);
      if (errados.length > 0) {
        // busca os quesitos da avaliação pra montar o contexto
        const { data: av } = await sb
          .from("avaliacoes")
          .select("titulo, briefing")
          .eq("id", avaliacaoId)
          .single();

        const { data: questoesRaw } = await sb
          .from("questoes")
          .select("id, enunciado, tipo")
          .eq("avaliacao_id", avaliacaoId);

        const questoesMap = new Map(
          (questoesRaw ?? []).map((q: any) => [q.id, q])
        );

        const prompt = errados.map(g => {
          const q = questoesMap.get(g.questao_id);
          const enunciado = q?.enunciado ?? "Quesito";
          const tipo = q?.tipo ?? "multipla_escolha";
          const respostaAluno = tipo === "multipla_escolha"
            ? (g.opcao_marcada ? `Opção: ${g.opcao_marcada}` : "(não respondido)")
            : (g.valor_informado !== null ? String(g.valor_informado) : "(não respondido)");
          const respostaCorreta = tipo === "multipla_escolha"
            ? (g.opcao_correta_texto ?? "—")
            : (g.resposta_valor !== null ? String(g.resposta_valor) : "—");

          return `QUESITO (${g.questao_id}): ${enunciado}
RESPOSTA CORRETA: ${respostaCorreta}
RESPOSTA DO ALUNO: ${respostaAluno}
PARECER ORIGINAL: ${g.parecer ?? "sem parecer"}`;
        }).join("\n\n---\n\n");

        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
            "anthropic-version": "2023-06-01",
          },
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
        const feedbacksIA: { questao_id: string; feedback: string }[] = JSON.parse(limpo);

        // substitui o parecer estático pelo personalizado
        const fbMap = new Map(feedbacksIA.map(f => [f.questao_id, f.feedback]));
        resultado.gabarito = resultado.gabarito.map(g => {
          const fb = fbMap.get(g.questao_id);
          if (fb && !g.correta) {
            return { ...g, parecer: fb };
          }
          return g;
        });
      }
    } catch (e) {
      console.error("[avaliacao] erro no feedback IA:", e);
      // se a IA falhar, mantém o parecer estático original — sem problema
    }

    return resultado;
  }

  return (
    <AvaliacaoContent dados={dados} usuarioNome={usuarioNome} submeter={submeter} />
  );
}

export async function generateMetadata({ params }: {
  params: Promise<{ slug: string; avaliacaoId: string }>;
}) {
  const { slug, avaliacaoId } = await params;
  const dados = await getAvaliacao(slug, avaliacaoId);
  if (!dados) return { title: "Avaliação — Peritos Academy" };
  const rotulo = dados.avaliacao.tipo === "prova" ? "Prova" : "Avaliação";
  return {
    title: `${dados.avaliacao.caso_numero ? `Caso Nº ${dados.avaliacao.caso_numero} — ` : ""}${dados.avaliacao.titulo} · ${rotulo} — Peritos Academy`,
  };
}
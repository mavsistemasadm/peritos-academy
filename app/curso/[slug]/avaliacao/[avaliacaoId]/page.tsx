// app/curso/[slug]/avaliacao/[avaliacaoId]/page.tsx
import { notFound } from "next/navigation";
import { getAvaliacao, type ResultadoCorrecao } from "@/lib/queries/avaliacao";
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
  console.log("[avaliacao] usuário na sessão:", auth?.user?.email ?? "NENHUM (anônimo)");
  const usuarioNome =
    (auth?.user?.user_metadata?.nome as string | undefined) ??
    (auth?.user?.user_metadata?.full_name as string | undefined) ??
    auth?.user?.email?.split("@")[0] ??
    null;

  // Server action: a correção roda no banco (RPC security definer),
  // o gabarito só sai daqui DEPOIS do envio.
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
    return data as ResultadoCorrecao;
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
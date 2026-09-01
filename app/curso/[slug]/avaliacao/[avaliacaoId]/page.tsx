// app/curso/[slug]/avaliacao/[avaliacaoId]/page.tsx
import { notFound, redirect } from "next/navigation";
import { getAvaliacao } from "@/lib/queries/avaliacao";
import { submeterAvaliacao } from "./actions";
import AvaliacaoContent from "@/components/AvaliacaoContent";
import { criarClienteServidor } from "@/lib/supabase/server";
import { carregarNav } from "@/lib/queries/nav";
import { verificarAcessoCurso } from "@/lib/acesso/verificar";
import AssinaturaNecessaria from "@/components/AssinaturaNecessaria";

// A correção chama a Claude Haiku pra personalizar o parecer de cada erro:
// uma avaliação inteira errada leva mais de 10s, que é o teto padrão da Vercel.
// Estourar ali derruba a submissão DEPOIS de a tentativa já estar gravada.
export const maxDuration = 60;

export default async function AvaliacaoPage({ params, searchParams }: {
  params: Promise<{ slug: string; avaliacaoId: string }>;
  searchParams: Promise<{ bloqueada?: string }>;
}) {
  const { slug, avaliacaoId } = await params;
  const { bloqueada } = await searchParams;

  const dados = await getAvaliacao(slug, avaliacaoId);
  if (!dados) notFound();

  const acesso = await verificarAcessoCurso(slug);
  // Turma fechada dá 404, não paywall — ver a página do curso.
  if (!acesso.permitido && acesso.restrito) notFound();
  if (!acesso.permitido) {
    const nav = await carregarNav();
    return <AssinaturaNecessaria nav={nav} logado={acesso.logado} alvo={slug} />;
  }

  const supabase = await criarClienteServidor();
  const { data: auth } = await supabase.auth.getUser();

  // gate de sequência: a prova não pula as aulas. Sem isto, o link direto da
  // avaliação abriria a prova de um curso nunca assistido — e a RPC de
  // submissão recusaria só depois de o aluno responder tudo. Admin passa.
  const { data: pendencia } = await supabase.rpc("avaliacao_pendencia", { p_avaliacao: avaliacaoId });
  if ((pendencia as any)?.bloqueado) {
    const alvo = (pendencia as any).tipo === "aula" && (pendencia as any).id
      ? `/curso/${slug}/aula/${(pendencia as any).id}`
      : `/curso/${slug}`;
    redirect(`${alvo}?bloqueada=1`);
  }
  const usuarioNome =
    (auth?.user?.user_metadata?.nome as string | undefined) ??
    (auth?.user?.user_metadata?.full_name as string | undefined) ??
    auth?.user?.email?.split("@")[0] ??
    null;

  return (
    <AvaliacaoContent
      dados={dados}
      usuarioNome={usuarioNome}
      submeter={submeterAvaliacao.bind(null, avaliacaoId)}
      vindoDeBloqueio={bloqueada === "1"}
    />
  );
}

export async function generateMetadata({ params }: {
  params: Promise<{ slug: string; avaliacaoId: string }>;
}) {
  const { slug, avaliacaoId } = await params;
  const dados = await getAvaliacao(slug, avaliacaoId);
  if (!dados) return { title: "Avaliação · Peritos Academy" };
  const rotulo = dados.avaliacao.tipo === "prova" ? "Prova" : "Avaliação";
  return {
    title: `${dados.avaliacao.caso_numero ? `Caso Nº ${dados.avaliacao.caso_numero} · ` : ""}${dados.avaliacao.titulo} · ${rotulo} · Peritos Academy`,
  };
}
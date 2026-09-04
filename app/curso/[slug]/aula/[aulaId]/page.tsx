// app/curso/[slug]/aula/[aulaId]/page.tsx
import { notFound, redirect } from "next/navigation";
import { getAula, proximoPassoDoCurso } from "@/lib/queries/aula";
import { carregarNav } from "@/lib/queries/nav";
import AulaContent from "@/components/AulaContent";
import { criarClienteServidor } from "@/lib/supabase/server";
import { verificarAcessoCurso } from "@/lib/acesso/verificar";
import AssinaturaNecessaria from "@/components/AssinaturaNecessaria";
import FormacaoPendente from "@/components/FormacaoPendente";

export default async function AulaPage({ params, searchParams }: {
  params: Promise<{ slug: string; aulaId: string }>;
  searchParams: Promise<{ bloqueada?: string }>;
}) {
  const { slug, aulaId } = await params;
  const { bloqueada } = await searchParams;
  const supabase = await criarClienteServidor();
  const { data: auth } = await supabase.auth.getUser();

  const [dados, nav] = await Promise.all([getAula(slug, aulaId), carregarNav()]);
  if (!dados) notFound();

  const acesso = await verificarAcessoCurso(slug);
  // Turma fechada dá 404, não paywall — ver a página do curso.
  if (!acesso.permitido && acesso.restrito) notFound();
  // ⚠️ ANTES DO PAYWALL. Quem tem direito e esbarrou na ORDEM não pode ver
  // "seu acesso não inclui este conteúdo": ele acabou de pagar por ele.
  if (!acesso.permitido && acesso.pendente) {
    return <FormacaoPendente nav={nav} pendente={acesso.pendente} curso={dados?.curso?.titulo ?? null} />;
  }
  if (!acesso.permitido) return <AssinaturaNecessaria nav={nav} logado={acesso.logado} alvo={slug} />;

  // acesso direto por URL a uma aula ainda travada → manda pro próximo passo
  // REAL da jornada, que pode ser uma avaliação. Admin tem bypass total.
  if (dados.aula.bloqueada && !nav.isAdmin) {
    const passo = await proximoPassoDoCurso(slug);
    if (passo && passo.id !== aulaId) {
      const sep = passo.href.includes("?") ? "&" : "?";
      redirect(`${passo.href}${sep}bloqueada=1`);
    }
  }

  const usuarioId = auth?.user?.id ?? null;
  const usuarioNome =
    (auth?.user?.user_metadata?.nome as string | undefined) ??
    (auth?.user?.user_metadata?.full_name as string | undefined) ??
    auth?.user?.email?.split("@")[0] ??
    null;

  return <AulaContent dados={dados} usuarioId={usuarioId} usuarioNome={usuarioNome} nav={nav} avisoBloqueio={bloqueada === "1"} />;
}

export async function generateMetadata({ params }: {
  params: Promise<{ slug: string; aulaId: string }>;
}) {
  const { slug, aulaId } = await params;
  const dados = await getAula(slug, aulaId);
  return { title: dados ? `${dados.aula.titulo} · Peritos Academy` : "Aula · Peritos Academy" };
}
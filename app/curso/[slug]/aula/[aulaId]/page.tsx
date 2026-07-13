// app/curso/[slug]/aula/[aulaId]/page.tsx
import { notFound } from "next/navigation";
import { getAula } from "@/lib/queries/aula";
import { carregarNav } from "@/lib/queries/nav";
import AulaContent from "@/components/AulaContent";
import { criarClienteServidor } from "@/lib/supabase/server";
import { verificarAcessoConteudo } from "@/lib/acesso/verificar";
import AssinaturaNecessaria from "@/components/AssinaturaNecessaria";

export default async function AulaPage({ params }: {
  params: Promise<{ slug: string; aulaId: string }>;
}) {
  const { slug, aulaId } = await params;
  const supabase = await criarClienteServidor();
  const { data: auth } = await supabase.auth.getUser();

  const [dados, nav] = await Promise.all([getAula(slug, aulaId), carregarNav()]);
  if (!dados) notFound();

  const acesso = await verificarAcessoConteudo();
  if (!acesso.permitido) return <AssinaturaNecessaria nav={nav} logado={acesso.logado} />;

  const usuarioId = auth?.user?.id ?? null;
  const usuarioNome =
    (auth?.user?.user_metadata?.nome as string | undefined) ??
    (auth?.user?.user_metadata?.full_name as string | undefined) ??
    auth?.user?.email?.split("@")[0] ??
    null;

  return <AulaContent dados={dados} usuarioId={usuarioId} usuarioNome={usuarioNome} nav={nav} />;
}

export async function generateMetadata({ params }: {
  params: Promise<{ slug: string; aulaId: string }>;
}) {
  const { slug, aulaId } = await params;
  const dados = await getAula(slug, aulaId);
  return { title: dados ? `${dados.aula.titulo} — Peritos Academy` : "Aula — Peritos Academy" };
}
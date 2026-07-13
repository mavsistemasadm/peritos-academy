import { notFound } from "next/navigation";
import { buscarCurso } from "@/lib/queries/curso";
import { carregarNav } from "@/lib/queries/nav";
import { CursoContent } from "@/components/CursoContent";
import { verificarAcessoConteudo } from "@/lib/acesso/verificar";
import AssinaturaNecessaria from "@/components/AssinaturaNecessaria";

export default async function PaginaCurso({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [dados, nav] = await Promise.all([buscarCurso(slug), carregarNav()]);

  if (!dados) notFound();

  const acesso = await verificarAcessoConteudo();
  if (!acesso.permitido) return <AssinaturaNecessaria nav={nav} logado={acesso.logado} />;

  return (
    <CursoContent
      curso={dados.curso}
      modulos={dados.modulos}
      conquistas={dados.conquistas}
      relacionados={dados.relacionados}
      nav={nav}
    />
  );
}
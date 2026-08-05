import { notFound } from "next/navigation";
import { buscarCurso } from "@/lib/queries/curso";
import { carregarNav } from "@/lib/queries/nav";
import { CursoContent } from "@/components/CursoContent";
import { verificarAcessoCurso } from "@/lib/acesso/verificar";
import AssinaturaNecessaria from "@/components/AssinaturaNecessaria";

export default async function PaginaCurso({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [dados, nav] = await Promise.all([buscarCurso(slug), carregarNav()]);

  if (!dados) notFound();

  const acesso = await verificarAcessoCurso(slug);
  if (!acesso.permitido) return <AssinaturaNecessaria nav={nav} logado={acesso.logado} alvo={slug} />;

  return (
    <CursoContent
      curso={dados.curso}
      modulos={dados.modulos}
      conquistas={dados.conquistas}
      progresso={dados.progresso}
      proximoPasso={dados.proximoPasso}
      nav={nav}
    />
  );
}
import { notFound } from "next/navigation";
import { buscarCurso } from "@/lib/queries/curso";
import { carregarNav } from "@/lib/queries/nav";
import { CursoContent } from "@/components/CursoContent";
import { verificarAcessoCurso } from "@/lib/acesso/verificar";
import AssinaturaNecessaria from "@/components/AssinaturaNecessaria";
import FormacaoPendente from "@/components/FormacaoPendente";

export default async function PaginaCurso({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [dados, nav] = await Promise.all([buscarCurso(slug), carregarNav()]);

  if (!dados) notFound();

  const acesso = await verificarAcessoCurso(slug);
  // Turma fechada não tem paywall: quem não está na turma vê 404, porque
  // assinar não abriria este curso e a tela de assinatura prometeria isso.
  if (!acesso.permitido && acesso.restrito) notFound();
  // ⚠️ ANTES DO PAYWALL. Quem tem direito e esbarrou na ORDEM não pode ver
  // "seu acesso não inclui este conteúdo": ele acabou de pagar por ele.
  if (!acesso.permitido && acesso.pendente) {
    return <FormacaoPendente nav={nav} pendente={acesso.pendente} curso={dados?.curso?.titulo ?? null} />;
  }
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
// app/meu-plano/page.tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { carregarNav } from "@/lib/queries/nav";
import { getPlanoVivo } from "@/lib/queries/meuPlano";
import { getAnamneseTerritorios, getAnamneseTextosGerais } from "@/lib/queries/anamnese";
import MeuPlanoContent from "@/components/MeuPlanoContent";

export const metadata: Metadata = {
  title: "Minha Rota do Perito · Peritos Academy",
  description: "O mapa da sua Rota do Perito, com o progresso real nos cursos de cada território.",
};

export const dynamic = "force-dynamic";

export default async function PaginaMeuPlano() {
  const nav = await carregarNav();
  if (!nav.logado) redirect("/login");

  const [plano, territorios, textos] = await Promise.all([
    getPlanoVivo(),
    getAnamneseTerritorios(),
    getAnamneseTextosGerais(),
  ]);

  return <MeuPlanoContent nav={nav} plano={plano} territorios={territorios} textos={textos} />;
}

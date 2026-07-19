import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { carregarAvisos } from "@/lib/queries/avisos";
import AvisosGlobais from "@/components/AvisosGlobais";
import ConquistaToast from "@/components/ConquistaToast";
import { registrarAcessoDiario } from "@/lib/gamificacao/acesso-diario";
import { carregarConfigPlataforma } from "@/lib/queries/config-plataforma";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const config = await carregarConfigPlataforma();
  const titulo = config.metaTitulo || config.nomePlataforma;
  const descricao = config.metaDescricao || "Conhecimento aplicado. Autoridade construída.";

  return {
    title: titulo,
    description: descricao,
    icons: config.faviconUrl ? { icon: config.faviconUrl } : undefined,
    openGraph: {
      title: titulo,
      description: descricao,
      images: config.ogImageUrl ? [config.ogImageUrl] : undefined,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [avisos, config] = await Promise.all([carregarAvisos(), carregarConfigPlataforma()]);
  void registrarAcessoDiario(); // fire-and-forget, não bloqueia o render — streak + login_diario, chokepoint único

  return (
    <html lang="pt-BR" className={inter.className}>
      <body className="min-h-screen">
        {children}
        <AvisosGlobais dados={avisos} />
        <ConquistaToast logado={avisos.logado} sonsConquista={avisos.sonsConquista} />
        {config.textoRodape && <footer className="rodape-global">{config.textoRodape}</footer>}
      </body>
    </html>
  );
}
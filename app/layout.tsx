import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { carregarAvisos } from "@/lib/queries/avisos";
import AvisosGlobais from "@/components/AvisosGlobais";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Peritos Academy",
  description: "Conhecimento aplicado. Autoridade construída.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const avisos = await carregarAvisos();

  return (
    <html lang="pt-BR" className={inter.className}>
      <body className="min-h-screen">
        {children}
        <AvisosGlobais dados={avisos} />
      </body>
    </html>
  );
}
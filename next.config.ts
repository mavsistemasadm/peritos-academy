import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    // Server Actions usam 1mb por padrão (next/dist/server/app-render/action-handler.js) —
    // qualquer upload de imagem/arquivo via 'use server' (capa de curso, materiais de
    // aula, avatar, banners) acima disso falha com 413 "Body exceeded 1mb limit" antes
    // mesmo de chegar no código da action. Materiais de aula aceitam múltiplos arquivos
    // de até 20MB cada num único envio, por isso o teto aqui é bem mais folgado que
    // qualquer limite individual já validado nas próprias actions.
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
};

export default nextConfig;
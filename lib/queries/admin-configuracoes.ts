// lib/queries/admin-configuracoes.ts
export { carregarConfigPlataforma } from '@/lib/queries/config-plataforma'
export type { ConfigPlataforma } from '@/lib/queries/config-plataforma'

export type IntegracaoStatus = {
  chave: string
  nome: string
  configurada: boolean
  onde: string
  docUrl: string
  info?: string
}

// Nunca retorna o valor da env — só se ela existe (boolean). Chamado
// server-side (page.tsx é Server Component); os booleans são os únicos
// dados que chegam ao client.
export function verificarIntegracoes(): IntegracaoStatus[] {
  return [
    {
      chave: 'supabase',
      nome: 'Supabase',
      configurada: !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      onde: 'Vercel → Project Settings → Environment Variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)',
      docUrl: 'https://supabase.com/docs/guides/getting-started',
    },
    {
      chave: 'asaas_webhook',
      nome: 'Asaas · validação de webhook',
      configurada: !!process.env.ASAAS_WEBHOOK_TOKEN,
      onde: 'Vercel → Environment Variables (ASAAS_WEBHOOK_TOKEN). Sem essa env, o webhook aceita qualquer chamada (ver CLAUDE.md, pendência)',
      docUrl: 'https://docs.asaas.com/docs/webhook',
    },
    {
      chave: 'asaas_api',
      nome: 'Asaas · API (criação de assinatura/cobrança)',
      configurada: !!process.env.ASAAS_API_KEY,
      onde: 'Vercel → Environment Variables (ASAAS_API_KEY). Integração real ainda não ligada',
      docUrl: 'https://docs.asaas.com/reference/comece-por-aqui',
    },
    {
      chave: 'panda_video',
      nome: 'Panda Video',
      configurada: true,
      info: 'Player embutido via iframe (player-vz-a94806ca-13a.tv.pandavideo.com.br). Não usa API key, nada a configurar aqui.',
      onde: '—',
      docUrl: 'https://pandavideo.com.br/',
    },
  ]
}

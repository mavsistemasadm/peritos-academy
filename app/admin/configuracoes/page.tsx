// app/admin/configuracoes/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'
import { carregarConfigPlataforma, verificarIntegracoes } from '@/lib/queries/admin-configuracoes'
import AdminConfiguracoesContent from '@/components/AdminConfiguracoesContent'

export const metadata: Metadata = {
  title: 'Configurações — Admin Peritos Academy',
}

export const dynamic = 'force-dynamic'

export default async function PaginaAdminConfiguracoes() {
  const admin = await obterAdminAtual()
  if (!temPermissao(admin, 'configuracoes')) redirect('/acesso-negado')

  const config = await carregarConfigPlataforma()
  const integracoes = verificarIntegracoes()

  return <AdminConfiguracoesContent config={config} integracoes={integracoes} />
}

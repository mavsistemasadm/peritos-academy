// app/admin/financeiro/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'
import {
  carregarPainelFinanceiro, carregarAssinaturasAdmin, carregarPlanosAdmin, carregarWebhooksAdmin,
} from '@/lib/queries/admin-financeiro'
import AdminFinanceiroContent from '@/components/AdminFinanceiroContent'

export const metadata: Metadata = {
  title: 'Financeiro · Admin Peritos Academy',
}

export const dynamic = 'force-dynamic'

export default async function PaginaAdminFinanceiro() {
  const admin = await obterAdminAtual()
  if (!temPermissao(admin, 'financeiro')) redirect('/acesso-negado')

  const [painel, assinaturas, planos, webhooks] = await Promise.all([
    carregarPainelFinanceiro(), carregarAssinaturasAdmin(), carregarPlanosAdmin(), carregarWebhooksAdmin(),
  ])

  return <AdminFinanceiroContent painel={painel} assinaturas={assinaturas} planos={planos} webhooks={webhooks} />
}

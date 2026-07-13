// app/admin/gamificacao/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'
import { carregarConfigGamificacao, carregarGatilhosAdmin, carregarNiveisAdmin } from '@/lib/queries/admin-gamificacao'
import AdminGamificacaoContent from '@/components/AdminGamificacaoContent'

export const metadata: Metadata = {
  title: 'Gamificação — Admin Peritos Academy',
}

export const dynamic = 'force-dynamic'

export default async function PaginaAdminGamificacao() {
  const admin = await obterAdminAtual()
  if (!temPermissao(admin, 'gamificacao')) redirect('/acesso-negado')

  const [config, gatilhos, niveis] = await Promise.all([
    carregarConfigGamificacao(), carregarGatilhosAdmin(), carregarNiveisAdmin(),
  ])

  return <AdminGamificacaoContent config={config} gatilhos={gatilhos} niveis={niveis} />
}

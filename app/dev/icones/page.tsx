// app/dev/icones/page.tsx
// Página interna de revisão do sistema de ícones — fora do menu de navegação,
// só pra super_admin auditar consistência (nada aqui é lido pelo resto do
// app). Instrumento de revisão: não altera nenhum tamanho de produção.
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { obterAdminAtual } from '@/lib/admin/auth'
import DevIconesContent from '@/components/DevIconesContent'

export const metadata: Metadata = {
  title: 'Revisão de ícones — Peritos Academy',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function PaginaDevIcones() {
  const admin = await obterAdminAtual()
  if (!admin) redirect('/login')
  if (!admin.papeis.includes('super_admin')) redirect('/acesso-negado')

  return <DevIconesContent />
}

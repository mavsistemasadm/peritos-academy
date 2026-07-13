// app/redefinir-senha/page.tsx
import type { Metadata } from 'next'
import RedefinirSenhaContent from '@/components/RedefinirSenhaContent'

export const metadata: Metadata = {
  title: 'Redefinir senha — Peritos Academy',
}

export const dynamic = 'force-dynamic'

export default function PaginaRedefinirSenha() {
  return <RedefinirSenhaContent />
}

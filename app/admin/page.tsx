// app/admin/page.tsx
import type { Metadata } from 'next'
import { obterAdminAtual } from '@/lib/admin/auth'
import { NOME_PAPEL } from '@/lib/admin/permissoes'

export const metadata: Metadata = {
  title: 'Admin · Peritos Academy',
}

export const dynamic = 'force-dynamic'

export default async function PaginaAdmin() {
  const admin = await obterAdminAtual()
  const superAdmin = admin?.papeis.includes('super_admin') ?? false

  return (
    <div className="pnl-dashboard">
      <h1>Painel Admin</h1>
      <p className="pnl-sub">Seus papéis: {admin?.papeis.map(p => NOME_PAPEL[p]).join(', ') ?? '—'}</p>

      {superAdmin && (
        <a href="/admin/administradores" className="pnl-card pnl-card-link">
          <h2>Gestão de Administradores</h2>
          <p>Conceda ou revogue papéis de Super Admin, Conteúdo, Financeiro e Moderador.</p>
        </a>
      )}

      <div className="pnl-card pnl-card-vazio">
        <p>As demais seções (Cursos, Financeiro, Desafios, Usuários...) serão construídas nas próximas etapas.</p>
      </div>
    </div>
  )
}

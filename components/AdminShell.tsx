// components/AdminShell.tsx
'use client'

import type { AdminAtual } from '@/lib/admin/auth'
import { PERMISSOES_SECAO, NOME_SECAO, NOME_PAPEL, type SecaoAdmin } from '@/lib/admin/permissoes'

const ROTA_SECAO: Partial<Record<SecaoAdmin, string>> = {
  administradores: '/admin/administradores',
  cursos: '/admin/cursos',
  trilhas: '/admin/trilhas',
  avaliacoes: '/admin/avaliacoes',
  desafios: '/admin/desafios',
  certificados: '/admin/certificados',
  comunidade: '/admin/comunidade',
  agenda: '/admin/agenda',
  avisos: '/admin/avisos',
  gamificacao: '/admin/gamificacao',
  financeiro: '/admin/financeiro',
  usuarios: '/admin/usuarios',
  acessos: '/admin/acessos',
  configuracoes: '/admin/configuracoes',
}

function temPermissao(admin: AdminAtual, secao: SecaoAdmin) {
  return PERMISSOES_SECAO[secao].some(p => admin.papeis.includes(p))
}

export default function AdminShell({ admin, children }: { admin: AdminAtual; children: React.ReactNode }) {
  const secoes = Object.keys(PERMISSOES_SECAO) as SecaoAdmin[]
  const visiveis = secoes.filter(s => temPermissao(admin, s))

  return (
    <div className="pnl-shell">
      <aside className="pnl-sidebar">
        <div className="pnl-sidebar-cab">
          <span className="pnl-sidebar-titulo">Painel Admin</span>
          <div className="pnl-papeis">
            {admin.papeis.map(p => (
              <span key={p} className="pnl-pill">{NOME_PAPEL[p]}</span>
            ))}
          </div>
        </div>
        <nav className="pnl-nav">
          <a href="/admin" className="pnl-nav-item">Início</a>
          {visiveis.map(secao => {
            const rota = ROTA_SECAO[secao]
            if (!rota) return (
              <span key={secao} className="pnl-nav-item em-breve" aria-disabled="true">
                {NOME_SECAO[secao]}
                <small>em breve</small>
              </span>
            )
            return <a key={secao} href={rota} className="pnl-nav-item">{NOME_SECAO[secao]}</a>
          })}
        </nav>
      </aside>
      <main className="pnl-conteudo">{children}</main>
    </div>
  )
}

// app/acesso-negado/page.tsx
import type { Metadata } from 'next'
import { carregarNav } from '@/lib/queries/nav'
import NavPlataforma from '@/components/NavPlataforma'

export const metadata: Metadata = {
  title: 'Acesso negado — Peritos Academy',
}

export const dynamic = 'force-dynamic'

export default async function PaginaAcessoNegado() {
  const nav = await carregarNav()

  return (
    <div className="pagina-acesso-negado">
      <NavPlataforma dados={nav} />
      <main className="an-main">
        <div className="an-card">
          <span className="an-ico" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          </span>
          <h1>Acesso negado</h1>
          <p>Você está logado, mas sua conta não tem permissão para acessar essa área.</p>
          <a className="an-link" href="/">Voltar para o início</a>
        </div>
      </main>
    </div>
  )
}

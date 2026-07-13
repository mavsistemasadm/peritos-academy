// app/acesso-negado/page.tsx
import type { Metadata } from 'next'
import { carregarNav } from '@/lib/queries/nav'
import NavPlataforma from '@/components/NavPlataforma'
import { IconeLock } from '@/components/Icones'

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
            <IconeLock size={32} strokeWidth={1.8} />
          </span>
          <h1>Acesso negado</h1>
          <p>Você está logado, mas sua conta não tem permissão para acessar essa área.</p>
          <a className="an-link" href="/">Voltar para o início</a>
        </div>
      </main>
    </div>
  )
}

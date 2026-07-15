// app/termos/page.tsx
import type { Metadata } from 'next'
import { carregarConfigPlataforma } from '@/lib/queries/config-plataforma'
import { carregarNav } from '@/lib/queries/nav'
import NavPlataforma from '@/components/NavPlataforma'

export const metadata: Metadata = {
  title: 'Termos de uso · Peritos Academy',
}

export const dynamic = 'force-dynamic'

export default async function PaginaTermos() {
  const [config, nav] = await Promise.all([carregarConfigPlataforma(), carregarNav()])

  return (
    <div className="pagina-institucional">
      <NavPlataforma dados={nav} />
      <main className="inst-main">
        <h1>Termos de uso</h1>
        <div className="inst-corpo">
          {(config.termosUso || 'Termos de uso ainda não publicados.').split('\n').map((p, i) => <p key={i}>{p}</p>)}
        </div>
      </main>
    </div>
  )
}

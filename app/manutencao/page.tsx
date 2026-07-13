// app/manutencao/page.tsx
import type { Metadata } from 'next'
import { carregarConfigPlataforma } from '@/lib/queries/config-plataforma'
import { IconeZap } from '@/components/Icones'

export const metadata: Metadata = {
  title: 'Em manutenção — Peritos Academy',
}

export const dynamic = 'force-dynamic'

export default async function PaginaManutencao() {
  const config = await carregarConfigPlataforma()

  return (
    <div className="pagina-acesso-negado">
      <main className="an-main">
        <div className="an-card">
          <span className="an-ico" aria-hidden="true">
            <IconeZap size={32} strokeWidth={1.8} />
          </span>
          <h1>Voltamos já</h1>
          <p>{config.mensagemManutencao || `${config.nomePlataforma} está em manutenção programada. Voltamos em breve.`}</p>
        </div>
      </main>
    </div>
  )
}

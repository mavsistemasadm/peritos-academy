// app/conta-suspensa/page.tsx
import type { Metadata } from 'next'
import { criarClienteServidor } from '@/lib/supabase/server'
import { carregarNav } from '@/lib/queries/nav'
import NavPlataforma from '@/components/NavPlataforma'
import { IconeLock } from '@/components/Icones'

export const metadata: Metadata = {
  title: 'Conta indisponível · Peritos Academy',
}

export const dynamic = 'force-dynamic'

export default async function PaginaContaSuspensa() {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()

  let status: string | null = null
  if (auth?.user) {
    const { data: perfil } = await supabase.from('perfis').select('status').eq('id', auth.user.id).single()
    status = perfil?.status ?? null
  }

  const nav = await carregarNav()
  const banido = status === 'banido'

  return (
    <div className="pagina-acesso-negado">
      <NavPlataforma dados={nav} />
      <main className="an-main">
        <div className="an-card">
          <span className="an-ico" aria-hidden="true">
            <IconeLock size={32} strokeWidth={1.8} />
          </span>
          <h1>{banido ? 'Conta banida' : 'Conta suspensa'}</h1>
          <p>
            {banido
              ? 'Sua conta foi banida da plataforma. Se você acredita que isso é um engano, entre em contato com o suporte.'
              : 'Sua conta está temporariamente suspensa. Entre em contato com o suporte para regularizar o acesso.'}
          </p>
        </div>
      </main>
    </div>
  )
}

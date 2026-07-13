// components/AssinaturaNecessaria.tsx
// Placeholder de paywall — a página de checkout real vem com a integração
// Asaas. Por ora só orienta o aluno sobre o que falta.
import type { DadosNav } from '@/lib/queries/nav'
import NavPlataforma from '@/components/NavPlataforma'
import { IconeLock } from '@/components/Icones'

export default function AssinaturaNecessaria({ nav, logado }: { nav: DadosNav; logado: boolean }) {
  return (
    <div className="pagina-assinatura-necessaria">
      <NavPlataforma dados={nav} />
      <main className="an2-main">
        <div className="an2-card">
          <span className="an2-ico" aria-hidden="true">
            <IconeLock size={32} strokeWidth={1.8} />
          </span>
          <h1>{logado ? 'Assinatura necessária' : 'Entre pra continuar'}</h1>
          <p>
            {logado
              ? 'Sua conta não tem uma assinatura ativa no momento. Regularize pra voltar a acessar esse conteúdo.'
              : 'Esse conteúdo é exclusivo pra assinantes. Faça login pra continuar.'}
          </p>
          <a className="an2-link" href={logado ? '/perfil' : '/login'}>
            {logado ? 'Ver minha assinatura' : 'Fazer login'}
          </a>
        </div>
      </main>
    </div>
  )
}

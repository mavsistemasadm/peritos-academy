// components/AssinaturaNecessaria.tsx
// Tela de conteúdo bloqueado. Além do aviso de acesso, mostra o que aquele
// conteúdo é e como desbloquear (copy em nexus_cta_bloqueio, ver
// lib/nexus/servidor.ts). É o momento mais honesto pra isso: o aluno já
// demonstrou interesse naquele conteúdo específico.
//
// Passou a ser relevante de verdade com o acesso por curso: um aluno migrado
// que comprou só um curso avulso bate aqui várias vezes navegando o catálogo,
// e a mensagem antiga ("regularize sua assinatura") estava errada pra ele, que
// nunca teve assinatura nenhuma pra regularizar.
import type { DadosNav } from '@/lib/queries/nav'
import NavPlataforma from '@/components/NavPlataforma'
import { IconeLock } from '@/components/Icones'
import { carregarBloqueioNexus } from '@/lib/nexus/servidor'

export default async function AssinaturaNecessaria({
  nav,
  logado,
  alvo,
}: {
  nav: DadosNav
  logado: boolean
  /** slug do curso (ou 'biblioteca') pra escolher a copy específica */
  alvo?: string | null
}) {
  const nexus = logado ? await carregarBloqueioNexus(alvo) : null

  return (
    <div className="pagina-assinatura-necessaria">
      <NavPlataforma dados={nav} />
      <main className="an2-main">
        <div className="an2-card">
          <span className="an2-ico" aria-hidden="true">
            <IconeLock size={32} strokeWidth={1.8} />
          </span>
          <h1>
            {!logado
              ? 'Entre pra continuar'
              : nexus
                ? 'Este conteúdo faz parte do ecossistema MH Nexus'
                : 'Conteúdo fora do seu acesso'}
          </h1>
          <p>
            {!logado
              ? 'Esse conteúdo é exclusivo pra assinantes. Faça login pra continuar.'
              : 'Seu acesso atual não inclui este conteúdo.'}
          </p>

          {nexus && (
            <div className="nx-bloqueio">
              <p className="nx-corpo">{nexus.corpo}</p>
              <a className="nx-link" href={nexus.link} target="_blank" rel="noopener noreferrer">
                Conhecer o MH Nexus
              </a>
            </div>
          )}

          <a className="an2-link" href={logado ? '/perfil' : '/login'}>
            {logado ? 'Ver meu acesso' : 'Fazer login'}
          </a>
        </div>
      </main>
    </div>
  )
}

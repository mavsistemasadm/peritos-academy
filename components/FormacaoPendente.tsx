// components/FormacaoPendente.tsx
//
// ⚠️ **NÃO É PAYWALL, E ESSA É A RAZÃO DE ELE EXISTIR.**
//
// Quem chega aqui JÁ TEM direito a este curso — assinou, ou recebeu a
// concessão. O que falta é a PROGRESSÃO: o selo de qualidade exige que a
// Formação Pericial de Alta Performance venha antes, e em ordem.
//
// Mandá-lo para `AssinaturaNecessaria` diria "seu acesso não inclui este
// conteúdo" a quem acabou de pagar. É a mesma armadilha que a turma fechada já
// ensinou neste repositório: recusar com a tela de assinatura é mentira quando
// assinar não é o que resolve.
//
// ⚠️ **A TELA DIZ O QUE FAZER, e não só o que não pode.** O nome do curso
// pendente e o link para ele são a peça inteira: sem eles a trava é recusa sem
// caminho, e recusa sem caminho vira chamado ou desistência. Com eles, ela lê
// como sequência — que é o que ela é.
//
// ⚠️ **E EXPLICA O PORQUÊ.** Uma regra sem motivo lê como capricho. O motivo é
// verdadeiro e vale ser dito: perícia bancária, trabalhista e previdenciária
// são aplicações de um mesmo raciocínio, e quem chega nelas sem a base decora
// fórmula — fórmula decorada não sobrevive ao primeiro caso que foge do
// exemplo.
import type { DadosNav } from '@/lib/queries/nav'
import NavPlataforma from '@/components/NavPlataforma'
import { IconeLock } from '@/components/Icones'

export default function FormacaoPendente({
  nav,
  pendente,
  curso,
}: {
  nav: DadosNav
  /** O curso que precisa ser concluído antes. Vem de `formacao_curso_pendente`. */
  pendente: { titulo: string; slug: string }
  /** O curso que a pessoa tentou abrir, para a frase ficar concreta. */
  curso?: string | null
}) {
  return (
    <div className="pagina-assinatura-necessaria">
      <NavPlataforma dados={nav} />
      <main className="an2-main">
        <div className="an2-card">
          <span className="an2-ico" aria-hidden="true">
            <IconeLock size={32} strokeWidth={1.8} />
          </span>

          <h1>Este curso abre depois da base</h1>

          <p>
            {curso ? <><strong>{curso}</strong> faz parte do seu acesso.</> : 'Este curso faz parte do seu acesso.'}
            {' '}Ele abre assim que você concluir{' '}
            <strong>{pendente.titulo}</strong>.
          </p>

          <div className="an2-resumo">
            <p className="an2-resumo-titulo">Por que existe essa ordem</p>
            <ul className="an2-resumo-lista">
              <li>
                Perícia bancária, trabalhista e previdenciária são aplicações de um mesmo raciocínio.
              </li>
              <li>
                Quem chega nelas sem a base decora fórmula — e fórmula decorada não sobrevive ao
                primeiro caso que foge do exemplo.
              </li>
              <li>
                Concluída a Formação Pericial, <strong>todos os territórios abrem de uma vez</strong> e
                você escolhe por onde seguir.
              </li>
            </ul>
          </div>

          {pendente.slug ? (
            <a className="an2-link" href={`/curso/${pendente.slug}`}>
              Continuar em {pendente.titulo}
            </a>
          ) : (
            <a className="an2-link" href="/trilhas">Ver minha rota</a>
          )}
        </div>
      </main>
    </div>
  )
}

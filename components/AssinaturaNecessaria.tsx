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
//
// ⚠️ **A tela diz o que a pessoa TEM, não só o que ela não tem** (14/08/2026).
// Desde que o comprador de curso avulso parou de alcançar Comunidade, Agenda e
// Desafios, ele bate aqui navegando normalmente — e "seu acesso atual não
// inclui este conteúdo", sozinho, é indistinguível de um acesso quebrado. Ele
// pagou por alguma coisa, e não achar essa coisa escrita em lugar nenhum é o
// que faz a pessoa abrir chamado, ou desistir achando que foi enganada. O
// resumo é a diferença entre "você não tem acesso" e "você tem ISTO, e o resto
// é o plano completo".
import type { DadosNav } from '@/lib/queries/nav'
import NavPlataforma from '@/components/NavPlataforma'
import { IconeLock } from '@/components/Icones'
import { carregarBloqueioNexus } from '@/lib/nexus/servidor'
import { carregarResumoAcesso } from '@/lib/acesso/verificar'

function formatarBR(iso: string | null): string {
  if (!iso) return ''
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

export default async function AssinaturaNecessaria({
  nav,
  logado,
  alvo,
  /** Nome da seção bloqueada, para a frase ficar concreta ("A Comunidade faz parte..."). */
  secao,
}: {
  nav: DadosNav
  logado: boolean
  /** slug do curso (ou 'biblioteca') pra escolher a copy específica */
  alvo?: string | null
  secao?: string
}) {
  const [nexus, resumo] = await Promise.all([
    logado ? carregarBloqueioNexus(alvo) : null,
    logado ? carregarResumoAcesso() : null,
  ])

  const temAlgumaCoisa = !!resumo && (resumo.cursos.length > 0 || resumo.biblioteca)

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
              : secao
                ? `${secao} faz parte do plano completo`
                : nexus
                  ? 'Este conteúdo faz parte do ecossistema MH Nexus'
                  : 'Conteúdo fora do seu acesso'}
          </h1>
          <p>
            {!logado
              ? 'Esse conteúdo é exclusivo pra assinantes. Faça login pra continuar.'
              : temAlgumaCoisa
                ? 'Seu acesso hoje não inclui esta parte da plataforma.'
                : 'Seu acesso atual não inclui este conteúdo.'}
          </p>

          {temAlgumaCoisa && resumo && (
            <div className="an2-resumo">
              <p className="an2-resumo-titulo">O que você tem hoje</p>
              <ul className="an2-resumo-lista">
                {resumo.cursos.map((c, i) => (
                  <li key={i}>
                    {c.titulo ?? 'Curso'}
                    {c.vitalicio ? ' · acesso vitalício' : c.expiraEm ? ` · até ${formatarBR(c.expiraEm)}` : ''}
                  </li>
                ))}
                {resumo.biblioteca && <li>Banco de planilhas</li>}
              </ul>
            </div>
          )}

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

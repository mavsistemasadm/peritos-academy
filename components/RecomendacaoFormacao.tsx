'use client'
// components/RecomendacaoFormacao.tsx
//
// ⚠️ **É UMA RECOMENDAÇÃO, NÃO UMA TRAVA — e isso é decisão de 29/09/2026.**
//
// Até aqui, quem tinha `perfis.exige_formacao_base` e abria um curso fora da
// ordem da Formação Pericial dava de cara com uma tela de bloqueio. O que se
// viu na prática: a trava não produzia base, produzia pressa. O primeiro aluno
// a chegar ao fim marcou 91 aulas numa tarde para alcançar o curso que tinha
// ido buscar, e pediu estorno logo depois de esbarrar na tela. Quem comprou
// pelo PASEP, ou já atua como perito, lia a trava como "não era o que eu
// comprei".
//
// Agora o curso abre sempre, e esta caixa diz a verdade: qual curso vem antes,
// por quê, e deixa a pessoa escolher. O incentivo para fazer a base na ordem é
// o Selo de Excelência, que continua exigindo a Formação completa.
//
// ⚠️ "Já domino" é lembrado por curso, no navegador. Não é estado que precise
// sobreviver a outro aparelho: no pior caso a pessoa lê a recomendação de novo.
import { useEffect, useState } from 'react'
import { IconeCompass } from '@/components/Icones'

const chave = (slug: string) => `rec-formacao:${slug}`

export default function RecomendacaoFormacao({
  cursoSlug,
  recomendado,
}: {
  cursoSlug: string
  /** O primeiro curso obrigatório da Formação que ainda falta. Vem de `formacao_curso_pendente`. */
  recomendado: { titulo: string; slug: string }
}) {
  // Nasce escondida e só aparece depois de ler o storage: renderizar visível no
  // servidor faria a caixa piscar e sumir para quem já a dispensou.
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    let dispensada = false
    try { dispensada = localStorage.getItem(chave(cursoSlug)) === '1' } catch {}
    setVisivel(!dispensada)
  }, [cursoSlug])

  function seguir() {
    try { localStorage.setItem(chave(cursoSlug), '1') } catch {}
    setVisivel(false)
  }

  if (!visivel) return null

  return (
    <aside className="rec-formacao" aria-label="Recomendação de ordem de estudo">
      <div className="rec-formacao-card">
        <span className="rec-formacao-ico" aria-hidden="true">
          <IconeCompass size={22} />
        </span>
        <div className="rec-formacao-corpo">
          <p className="rec-formacao-titulo">Recomendamos começar pela base</p>
          <p>
            Este curso é seu e já está aberto. Ele rende mais para quem passou por{' '}
            <strong>{recomendado.titulo}</strong>, o próximo passo da Formação Pericial de Alta
            Performance. Perícia bancária, trabalhista e previdenciária usam o mesmo raciocínio,
            e quem chega sem a base costuma decorar fórmula em vez de entender o cálculo.
          </p>
          <div className="rec-formacao-acoes">
            <a className="rec-formacao-btn primario" href={`/curso/${recomendado.slug}`}>
              Começar pela base
            </a>
            <button type="button" className="rec-formacao-btn" onClick={seguir}>
              Já domino, seguir neste curso
            </button>
          </div>
          <p className="rec-formacao-nota">
            Concluir a Formação na ordem é o que dá o Selo de Excelência no seu perfil.
          </p>
        </div>
      </div>
    </aside>
  )
}

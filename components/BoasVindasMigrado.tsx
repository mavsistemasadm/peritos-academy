// components/BoasVindasMigrado.tsx
// Mensagem de transição pro aluno que veio de outra plataforma (importação em
// lote). Aparece uma vez, no primeiro acesso, ANTES do tour guiado — o tour
// explica a plataforma; isto explica por que ele já está dentro dela.
'use client'

import { useEffect, useState } from 'react'
import { marcarBoasVindasMigrado } from '@/app/actions'
import { IconeCheck, IconeClose } from '@/components/Icones'

export default function BoasVindasMigrado({ plataforma }: { plataforma: string }) {
  const [aberto, setAberto] = useState(false)

  // pequeno atraso pra a home pintar primeiro — o cartão entra sobre a página
  // já montada, não junto com ela (mesmo espírito do TourGuiado)
  useEffect(() => {
    const t = setTimeout(() => setAberto(true), 600)
    return () => clearTimeout(t)
  }, [])

  function fechar() {
    setAberto(false)
    // best-effort: se a marcação falhar, o pior caso é a mensagem reaparecer
    void marcarBoasVindasMigrado()
  }

  useEffect(() => {
    if (!aberto) return
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar() }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [aberto])

  if (!aberto) return null

  return (
    <div className="bvm-fundo" role="dialog" aria-modal="true" aria-labelledby="bvm-titulo">
      <div className="bvm-cartao">
        <button className="bvm-fechar" onClick={fechar} aria-label="Fechar">
          <IconeClose size={18} />
        </button>

        <span className="bvm-eyebrow">Sua conta foi transferida</span>
        <h2 id="bvm-titulo">Você já está dentro.</h2>

        <p>
          Esta é a nova casa da Peritos Academy. Trouxemos sua conta da {plataforma} —
          você não precisa comprar nada de novo nem se cadastrar outra vez.
        </p>

        <ul className="bvm-lista">
          <li><IconeCheck size={16} /> Seus cursos já estão liberados</li>
          <li><IconeCheck size={16} /> Seu acesso vale pelo mesmo prazo de antes</li>
          <li><IconeCheck size={16} /> Certificados, trilhas e comunidade são novidade — explore</li>
        </ul>

        <p className="bvm-nota">
          Seu progresso de aulas começa do zero aqui: a plataforma é nova e o
          histórico de visualização não vem junto. O acesso ao conteúdo, sim.
        </p>

        <button className="btn btn-primario bvm-cta" onClick={fechar}>
          Começar
        </button>
      </div>
    </div>
  )
}

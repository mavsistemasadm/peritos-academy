// components/AdminConfirmacao.tsx
// Confirmação centralizada para a ação que MUDA DE PÁGINA depois.
//
// O toast do canto (`AdminToast`) resolve o salvamento que deixa a pessoa onde
// está: ela vê o campo que acabou de editar, e o toast é só o carimbo. Quando a
// tela vai embora logo em seguida, o toast some junto com ela — o operador
// clica em "Salvar", a página troca, e nada confirma que salvou. Sobrou dúvida,
// e a dúvida faz voltar e salvar de novo.
//
// Por isso esta peça ocupa o centro e segura a saída por um instante: ela é a
// resposta ao clique, e não um aviso paralelo a ele.
'use client'

import { useEffect } from 'react'
import { IconeCheck } from '@/components/Icones'

export default function AdminConfirmacao({
  titulo, detalhe, rotuloAcao, aoConcluir, esperaMs = 1300,
}: {
  titulo: string
  /** Uma linha dizendo o que aconteceu com o quê. Opcional. */
  detalhe?: string
  /** O que vai acontecer a seguir, escrito no botão: "Ver a agenda". */
  rotuloAcao: string
  aoConcluir: () => void
  esperaMs?: number
}) {
  // A saída é automática, e o botão está lá para quem não quer esperar. Deixar
  // só o botão transformaria todo salvamento num clique a mais; deixar só o
  // relógio prenderia quem lê rápido.
  useEffect(() => {
    const t = setTimeout(aoConcluir, esperaMs)
    return () => clearTimeout(t)
  }, [aoConcluir, esperaMs])

  // ESC também sai: a peça é um aviso, não uma pergunta, e nada se perde
  // fechando antes da hora.
  useEffect(() => {
    const ao = (e: KeyboardEvent) => { if (e.key === 'Escape') aoConcluir() }
    window.addEventListener('keydown', ao)
    return () => window.removeEventListener('keydown', ao)
  }, [aoConcluir])

  return (
    <div className="pnl-confirma" role="status" aria-live="polite" onClick={aoConcluir}>
      <div className="pnl-confirma-caixa" onClick={e => e.stopPropagation()}>
        <span className="pnl-confirma-selo"><IconeCheck size={26} /></span>
        <strong>{titulo}</strong>
        {detalhe && <p>{detalhe}</p>}
        <button type="button" className="pnl-btn-primario" onClick={aoConcluir}>{rotuloAcao}</button>
      </div>
    </div>
  )
}

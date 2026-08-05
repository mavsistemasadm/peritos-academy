// components/NexusSugestao.tsx
// Sugestão contextual do MH Nexus. Um componente, quatro roupas visuais
// (linha na aula, toast, grade do perfil, item do sino) — a decisão de QUAL
// sugestão aparece é toda do servidor (lib/nexus/servidor.ts); aqui só cuida
// de renderizar, do X e de não repetir na mesma sessão.
//
// Princípios que este componente materializa:
//  - tudo pode ser fechado (todo variante tem X);
//  - ambiente de estudo, não vitrine (visual neutro, tipografia menor);
//  - no máximo 1x por sessão por placement (sessionStorage);
//  - se não houver sugestão, não renderiza NADA (nem espaço em branco).
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { buscarSugestaoNexus, registrarNexus } from '@/app/nexus/actions'
import { NOME_APP, type PlacementNexus, type SugestaoNexus } from '@/lib/nexus'
import { IconeClose, IconeSparkle } from '@/components/Icones'

type Variante = 'linha' | 'toast' | 'perfil'

export default function NexusSugestao({
  placement,
  contexto,
  variante,
  atrasoMs = 0,
  autoFecharMs,
  onFechar,
}: {
  placement: PlacementNexus
  contexto?: string | null
  variante: Variante
  /** espera antes de aparecer (usado no toast pós-conquista) */
  atrasoMs?: number
  /** desaparece sozinho depois de N ms (usado no toast) */
  autoFecharMs?: number
  onFechar?: () => void
}) {
  const [sug, setSug] = useState<SugestaoNexus | null>(null)
  const [visivel, setVisivel] = useState(false)
  const jaRegistrou = useRef(false)

  const chaveSessao = `nexus-visto-${placement}`

  useEffect(() => {
    let cancelado = false
    // 1x por sessão por placement. `bloqueio` não usa este componente (é uma
    // tela inteira, não uma sugestão rotativa), então não há exceção aqui.
    if (sessionStorage.getItem(chaveSessao)) return

    const timer = setTimeout(async () => {
      const encontrada = await buscarSugestaoNexus(placement, contexto ?? null)
      if (cancelado || !encontrada) return
      // marca a sessão só quando de fato vai renderizar
      sessionStorage.setItem(chaveSessao, encontrada.chave)
      setSug(encontrada)
      setVisivel(true)
    }, atrasoMs)

    return () => { cancelado = true; clearTimeout(timer) }
  }, [placement, contexto, atrasoMs, chaveSessao])

  // registra a exibição só quando o elemento realmente entra na tela
  useEffect(() => {
    if (!sug || !visivel || jaRegistrou.current) return
    jaRegistrou.current = true
    void registrarNexus('exibida', sug.app, sug.chave, placement, contexto ?? null)
  }, [sug, visivel, placement, contexto])

  const fechar = useCallback(
    (motivo: 'dispensada' | 'auto') => {
      if (sug && motivo === 'dispensada') {
        void registrarNexus('dispensada', sug.app, sug.chave, placement, contexto ?? null)
      }
      setVisivel(false)
      onFechar?.()
    },
    [sug, placement, contexto, onFechar]
  )

  // auto-fechamento do toast
  useEffect(() => {
    if (!visivel || !autoFecharMs) return
    const t = setTimeout(() => fechar('auto'), autoFecharMs)
    return () => clearTimeout(t)
  }, [visivel, autoFecharMs, fechar])

  if (!sug || !visivel) return null

  function clicar() {
    void registrarNexus('clicada', sug!.app, sug!.chave, placement, contexto ?? null)
  }

  const nome = NOME_APP[sug.app]

  // ---------------------------------------------------------------- linha
  // Usada na página de aula: uma faixa discreta, integrada ao conteúdo.
  if (variante === 'linha') {
    return (
      <aside className="nx-linha" aria-label={`Sugestão: ${nome}`}>
        <span className="nx-ico" aria-hidden="true"><IconeSparkle size={16} /></span>
        <div className="nx-txt">
          <p className="nx-corpo">{sug.corpo}</p>
          <a
            className="nx-link"
            href={sug.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={clicar}
          >
            Conhecer o {nome}
          </a>
        </div>
        <button className="nx-x" onClick={() => fechar('dispensada')} aria-label="Fechar sugestão">
          <IconeClose size={14} />
        </button>
      </aside>
    )
  }

  // ---------------------------------------------------------------- toast
  // Secundário, entra depois da celebração da conquista e sai sozinho.
  if (variante === 'toast') {
    return (
      <div className="nx-toast" role="status">
        <span className="nx-ico" aria-hidden="true"><IconeSparkle size={16} /></span>
        <div className="nx-txt">
          <strong className="nx-titulo">{sug.titulo}</strong>
          <a
            className="nx-link"
            href={sug.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={clicar}
          >
            Ver o {nome}
          </a>
        </div>
        <button className="nx-x" onClick={() => fechar('dispensada')} aria-label="Fechar">
          <IconeClose size={14} />
        </button>
      </div>
    )
  }

  // ---------------------------------------------------------------- perfil
  // Seção "Ferramentas do ecossistema", abaixo dos dados de plano.
  return (
    <section className="nx-perfil" aria-label="Ferramentas do ecossistema">
      <header className="nx-perfil-topo">
        <h3>Ferramentas do ecossistema</h3>
        <button className="nx-x" onClick={() => fechar('dispensada')} aria-label="Ocultar seção">
          <IconeClose size={14} />
        </button>
      </header>
      <div className="nx-perfil-card">
        <span className="nx-perfil-app">{nome}</span>
        <p className="nx-corpo">{sug.corpo}</p>
        <a
          className="nx-link"
          href={sug.link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={clicar}
        >
          Conhecer o {nome}
        </a>
      </div>
    </section>
  )
}

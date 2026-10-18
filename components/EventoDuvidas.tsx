'use client'

// ══════════════════════════════════════════════════════════════════
// components/EventoDuvidas.tsx — "MANDE SUA DÚVIDA" NA PÁGINA DO EVENTO
//
// Só aparece em live de tira-dúvidas (`ev.recebeDuvidas`), até o fim da
// transmissão. É para cá que apontam o convite por email e por WhatsApp
// (`/evento/{slug}#duvida`), por isso a seção tem âncora e rola sozinha.
//
// O anexo sobe DIRETO do navegador para o Storage (URL assinada), nunca pela
// server action: ver o cabeçalho de app/evento/[slug]/duvidas.ts.
// ══════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, useTransition } from 'react'
import { enviarDuvida, prepararAnexoDuvida } from '@/app/evento/[slug]/duvidas'
import { enviarParaSignedUrl } from '@/lib/storage/enviarDireto'
import { IconeCheck, IconePaperclip } from '@/components/Icones'

const MAX_BYTES = 20 * 1024 * 1024
const ACEITA = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt'

const tamanho = (b: number) => b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`

export default function EventoDuvidas({ eventoId, logado, abertoAoPublico, urlLogin }: {
  eventoId: string
  logado: boolean
  abertoAoPublico: boolean
  urlLogin: string
}) {
  const [texto, setTexto] = useState('')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [erro, setErro] = useState('')
  const [etapa, setEtapa] = useState<string | null>(null)
  const [enviadas, setEnviadas] = useState(0)
  const [pendente, start] = useTransition()
  const secao = useRef<HTMLElement>(null)
  const input = useRef<HTMLInputElement>(null)

  // Chegou pelo link do convite (#duvida): leva direto ao formulário.
  useEffect(() => {
    if (window.location.hash === '#duvida') {
      setTimeout(() => secao.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300)
    }
  }, [])

  const precisaDeConta = !logado && !abertoAoPublico

  function escolher(f: File | null) {
    setErro('')
    if (f && f.size > MAX_BYTES) { setErro('O arquivo passa de 20 MB. Mande uma versão menor ou um print do trecho.'); return }
    setArquivo(f)
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    start(async () => {
      let anexo: { path: string; nome: string; tipo: string; bytes: number } | null = null
      if (arquivo) {
        setEtapa('Preparando o arquivo…')
        const tipo = arquivo.type || 'application/octet-stream'
        const p = await prepararAnexoDuvida(eventoId, { nome: arquivo.name, tipo, bytes: arquivo.size })
        if (!p.ok) { setErro(p.erro); setEtapa(null); return }
        setEtapa(`Enviando o arquivo (${tamanho(arquivo.size)})…`)
        const up = await enviarParaSignedUrl('evento-duvidas', p.path, p.token, arquivo)
        if (!up.ok) { setErro(up.erro); setEtapa(null); return }
        anexo = { path: p.path, nome: arquivo.name, tipo, bytes: arquivo.size }
      }
      setEtapa('Enviando a dúvida…')
      const r = await enviarDuvida({ eventoId, texto, nome, email, anexo })
      setEtapa(null)
      if (!r.ok) { setErro(r.erro); return }
      setEnviadas(n => n + 1)
      setTexto('')
      setArquivo(null)
      if (input.current) input.current.value = ''
    })
  }

  return (
    <section id="duvida" ref={secao} className="ev-duvidas">
      <span className="ev-duvidas-eyebrow">Live de tira-dúvidas</span>
      <h2>Mande a sua dúvida <span className="grad-txt">antes da live.</span></h2>
      <p className="ev-duvidas-sub">
        Escreva com calma o que você quer perguntar. Se ajudar, anexe o documento, a planilha ou um print
        (até 20 MB). Eu leio antes e respondo ao vivo.
      </p>

      {precisaDeConta ? (
        <a className="btn btn-primario" href={urlLogin}>Entrar para mandar a dúvida</a>
      ) : (
        <>
          {enviadas > 0 && (
            <p className="ev-duvidas-ok" role="status">
              <IconeCheck size={15} strokeWidth={2.6} />
              <span>
                <b>{enviadas === 1 ? 'Recebi a sua dúvida.' : `Recebi as suas ${enviadas} dúvidas.`}</b>{' '}
                Ela entra na pauta da live. Tem outra? Pode mandar aqui embaixo.
              </span>
            </p>
          )}

          <form className="ev-duvidas-forma" onSubmit={enviar}>
            {!logado && (
              <div className="ev-duvidas-dupla">
                <label className="ev-campo">
                  <span>Seu nome</span>
                  <input value={nome} onChange={e => setNome(e.target.value)} required autoComplete="name" placeholder="Como você quer ser chamado" />
                </label>
                <label className="ev-campo">
                  <span>Seu email</span>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" placeholder="voce@email.com" />
                </label>
              </div>
            )}

            <label className="ev-campo">
              <span>Sua dúvida</span>
              <textarea
                value={texto}
                onChange={e => setTexto(e.target.value)}
                required minLength={3} maxLength={4000} rows={5}
                placeholder="Ex.: No laudo de revisão de contrato bancário, como eu trato a capitalização quando o contrato não fala em taxa anual?"
              />
            </label>

            <div className="ev-duvidas-anexo">
              <input ref={input} id="ev-duvida-arquivo" type="file" accept={ACEITA} onChange={e => escolher(e.target.files?.[0] ?? null)} />
              <label htmlFor="ev-duvida-arquivo" className="btn btn-fantasma">
                <IconePaperclip size={14} strokeWidth={2} /> {arquivo ? 'Trocar arquivo' : 'Anexar arquivo'}
              </label>
              {arquivo
                ? <span className="ev-duvidas-arq">{arquivo.name} · {tamanho(arquivo.size)}
                    <button type="button" onClick={() => { setArquivo(null); if (input.current) input.current.value = '' }}>remover</button>
                  </span>
                : <small>Opcional. Imagem, PDF, Word, Excel ou texto, até 20 MB.</small>}
            </div>

            {erro && <p className="ev-erro" role="alert">{erro}</p>}
            <button type="submit" className="btn btn-primario" disabled={pendente}>
              {pendente ? (etapa ?? 'Enviando…') : enviadas > 0 ? 'Mandar outra dúvida' : 'Mandar minha dúvida'}
            </button>
            <p className="ev-forma-rodape">Só quem conduz a live vê a sua dúvida e o arquivo.</p>
          </form>
        </>
      )}
    </section>
  )
}

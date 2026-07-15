// components/DesafioContent.tsx
'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import {
  aceitarDesafio, protocolarLaudo, salvarRespostas,
  baixarDocumento, baixarGabarito, curtirEntrega, explicarQuesito,
  uploadPlanilha,
} from '@/app/desafios/actions'
import NavPlataforma from '@/components/NavPlataforma'
import type { DadosNav } from '@/lib/queries/nav'
import type { DadosDesafio, EntregaGaleria } from '@/lib/queries/desafio'
import {
  IconeClipboard, IconeChevronLeft, IconeChevronRight, IconeCheck, IconeClose,
  IconeUsers, IconeClock, IconeHourglass, IconeDownload, IconePaperclip, IconeUpload,
  IconeSave, IconeBot, IconeAlertTriangle, IconeBookOpen, IconeHeart,
} from '@/components/Icones'
import { XP, Moeda } from '@/components/Emblemas'

const fmtNum = (n: number) => n.toLocaleString('pt-BR')

function tamanhoBonito(kb: number) {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1).replace('.', ',')} MB` : `${kb} KB`
}

function tempoGasto(seg: number) {
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  if (h > 0) return `${h}h ${m}min`
  return `${m} minutos`
}

function mascaraValor(raw: string): string {
  const soDigitos = raw.replace(/\D/g, '')
  if (!soDigitos) return ''
  const centavos = parseInt(soDigitos, 10)
  return (centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type Cena = 'intimacao' | 'autos' | 'perguntas' | 'veredito' | 'galeria'

function Contagem({ seg, onExpirou }: { seg: number; onExpirou: () => void }) {
  const [restante, setRestante] = useState(seg)
  useEffect(() => {
    if (restante <= 0) { onExpirou(); return }
    const id = setInterval(() => setRestante(r => {
      if (r <= 1) { onExpirou(); clearInterval(id); return 0 }
      return r - 1
    }), 1000)
    return () => clearInterval(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const d = Math.floor(restante / 86400)
  const h = Math.floor((restante % 86400) / 3600)
  const m = Math.floor((restante % 3600) / 60)
  const s = restante % 60
  return (
    <div className={`dsc-contagem num${restante < 3600 ? ' urgente' : ''}`}>
      {d > 0 && <div className="dsc-cb"><span className="v">{d}</span><span className="r">dias</span></div>}
      <div className="dsc-cb"><span className="v">{String(h).padStart(2, '0')}</span><span className="r">horas</span></div>
      <div className="dsc-cb"><span className="v">{String(m).padStart(2, '0')}</span><span className="r">min</span></div>
      <div className="dsc-cb"><span className="v">{String(s).padStart(2, '0')}</span><span className="r">seg</span></div>
    </div>
  )
}

function IntimacaoAnimada({ ds, onAceitar }: { ds: DadosDesafio['desafio']; onAceitar: () => void }) {
  const [fase, setFase] = useState(0)
  useEffect(() => {
    const t = [
      setTimeout(() => setFase(1), 300), setTimeout(() => setFase(2), 1200),
      setTimeout(() => setFase(3), 2000), setTimeout(() => setFase(4), 3800),
      setTimeout(() => setFase(5), 4600), setTimeout(() => setFase(6), 5200),
    ]
    return () => t.forEach(clearTimeout)
  }, [])
  return (
    <section className="dsc-cena dsc-intimacao">
      <div className="wrap">
        <div className={`dsc-intim-card anim-entrada${fase >= 1 ? ' visivel' : ''}`}>
          <div className="dsc-intim-selo"><IconeClipboard size={13} /> INTIMAÇÃO</div>
          <p className="dsc-intim-texto">{ds.intimacao_texto}</p>
        </div>
        <div className={`dsc-whats anim-sobe${fase >= 2 ? ' visivel' : ''}`}>
          <div className="dsc-whats-cab">
            <IconeChevronLeft size={14} strokeWidth={2} />
            <span className="dsc-whats-foto" aria-hidden="true">{ds.mensageiro_nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}</span>
            <div className="dsc-whats-quem"><b>{ds.mensageiro_nome}</b><span>{ds.mensageiro_cargo}</span></div>
          </div>
          <div className="dsc-whats-corpo">
            {fase >= 3 && fase < 4 && <div className="dsc-whats-digitando"><span></span><span></span><span></span></div>}
            <div className={`dsc-whats-balao anim-balao${fase >= 4 ? ' visivel' : ''}`}>{ds.mensagem_texto}</div>
          </div>
        </div>
        <div className={`dsc-intim-recomp num anim-fade${fase >= 5 ? ' visivel' : ''}`}>
          <div className="dsc-rw"><span className="dsc-rw-ico"><XP size={16} /></span><b>{fmtNum(ds.xp)} XP</b><span>ao protocolar</span></div>
          <div className="dsc-rw"><span className="dsc-rw-ico"><Moeda size={16} /></span><b>{fmtNum(ds.moedas)} moedas</b><span>ao aprovar</span></div>
          <div className="dsc-rw"><span className="dsc-rw-ico"><IconeClock size={16} /></span><b>{ds.prazo_dias} {ds.prazo_dias === 1 ? 'dia' : 'dias'}</b><span>de prazo</span></div>
          <div className="dsc-rw"><span className="dsc-rw-ico"><IconeUsers size={16} /></span><b>{fmtNum(ds.participantes)}</b><span>participantes</span></div>
        </div>
        <div className={`anim-fade${fase >= 6 ? ' visivel' : ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--s-3)' }}>
          <button className="dsc-btn-aceitar" onClick={onAceitar}>
            <IconeCheck size={14} strokeWidth={2.6} />
            Aceitar a nomeação
          </button>
          <p className="dsc-nota-prazo">Ao aceitar, o prazo de {ds.prazo_dias} dias começa a correr. Você pode sair e voltar, o relógio continua.</p>
        </div>
      </div>
    </section>
  )
}

export default function DesafioContent({ dados, nav }: { dados: DadosDesafio; nav: DadosNav }) {
  const ds = dados.desafio
  const jaAceitou = !!dados.aceito_em
  const jaEntregou = !!dados.entregue_em

  const [cena, setCena] = useState<Cena>(jaEntregou ? 'veredito' : jaAceitou ? 'autos' : 'intimacao')
  const [respostas, setRespostas] = useState<Record<string, string>>(dados.respostas_salvas ?? {})
  const [feedbacks, setFeedbacks] = useState(dados.feedbacks)
  const [nota, setNota] = useState(dados.nota)
  const [xpGanho, setXpGanho] = useState(0)
  const [moedasGanho, setMoedasGanho] = useState(0)
  const [baixando, setBaixando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [prazoExpirado, setPrazoExpirado] = useState(dados.prazoExpirado)
  const [entregas, setEntregas] = useState<EntregaGaleria[]>(dados.entregas)
  const [, startTransition] = useTransition()
  const [salvando, setSalvando] = useState(false)
  const [protocolando, setProtocolando] = useState(false)
  const [atual, setAtual] = useState(0)
  const [saindo, setSaindo] = useState(false)
  const notaRef = useRef<HTMLSpanElement>(null)
  const [explicacoes, setExplicacoes] = useState<Record<number, string>>({})
  const [explicando, setExplicando] = useState<number | null>(null)
  const [arquivoNome, setArquivoNome] = useState<string | null>(null)
  const [arquivoPath, setArquivoPath] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const nQ = ds.quesitos_total
  const q = ds.quesitos[atual]
  const respondidas = ds.quesitos.filter(qq => (respostas[String(qq.ordem)] ?? '').trim()).length
  const todasRespondidas = respondidas === nQ
  const prontoProtocolar = todasRespondidas && !!arquivoPath
  const respostaAtual = (respostas[String(q?.ordem)] ?? '').trim()
  const atualRespondida = !!respostaAtual
  const ultima = atual === nQ - 1
const aprovado = nota !== null && nota >= ds.nota_minima

  function irPara(idx: number) { setSaindo(true); setTimeout(() => { setAtual(idx); setSaindo(false) }, 250) }

  async function pedirExplicacao(quesitoOrdem: number) {
    setExplicando(quesitoOrdem)
    const r = await explicarQuesito(ds.id, quesitoOrdem, respostas[String(quesitoOrdem)] ?? '')
    setExplicando(null)
    if (r.ok) {
      const limpo = r.explicacao.replace(/#{1,6}\s?/g, '').replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1').replace(/^[-–—]\s/gm, '').replace(/---/g, '').trim()
      setExplicacoes(prev => ({ ...prev, [quesitoOrdem]: limpo }))
    }
  }

  async function enviarArquivo(file: File) {
    setUploading(true); setErro(null)
    const fd = new FormData(); fd.append('arquivo', file)
    const r = await uploadPlanilha(ds.id, fd)
    setUploading(false)
    if (r.ok) { setArquivoNome(r.nome); setArquivoPath(r.path) }
    else setErro(r.erro ?? 'Erro no upload.')
  }

  useEffect(() => {
    if (cena !== 'veredito' || nota === null || !notaRef.current) return
    const el = notaRef.current; const alvo = nota; const t0 = performance.now() + 500; let raf = 0
    const passo = (t: number) => { const p = Math.min(Math.max(t - t0, 0) / 1200, 1); el.textContent = (alvo * (1 - Math.pow(1 - p, 3))).toFixed(1).replace('.', ','); if (p < 1) raf = requestAnimationFrame(passo) }
    raf = requestAnimationFrame(passo); return () => cancelAnimationFrame(raf)
  }, [cena, nota])

  useEffect(() => {
    if (cena !== 'perguntas' || !q) return
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') { if (e.key === 'Enter' && !e.shiftKey && atualRespondida) { e.preventDefault(); if (!ultima) irPara(atual + 1) }; return }
      if (e.key === 'ArrowLeft' && atual > 0) irPara(atual - 1)
      if (e.key === 'ArrowRight' && atual < nQ - 1 && atualRespondida) irPara(atual + 1)
      if (q.tipo === 'multipla' && q.opcoes && ['a','b','c','d','e'].includes(e.key.toLowerCase())) {
        const idx = e.key.toLowerCase().charCodeAt(0) - 97; const op = q.opcoes[idx]
        if (op) setRespostas(r => ({ ...r, [String(q.ordem)]: op }))
      }
    }
    addEventListener('keydown', onKey); return () => removeEventListener('keydown', onKey)
  }, [cena, q, atual, nQ, ultima, atualRespondida])

  async function aceitar() { setErro(null); const r = await aceitarDesafio(ds.id); if (r.ok) setCena('autos'); else setErro(r.erro ?? 'Erro ao aceitar.') }
  async function salvar() { setSalvando(true); await salvarRespostas(ds.id, Object.entries(respostas).map(([k, v]) => ({ quesito_ordem: Number(k), resposta: v }))); setSalvando(false) }
  async function protocolar() {
    if (!prontoProtocolar || protocolando) return
    setProtocolando(true); setErro(null)
    const r = await protocolarLaudo(ds.id, Object.entries(respostas).map(([k, v]) => ({ quesito_ordem: Number(k), resposta: v })))
    setProtocolando(false)
    if (!r.ok) { setErro(r.erro ?? 'Erro ao protocolar.'); return }
    setNota(r.nota); setFeedbacks(r.feedbacks); setXpGanho(r.xp); setMoedasGanho(r.moedas); setCena('veredito')
  }
  async function baixarDoc(path: string) { setBaixando(path); const r = await baixarDocumento(path); setBaixando(null); if (r.ok) { const a = document.createElement('a'); a.href = r.url; a.download = ''; document.body.appendChild(a); a.click(); a.remove() } else setErro(r.erro ?? 'Erro ao baixar.') }
  async function baixarGab() { setBaixando('gabarito'); const r = await baixarGabarito(ds.id); setBaixando(null); if (r.ok) { const a = document.createElement('a'); a.href = r.url; a.download = ''; document.body.appendChild(a); a.click(); a.remove() } else setErro(r.erro ?? 'Erro ao baixar gabarito.') }
  function curtir(entregaId: string) { setEntregas(es => es.map(e => e.id === entregaId ? { ...e, jaCurtiu: !e.jaCurtiu, curtidas: e.curtidas + (e.jaCurtiu ? -1 : 1) } : e)); startTransition(async () => { await curtirEntrega(entregaId) }) }

  return (
    <div className="pagina-desafio">
      <div className="grao" aria-hidden="true"></div>
      <NavPlataforma dados={nav} />
      <div className="dsc-barra-topo">
        <div className="dsc-barra-inner">
          <a className="dsc-voltar" href="/desafios"><IconeChevronLeft size={13} strokeWidth={2.4} /> Desafios</a>
          <span className="dsc-id num">Desafio <b>#{ds.numero}</b> · {ds.categoria_nome}</span>
          {(cena === 'autos' || cena === 'perguntas') && !prazoExpirado && dados.tempoRestanteSeg !== null && <Contagem seg={dados.tempoRestanteSeg} onExpirou={() => setPrazoExpirado(true)} />}
          {(cena === 'autos' || cena === 'perguntas') && prazoExpirado && <span className="dsc-expirado"><IconeHourglass size={13} /> Prazo expirado</span>}
        </div>
        <div className="dsc-progresso"><i style={{ width: `${(respondidas / nQ) * 100}%` }}></i></div>
      </div>
      {erro && <div className="wrap"><p className="dsc-erro" role="alert">{erro}</p></div>}

      {cena === 'intimacao' && <IntimacaoAnimada ds={ds} onAceitar={aceitar} />}

      {cena === 'autos' && (
        <section className="dsc-cena dsc-autos"><div className="wrap"><div className="dsc-autos-grid">
          <div className="dsc-principal">
            <div className="dsc-instrucoes">
              <span className="eyebrow">Instruções do perito-assistente</span>
              <h2>Sobre este desafio.</h2>
              {ds.instrucoes.map((p, i) => <p key={i}>{p}</p>)}
            </div>
            <button className="dsc-btn-comecar" onClick={() => setCena('perguntas')}>Começar as perguntas <IconeChevronRight size={14} strokeWidth={2.4} /></button>
          </div>
          <aside className="dsc-lateral">
            <div className="dsc-docs">
              <span className="eyebrow">Documentos do processo</span><h3>Autos.</h3>
              {ds.documentos.map((doc, i) => (
                <button className="dsc-doc" key={i} onClick={() => baixarDoc(doc.path)} disabled={baixando === doc.path}>
                  <span className="dsc-doc-ico" aria-hidden="true">{doc.formato.toUpperCase()}</span>
                  <span className="dsc-doc-txt"><b>{doc.nome}</b><span className="num">.{doc.formato} · {tamanhoBonito(doc.tamanho_kb)}</span></span>
                  <span className="dsc-doc-dl">{baixando === doc.path ? '…' : <IconeDownload size={12} />}</span>
                </button>
              ))}
            </div>
            <div className="dsc-resumo num">
              <div><span>Perguntas</span><b>{nQ}</b></div>
              <div><span>Prazo</span><b>{ds.prazo_dias} dias</b></div>
              <div><span>Recompensa</span><b><XP size={13} />{fmtNum(ds.xp)} + <Moeda size={13} />{fmtNum(ds.moedas)}</b></div>
            </div>
          </aside>
        </div></div></section>
      )}

      {cena === 'perguntas' && q && (
        <section className="dsc-cena dsc-perguntas"><div className="wrap"><div className="dsc-perg-layout">
          <div className={`dsc-perg-card${saindo ? ' saindo' : ''}`} key={q.ordem}>
            <div className="dsc-perg-cab">
              <span className="eyebrow num">Pergunta <b>{String(atual + 1).padStart(2, '0')}</b> de {String(nQ).padStart(2, '0')}</span>
              <h2>{q.enunciado}</h2>
            </div>
            {q.tipo === 'multipla' && q.opcoes ? (
              <ul className="dsc-perg-opcoes">{q.opcoes.map((op, i) => {
                const sel = respostas[String(q.ordem)] === op
                return <li key={i}><button className={`dsc-perg-op${sel ? ' sel' : ''}`} onClick={() => setRespostas(r => ({ ...r, [String(q.ordem)]: op }))}><span className="dsc-perg-op-letra num">{String.fromCharCode(65 + i)}</span><span>{op}</span></button></li>
              })}</ul>
            ) : q.tipo === 'texto' ? (
              <textarea className="dsc-perg-textarea" placeholder="Sua resposta técnica…" value={respostas[String(q.ordem)] ?? ''} onChange={e => setRespostas(r => ({ ...r, [String(q.ordem)]: e.target.value }))} rows={4} autoFocus />
            ) : (
              <div className="dsc-perg-valor">
                {q.prefixo && <span className="dsc-perg-fixo num">{q.prefixo}</span>}
                <input type="text" inputMode="decimal" placeholder="0,00" value={respostas[String(q.ordem)] ?? ''} onChange={e => setRespostas(r => ({ ...r, [String(q.ordem)]: mascaraValor(e.target.value) }))} autoFocus />
                {q.sufixo && <span className="dsc-perg-fixo num">{q.sufixo}</span>}
              </div>
            )}
            <div className="dsc-perg-nav">
              <button className="dsc-perg-btn-sec" style={{ visibility: atual === 0 ? 'hidden' : 'visible' }} onClick={() => irPara(atual - 1)}><IconeChevronLeft size={13} /> Anterior</button>
              {!ultima ? (
                <button className="dsc-perg-btn-pri" disabled={!atualRespondida} onClick={() => irPara(atual + 1)}>Próxima <IconeChevronRight size={13} /></button>
              ) : (
                <div className="dsc-perg-final">
                  <div className={`dsc-upload${arquivoPath ? ' enviado' : ''}`}>
                    {arquivoPath ? (
                      <div className="dsc-upload-ok"><span><IconePaperclip size={16} /></span><div><b>{arquivoNome}</b><button className="dsc-upload-trocar" onClick={() => { setArquivoPath(null); setArquivoNome(null) }}>Trocar arquivo</button></div></div>
                    ) : (
                      <label className="dsc-upload-label">
                        <input type="file" accept=".xls,.xlsx,.xlsm,.pdf,.docx" hidden onChange={e => { const f = e.target.files?.[0]; if (f) enviarArquivo(f) }} />
                        <span className="dsc-upload-ico">{uploading ? <IconeHourglass size={18} /> : <IconeUpload size={18} />}</span>
                        <div><b>{uploading ? 'Enviando planilha…' : 'Enviar sua planilha'}</b><span>.xlsx, .xls, .xlsm, .pdf ou .docx · máx 10 MB</span></div>
                      </label>
                    )}
                  </div>
                  <button className="dsc-perg-btn-protocolar" disabled={!prontoProtocolar || protocolando || prazoExpirado} onClick={protocolar}>
                    {protocolando ? 'Protocolando laudo…' : !todasRespondidas ? `Faltam ${nQ - respondidas}` : !arquivoPath ? 'Envie a planilha para protocolar' : <>Protocolar laudo <IconeCheck size={13} /></>}
                  </button>
                </div>
              )}
            </div>
            <p className="dsc-perg-dica">{q.tipo === 'multipla' ? <>Use <kbd>A</kbd>-<kbd>D</kbd> e <kbd>Enter</kbd></> : q.tipo === 'texto' ? <>Shift+Enter pra nova linha · Enter pra avançar</> : <>Enter pra avançar · ← → pra navegar</>}</p>
          </div>
          <div className="dsc-perg-pontos">{ds.quesitos.map((qq, i) => <button key={qq.ordem} className={`dsc-ponto${i === atual ? ' aqui' : ''}${(respostas[String(qq.ordem)] ?? '').trim() ? ' resp' : ''}`} onClick={() => irPara(i)} aria-label={`Ir para pergunta ${i + 1}`} />)}</div>
          <button className="dsc-perg-salvar" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : <><IconeSave size={13} /> Salvar rascunho</>}</button>
        </div></div></section>
      )}

      {cena === 'veredito' && (
        <section className="dsc-cena dsc-veredito"><div className="wrap">
          <div className={`dsc-selo-veredito${aprovado ? '' : ' reprovado'}`}>{aprovado ? 'Laudo homologado' : 'Diligências complementares'}</div>
          <div className="dsc-nota-grande grad-txt num"><span ref={notaRef}>0,0</span></div>
          <p className="dsc-veredito-sub">{aprovado ? 'Parecer sólido: ' : 'O caso continua: '}<b className="num">{feedbacks?.filter(f => f.nota >= 6).length ?? 0} de {nQ}</b> perguntas aprovadas.</p>
          {(xpGanho > 0 || moedasGanho > 0) && (
            <div className="dsc-ganhos num">
              {xpGanho > 0 && <span className="dsc-ganho"><XP size={14} /> +{fmtNum(xpGanho)} XP creditados</span>}
              {moedasGanho > 0 && <span className="dsc-ganho"><Moeda size={14} /> +{fmtNum(moedasGanho)} moedas</span>}
            </div>
          )}
          {feedbacks && feedbacks.length > 0 && (
            <div className="dsc-feedbacks"><h3>Correção por pergunta</h3>
              {feedbacks.map(f => {
                const qq = ds.quesitos.find(x => x.ordem === f.quesito_ordem)
                const acertou = f.nota >= 6
                return (
                  <div className={`dsc-fb${acertou ? ' ok' : ' erro'}`} key={f.quesito_ordem}>
                    <div className="dsc-fb-cab">
                      <span className="dsc-fb-status">{acertou ? <IconeCheck size={13} /> : <IconeClose size={13} />}</span>
                      <span className="dsc-fb-qnum num">Pergunta {String(f.quesito_ordem).padStart(2, '0')}</span>
                      <span className="dsc-fb-nota num">{f.nota.toFixed(1).replace('.', ',')}/10</span>
                    </div>
                    {qq && <p className="dsc-fb-enunciado">{qq.enunciado}</p>}
                    {acertou ? (
                      <div className="dsc-fb-acertou"><span className="dsc-fb-acertou-ico"><IconeCheck size={16} /></span><div><b>Resposta correta!</b><p>{f.feedback}</p></div></div>
                    ) : (
                      <>
                        <p className="dsc-fb-resp">Sua resposta: <b>{respostas[String(f.quesito_ordem)] ?? '—'}</b></p>
                        <div className="dsc-fb-ia"><span className="dsc-fb-ia-ico" aria-hidden="true"><IconeBot size={16} /></span><p>{f.feedback}</p></div>
                        {f.sugerir_refazer && <span className="dsc-fb-refazer"><IconeAlertTriangle size={13} /> Sugerimos revisar esta pergunta</span>}
                        {explicacoes[f.quesito_ordem] ? (
                          <div className="dsc-fb-explicacao"><span className="dsc-fb-explicacao-ico"><IconeBookOpen size={16} /></span><div><b>Explicação do professor</b><p>{explicacoes[f.quesito_ordem]}</p></div></div>
                        ) : (
                          <button className="dsc-fb-btn-explicar" onClick={() => pedirExplicacao(f.quesito_ordem)} disabled={explicando === f.quesito_ordem}>
                            {explicando === f.quesito_ordem ? <><IconeHourglass size={13} /> Consultando o professor…</> : <><IconeBookOpen size={13} /> Entender melhor</>}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
<div className="dsc-veredito-acoes">
            {!aprovado && <p className="dsc-veredito-minima num">Nota mínima para aprovação: <b>{ds.nota_minima.toFixed(1).replace('.', ',')}</b></p>}
            {ds.gabarito_path && aprovado && <button className="dsc-btn-gab" onClick={baixarGab} disabled={baixando === 'gabarito'}>{baixando === 'gabarito' ? 'Gerando link…' : <><IconePaperclip size={13} /> Baixar gabarito do professor</>}</button>}
            <button className="dsc-btn-galeria" onClick={() => setCena('galeria')}><IconeUsers size={13} /> Ver entregas da comunidade</button>
            <a className="dsc-btn-voltar" href="/desafios"><IconeChevronLeft size={12} /> Voltar aos desafios</a>
          </div>
                  </div></section>
      )}

      {cena === 'galeria' && (
        <section className="dsc-cena dsc-galeria"><div className="wrap">
          <span className="eyebrow">Comunidade</span><h2>Entregas dos peritos.</h2>
          <p className="dsc-gal-sub">{fmtNum(entregas.length)} laudos protocolados neste desafio.</p>
          {entregas.length === 0 ? <p className="dsc-gal-vazio">Nenhuma entrega ainda, seja o primeiro!</p> : (
            <div className="dsc-gal-grade">{entregas.map(e => (
              <div className="dsc-gal-card" key={e.id}>
                <div className="dsc-gal-cab">
                  <span className="dsc-gal-avatar" aria-hidden="true">{e.usuario_iniciais}</span>
                  <div className="dsc-gal-quem"><b>{e.usuario_nome}</b><span className="num">{e.nota !== null ? `Nota ${e.nota.toFixed(1).replace('.', ',')}` : 'Aguardando correção'}{e.tempo_seg !== null ? ` · ${tempoGasto(e.tempo_seg)}` : ''}</span></div>
                </div>
                <div className="dsc-gal-rodape"><button className={`dsc-gal-curtir${e.jaCurtiu ? ' curtido' : ''}`} onClick={() => curtir(e.id)}><IconeHeart size={13} /> {e.curtidas}</button></div>
              </div>
            ))}</div>
          )}
          <div className="dsc-gal-acoes">
            <button className="dsc-btn-galeria" onClick={() => setCena('veredito')}><IconeChevronLeft size={13} /> Voltar ao veredito</button>
            <a className="dsc-btn-voltar" href="/desafios">Voltar aos desafios</a>
          </div>
        </div></section>
      )}
    </div>
  )
}
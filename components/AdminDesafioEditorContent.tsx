// components/AdminDesafioEditorContent.tsx
'use client'

import { useState, useTransition } from 'react'
import type { FormEvent, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { DesafioAdmin, CategoriaAdmin, EntregaAdmin, Quesito } from '@/lib/queries/admin-desafios'
import {
  atualizarDesafio, uploadCapaDesafio, alternarPublicacaoDesafio, excluirDesafio,
  adicionarQuesito, atualizarQuesito, excluirQuesito, moverQuesito,
  uploadDocumento, excluirDocumento, uploadGabarito,
} from '@/app/admin/desafios/actions'
import { baixarDocumento } from '@/app/desafios/actions'
import { IconeChevronLeft, IconeArrowUp, IconeArrowDown, IconeTrash } from '@/components/Icones'
import { useAdminToast, AdminToastContainer } from '@/components/AdminToast'

function segParaLabel(seg: number | null) {
  if (seg === null) return '—'
  const m = Math.floor(seg / 60)
  const s = seg % 60
  return `${m}min ${s}s`
}

export default function AdminDesafioEditorContent({ desafio, categorias, entregas }: {
  desafio: DesafioAdmin; categorias: CategoriaAdmin[]; entregas: EntregaAdmin[]
}) {
  const router = useRouter()
  const toast = useAdminToast()
  const [pendente, startTransition] = useTransition()
  const [quesitoExpandido, setQuesitoExpandido] = useState<number | null>(null)
  const [novoTipo, setNovoTipo] = useState<Quesito['tipo']>('valor')

  function refresh() { router.refresh() }

  function onSalvarDados(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await atualizarDesafio(desafio.id, fd)
      if (!r.ok) toast.erro(r.erro)
      else { toast.sucesso('Dados gerais salvos com sucesso'); refresh() }
    })
  }

  function onUploadCapa(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.set('capa', file)
    startTransition(async () => {
      const r = await uploadCapaDesafio(desafio.id, fd)
      if (!r.ok) toast.erro(r.erro)
      else { toast.sucesso('Capa atualizada com sucesso'); refresh() }
    })
  }

  function onAlternarPublicacao(publicado: boolean) {
    startTransition(async () => {
      const r = await alternarPublicacaoDesafio(desafio.id, publicado)
      if (!r.ok) toast.erro(r.erro)
      else { toast.sucesso(publicado ? 'Desafio publicado com sucesso' : 'Desafio voltou a rascunho'); refresh() }
    })
  }

  function onExcluirDesafio() {
    if (!confirm(`Excluir o desafio "${desafio.titulo}"? Essa ação não pode ser desfeita.`)) return
    startTransition(async () => {
      const r = await excluirDesafio(desafio.id)
      if (!r.ok) toast.erro(r.erro)
      else router.push('/admin/desafios')
    })
  }

  function onCriarQuesito() {
    const fd = new FormData()
    fd.set('tipo', novoTipo)
    fd.set('enunciado', 'Nova questão — edite o enunciado abaixo')
    startTransition(async () => {
      const r = await adicionarQuesito(desafio.id, fd)
      if (!r.ok) toast.erro(r.erro)
      else { toast.sucesso('Quesito criado com sucesso'); refresh() }
    })
  }

  async function onBaixar(path: string) {
    const r = await baixarDocumento(path)
    if (!r.ok) { toast.erro(r.erro); return }
    window.open(r.url, '_blank')
  }

  return (
    <div className="ad-curso-editor">
      <AdminToastContainer toasts={toast.toasts} remover={toast.remover} />
      <a href="/admin/desafios" className="ad-voltar"><IconeChevronLeft size={14} /> Desafios</a>
      <div className="ad-editor-cab">
        <h1>{desafio.numero ? `#${desafio.numero} — ` : ''}{desafio.titulo}</h1>
        <div className="ad-editor-cab-acoes">
          <label className={`ad-toggle-papel${desafio.publicado ? ' ativo' : ''}`}>
            <input type="checkbox" checked={desafio.publicado} disabled={pendente} onChange={e => onAlternarPublicacao(e.target.checked)} />
            {desafio.publicado ? 'Publicado' : 'Rascunho'}
          </label>
          <button type="button" className="ad-btn-perigo" disabled={pendente} onClick={onExcluirDesafio}>Excluir desafio</button>
        </div>
      </div>

      <div className="ad-editor-grid">
        <section className="ad-card">
          <h2>Capa</h2>
          <div className="ad-capa-preview" style={desafio.capaUrl ? { backgroundImage: `url(${desafio.capaUrl})` } : undefined}>
            {!desafio.capaUrl && <span>Sem capa</span>}
          </div>
          <label className="ad-btn-secundario ad-upload-btn">
            Trocar capa
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onUploadCapa} hidden disabled={pendente} />
          </label>
        </section>

        <section className="ad-card ad-card-dados">
          <h2>Dados gerais</h2>
          <form onSubmit={onSalvarDados} className="ad-form">
            <label>Título
              <input name="titulo" defaultValue={desafio.titulo} required minLength={3} />
            </label>
            <label>Categoria
              <select name="categoria_id" defaultValue={desafio.categoriaId ?? ''}>
                <option value="">—</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
            <div className="ad-form-linha">
              <label>Prazo (dias)
                <input name="prazo_dias" type="number" min="1" defaultValue={desafio.prazoDias} />
              </label>
              <label>XP
                <input name="xp" type="number" min="0" defaultValue={desafio.xp} />
              </label>
              <label>Moedas
                <input name="moedas" type="number" min="0" defaultValue={desafio.moedas} />
              </label>
              <label>Nota mínima
                <input name="nota_minima" type="number" step="0.1" min="0" max="10" defaultValue={desafio.notaMinima} />
              </label>
            </div>
            <label>Plano exigido
              <select name="plano" defaultValue={desafio.plano}>
                <option value="free">Gratuito</option>
                <option value="pro">Assinante</option>
              </select>
            </label>

            <h3 className="ad-form-subtitulo">Intimação</h3>
            <label>Texto da intimação
              <textarea name="intimacao_texto" defaultValue={desafio.intimacaoTexto ?? ''} rows={3} />
            </label>
            <div className="ad-form-linha">
              <label>Mensageiro (nome)
                <input name="mensageiro_nome" defaultValue={desafio.mensageiroNome ?? ''} />
              </label>
              <label>Mensageiro (cargo)
                <input name="mensageiro_cargo" defaultValue={desafio.mensageiroCargo ?? ''} />
              </label>
            </div>
            <label>Mensagem do mensageiro
              <textarea name="mensagem_texto" defaultValue={desafio.mensagemTexto ?? ''} rows={2} />
            </label>
            <label>Instruções (uma por linha)
              <textarea name="instrucoes" defaultValue={desafio.instrucoes.join('\n')} rows={4} />
            </label>

            <button type="submit" className="ad-btn-primario" disabled={pendente}>{pendente ? 'Salvando...' : 'Salvar dados gerais'}</button>
          </form>
        </section>
      </div>

      <section className="ad-card">
        <h2>Documentos do processo</h2>
        <ul className="ad-sublista-lista">
          {desafio.documentos.length === 0 && <p className="ad-vazio-sm">Nenhum documento anexado.</p>}
          {desafio.documentos.map((doc, i) => (
            <li key={i} className="ad-doc-linha">
              <span>{doc.nome}</span>
              <span className="ad-sublista-meta">{doc.formato.toUpperCase()} · {doc.tamanho_kb} KB</span>
              <button type="button" className="ad-btn-secundario" onClick={() => onBaixar(doc.path)}>Baixar</button>
              <DocumentoExcluirBotao desafioId={desafio.id} indice={i} onErro={toast.erro} onSucesso={toast.sucesso} onRefresh={refresh} />
            </li>
          ))}
        </ul>
        <NovoDocumentoForm desafioId={desafio.id} onErro={toast.erro} onSucesso={toast.sucesso} onRefresh={refresh} />
      </section>

      <section className="ad-card">
        <h2>Gabarito</h2>
        {desafio.gabaritoPath
          ? <div className="ad-nova-linha"><span>{desafio.gabaritoPath.split('/').pop()}</span><button type="button" className="ad-btn-secundario" onClick={() => onBaixar(desafio.gabaritoPath!)}>Baixar</button></div>
          : <p className="ad-vazio-sm">Nenhum gabarito enviado ainda.</p>}
        <GabaritoForm desafioId={desafio.id} onErro={toast.erro} onSucesso={toast.sucesso} onRefresh={refresh} />
      </section>

      <section className="ad-card">
        <h2>Quesitos</h2>
        <div className="ad-nova-linha">
          <select value={novoTipo} onChange={e => setNovoTipo(e.target.value as Quesito['tipo'])}>
            <option value="valor">Resposta numérica</option>
            <option value="texto">Resposta em texto</option>
            <option value="multipla">Múltipla escolha</option>
          </select>
          <button type="button" className="ad-btn-primario" disabled={pendente} onClick={onCriarQuesito}>+ Quesito</button>
        </div>

        {desafio.quesitos.length === 0 && <p className="ad-vazio">Nenhum quesito cadastrado ainda.</p>}

        <div className="ad-modulos-lista">
          {desafio.quesitos.map((q, i) => (
            <QuesitoBloco
              key={i}
              quesito={q}
              indice={i}
              desafioId={desafio.id}
              total={desafio.quesitos.length}
              expandido={quesitoExpandido === i}
              onToggle={() => setQuesitoExpandido(quesitoExpandido === i ? null : i)}
              onErro={toast.erro}
              onSucesso={toast.sucesso}
              onRefresh={refresh}
            />
          ))}
        </div>
      </section>

      <section className="ad-card">
        <h2>Entregas dos alunos</h2>
        {entregas.length === 0 && <p className="ad-vazio">Nenhuma entrega ainda.</p>}
        {entregas.length > 0 && (
          <div className="ad-tabela-scroll">
            <table className="ad-tabela">
              <thead>
                <tr><th>Aluno</th><th>Nota</th><th>Tempo</th><th>Aceito em</th><th>Entregue em</th><th>Arquivo</th></tr>
              </thead>
              <tbody>
                {entregas.map(e => (
                  <tr key={e.id}>
                    <td>{e.usuarioNome}</td>
                    <td>{e.nota ?? '—'}</td>
                    <td>{segParaLabel(e.tempoSeg)}</td>
                    <td>{e.aceitoEm ? new Date(e.aceitoEm).toLocaleDateString('pt-BR') : '—'}</td>
                    <td>{e.entregueEm ? new Date(e.entregueEm).toLocaleDateString('pt-BR') : '—'}</td>
                    <td>{e.arquivoPath ? <button type="button" className="ad-btn-secundario" onClick={() => onBaixar(e.arquivoPath!)}>Baixar</button> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function QuesitoBloco({ quesito, indice, desafioId, total, expandido, onToggle, onErro, onSucesso, onRefresh }: {
  quesito: Quesito; indice: number; desafioId: string; total: number; expandido: boolean
  onToggle: () => void; onErro: (e: string) => void; onSucesso: (m: string) => void; onRefresh: () => void
}) {
  const [pendente, startTransition] = useTransition()
  const [tipo, setTipo] = useState(quesito.tipo)

  function onMover(direcao: 'up' | 'down') {
    startTransition(async () => {
      const r = await moverQuesito(desafioId, indice, direcao)
      if (!r.ok) onErro(r.erro)
      else onRefresh()
    })
  }

  function onExcluir() {
    if (!confirm('Excluir este quesito?')) return
    startTransition(async () => {
      const r = await excluirQuesito(desafioId, indice)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Quesito excluído com sucesso'); onRefresh() }
    })
  }

  function onSalvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await atualizarQuesito(desafioId, indice, fd)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Quesito salvo com sucesso'); onRefresh() }
    })
  }

  return (
    <div className="ad-modulo-bloco">
      <div className="ad-modulo-cab">
        <button type="button" className="ad-modulo-toggle" onClick={onToggle}>
          {expandido ? '▾' : '▸'} {indice + 1}. {quesito.enunciado.slice(0, 60)}{quesito.enunciado.length > 60 ? '…' : ''}
        </button>
        <div className="ad-modulo-acoes">
          <span className="ad-modulo-contagem">{quesito.tipo}</span>
          <button type="button" disabled={pendente || indice === 0} onClick={() => onMover('up')} title="Mover para cima"><IconeArrowUp size={13} /></button>
          <button type="button" disabled={pendente || indice === total - 1} onClick={() => onMover('down')} title="Mover para baixo"><IconeArrowDown size={13} /></button>
          <button type="button" className="ad-btn-perigo-sm" disabled={pendente} onClick={onExcluir} title="Excluir quesito"><IconeTrash size={13} /></button>
        </div>
      </div>

      {expandido && (
        <div className="ad-modulo-corpo">
          <form onSubmit={onSalvar} className="ad-form">
            <label>Tipo
              <select name="tipo" value={tipo} onChange={e => setTipo(e.target.value as Quesito['tipo'])}>
                <option value="valor">Resposta numérica</option>
                <option value="texto">Resposta em texto</option>
                <option value="multipla">Múltipla escolha</option>
              </select>
            </label>
            <label>Enunciado
              <textarea name="enunciado" defaultValue={quesito.enunciado} rows={2} required />
            </label>
            {tipo === 'valor' && (
              <div className="ad-form-linha">
                <label>Prefixo
                  <input name="prefixo" defaultValue={quesito.prefixo ?? ''} placeholder="R$" />
                </label>
                <label>Sufixo
                  <input name="sufixo" defaultValue={quesito.sufixo ?? ''} placeholder="%" />
                </label>
                <label>Tolerância
                  <input name="tolerancia" type="number" step="0.01" min="0" defaultValue={quesito.tolerancia ?? 0} />
                </label>
              </div>
            )}
            {tipo === 'multipla' && (
              <label>Opções (uma por linha)
                <textarea name="opcoes" defaultValue={(quesito.opcoes ?? []).join('\n')} rows={3} />
              </label>
            )}
            <label>Resposta modelo (gabarito / referência de correção)
              <textarea name="resposta_modelo" defaultValue={quesito.resposta_modelo ?? ''} rows={2} />
            </label>
            <button type="submit" className="ad-btn-primario" disabled={pendente}>{pendente ? 'Salvando...' : 'Salvar quesito'}</button>
          </form>
        </div>
      )}
    </div>
  )
}

function NovoDocumentoForm({ desafioId, onErro, onSucesso, onRefresh }: { desafioId: string; onErro: (e: string) => void; onSucesso: (m: string) => void; onRefresh: () => void }) {
  const [pendente, startTransition] = useTransition()
  const [nome, setNome] = useState('')

  function onEnviar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!nome.trim()) { onErro('Informe o nome do documento antes de escolher o arquivo.'); return }
    const fd = new FormData()
    fd.set('nome', nome)
    fd.set('arquivo', file)
    startTransition(async () => {
      const r = await uploadDocumento(desafioId, fd)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Documento enviado com sucesso'); setNome(''); onRefresh() }
    })
  }

  return (
    <div className="ad-nova-linha">
      <input type="text" placeholder="Nome do documento" value={nome} onChange={e => setNome(e.target.value)} />
      <label className="ad-btn-secundario ad-upload-btn">
        {pendente ? 'Enviando...' : 'Escolher arquivo'}
        <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.xlsm" onChange={onEnviar} hidden disabled={pendente} />
      </label>
    </div>
  )
}

function DocumentoExcluirBotao({ desafioId, indice, onErro, onSucesso, onRefresh }: { desafioId: string; indice: number; onErro: (e: string) => void; onSucesso: (m: string) => void; onRefresh: () => void }) {
  const [pendente, startTransition] = useTransition()
  function onExcluir() {
    startTransition(async () => {
      const r = await excluirDocumento(desafioId, indice)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Documento excluído com sucesso'); onRefresh() }
    })
  }
  return <button type="button" className="ad-btn-perigo-sm" disabled={pendente} onClick={onExcluir}><IconeTrash size={13} /></button>
}

function GabaritoForm({ desafioId, onErro, onSucesso, onRefresh }: { desafioId: string; onErro: (e: string) => void; onSucesso: (m: string) => void; onRefresh: () => void }) {
  const [pendente, startTransition] = useTransition()

  function onEnviar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.set('arquivo', file)
    startTransition(async () => {
      const r = await uploadGabarito(desafioId, fd)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Gabarito enviado com sucesso'); onRefresh() }
    })
  }

  return (
    <label className="ad-btn-secundario ad-upload-btn">
      {pendente ? 'Enviando...' : 'Enviar gabarito'}
      <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.xlsm" onChange={onEnviar} hidden disabled={pendente} />
    </label>
  )
}

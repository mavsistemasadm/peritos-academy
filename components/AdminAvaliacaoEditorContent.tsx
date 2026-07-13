// components/AdminAvaliacaoEditorContent.tsx
'use client'

import { useState, useTransition } from 'react'
import type { FormEvent, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { AvaliacaoAdmin, QuestaoAdmin, ModuloPicker } from '@/lib/queries/admin-avaliacoes'
import {
  atualizarAvaliacao, uploadCapaAvaliacao, alternarPublicacaoAvaliacao, excluirAvaliacao,
  criarQuestao, atualizarQuestao, excluirQuestao, moverQuestao,
  criarOpcao, marcarOpcaoCorreta, excluirOpcao,
} from '@/app/admin/avaliacoes/actions'

export default function AdminAvaliacaoEditorContent({ avaliacao, questoes, modulos }: {
  avaliacao: AvaliacaoAdmin; questoes: QuestaoAdmin[]; modulos: ModuloPicker[]
}) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, startTransition] = useTransition()
  const [tipo, setTipo] = useState(avaliacao.tipo)
  const [questaoExpandida, setQuestaoExpandida] = useState<string | null>(questoes[0]?.id ?? null)
  const [novoTipo, setNovoTipo] = useState<'multipla_escolha' | 'valor'>('multipla_escolha')

  function refresh() { router.refresh() }

  function onSalvarDados(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await atualizarAvaliacao(avaliacao.id, avaliacao.cursoId, fd)
      if (!r.ok) setErro(r.erro)
      else refresh()
    })
  }

  function onUploadCapa(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setErro(null)
    const fd = new FormData()
    fd.set('capa', file)
    startTransition(async () => {
      const r = await uploadCapaAvaliacao(avaliacao.id, avaliacao.cursoId, fd)
      if (!r.ok) setErro(r.erro)
      else refresh()
    })
  }

  function onAlternarPublicacao(publicado: boolean) {
    setErro(null)
    startTransition(async () => {
      const r = await alternarPublicacaoAvaliacao(avaliacao.id, avaliacao.cursoId, publicado)
      if (!r.ok) setErro(r.erro)
      else refresh()
    })
  }

  function onExcluir() {
    if (!confirm(`Excluir a avaliação "${avaliacao.titulo}"? Isso apaga as questões vinculadas.`)) return
    setErro(null)
    startTransition(async () => {
      const r = await excluirAvaliacao(avaliacao.id, avaliacao.cursoId)
      if (!r.ok) setErro(r.erro)
      else router.push('/admin/avaliacoes')
    })
  }

  function onCriarQuestao() {
    setErro(null)
    const fd = new FormData()
    fd.set('tipo', novoTipo)
    fd.set('enunciado', 'Nova questão — edite o enunciado abaixo')
    if (novoTipo === 'valor') fd.set('resposta_valor', '0')
    startTransition(async () => {
      const r = await criarQuestao(avaliacao.id, avaliacao.cursoId, fd)
      if (!r.ok) setErro(r.erro)
      else refresh()
    })
  }

  return (
    <div className="ad-curso-editor">
      <a href="/admin/avaliacoes" className="ad-voltar">← Avaliações</a>
      <div className="ad-editor-cab">
        <h1>{avaliacao.titulo}{avaliacao.numeroCaso ? <span className="ad-caso-numero"> · Caso #{avaliacao.numeroCaso}</span> : null}</h1>
        <div className="ad-editor-cab-acoes">
          <label className={`ad-toggle-papel${avaliacao.publicado ? ' ativo' : ''}`}>
            <input type="checkbox" checked={avaliacao.publicado} disabled={pendente} onChange={e => onAlternarPublicacao(e.target.checked)} />
            {avaliacao.publicado ? 'Publicado' : 'Rascunho'}
          </label>
          <button type="button" className="ad-btn-perigo" disabled={pendente} onClick={onExcluir}>Excluir avaliação</button>
        </div>
      </div>

      {erro && <p className="ad-erro">{erro}</p>}

      <div className="ad-editor-grid">
        <section className="ad-card">
          <h2>Capa</h2>
          <div className="ad-capa-preview" style={avaliacao.capaUrl ? { backgroundImage: `url(${avaliacao.capaUrl})` } : undefined}>
            {!avaliacao.capaUrl && <span>Sem capa</span>}
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
              <input name="titulo" defaultValue={avaliacao.titulo} required minLength={3} />
            </label>
            <label>Tipo
              <select name="tipo" value={tipo} onChange={e => setTipo(e.target.value as 'avaliacao' | 'prova')}>
                <option value="avaliacao">Avaliação de módulo</option>
                <option value="prova">Prova final (O Caso)</option>
              </select>
            </label>
            {tipo === 'avaliacao' && (
              <label>Módulo
                <select name="modulo_id" defaultValue={avaliacao.moduloId ?? ''}>
                  <option value="">—</option>
                  {modulos.map(m => (
                    <option key={m.id} value={m.id}>{m.titulo}</option>
                  ))}
                </select>
              </label>
            )}
            <label>Briefing / enunciado geral
              <textarea name="briefing" defaultValue={avaliacao.briefing ?? ''} rows={4} />
            </label>
            <div className="ad-form-linha">
              <label>Nota mínima
                <input name="nota_minima" type="number" step="0.1" min="0" max="10" defaultValue={avaliacao.notaMinima} />
              </label>
              <label>XP
                <input name="xp" type="number" min="0" defaultValue={avaliacao.xp} />
              </label>
            </div>
            <button type="submit" className="ad-btn-primario" disabled={pendente}>{pendente ? 'Salvando...' : 'Salvar dados gerais'}</button>
          </form>
        </section>
      </div>

      <section className="ad-card">
        <h2>Questões</h2>
        <div className="ad-nova-linha">
          <select value={novoTipo} onChange={e => setNovoTipo(e.target.value as 'multipla_escolha' | 'valor')}>
            <option value="multipla_escolha">Múltipla escolha</option>
            <option value="valor">Resposta numérica</option>
          </select>
          <button type="button" className="ad-btn-primario" disabled={pendente} onClick={onCriarQuestao}>+ Questão</button>
        </div>

        {questoes.length === 0 && <p className="ad-vazio">Nenhuma questão cadastrada ainda.</p>}

        <div className="ad-modulos-lista">
          {questoes.map((q, i) => (
            <QuestaoBloco
              key={q.id}
              questao={q}
              avaliacaoId={avaliacao.id}
              cursoId={avaliacao.cursoId}
              indice={i}
              total={questoes.length}
              expandida={questaoExpandida === q.id}
              onToggle={() => setQuestaoExpandida(questaoExpandida === q.id ? null : q.id)}
              onErro={setErro}
              onRefresh={refresh}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function QuestaoBloco({ questao, avaliacaoId, cursoId, indice, total, expandida, onToggle, onErro, onRefresh }: {
  questao: QuestaoAdmin
  avaliacaoId: string
  cursoId: string
  indice: number
  total: number
  expandida: boolean
  onToggle: () => void
  onErro: (erro: string | null) => void
  onRefresh: () => void
}) {
  const [pendente, startTransition] = useTransition()
  const [tipo, setTipo] = useState(questao.tipo)
  const [novaOpcaoTexto, setNovaOpcaoTexto] = useState('')

  function onMover(direcao: 'up' | 'down') {
    onErro(null)
    startTransition(async () => {
      const r = await moverQuestao(avaliacaoId, cursoId, questao.id, direcao)
      if (!r.ok) onErro(r.erro)
      else onRefresh()
    })
  }

  function onExcluir() {
    if (!confirm('Excluir esta questão e suas opções?')) return
    onErro(null)
    startTransition(async () => {
      const r = await excluirQuestao(questao.id, avaliacaoId, cursoId)
      if (!r.ok) onErro(r.erro)
      else onRefresh()
    })
  }

  function onSalvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    onErro(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await atualizarQuestao(questao.id, avaliacaoId, cursoId, fd)
      if (!r.ok) onErro(r.erro)
      else onRefresh()
    })
  }

  function onCriarOpcao() {
    if (!novaOpcaoTexto.trim()) return
    onErro(null)
    const fd = new FormData()
    fd.set('texto', novaOpcaoTexto)
    startTransition(async () => {
      const r = await criarOpcao(questao.id, avaliacaoId, cursoId, fd)
      if (!r.ok) onErro(r.erro)
      else { setNovaOpcaoTexto(''); onRefresh() }
    })
  }

  function onMarcarCorreta(opcaoId: string) {
    onErro(null)
    startTransition(async () => {
      const r = await marcarOpcaoCorreta(opcaoId, questao.id, avaliacaoId, cursoId)
      if (!r.ok) onErro(r.erro)
      else onRefresh()
    })
  }

  function onExcluirOpcao(opcaoId: string) {
    onErro(null)
    startTransition(async () => {
      const r = await excluirOpcao(opcaoId, avaliacaoId, cursoId)
      if (!r.ok) onErro(r.erro)
      else onRefresh()
    })
  }

  return (
    <div className="ad-modulo-bloco">
      <div className="ad-modulo-cab">
        <button type="button" className="ad-modulo-toggle" onClick={onToggle}>
          {expandida ? '▾' : '▸'} {indice + 1}. {questao.enunciado.slice(0, 60)}{questao.enunciado.length > 60 ? '…' : ''}
        </button>
        <div className="ad-modulo-acoes">
          <span className="ad-modulo-contagem">{questao.tipo === 'valor' ? 'Numérica' : 'Múltipla escolha'}</span>
          <button type="button" disabled={pendente || indice === 0} onClick={() => onMover('up')} title="Mover para cima">↑</button>
          <button type="button" disabled={pendente || indice === total - 1} onClick={() => onMover('down')} title="Mover para baixo">↓</button>
          <button type="button" className="ad-btn-perigo-sm" disabled={pendente} onClick={onExcluir} title="Excluir questão">🗑</button>
        </div>
      </div>

      {expandida && (
        <div className="ad-modulo-corpo">
          <form onSubmit={onSalvar} className="ad-form">
            <label>Tipo
              <select name="tipo" value={tipo} onChange={e => setTipo(e.target.value as 'multipla_escolha' | 'valor')}>
                <option value="multipla_escolha">Múltipla escolha</option>
                <option value="valor">Resposta numérica</option>
              </select>
            </label>
            <label>Enunciado
              <textarea name="enunciado" defaultValue={questao.enunciado} rows={3} required />
            </label>
            {tipo === 'valor' && (
              <div className="ad-form-linha">
                <label>Resposta correta (gabarito)
                  <input name="resposta_valor" type="number" step="0.01" defaultValue={questao.respostaValor ?? ''} required />
                </label>
                <label>Tolerância
                  <input name="tolerancia" type="number" step="0.01" min="0" defaultValue={questao.tolerancia} />
                </label>
                <label>Prefixo
                  <input name="prefixo" defaultValue={questao.prefixo ?? ''} placeholder="R$" />
                </label>
                <label>Sufixo
                  <input name="sufixo" defaultValue={questao.sufixo ?? ''} placeholder="%" />
                </label>
              </div>
            )}
            <label>Parecer (feedback exibido após a correção)
              <textarea name="parecer" defaultValue={questao.parecer ?? ''} rows={2} />
            </label>
            <button type="submit" className="ad-btn-primario" disabled={pendente}>{pendente ? 'Salvando...' : 'Salvar questão'}</button>
          </form>

          {tipo === 'multipla_escolha' && (
            <div className="ad-sublista">
              <h3>Opções (marque a correta)</h3>
              {questao.opcoes.length === 0 && <p className="ad-vazio-sm">Nenhuma opção cadastrada.</p>}
              <ul>
                {questao.opcoes.map(o => (
                  <li key={o.id}>
                    <label className="ad-checkbox-linha">
                      <input type="radio" name={`correta-${questao.id}`} checked={o.correta} disabled={pendente} onChange={() => onMarcarCorreta(o.id)} />
                      {o.texto}
                    </label>
                    <button type="button" className="ad-btn-perigo-sm" disabled={pendente} onClick={() => onExcluirOpcao(o.id)}>🗑</button>
                  </li>
                ))}
              </ul>
              <div className="ad-nova-linha">
                <input type="text" placeholder="Texto da opção" value={novaOpcaoTexto} onChange={e => setNovaOpcaoTexto(e.target.value)} />
                <button type="button" className="ad-btn-secundario" disabled={pendente} onClick={onCriarOpcao}>+ Opção</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

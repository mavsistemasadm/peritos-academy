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
import { IconeChevronLeft, IconeArrowUp, IconeArrowDown, IconeTrash } from '@/components/Icones'
import { useAdminToast, AdminToastContainer } from '@/components/AdminToast'

export default function AdminAvaliacaoEditorContent({ avaliacao, questoes, modulos }: {
  avaliacao: AvaliacaoAdmin; questoes: QuestaoAdmin[]; modulos: ModuloPicker[]
}) {
  const router = useRouter()
  const toast = useAdminToast()
  const [pendente, startTransition] = useTransition()
  const [tipo, setTipo] = useState(avaliacao.tipo)
  const [moduloId, setModuloId] = useState(avaliacao.moduloId ?? '')
  // '' = fim do módulo (null no banco); '0' = antes da 1ª aula; 'k' = depois da k-ésima
  const [posicao, setPosicao] = useState(avaliacao.posicao === null ? '' : String(avaliacao.posicao))
  const aulasDoModulo = modulos.find(m => m.id === moduloId)?.aulas ?? []
  const [questaoExpandida, setQuestaoExpandida] = useState<string | null>(questoes[0]?.id ?? null)
  const [novoTipo, setNovoTipo] = useState<'multipla_escolha' | 'valor'>('multipla_escolha')

  function refresh() { router.refresh() }

  function onSalvarDados(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await atualizarAvaliacao(avaliacao.id, avaliacao.cursoId, fd)
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
      const r = await uploadCapaAvaliacao(avaliacao.id, avaliacao.cursoId, fd)
      if (!r.ok) toast.erro(r.erro)
      else { toast.sucesso('Capa atualizada com sucesso'); refresh() }
    })
  }

  function onAlternarPublicacao(publicado: boolean) {
    startTransition(async () => {
      const r = await alternarPublicacaoAvaliacao(avaliacao.id, avaliacao.cursoId, publicado)
      if (!r.ok) toast.erro(r.erro)
      else { toast.sucesso(publicado ? 'Avaliação publicada com sucesso' : 'Avaliação voltou a rascunho'); refresh() }
    })
  }

  function onExcluir() {
    if (!confirm(`Excluir a avaliação "${avaliacao.titulo}"? Isso apaga as questões vinculadas.`)) return
    startTransition(async () => {
      const r = await excluirAvaliacao(avaliacao.id, avaliacao.cursoId)
      if (!r.ok) toast.erro(r.erro)
      else router.push('/admin/avaliacoes')
    })
  }

  function onCriarQuestao() {
    const fd = new FormData()
    fd.set('tipo', novoTipo)
    fd.set('enunciado', 'Nova questão. Edite o enunciado abaixo')
    if (novoTipo === 'valor') fd.set('resposta_valor', '0')
    startTransition(async () => {
      const r = await criarQuestao(avaliacao.id, avaliacao.cursoId, fd)
      if (!r.ok) toast.erro(r.erro)
      else { toast.sucesso('Questão criada com sucesso'); refresh() }
    })
  }

  return (
    <div className="pnl-curso-editor">
      <AdminToastContainer toasts={toast.toasts} remover={toast.remover} />
      <a href="/admin/avaliacoes" className="pnl-voltar"><IconeChevronLeft size={14} /> Avaliações</a>
      <div className="pnl-editor-cab">
        <h1>{avaliacao.titulo}{avaliacao.numeroCaso ? <span className="pnl-caso-numero"> · Caso #{avaliacao.numeroCaso}</span> : null}</h1>
        <div className="pnl-editor-cab-acoes">
          <label className={`pnl-toggle-papel${avaliacao.publicado ? ' ativo' : ''}`}>
            <input type="checkbox" checked={avaliacao.publicado} disabled={pendente} onChange={e => onAlternarPublicacao(e.target.checked)} />
            {avaliacao.publicado ? 'Publicado' : 'Rascunho'}
          </label>
          <button type="button" className="pnl-btn-perigo" disabled={pendente} onClick={onExcluir}>Excluir avaliação</button>
        </div>
      </div>

      <div className="pnl-editor-grid">
        <section className="pnl-card">
          <h2>Capa</h2>
          <div className="pnl-capa-preview" style={avaliacao.capaUrl ? { backgroundImage: `url(${avaliacao.capaUrl})` } : undefined}>
            {!avaliacao.capaUrl && <span>Sem capa</span>}
          </div>
          <label className="pnl-btn-secundario pnl-upload-btn">
            Trocar capa
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onUploadCapa} hidden disabled={pendente} />
          </label>
        </section>

        <section className="pnl-card pnl-card-dados">
          <h2>Dados gerais</h2>
          <form onSubmit={onSalvarDados} className="pnl-form">
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
              <>
                <label>Módulo
                  <select name="modulo_id" value={moduloId} onChange={e => { setModuloId(e.target.value); setPosicao('') }}>
                    <option value="">—</option>
                    {modulos.map(m => (
                      <option key={m.id} value={m.id}>{m.titulo}</option>
                    ))}
                  </select>
                </label>
                {/* Posição na jornada: a avaliação é um item da sequência, e o
                    aluno só passa dela sendo aprovado. A aula de correção tem
                    que vir DEPOIS — se ficar antes, o vídeo entrega a resposta
                    da prova (foi o que acontecia até 21/08/2026). */}
                <label>Posição no módulo
                  <select name="posicao" value={posicao} onChange={e => setPosicao(e.target.value)}>
                    <option value="0">Antes de tudo (abre o módulo)</option>
                    {aulasDoModulo.map((a, i) => (
                      <option key={a.id} value={String(i + 1)}>Depois de: {a.titulo}</option>
                    ))}
                    <option value="">No fim do módulo</option>
                  </select>
                </label>
              </>
            )}
            <label>Briefing / enunciado geral
              <textarea name="briefing" defaultValue={avaliacao.briefing ?? ''} rows={4} />
            </label>
            <div className="pnl-form-linha">
              <label>Nota mínima
                <input name="nota_minima" type="number" step="0.1" min="0" max="10" defaultValue={avaliacao.notaMinima} />
              </label>
              <label>Peso (multiplica os pontos de XP por faixa de acerto)
                <input name="peso" type="number" min="1" max="5" defaultValue={avaliacao.peso} />
              </label>
            </div>
            <button type="submit" className="pnl-btn-primario" disabled={pendente}>{pendente ? 'Salvando...' : 'Salvar dados gerais'}</button>
          </form>
        </section>
      </div>

      <section className="pnl-card">
        <h2>Questões</h2>
        <div className="pnl-nova-linha">
          <select value={novoTipo} onChange={e => setNovoTipo(e.target.value as 'multipla_escolha' | 'valor')}>
            <option value="multipla_escolha">Múltipla escolha</option>
            <option value="valor">Resposta numérica</option>
          </select>
          <button type="button" className="pnl-btn-primario" disabled={pendente} onClick={onCriarQuestao}>+ Questão</button>
        </div>

        {questoes.length === 0 && <p className="pnl-vazio">Nenhuma questão cadastrada ainda.</p>}

        <div className="pnl-modulos-lista">
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
              onErro={toast.erro}
              onSucesso={toast.sucesso}
              onRefresh={refresh}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function QuestaoBloco({ questao, avaliacaoId, cursoId, indice, total, expandida, onToggle, onErro, onSucesso, onRefresh }: {
  questao: QuestaoAdmin
  avaliacaoId: string
  cursoId: string
  indice: number
  total: number
  expandida: boolean
  onToggle: () => void
  onErro: (erro: string) => void
  onSucesso: (mensagem: string) => void
  onRefresh: () => void
}) {
  const [pendente, startTransition] = useTransition()
  const [tipo, setTipo] = useState(questao.tipo)
  const [novaOpcaoTexto, setNovaOpcaoTexto] = useState('')

  function onMover(direcao: 'up' | 'down') {
    startTransition(async () => {
      const r = await moverQuestao(avaliacaoId, cursoId, questao.id, direcao)
      if (!r.ok) onErro(r.erro)
      else onRefresh()
    })
  }

  function onExcluir() {
    if (!confirm('Excluir esta questão e suas opções?')) return
    startTransition(async () => {
      const r = await excluirQuestao(questao.id, avaliacaoId, cursoId)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Questão excluída com sucesso'); onRefresh() }
    })
  }

  function onSalvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await atualizarQuestao(questao.id, avaliacaoId, cursoId, fd)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Questão salva com sucesso'); onRefresh() }
    })
  }

  function onCriarOpcao() {
    if (!novaOpcaoTexto.trim()) return
    const fd = new FormData()
    fd.set('texto', novaOpcaoTexto)
    startTransition(async () => {
      const r = await criarOpcao(questao.id, avaliacaoId, cursoId, fd)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Opção criada com sucesso'); setNovaOpcaoTexto(''); onRefresh() }
    })
  }

  function onMarcarCorreta(opcaoId: string) {
    startTransition(async () => {
      const r = await marcarOpcaoCorreta(opcaoId, questao.id, avaliacaoId, cursoId)
      if (!r.ok) onErro(r.erro)
      else onRefresh()
    })
  }

  function onExcluirOpcao(opcaoId: string) {
    startTransition(async () => {
      const r = await excluirOpcao(opcaoId, avaliacaoId, cursoId)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Opção removida com sucesso'); onRefresh() }
    })
  }

  return (
    <div className="pnl-modulo-bloco">
      <div className="pnl-modulo-cab">
        <button type="button" className="pnl-modulo-toggle" onClick={onToggle}>
          {expandida ? '▾' : '▸'} {indice + 1}. {questao.enunciado.slice(0, 60)}{questao.enunciado.length > 60 ? '…' : ''}
        </button>
        <div className="pnl-modulo-acoes">
          <span className="pnl-modulo-contagem">{questao.tipo === 'valor' ? 'Numérica' : 'Múltipla escolha'}</span>
          <button type="button" disabled={pendente || indice === 0} onClick={() => onMover('up')} title="Mover para cima"><IconeArrowUp size={13} /></button>
          <button type="button" disabled={pendente || indice === total - 1} onClick={() => onMover('down')} title="Mover para baixo"><IconeArrowDown size={13} /></button>
          <button type="button" className="pnl-btn-perigo-sm" disabled={pendente} onClick={onExcluir} title="Excluir questão"><IconeTrash size={13} /></button>
        </div>
      </div>

      {expandida && (
        <div className="pnl-modulo-corpo">
          <form onSubmit={onSalvar} className="pnl-form">
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
              <div className="pnl-form-linha">
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
            <button type="submit" className="pnl-btn-primario" disabled={pendente}>{pendente ? 'Salvando...' : 'Salvar questão'}</button>
          </form>

          {tipo === 'multipla_escolha' && (
            <div className="pnl-sublista">
              <h3>Opções (marque a correta)</h3>
              {questao.opcoes.length === 0 && <p className="pnl-vazio-sm">Nenhuma opção cadastrada.</p>}
              <ul>
                {questao.opcoes.map(o => (
                  <li key={o.id}>
                    <label className="pnl-checkbox-linha">
                      <input type="radio" name={`correta-${questao.id}`} checked={o.correta} disabled={pendente} onChange={() => onMarcarCorreta(o.id)} />
                      {o.texto}
                    </label>
                    <button type="button" className="pnl-btn-perigo-sm" disabled={pendente} onClick={() => onExcluirOpcao(o.id)}><IconeTrash size={13} /></button>
                  </li>
                ))}
              </ul>
              <div className="pnl-nova-linha">
                <input type="text" placeholder="Texto da opção" value={novaOpcaoTexto} onChange={e => setNovaOpcaoTexto(e.target.value)} />
                <button type="button" className="pnl-btn-secundario" disabled={pendente} onClick={onCriarOpcao}>+ Opção</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

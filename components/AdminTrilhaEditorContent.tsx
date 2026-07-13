// components/AdminTrilhaEditorContent.tsx
'use client'

import { useState, useTransition } from 'react'
import type { FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { TrilhaAdmin, EtapaAdmin, CursoPicker } from '@/lib/queries/admin-trilhas'
import {
  atualizarTrilha, excluirTrilha,
  criarEtapa, atualizarEtapa, excluirEtapa, moverEtapa,
  adicionarCursoNaEtapa, removerCursoDaEtapa, moverMissao,
} from '@/app/admin/trilhas/actions'
import { IconeChevronLeft, IconeArrowUp, IconeArrowDown, IconePencil, IconeTrash } from '@/components/Icones'

export default function AdminTrilhaEditorContent({ trilha, etapas, cursos }: {
  trilha: TrilhaAdmin; etapas: EtapaAdmin[]; cursos: CursoPicker[]
}) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, startTransition] = useTransition()
  const [etapaExpandida, setEtapaExpandida] = useState<string | null>(etapas[0]?.id ?? null)
  const [novaEtapaNome, setNovaEtapaNome] = useState('')

  function refresh() { router.refresh() }

  function onSalvarDados(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await atualizarTrilha(trilha.id, fd)
      if (!r.ok) setErro(r.erro)
      else refresh()
    })
  }

  function onExcluirTrilha() {
    if (!confirm(`Excluir a trilha "${trilha.nome}"? Isso apaga suas etapas. Essa ação não pode ser desfeita.`)) return
    setErro(null)
    startTransition(async () => {
      const r = await excluirTrilha(trilha.id)
      if (!r.ok) setErro(r.erro)
      else router.push('/admin/trilhas')
    })
  }

  function onCriarEtapa() {
    if (!novaEtapaNome.trim()) return
    setErro(null)
    const fd = new FormData()
    fd.set('nome', novaEtapaNome)
    startTransition(async () => {
      const r = await criarEtapa(trilha.id, fd)
      if (!r.ok) setErro(r.erro)
      else { setNovaEtapaNome(''); refresh() }
    })
  }

  return (
    <div className="ad-curso-editor">
      <a href="/admin/trilhas" className="ad-voltar"><IconeChevronLeft size={14} /> Trilhas</a>
      <div className="ad-editor-cab">
        <h1>{trilha.nome ?? 'Trilha sem nome'}</h1>
        <div className="ad-editor-cab-acoes">
          <button type="button" className="ad-btn-perigo" disabled={pendente} onClick={onExcluirTrilha}>Excluir trilha</button>
        </div>
      </div>

      {erro && <p className="ad-erro">{erro}</p>}

      <section className="ad-card ad-card-dados">
        <h2>Dados gerais</h2>
        <form onSubmit={onSalvarDados} className="ad-form">
          <label>Nome
            <input name="nome" defaultValue={trilha.nome ?? ''} required minLength={3} />
          </label>
          <label>Descrição
            <textarea name="descricao" defaultValue={trilha.descricao ?? ''} rows={2} />
          </label>
          <div className="ad-form-linha">
            <label>Horas estimadas
              <input name="horas" type="number" min="0" defaultValue={trilha.horas ?? ''} />
            </label>
            <label>Alunos (vitrine)
              <input name="alunos" type="number" min="0" defaultValue={trilha.alunos ?? ''} />
            </label>
            <label className="ad-checkbox-linha">
              <input type="checkbox" name="principal" defaultChecked={trilha.principal ?? false} />
              Trilha principal
            </label>
          </div>
          <button type="submit" className="ad-btn-primario" disabled={pendente}>{pendente ? 'Salvando...' : 'Salvar dados gerais'}</button>
        </form>
      </section>

      <section className="ad-card">
        <h2>Etapas e cursos</h2>
        <div className="ad-nova-linha">
          <input
            type="text"
            placeholder="Nome da nova etapa"
            value={novaEtapaNome}
            onChange={e => setNovaEtapaNome(e.target.value)}
          />
          <button type="button" className="ad-btn-primario" disabled={pendente} onClick={onCriarEtapa}>+ Etapa</button>
        </div>

        {etapas.length === 0 && <p className="ad-vazio">Nenhuma etapa cadastrada ainda.</p>}

        <div className="ad-modulos-lista">
          {etapas.map((e, i) => (
            <EtapaBloco
              key={e.id}
              etapa={e}
              trilhaId={trilha.id}
              indice={i}
              total={etapas.length}
              cursos={cursos}
              expandida={etapaExpandida === e.id}
              onToggle={() => setEtapaExpandida(etapaExpandida === e.id ? null : e.id)}
              onErro={setErro}
              onRefresh={refresh}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function EtapaBloco({ etapa, trilhaId, indice, total, cursos, expandida, onToggle, onErro, onRefresh }: {
  etapa: EtapaAdmin
  trilhaId: string
  indice: number
  total: number
  cursos: CursoPicker[]
  expandida: boolean
  onToggle: () => void
  onErro: (erro: string | null) => void
  onRefresh: () => void
}) {
  const [pendente, startTransition] = useTransition()
  const [editando, setEditando] = useState(false)
  const [cursoSelecionado, setCursoSelecionado] = useState('')

  function onSalvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    onErro(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await atualizarEtapa(etapa.id, trilhaId, fd)
      if (!r.ok) onErro(r.erro)
      else { setEditando(false); onRefresh() }
    })
  }

  function onMover(direcao: 'up' | 'down') {
    onErro(null)
    startTransition(async () => {
      const r = await moverEtapa(trilhaId, etapa.id, direcao)
      if (!r.ok) onErro(r.erro)
      else onRefresh()
    })
  }

  function onExcluir() {
    if (!confirm(`Excluir a etapa "${etapa.nome}"?`)) return
    onErro(null)
    startTransition(async () => {
      const r = await excluirEtapa(etapa.id, trilhaId)
      if (!r.ok) onErro(r.erro)
      else onRefresh()
    })
  }

  function onAdicionarCurso() {
    if (!cursoSelecionado) return
    onErro(null)
    startTransition(async () => {
      const r = await adicionarCursoNaEtapa(etapa.id, trilhaId, cursoSelecionado)
      if (!r.ok) onErro(r.erro)
      else { setCursoSelecionado(''); onRefresh() }
    })
  }

  function onRemoverCurso(cursoId: string) {
    onErro(null)
    startTransition(async () => {
      const r = await removerCursoDaEtapa(etapa.id, trilhaId, cursoId)
      if (!r.ok) onErro(r.erro)
      else onRefresh()
    })
  }

  function onMoverMissao(cursoId: string, direcao: 'up' | 'down') {
    onErro(null)
    startTransition(async () => {
      const r = await moverMissao(etapa.id, trilhaId, cursoId, direcao)
      if (!r.ok) onErro(r.erro)
      else onRefresh()
    })
  }

  const cursosDisponiveis = cursos.filter(c => !etapa.missoes.some(m => m.cursoId === c.id))

  return (
    <div className="ad-modulo-bloco">
      <div className="ad-modulo-cab">
        <button type="button" className="ad-modulo-toggle" onClick={onToggle}>
          {expandida ? '▾' : '▸'} {etapa.nome}
        </button>
        <div className="ad-modulo-acoes">
          <span className="ad-modulo-contagem">{etapa.missoes.length} curso{etapa.missoes.length === 1 ? '' : 's'}</span>
          <button type="button" disabled={pendente || indice === 0} onClick={() => onMover('up')} title="Mover para cima"><IconeArrowUp size={13} /></button>
          <button type="button" disabled={pendente || indice === total - 1} onClick={() => onMover('down')} title="Mover para baixo"><IconeArrowDown size={13} /></button>
          <button type="button" onClick={() => setEditando(v => !v)} title="Editar"><IconePencil size={13} /></button>
          <button type="button" className="ad-btn-perigo-sm" disabled={pendente} onClick={onExcluir} title="Excluir etapa"><IconeTrash size={13} /></button>
        </div>
      </div>

      {expandida && (
        <div className="ad-modulo-corpo">
          {editando && (
            <form onSubmit={onSalvar} className="ad-form">
              <label>Nome
                <input name="nome" defaultValue={etapa.nome} required />
              </label>
              <label>Descrição
                <textarea name="descricao" defaultValue={etapa.descricao ?? ''} rows={2} />
              </label>
              <div className="ad-form-linha">
                <label>XP de conclusão
                  <input name="xp_conclusao" type="number" min="0" defaultValue={etapa.xpConclusao} />
                </label>
                <label>Insígnia
                  <input name="insignia" defaultValue={etapa.insignia ?? ''} />
                </label>
              </div>
              <button type="submit" className="ad-btn-primario" disabled={pendente}>{pendente ? 'Salvando...' : 'Salvar etapa'}</button>
            </form>
          )}

          <div className="ad-sublista">
            <h3>Cursos desta etapa</h3>
            {etapa.missoes.length === 0 && <p className="ad-vazio-sm">Nenhum curso vinculado.</p>}
            <ul>
              {etapa.missoes.map((m, i) => (
                <li key={m.cursoId}>
                  <span>{m.curso.titulo}</span>
                  <button type="button" disabled={pendente || i === 0} onClick={() => onMoverMissao(m.cursoId, 'up')} title="Mover para cima"><IconeArrowUp size={13} /></button>
                  <button type="button" disabled={pendente || i === etapa.missoes.length - 1} onClick={() => onMoverMissao(m.cursoId, 'down')} title="Mover para baixo"><IconeArrowDown size={13} /></button>
                  <button type="button" className="ad-btn-perigo-sm" disabled={pendente} onClick={() => onRemoverCurso(m.cursoId)}><IconeTrash size={13} /></button>
                </li>
              ))}
            </ul>
            <div className="ad-nova-linha">
              <select value={cursoSelecionado} onChange={e => setCursoSelecionado(e.target.value)}>
                <option value="">Selecione um curso...</option>
                {cursosDisponiveis.map(c => (
                  <option key={c.id} value={c.id}>{c.titulo}</option>
                ))}
              </select>
              <button type="button" className="ad-btn-secundario" disabled={pendente || !cursoSelecionado} onClick={onAdicionarCurso}>+ Vincular curso</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

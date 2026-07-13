// components/AdminAvaliacoesContent.tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { AvaliacaoListaItem } from '@/lib/queries/admin-avaliacoes'
import type { CursoPicker } from '@/lib/queries/admin-trilhas'
import { criarAvaliacao, alternarPublicacaoAvaliacao, excluirAvaliacao } from '@/app/admin/avaliacoes/actions'

export default function AdminAvaliacoesContent({ avaliacoes, cursos, cursoFiltro }: {
  avaliacoes: AvaliacaoListaItem[]; cursos: CursoPicker[]; cursoFiltro: string
}) {
  const router = useRouter()
  const [criando, setCriando] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [cursoId, setCursoId] = useState(cursoFiltro || '')
  const [tipo, setTipo] = useState<'avaliacao' | 'prova'>('avaliacao')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, startTransition] = useTransition()

  function onFiltrar(valor: string) {
    router.push(valor ? `/admin/avaliacoes?curso=${valor}` : '/admin/avaliacoes')
  }

  function onCriar() {
    setErro(null)
    if (!cursoId) { setErro('Selecione um curso.'); return }
    if (titulo.trim().length < 3) { setErro('Título precisa ter pelo menos 3 caracteres.'); return }
    const fd = new FormData()
    fd.set('curso_id', cursoId)
    fd.set('titulo', titulo)
    fd.set('tipo', tipo)
    startTransition(async () => {
      const r = await criarAvaliacao(fd)
      if (!r.ok) { setErro(r.erro); return }
      router.push(`/admin/avaliacoes/${r.id}`)
    })
  }

  function onAlternarPublicacao(id: string, curso_id: string, publicado: boolean) {
    setErro(null)
    startTransition(async () => {
      const r = await alternarPublicacaoAvaliacao(id, curso_id, publicado)
      if (!r.ok) setErro(r.erro)
      else router.refresh()
    })
  }

  function onExcluir(id: string, curso_id: string, titulo: string) {
    if (!confirm(`Excluir a avaliação "${titulo}"? Isso apaga as questões vinculadas. Essa ação não pode ser desfeita.`)) return
    setErro(null)
    startTransition(async () => {
      const r = await excluirAvaliacao(id, curso_id)
      if (!r.ok) setErro(r.erro)
      else router.refresh()
    })
  }

  return (
    <div className="ad-cursos">
      <div className="ad-cursos-cab">
        <div>
          <h1>Avaliações</h1>
          <p className="ad-sub">Quizzes por módulo e provas finais (desafios periciais) de cada curso.</p>
        </div>
        <button type="button" className="ad-btn-primario" onClick={() => setCriando(v => !v)}>
          + Nova avaliação
        </button>
      </div>

      <div className="ad-nova-linha">
        <select value={cursoFiltro} onChange={e => onFiltrar(e.target.value)}>
          <option value="">Todos os cursos</option>
          {cursos.map(c => (
            <option key={c.id} value={c.id}>{c.titulo}</option>
          ))}
        </select>
      </div>

      {erro && <p className="ad-erro">{erro}</p>}

      {criando && (
        <div className="ad-busca-card">
          <label>Curso
            <select value={cursoId} onChange={e => setCursoId(e.target.value)}>
              <option value="">Selecione um curso...</option>
              {cursos.map(c => (
                <option key={c.id} value={c.id}>{c.titulo}</option>
              ))}
            </select>
          </label>
          <label>Tipo
            <select value={tipo} onChange={e => setTipo(e.target.value as 'avaliacao' | 'prova')}>
              <option value="avaliacao">Avaliação de módulo</option>
              <option value="prova">Prova final (O Caso)</option>
            </select>
          </label>
          <label>Título
            <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Caso Perícia Contábil 01" autoFocus />
          </label>
          <div className="ad-form-acoes">
            <button type="button" className="ad-btn-primario" disabled={pendente} onClick={onCriar}>
              {pendente ? 'Criando...' : 'Criar e editar'}
            </button>
            <button type="button" className="ad-btn-secundario" onClick={() => { setCriando(false); setTitulo('') }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="ad-lista-admins">
        {avaliacoes.length === 0 && <p className="ad-vazio">Nenhuma avaliação cadastrada ainda.</p>}
        {avaliacoes.map(a => (
          <div key={a.id} className="ad-admin-linha">
            <div className="ad-admin-quem">
              <div>
                <a href={`/admin/avaliacoes/${a.id}`}><b>{a.titulo}</b></a>
                <span className="ad-admin-slug">
                  {a.cursoTitulo}{a.moduloTitulo ? ` · ${a.moduloTitulo}` : ''} · {a.tipo === 'prova' ? 'Prova final' : 'Avaliação'} · {a.totalQuestoes} questão{a.totalQuestoes === 1 ? '' : 'ões'}
                </span>
              </div>
            </div>
            <div className="ad-curso-acoes">
              <label className={`ad-toggle-papel${a.publicado ? ' ativo' : ''}`}>
                <input
                  type="checkbox"
                  checked={a.publicado}
                  disabled={pendente}
                  onChange={e => onAlternarPublicacao(a.id, a.cursoId, e.target.checked)}
                />
                {a.publicado ? 'Publicado' : 'Rascunho'}
              </label>
              <a href={`/admin/avaliacoes/${a.id}`} className="ad-btn-secundario">Editar</a>
              <button type="button" className="ad-btn-perigo" disabled={pendente} onClick={() => onExcluir(a.id, a.cursoId, a.titulo)}>
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

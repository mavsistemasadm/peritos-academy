// components/AdminAvaliacoesContent.tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { AvaliacaoListaItem } from '@/lib/queries/admin-avaliacoes'
import type { CursoPicker } from '@/lib/queries/admin-trilhas'
import { criarAvaliacao, alternarPublicacaoAvaliacao, excluirAvaliacao } from '@/app/admin/avaliacoes/actions'
import { useAdminToast, AdminToastContainer } from '@/components/AdminToast'

export default function AdminAvaliacoesContent({ avaliacoes, cursos, cursoFiltro }: {
  avaliacoes: AvaliacaoListaItem[]; cursos: CursoPicker[]; cursoFiltro: string
}) {
  const router = useRouter()
  const toast = useAdminToast()
  const [criando, setCriando] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [cursoId, setCursoId] = useState(cursoFiltro || '')
  const [tipo, setTipo] = useState<'avaliacao' | 'prova'>('avaliacao')
  const [pendente, startTransition] = useTransition()

  function onFiltrar(valor: string) {
    router.push(valor ? `/admin/avaliacoes?curso=${valor}` : '/admin/avaliacoes')
  }

  function onCriar() {
    if (!cursoId) { toast.erro('Selecione um curso.'); return }
    if (titulo.trim().length < 3) { toast.erro('Título precisa ter pelo menos 3 caracteres.'); return }
    const fd = new FormData()
    fd.set('curso_id', cursoId)
    fd.set('titulo', titulo)
    fd.set('tipo', tipo)
    startTransition(async () => {
      const r = await criarAvaliacao(fd)
      if (!r.ok) { toast.erro(r.erro); return }
      toast.sucesso('Avaliação criada com sucesso')
      router.push(`/admin/avaliacoes/${r.id}`)
    })
  }

  function onAlternarPublicacao(id: string, curso_id: string, publicado: boolean) {
    startTransition(async () => {
      const r = await alternarPublicacaoAvaliacao(id, curso_id, publicado)
      if (!r.ok) toast.erro(r.erro)
      else { toast.sucesso(publicado ? 'Avaliação publicada com sucesso' : 'Avaliação voltou a rascunho'); router.refresh() }
    })
  }

  function onExcluir(id: string, curso_id: string, titulo: string) {
    if (!confirm(`Excluir a avaliação "${titulo}"? Isso apaga as questões vinculadas. Essa ação não pode ser desfeita.`)) return
    startTransition(async () => {
      const r = await excluirAvaliacao(id, curso_id)
      if (!r.ok) toast.erro(r.erro)
      else { toast.sucesso('Avaliação excluída com sucesso'); router.refresh() }
    })
  }

  return (
    <div className="ad-cursos">
      <AdminToastContainer toasts={toast.toasts} remover={toast.remover} />
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

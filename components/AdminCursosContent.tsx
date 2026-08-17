// components/AdminCursosContent.tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { CursoListaItem } from '@/lib/queries/admin-cursos'
import { criarCurso, alternarPublicacaoCurso, excluirCurso } from '@/app/admin/cursos/actions'
import { useAdminToast, AdminToastContainer } from '@/components/AdminToast'

export default function AdminCursosContent({ cursos }: { cursos: CursoListaItem[] }) {
  const router = useRouter()
  const [criando, setCriando] = useState(false)
  const [titulo, setTitulo] = useState('')
  const toast = useAdminToast()
  const [pendente, startTransition] = useTransition()

  function onCriar() {
    if (titulo.trim().length < 3) { toast.erro('Título precisa ter pelo menos 3 caracteres.'); return }
    const fd = new FormData()
    fd.set('titulo', titulo)
    startTransition(async () => {
      const r = await criarCurso(fd)
      if (!r.ok) { toast.erro(r.erro); return }
      toast.sucesso('Curso criado com sucesso')
      router.push(`/admin/cursos/${r.id}`)
    })
  }

  function onAlternarPublicacao(id: string, publicado: boolean) {
    startTransition(async () => {
      const r = await alternarPublicacaoCurso(id, publicado)
      if (!r.ok) toast.erro(r.erro)
      else { toast.sucesso(publicado ? 'Curso publicado com sucesso' : 'Curso voltou a rascunho'); router.refresh() }
    })
  }

  function onExcluir(id: string, titulo: string) {
    if (!confirm(`Excluir o curso "${titulo}"? Isso apaga módulos, aulas e avaliações vinculadas. Essa ação não pode ser desfeita.`)) return
    startTransition(async () => {
      const r = await excluirCurso(id)
      if (!r.ok) toast.erro(r.erro)
      else { toast.sucesso('Curso excluído com sucesso'); router.refresh() }
    })
  }

  return (
    <div className="pnl-cursos">
      <AdminToastContainer toasts={toast.toasts} remover={toast.remover} />
      <div className="pnl-cursos-cab">
        <div>
          <h1>Cursos</h1>
          <p className="pnl-sub">Gerencie cursos, módulos e aulas da plataforma.</p>
        </div>
        <button type="button" className="pnl-btn-primario" onClick={() => setCriando(v => !v)}>
          + Novo curso
        </button>
      </div>

      {criando && (
        <div className="pnl-busca-card">
          <label htmlFor="novo-curso-titulo">Título do curso</label>
          <input
            id="novo-curso-titulo"
            type="text"
            value={titulo}
            onChange={e => setTitulo(e.target.value)}
            placeholder="Ex.: Perícia Bancária Aplicada"
            autoFocus
          />
          <div className="pnl-form-acoes">
            <button type="button" className="pnl-btn-primario" disabled={pendente} onClick={onCriar}>
              {pendente ? 'Criando...' : 'Criar e editar'}
            </button>
            <button type="button" className="pnl-btn-secundario" onClick={() => { setCriando(false); setTitulo('') }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="pnl-cursos-grid">
        {cursos.length === 0 && <p className="pnl-vazio">Nenhum curso cadastrado ainda.</p>}
        {cursos.map(c => (
          <div key={c.id} className="pnl-curso-card">
            <a href={`/admin/cursos/${c.id}`} className="pnl-curso-capa" style={c.capaUrl ? { backgroundImage: `url(${c.capaUrl})` } : undefined}>
              {!c.capaUrl && <span>Sem capa</span>}
            </a>
            <div className="pnl-curso-info">
              <a href={`/admin/cursos/${c.id}`} className="pnl-curso-titulo">{c.titulo}</a>
              {c.subtitulo && <p className="pnl-curso-subtitulo">{c.subtitulo}</p>}
              <div className="pnl-curso-meta">
                <span>{c.totalModulos} módulo{c.totalModulos === 1 ? '' : 's'}</span>
                <span>{c.totalAulas} aula{c.totalAulas === 1 ? '' : 's'}</span>
                {c.nivel && <span>{c.nivel}</span>}
              </div>
              <div className="pnl-curso-acoes">
                <label className={`pnl-toggle-papel${c.publicado ? ' ativo' : ''}`}>
                  <input
                    type="checkbox"
                    checked={c.publicado}
                    disabled={pendente}
                    onChange={e => onAlternarPublicacao(c.id, e.target.checked)}
                  />
                  {c.publicado ? 'Publicado' : 'Rascunho'}
                </label>
                <button type="button" className="pnl-btn-perigo" disabled={pendente} onClick={() => onExcluir(c.id, c.titulo)}>
                  Excluir
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

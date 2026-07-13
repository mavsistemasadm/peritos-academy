// components/AdminCursosContent.tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { CursoListaItem } from '@/lib/queries/admin-cursos'
import { criarCurso, alternarPublicacaoCurso, excluirCurso } from '@/app/admin/cursos/actions'

export default function AdminCursosContent({ cursos }: { cursos: CursoListaItem[] }) {
  const router = useRouter()
  const [criando, setCriando] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, startTransition] = useTransition()

  function onCriar() {
    setErro(null)
    if (titulo.trim().length < 3) { setErro('Título precisa ter pelo menos 3 caracteres.'); return }
    const fd = new FormData()
    fd.set('titulo', titulo)
    startTransition(async () => {
      const r = await criarCurso(fd)
      if (!r.ok) { setErro(r.erro); return }
      router.push(`/admin/cursos/${r.id}`)
    })
  }

  function onAlternarPublicacao(id: string, publicado: boolean) {
    setErro(null)
    startTransition(async () => {
      const r = await alternarPublicacaoCurso(id, publicado)
      if (!r.ok) setErro(r.erro)
      else router.refresh()
    })
  }

  function onExcluir(id: string, titulo: string) {
    if (!confirm(`Excluir o curso "${titulo}"? Isso apaga módulos, aulas e avaliações vinculadas. Essa ação não pode ser desfeita.`)) return
    setErro(null)
    startTransition(async () => {
      const r = await excluirCurso(id)
      if (!r.ok) setErro(r.erro)
      else router.refresh()
    })
  }

  return (
    <div className="ad-cursos">
      <div className="ad-cursos-cab">
        <div>
          <h1>Cursos</h1>
          <p className="ad-sub">Gerencie cursos, módulos e aulas da plataforma.</p>
        </div>
        <button type="button" className="ad-btn-primario" onClick={() => setCriando(v => !v)}>
          + Novo curso
        </button>
      </div>

      {erro && <p className="ad-erro">{erro}</p>}

      {criando && (
        <div className="ad-busca-card">
          <label htmlFor="novo-curso-titulo">Título do curso</label>
          <input
            id="novo-curso-titulo"
            type="text"
            value={titulo}
            onChange={e => setTitulo(e.target.value)}
            placeholder="Ex.: Perícia Bancária Aplicada"
            autoFocus
          />
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

      <div className="ad-cursos-grid">
        {cursos.length === 0 && <p className="ad-vazio">Nenhum curso cadastrado ainda.</p>}
        {cursos.map(c => (
          <div key={c.id} className="ad-curso-card">
            <a href={`/admin/cursos/${c.id}`} className="ad-curso-capa" style={c.capaUrl ? { backgroundImage: `url(${c.capaUrl})` } : undefined}>
              {!c.capaUrl && <span>Sem capa</span>}
            </a>
            <div className="ad-curso-info">
              <a href={`/admin/cursos/${c.id}`} className="ad-curso-titulo">{c.titulo}</a>
              {c.subtitulo && <p className="ad-curso-subtitulo">{c.subtitulo}</p>}
              <div className="ad-curso-meta">
                <span>{c.totalModulos} módulo{c.totalModulos === 1 ? '' : 's'}</span>
                <span>{c.totalAulas} aula{c.totalAulas === 1 ? '' : 's'}</span>
                {c.nivel && <span>{c.nivel}</span>}
              </div>
              <div className="ad-curso-acoes">
                <label className={`ad-toggle-papel${c.publicado ? ' ativo' : ''}`}>
                  <input
                    type="checkbox"
                    checked={c.publicado}
                    disabled={pendente}
                    onChange={e => onAlternarPublicacao(c.id, e.target.checked)}
                  />
                  {c.publicado ? 'Publicado' : 'Rascunho'}
                </label>
                <button type="button" className="ad-btn-perigo" disabled={pendente} onClick={() => onExcluir(c.id, c.titulo)}>
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

// components/AdminTrilhasContent.tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { TrilhaListaItem } from '@/lib/queries/admin-trilhas'
import { criarTrilha, excluirTrilha } from '@/app/admin/trilhas/actions'

export default function AdminTrilhasContent({ trilhas }: { trilhas: TrilhaListaItem[] }) {
  const router = useRouter()
  const [criando, setCriando] = useState(false)
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, startTransition] = useTransition()

  function onCriar() {
    setErro(null)
    if (nome.trim().length < 3) { setErro('Nome precisa ter pelo menos 3 caracteres.'); return }
    const fd = new FormData()
    fd.set('nome', nome)
    startTransition(async () => {
      const r = await criarTrilha(fd)
      if (!r.ok) { setErro(r.erro); return }
      router.push(`/admin/trilhas/${r.id}`)
    })
  }

  function onExcluir(id: string, nome: string) {
    if (!confirm(`Excluir a trilha "${nome}"? Isso apaga suas etapas. Essa ação não pode ser desfeita.`)) return
    setErro(null)
    startTransition(async () => {
      const r = await excluirTrilha(id)
      if (!r.ok) setErro(r.erro)
      else router.refresh()
    })
  }

  return (
    <div className="ad-trilhas">
      <div className="ad-cursos-cab">
        <div>
          <h1>Trilhas</h1>
          <p className="ad-sub">Organize os cursos em trilhas e etapas — alimenta o catálogo em /biblioteca.</p>
        </div>
        <button type="button" className="ad-btn-primario" onClick={() => setCriando(v => !v)}>
          + Nova trilha
        </button>
      </div>

      {erro && <p className="ad-erro">{erro}</p>}

      {criando && (
        <div className="ad-busca-card">
          <label htmlFor="nova-trilha-nome">Nome da trilha</label>
          <input
            id="nova-trilha-nome"
            type="text"
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="Ex.: Perícia Bancária"
            autoFocus
          />
          <div className="ad-form-acoes">
            <button type="button" className="ad-btn-primario" disabled={pendente} onClick={onCriar}>
              {pendente ? 'Criando...' : 'Criar e editar'}
            </button>
            <button type="button" className="ad-btn-secundario" onClick={() => { setCriando(false); setNome('') }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="ad-lista-admins">
        {trilhas.length === 0 && <p className="ad-vazio">Nenhuma trilha cadastrada ainda.</p>}
        {trilhas.map(t => (
          <div key={t.id} className="ad-admin-linha">
            <div className="ad-admin-quem">
              <div>
                <a href={`/admin/trilhas/${t.id}`}><b>{t.nome ?? 'Sem nome'}</b></a>
                <span className="ad-admin-slug">{t.totalEtapas} etapa{t.totalEtapas === 1 ? '' : 's'}{t.principal ? ' · principal' : ''}</span>
              </div>
            </div>
            <div className="ad-curso-acoes">
              <a href={`/admin/trilhas/${t.id}`} className="ad-btn-secundario">Editar</a>
              <button type="button" className="ad-btn-perigo" disabled={pendente} onClick={() => onExcluir(t.id, t.nome ?? 'Sem nome')}>
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

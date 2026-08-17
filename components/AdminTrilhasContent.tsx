// components/AdminTrilhasContent.tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { TrilhaListaItem } from '@/lib/queries/admin-trilhas'
import { criarTrilha, excluirTrilha } from '@/app/admin/trilhas/actions'
import { useAdminToast, AdminToastContainer } from '@/components/AdminToast'

export default function AdminTrilhasContent({ trilhas }: { trilhas: TrilhaListaItem[] }) {
  const router = useRouter()
  const toast = useAdminToast()
  const [criando, setCriando] = useState(false)
  const [nome, setNome] = useState('')
  const [pendente, startTransition] = useTransition()

  function onCriar() {
    if (nome.trim().length < 3) { toast.erro('Nome precisa ter pelo menos 3 caracteres.'); return }
    const fd = new FormData()
    fd.set('nome', nome)
    startTransition(async () => {
      const r = await criarTrilha(fd)
      if (!r.ok) { toast.erro(r.erro); return }
      toast.sucesso('Trilha criada com sucesso')
      router.push(`/admin/trilhas/${r.id}`)
    })
  }

  function onExcluir(id: string, nome: string) {
    if (!confirm(`Excluir a trilha "${nome}"? Isso apaga suas etapas. Essa ação não pode ser desfeita.`)) return
    startTransition(async () => {
      const r = await excluirTrilha(id)
      if (!r.ok) toast.erro(r.erro)
      else { toast.sucesso('Trilha excluída com sucesso'); router.refresh() }
    })
  }

  return (
    <div className="pnl-trilhas">
      <AdminToastContainer toasts={toast.toasts} remover={toast.remover} />
      <div className="pnl-cursos-cab">
        <div>
          <h1>Trilhas</h1>
          <p className="pnl-sub">Organize os cursos em trilhas e etapas, alimenta o catálogo em /biblioteca.</p>
        </div>
        <button type="button" className="pnl-btn-primario" onClick={() => setCriando(v => !v)}>
          + Nova trilha
        </button>
      </div>

      {criando && (
        <div className="pnl-busca-card">
          <label htmlFor="nova-trilha-nome">Nome da trilha</label>
          <input
            id="nova-trilha-nome"
            type="text"
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="Ex.: Perícia Bancária"
            autoFocus
          />
          <div className="pnl-form-acoes">
            <button type="button" className="pnl-btn-primario" disabled={pendente} onClick={onCriar}>
              {pendente ? 'Criando...' : 'Criar e editar'}
            </button>
            <button type="button" className="pnl-btn-secundario" onClick={() => { setCriando(false); setNome('') }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="pnl-lista-admins">
        {trilhas.length === 0 && <p className="pnl-vazio">Nenhuma trilha cadastrada ainda.</p>}
        {trilhas.map(t => (
          <div key={t.id} className="pnl-admin-linha">
            <div className="pnl-admin-quem">
              <div>
                <a href={`/admin/trilhas/${t.id}`}><b>{t.nome ?? 'Sem nome'}</b></a>
                <span className="pnl-admin-slug">{t.totalEtapas} etapa{t.totalEtapas === 1 ? '' : 's'}{t.principal ? ' · principal' : ''}</span>
              </div>
            </div>
            <div className="pnl-curso-acoes">
              <a href={`/admin/trilhas/${t.id}`} className="pnl-btn-secundario">Editar</a>
              <button type="button" className="pnl-btn-perigo" disabled={pendente} onClick={() => onExcluir(t.id, t.nome ?? 'Sem nome')}>
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// components/AdminAdministradoresContent.tsx
'use client'

import { useState, useTransition } from 'react'
import type { AdministradorLinha, PerfilBusca } from '@/lib/queries/admin-usuarios'
import { NOME_PAPEL } from '@/lib/admin/permissoes'
import type { PapelAdmin } from '@/lib/admin/permissoes'
import { buscarPerfis, concederPapel, alternarPapel } from '@/app/admin/administradores/actions'
import { useAdminToast, AdminToastContainer } from '@/components/AdminToast'

const PAPEIS: PapelAdmin[] = ['super_admin', 'conteudo', 'financeiro', 'moderador']

function iniciais(nome: string) {
  return nome.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

export default function AdminAdministradoresContent({ administradores }: { administradores: AdministradorLinha[] }) {
  const toast = useAdminToast()
  const [termo, setTermo] = useState('')
  const [resultados, setResultados] = useState<PerfilBusca[]>([])
  const [buscando, startBusca] = useTransition()
  const [salvando, startSalvar] = useTransition()

  function onBuscar(valor: string) {
    setTermo(valor)
    if (valor.trim().length < 2) { setResultados([]); return }
    startBusca(async () => {
      const r = await buscarPerfis(valor)
      setResultados(r)
    })
  }

  function onConceder(usuarioId: string, papel: PapelAdmin) {
    const fd = new FormData()
    fd.set('usuario_id', usuarioId)
    fd.set('papel', papel)
    startSalvar(async () => {
      const r = await concederPapel(fd)
      if (!r.ok) toast.erro(r.erro)
      else { toast.sucesso('Papel concedido com sucesso'); setTermo(''); setResultados([]) }
    })
  }

  function onAlternar(id: string, ativo: boolean) {
    const fd = new FormData()
    fd.set('id', id)
    fd.set('ativo', String(ativo))
    startSalvar(async () => {
      const r = await alternarPapel(fd)
      if (!r.ok) toast.erro(r.erro)
      else toast.sucesso(ativo ? 'Papel reativado com sucesso' : 'Papel desativado com sucesso')
    })
  }

  return (
    <div className="pnl-admins">
      <AdminToastContainer toasts={toast.toasts} remover={toast.remover} />
      <h1>Gestão de Administradores</h1>
      <p className="pnl-sub">Conceda ou revogue papéis de acesso ao painel admin.</p>

      <div className="pnl-busca-card">
        <label htmlFor="busca-admin">Buscar por nome ou slug</label>
        <input
          id="busca-admin"
          type="text"
          value={termo}
          onChange={e => onBuscar(e.target.value)}
          placeholder="Digite ao menos 2 caracteres..."
          autoComplete="off"
        />
        {buscando && <span className="pnl-busca-status">Buscando...</span>}
        {resultados.length > 0 && (
          <ul className="pnl-busca-resultados">
            {resultados.map(p => (
              <li key={p.id}>
                <span className="pnl-avatar">{iniciais(p.nome)}</span>
                <span className="pnl-busca-nome">{p.nome}</span>
                <div className="pnl-busca-acoes">
                  {PAPEIS.map(papel => (
                    <button
                      key={papel}
                      type="button"
                      disabled={salvando}
                      onClick={() => onConceder(p.id, papel)}
                      className="pnl-btn-papel"
                    >
                      + {NOME_PAPEL[papel]}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="pnl-lista-admins">
        {administradores.length === 0 && <p className="pnl-vazio">Nenhum administrador cadastrado.</p>}
        {administradores.map(a => (
          <div key={a.usuarioId} className="pnl-admin-linha">
            <div className="pnl-admin-quem">
              <span className="pnl-avatar">{iniciais(a.nome)}</span>
              <div>
                <b>{a.nome}</b>
                {a.slug && <span className="pnl-admin-slug">/perito/{a.slug}</span>}
              </div>
            </div>
            <div className="pnl-admin-papeis">
              {a.papeis.map(pc => (
                <label key={pc.id} className={`pnl-toggle-papel${pc.ativo ? ' ativo' : ''}`}>
                  <input
                    type="checkbox"
                    checked={pc.ativo}
                    disabled={salvando}
                    onChange={e => onAlternar(pc.id, e.target.checked)}
                  />
                  {NOME_PAPEL[pc.papel]}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

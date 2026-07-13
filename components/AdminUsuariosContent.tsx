// components/AdminUsuariosContent.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { UsuarioLinha } from '@/lib/queries/admin-suporte'
import { IconeSearch, IconeChevronLeft, IconeChevronRight } from '@/components/Icones'

const NOME_STATUS_CONTA: Record<string, string> = { ativo: 'Ativo', suspenso: 'Suspenso', banido: 'Banido' }
const NOME_STATUS_ASSINATURA: Record<string, string> = {
  ativa: 'Ativa', inadimplente: 'Inadimplente', suspensa: 'Suspensa', cancelada: 'Cancelada',
  cortesia: 'Cortesia', sem_assinatura: 'Sem assinatura',
}

function fmtDataHora(iso: string | null) {
  if (!iso) return 'nunca'
  return new Date(iso).toLocaleString('pt-BR')
}

type Filtros = {
  busca?: string; status?: string; assinatura?: string; nivel?: string; ativos?: string; ordenar?: string; dir?: string; pagina?: string
}

export default function AdminUsuariosContent({ usuarios, totalCount, pagina, porPagina, filtrosAtuais }: {
  usuarios: UsuarioLinha[]; totalCount: number; pagina: number; porPagina: number; filtrosAtuais: Filtros
}) {
  const router = useRouter()
  const [busca, setBusca] = useState(filtrosAtuais.busca ?? '')

  const totalPaginas = Math.max(1, Math.ceil(totalCount / porPagina))

  function navegar(novos: Partial<Filtros>) {
    const params: Filtros = { ...filtrosAtuais, ...novos }
    if (!('pagina' in novos)) params.pagina = undefined
    const qs = new URLSearchParams()
    if (params.busca) qs.set('busca', params.busca)
    if (params.status) qs.set('status', params.status)
    if (params.assinatura) qs.set('assinatura', params.assinatura)
    if (params.nivel) qs.set('nivel', params.nivel)
    if (params.ativos) qs.set('ativos', params.ativos)
    if (params.ordenar) qs.set('ordenar', params.ordenar)
    if (params.dir) qs.set('dir', params.dir)
    if (params.pagina) qs.set('pagina', params.pagina)
    const s = qs.toString()
    router.push(s ? `/admin/usuarios?${s}` : '/admin/usuarios')
  }

  function onOrdenar(coluna: string) {
    const mesmaColuna = filtrosAtuais.ordenar === coluna
    const novaDir = mesmaColuna && filtrosAtuais.dir === 'asc' ? 'desc' : 'asc'
    navegar({ ordenar: coluna, dir: novaDir })
  }

  return (
    <div className="ad-cursos">
      <div className="ad-cursos-cab">
        <div>
          <h1>Usuários</h1>
          <p className="ad-sub">Visão 360° de cada aluno — suporte, progresso, gamificação e financeiro.</p>
        </div>
      </div>

      <section className="ad-card">
        <div className="ad-form-linha" style={{ marginBottom: 12 }}>
          <form
            onSubmit={e => { e.preventDefault(); navegar({ busca }) }}
            style={{ display: 'flex', gap: 8, flex: 2 }}
          >
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nome ou e-mail..." />
            <button type="submit" className="ad-btn-secundario"><IconeSearch size={14} /></button>
          </form>
          <label>Status da conta
            <select value={filtrosAtuais.status ?? ''} onChange={e => navegar({ status: e.target.value || undefined })}>
              <option value="">Todos</option>
              <option value="ativo">Ativo</option>
              <option value="suspenso">Suspenso</option>
              <option value="banido">Banido</option>
            </select>
          </label>
          <label>Assinatura
            <select value={filtrosAtuais.assinatura ?? ''} onChange={e => navegar({ assinatura: e.target.value || undefined })}>
              <option value="">Todas</option>
              {Object.entries(NOME_STATUS_ASSINATURA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label>Ativos nos últimos
            <select value={filtrosAtuais.ativos ?? ''} onChange={e => navegar({ ativos: e.target.value || undefined })}>
              <option value="">Sempre</option>
              <option value="7">7 dias</option>
              <option value="30">30 dias</option>
            </select>
          </label>
        </div>

        {usuarios.length === 0 && <p className="ad-vazio">Nenhum usuário encontrado com esses filtros.</p>}
        {usuarios.length > 0 && (
          <div className="ad-tabela-scroll">
            <table className="ad-tabela">
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer' }} onClick={() => onOrdenar('nome')}>Nome</th>
                  <th>E-mail</th>
                  <th>Assinatura</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => onOrdenar('nivel')}>Nível</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => onOrdenar('ultimo_acesso')}>Último acesso</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map(u => (
                  <tr key={u.id}>
                    <td>{u.nome}</td>
                    <td>{u.email ?? '—'}</td>
                    <td><span className={`ad-status-pill ${u.assinaturaStatus}`}>{NOME_STATUS_ASSINATURA[u.assinaturaStatus] ?? u.assinaturaStatus}</span></td>
                    <td>{u.nivelNome ?? `Nível ${u.nivel}`}</td>
                    <td>{fmtDataHora(u.ultimoAcesso)}</td>
                    <td><span className={`ad-status-pill ${u.status}`}>{NOME_STATUS_CONTA[u.status]}</span></td>
                    <td>
                      <a href={`/admin/usuarios/${u.id}`} className="ad-btn-secundario">Ver ficha</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPaginas > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <button type="button" className="ad-btn-secundario" disabled={pagina <= 1} onClick={() => navegar({ pagina: String(pagina - 1) })}>
              <IconeChevronLeft size={14} />
            </button>
            <span className="ad-fin-nota">Página {pagina} de {totalPaginas} ({totalCount} usuários)</span>
            <button type="button" className="ad-btn-secundario" disabled={pagina >= totalPaginas} onClick={() => navegar({ pagina: String(pagina + 1) })}>
              <IconeChevronRight size={14} />
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

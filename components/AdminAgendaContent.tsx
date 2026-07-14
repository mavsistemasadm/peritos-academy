// components/AdminAgendaContent.tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { EventoAdmin } from '@/lib/queries/admin-agenda'
import { criarEvento, alternarPublicacaoEvento, excluirEvento } from '@/app/admin/agenda/actions'
import { useAdminToast, AdminToastContainer } from '@/components/AdminToast'

const NOME_TIPO: Record<string, string> = {
  sala_analise: 'Sala de análise', aula_ao_vivo: 'Aula ao vivo', plantao: 'Plantão',
  mentoria: 'Mentoria', lancamento: 'Lançamento',
}

export default function AdminAgendaContent({ eventos }: { eventos: EventoAdmin[] }) {
  const router = useRouter()
  const toast = useAdminToast()
  const [criando, setCriando] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [tipo, setTipo] = useState('aula_ao_vivo')
  const [pendente, startTransition] = useTransition()

  function onCriar() {
    if (titulo.trim().length < 3) { toast.erro('Título precisa ter pelo menos 3 caracteres.'); return }
    const fd = new FormData()
    fd.set('titulo', titulo)
    fd.set('tipo', tipo)
    startTransition(async () => {
      const r = await criarEvento(fd)
      if (!r.ok) { toast.erro(r.erro); return }
      toast.sucesso('Evento criado com sucesso')
      router.push(`/admin/agenda/${r.id}`)
    })
  }

  function onAlternarPublicacao(id: string, publicado: boolean) {
    startTransition(async () => {
      const r = await alternarPublicacaoEvento(id, publicado)
      if (!r.ok) toast.erro(r.erro)
      else { toast.sucesso(publicado ? 'Evento publicado com sucesso' : 'Evento voltou a rascunho'); router.refresh() }
    })
  }

  function onExcluir(id: string, titulo: string) {
    if (!confirm(`Excluir o evento "${titulo}"?`)) return
    startTransition(async () => {
      const r = await excluirEvento(id)
      if (!r.ok) toast.erro(r.erro)
      else { toast.sucesso('Evento excluído com sucesso'); router.refresh() }
    })
  }

  return (
    <div className="ad-cursos">
      <AdminToastContainer toasts={toast.toasts} remover={toast.remover} />
      <div className="ad-cursos-cab">
        <div>
          <h1>Agenda</h1>
          <p className="ad-sub">Eventos ao vivo e gravados — salas de análise, aulas, plantões, mentorias.</p>
        </div>
        <button type="button" className="ad-btn-primario" onClick={() => setCriando(v => !v)}>+ Novo evento</button>
      </div>

      {criando && (
        <div className="ad-busca-card">
          <label>Título
            <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Plantão de dúvidas — perícia bancária" autoFocus />
          </label>
          <label>Tipo
            <select value={tipo} onChange={e => setTipo(e.target.value)}>
              {Object.entries(NOME_TIPO).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <div className="ad-form-acoes">
            <button type="button" className="ad-btn-primario" disabled={pendente} onClick={onCriar}>{pendente ? 'Criando...' : 'Criar e editar'}</button>
            <button type="button" className="ad-btn-secundario" onClick={() => { setCriando(false); setTitulo('') }}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="ad-lista-admins">
        {eventos.length === 0 && <p className="ad-vazio">Nenhum evento cadastrado ainda.</p>}
        {eventos.map(e => (
          <div key={e.id} className="ad-admin-linha">
            <div className="ad-admin-quem">
              <div>
                <a href={`/admin/agenda/${e.id}`}><b>{e.titulo}</b></a>
                <span className="ad-admin-slug">
                  {NOME_TIPO[e.tipo] ?? e.tipo} · {e.iniciaEm ? new Date(e.iniciaEm).toLocaleString('pt-BR') : 'sem data'} · {e.totalReservas} reserva{e.totalReservas === 1 ? '' : 's'}
                </span>
              </div>
            </div>
            <div className="ad-curso-acoes">
              <label className={`ad-toggle-papel${e.publicado ? ' ativo' : ''}`}>
                <input type="checkbox" checked={e.publicado} disabled={pendente} onChange={ev => onAlternarPublicacao(e.id, ev.target.checked)} />
                {e.publicado ? 'Publicado' : 'Rascunho'}
              </label>
              <a href={`/admin/agenda/${e.id}`} className="ad-btn-secundario">Editar</a>
              <button type="button" className="ad-btn-perigo" disabled={pendente} onClick={() => onExcluir(e.id, e.titulo)}>Excluir</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

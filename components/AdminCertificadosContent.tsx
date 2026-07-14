// components/AdminCertificadosContent.tsx
'use client'

import { useState, useTransition } from 'react'
import type { FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { CertificadoAdmin, CursoCertificavel } from '@/lib/queries/admin-certificados'
import { revogarCertificado, reemitirCertificado, atualizarCursoCertificado } from '@/app/admin/certificados/actions'
import { useAdminToast, AdminToastContainer } from '@/components/AdminToast'

export default function AdminCertificadosContent({ certificados, cursos }: { certificados: CertificadoAdmin[]; cursos: CursoCertificavel[] }) {
  const router = useRouter()
  const toast = useAdminToast()
  const [pendente, startTransition] = useTransition()

  function onRevogar(id: string, numero: string) {
    if (!confirm(`Revogar o certificado ${numero}? O aluno perde o certificado até que seja reemitido.`)) return
    startTransition(async () => {
      const r = await revogarCertificado(id)
      if (!r.ok) toast.erro(r.erro)
      else { toast.sucesso('Certificado revogado com sucesso'); router.refresh() }
    })
  }

  function onReemitir(id: string) {
    startTransition(async () => {
      const r = await reemitirCertificado(id)
      if (!r.ok) toast.erro(r.erro)
      else { toast.sucesso('Certificado reemitido com sucesso'); router.refresh() }
    })
  }

  return (
    <div className="ad-cursos">
      <AdminToastContainer toasts={toast.toasts} remover={toast.remover} />
      <div className="ad-cursos-cab">
        <div>
          <h1>Certificados</h1>
          <p className="ad-sub">Certificados emitidos automaticamente ao concluir um curso com certificação.</p>
        </div>
      </div>

      <section className="ad-card">
        <h2>Cursos com certificação</h2>
        <p>Defina quais cursos emitem certificado e a carga horária que aparece nele.</p>
        <div className="ad-tabela-scroll">
          <table className="ad-tabela">
            <thead><tr><th>Curso</th><th>Emite certificado</th><th>Carga horária (h)</th><th></th></tr></thead>
            <tbody>
              {cursos.map(c => <CursoCertificadoLinha key={c.id} curso={c} onErro={toast.erro} onSucesso={toast.sucesso} />)}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ad-card">
        <h2>Certificados emitidos</h2>
        {certificados.length === 0 && <p className="ad-vazio">Nenhum certificado emitido ainda.</p>}
        {certificados.length > 0 && (
          <div className="ad-tabela-scroll">
            <table className="ad-tabela">
              <thead><tr><th>Número</th><th>Aluno</th><th>Curso</th><th>Nota</th><th>Carga h</th><th>Emitido em</th><th></th></tr></thead>
              <tbody>
                {certificados.map(c => (
                  <tr key={c.id}>
                    <td>{c.numero}</td>
                    <td>{c.usuarioNome}</td>
                    <td>{c.cursoTitulo}</td>
                    <td>{c.nota ?? '—'}</td>
                    <td>{c.cargaHoras ?? '—'}</td>
                    <td>{new Date(c.emitidoEm).toLocaleDateString('pt-BR')}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button type="button" className="ad-btn-secundario" disabled={pendente} onClick={() => onReemitir(c.id)}>Reemitir</button>
                      <button type="button" className="ad-btn-perigo" disabled={pendente} onClick={() => onRevogar(c.id, c.numero)}>Revogar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function CursoCertificadoLinha({ curso, onErro, onSucesso }: { curso: CursoCertificavel; onErro: (e: string) => void; onSucesso: (m: string) => void }) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()

  function onSalvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await atualizarCursoCertificado(curso.id, fd)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Configuração de certificado salva com sucesso'); router.refresh() }
    })
  }

  return (
    <tr>
      <td>{curso.titulo}</td>
      <td colSpan={3}>
        <form onSubmit={onSalvar} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label className="ad-checkbox-linha">
            <input type="checkbox" name="emite_certificado" defaultChecked={curso.emiteCertificado} />
            Emite
          </label>
          <input name="carga_horas" type="number" step="0.5" min="0" defaultValue={curso.cargaHoras ?? ''} className="ad-input-sm" placeholder="horas" />
          <button type="submit" className="ad-btn-secundario" disabled={pendente}>{pendente ? 'Salvando...' : 'Salvar'}</button>
        </form>
      </td>
    </tr>
  )
}

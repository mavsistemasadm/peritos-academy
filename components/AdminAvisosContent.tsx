// components/AdminAvisosContent.tsx
'use client'

import { useState, useTransition } from 'react'
import type { FormEvent, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { NovidadeAdmin } from '@/lib/queries/admin-avisos'
import {
  criarNovidade, atualizarNovidade, alternarPublicacaoNovidade, excluirNovidade, uploadImagemNovidade,
} from '@/app/admin/avisos/actions'
import { IconeTrash } from '@/components/Icones'
import { useAdminToast, AdminToastContainer } from '@/components/AdminToast'

export default function AdminAvisosContent({ novidades }: { novidades: NovidadeAdmin[] }) {
  const router = useRouter()
  const toast = useAdminToast()
  const [criando, setCriando] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [pendente, startTransition] = useTransition()
  const [expandido, setExpandido] = useState<string | null>(null)

  function onCriar() {
    if (!titulo.trim()) { toast.erro('Título é obrigatório.'); return }
    const fd = new FormData()
    fd.set('titulo', titulo)
    startTransition(async () => {
      const r = await criarNovidade(fd)
      if (!r.ok) { toast.erro(r.erro); return }
      toast.sucesso('Aviso criado com sucesso')
      setTitulo(''); setCriando(false)
      if (r.id) setExpandido(r.id)
      router.refresh()
    })
  }

  return (
    <div className="pnl-cursos">
      <AdminToastContainer toasts={toast.toasts} remover={toast.remover} />
      <div className="pnl-cursos-cab">
        <div>
          <h1>Avisos e novidades</h1>
          <p className="pnl-sub">Publica avisos no feed e banners do dashboard (imagem + link).</p>
        </div>
        <button type="button" className="pnl-btn-primario" onClick={() => setCriando(v => !v)}>+ Novo aviso</button>
      </div>

      {criando && (
        <div className="pnl-busca-card">
          <label>Título
            <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Nova trilha de Perícia Bancária no ar!" autoFocus />
          </label>
          <div className="pnl-form-acoes">
            <button type="button" className="pnl-btn-primario" disabled={pendente} onClick={onCriar}>{pendente ? 'Criando...' : 'Criar'}</button>
            <button type="button" className="pnl-btn-secundario" onClick={() => { setCriando(false); setTitulo('') }}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="pnl-modulos-lista">
        {novidades.length === 0 && <p className="pnl-vazio">Nenhum aviso cadastrado ainda.</p>}
        {novidades.map(n => (
          <NovidadeBloco key={n.id} novidade={n} expandido={expandido === n.id} onToggle={() => setExpandido(expandido === n.id ? null : n.id)} onErro={toast.erro} onSucesso={toast.sucesso} />
        ))}
      </div>
    </div>
  )
}

function NovidadeBloco({ novidade, expandido, onToggle, onErro, onSucesso }: {
  novidade: NovidadeAdmin; expandido: boolean; onToggle: () => void; onErro: (e: string) => void; onSucesso: (m: string) => void
}) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()

  function refresh() { router.refresh() }

  function onSalvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await atualizarNovidade(novidade.id, fd)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Aviso salvo com sucesso'); refresh() }
    })
  }

  function onUploadImagem(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.set('imagem', file)
    startTransition(async () => {
      const r = await uploadImagemNovidade(novidade.id, fd)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Imagem atualizada com sucesso'); refresh() }
    })
  }

  function onAlternarPublicacao(publicado: boolean) {
    startTransition(async () => {
      const r = await alternarPublicacaoNovidade(novidade.id, publicado)
      if (!r.ok) onErro(r.erro)
      else { onSucesso(publicado ? 'Aviso publicado com sucesso' : 'Aviso voltou a rascunho'); refresh() }
    })
  }

  function onExcluir() {
    if (!confirm(`Excluir o aviso "${novidade.titulo}"?`)) return
    startTransition(async () => {
      const r = await excluirNovidade(novidade.id)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Aviso excluído com sucesso'); refresh() }
    })
  }

  return (
    <div className="pnl-modulo-bloco">
      <div className="pnl-modulo-cab">
        <button type="button" className="pnl-modulo-toggle" onClick={onToggle}>
          {expandido ? '▾' : '▸'} {novidade.titulo ?? 'Sem título'}
        </button>
        <div className="pnl-modulo-acoes">
          <label className={`pnl-toggle-papel${novidade.publicado ? ' ativo' : ''}`}>
            <input type="checkbox" checked={novidade.publicado} disabled={pendente} onChange={e => onAlternarPublicacao(e.target.checked)} />
            {novidade.publicado ? 'Publicado' : 'Rascunho'}
          </label>
          <span className="pnl-modulo-contagem">{novidade.totalLeituras} leitura{novidade.totalLeituras === 1 ? '' : 's'}</span>
          <button type="button" className="pnl-btn-perigo-sm" disabled={pendente} onClick={onExcluir} title="Excluir"><IconeTrash size={13} /></button>
        </div>
      </div>

      {expandido && (
        <div className="pnl-modulo-corpo">
          <div className="pnl-aula-capa-linha">
            <div className="pnl-capa-preview pnl-capa-preview-sm" style={novidade.imagemUrl ? { backgroundImage: `url(${novidade.imagemUrl})` } : undefined}>
              {!novidade.imagemUrl && <span>Sem imagem</span>}
            </div>
            <label className="pnl-btn-secundario pnl-upload-btn">
              Trocar imagem
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onUploadImagem} hidden disabled={pendente} />
            </label>
          </div>
          <form onSubmit={onSalvar} className="pnl-form">
            <label>Título
              <input name="titulo" defaultValue={novidade.titulo ?? ''} required />
            </label>
            <label>Corpo (um parágrafo por linha)
              <textarea name="corpo" defaultValue={novidade.corpo.join('\n')} rows={3} />
            </label>
            <div className="pnl-form-linha">
              <label>Link
                <input name="link_url" defaultValue={novidade.linkUrl ?? ''} placeholder="https://..." />
              </label>
              <label>Rótulo do link
                <input name="link_rotulo" defaultValue={novidade.linkRotulo ?? ''} placeholder="Saiba mais" />
              </label>
              <label>Selo
                <input name="selo" defaultValue={novidade.selo ?? ''} placeholder="Novo" />
              </label>
            </div>
            <button type="submit" className="pnl-btn-primario" disabled={pendente}>{pendente ? 'Salvando...' : 'Salvar'}</button>
          </form>
        </div>
      )}
    </div>
  )
}

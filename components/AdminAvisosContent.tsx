// components/AdminAvisosContent.tsx
'use client'

import { useState, useTransition } from 'react'
import type { FormEvent, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { NovidadeAdmin } from '@/lib/queries/admin-avisos'
import {
  criarNovidade, atualizarNovidade, alternarPublicacaoNovidade, excluirNovidade, uploadImagemNovidade,
} from '@/app/admin/avisos/actions'

export default function AdminAvisosContent({ novidades }: { novidades: NovidadeAdmin[] }) {
  const router = useRouter()
  const [criando, setCriando] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, startTransition] = useTransition()
  const [expandido, setExpandido] = useState<string | null>(null)

  function onCriar() {
    setErro(null)
    if (!titulo.trim()) { setErro('Título é obrigatório.'); return }
    const fd = new FormData()
    fd.set('titulo', titulo)
    startTransition(async () => {
      const r = await criarNovidade(fd)
      if (!r.ok) { setErro(r.erro); return }
      setTitulo(''); setCriando(false)
      if (r.id) setExpandido(r.id)
      router.refresh()
    })
  }

  return (
    <div className="ad-cursos">
      <div className="ad-cursos-cab">
        <div>
          <h1>Avisos e novidades</h1>
          <p className="ad-sub">Publica avisos no feed e banners do dashboard (imagem + link).</p>
        </div>
        <button type="button" className="ad-btn-primario" onClick={() => setCriando(v => !v)}>+ Novo aviso</button>
      </div>

      {erro && <p className="ad-erro">{erro}</p>}

      {criando && (
        <div className="ad-busca-card">
          <label>Título
            <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Nova trilha de Perícia Bancária no ar!" autoFocus />
          </label>
          <div className="ad-form-acoes">
            <button type="button" className="ad-btn-primario" disabled={pendente} onClick={onCriar}>{pendente ? 'Criando...' : 'Criar'}</button>
            <button type="button" className="ad-btn-secundario" onClick={() => { setCriando(false); setTitulo('') }}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="ad-modulos-lista">
        {novidades.length === 0 && <p className="ad-vazio">Nenhum aviso cadastrado ainda.</p>}
        {novidades.map(n => (
          <NovidadeBloco key={n.id} novidade={n} expandido={expandido === n.id} onToggle={() => setExpandido(expandido === n.id ? null : n.id)} onErro={setErro} />
        ))}
      </div>
    </div>
  )
}

function NovidadeBloco({ novidade, expandido, onToggle, onErro }: {
  novidade: NovidadeAdmin; expandido: boolean; onToggle: () => void; onErro: (e: string | null) => void
}) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()

  function refresh() { router.refresh() }

  function onSalvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    onErro(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await atualizarNovidade(novidade.id, fd)
      if (!r.ok) onErro(r.erro)
      else refresh()
    })
  }

  function onUploadImagem(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    onErro(null)
    const fd = new FormData()
    fd.set('imagem', file)
    startTransition(async () => {
      const r = await uploadImagemNovidade(novidade.id, fd)
      if (!r.ok) onErro(r.erro)
      else refresh()
    })
  }

  function onAlternarPublicacao(publicado: boolean) {
    onErro(null)
    startTransition(async () => {
      const r = await alternarPublicacaoNovidade(novidade.id, publicado)
      if (!r.ok) onErro(r.erro)
      else refresh()
    })
  }

  function onExcluir() {
    if (!confirm(`Excluir o aviso "${novidade.titulo}"?`)) return
    onErro(null)
    startTransition(async () => {
      const r = await excluirNovidade(novidade.id)
      if (!r.ok) onErro(r.erro)
      else refresh()
    })
  }

  return (
    <div className="ad-modulo-bloco">
      <div className="ad-modulo-cab">
        <button type="button" className="ad-modulo-toggle" onClick={onToggle}>
          {expandido ? '▾' : '▸'} {novidade.titulo ?? 'Sem título'}
        </button>
        <div className="ad-modulo-acoes">
          <label className={`ad-toggle-papel${novidade.publicado ? ' ativo' : ''}`}>
            <input type="checkbox" checked={novidade.publicado} disabled={pendente} onChange={e => onAlternarPublicacao(e.target.checked)} />
            {novidade.publicado ? 'Publicado' : 'Rascunho'}
          </label>
          <span className="ad-modulo-contagem">{novidade.totalLeituras} leitura{novidade.totalLeituras === 1 ? '' : 's'}</span>
          <button type="button" className="ad-btn-perigo-sm" disabled={pendente} onClick={onExcluir} title="Excluir">🗑</button>
        </div>
      </div>

      {expandido && (
        <div className="ad-modulo-corpo">
          <div className="ad-aula-capa-linha">
            <div className="ad-capa-preview ad-capa-preview-sm" style={novidade.imagemUrl ? { backgroundImage: `url(${novidade.imagemUrl})` } : undefined}>
              {!novidade.imagemUrl && <span>Sem imagem</span>}
            </div>
            <label className="ad-btn-secundario ad-upload-btn">
              Trocar imagem
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onUploadImagem} hidden disabled={pendente} />
            </label>
          </div>
          <form onSubmit={onSalvar} className="ad-form">
            <label>Título
              <input name="titulo" defaultValue={novidade.titulo ?? ''} required />
            </label>
            <label>Corpo (um parágrafo por linha)
              <textarea name="corpo" defaultValue={novidade.corpo.join('\n')} rows={3} />
            </label>
            <div className="ad-form-linha">
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
            <button type="submit" className="ad-btn-primario" disabled={pendente}>{pendente ? 'Salvando...' : 'Salvar'}</button>
          </form>
        </div>
      )}
    </div>
  )
}

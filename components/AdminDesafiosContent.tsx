// components/AdminDesafiosContent.tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { DesafioListaItem, CategoriaAdmin } from '@/lib/queries/admin-desafios'
import {
  criarDesafio, alternarPublicacaoDesafio, excluirDesafio,
  criarCategoria, atualizarCategoria, excluirCategoria,
} from '@/app/admin/desafios/actions'
import { IconePencil, IconeTrash } from '@/components/Icones'
import { useAdminToast, AdminToastContainer } from '@/components/AdminToast'

export default function AdminDesafiosContent({ desafios, categorias }: { desafios: DesafioListaItem[]; categorias: CategoriaAdmin[] }) {
  const router = useRouter()
  const [criando, setCriando] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const toast = useAdminToast()
  const [pendente, startTransition] = useTransition()
  const [mostrarCategorias, setMostrarCategorias] = useState(false)

  function onCriar() {
    if (titulo.trim().length < 3) { toast.erro('Título precisa ter pelo menos 3 caracteres.'); return }
    const fd = new FormData()
    fd.set('titulo', titulo)
    if (categoriaId) fd.set('categoria_id', categoriaId)
    startTransition(async () => {
      const r = await criarDesafio(fd)
      if (!r.ok) { toast.erro(r.erro); return }
      toast.sucesso('Desafio criado com sucesso')
      router.push(`/admin/desafios/${r.id}`)
    })
  }

  function onAlternarPublicacao(id: string, publicado: boolean) {
    startTransition(async () => {
      const r = await alternarPublicacaoDesafio(id, publicado)
      if (!r.ok) toast.erro(r.erro)
      else { toast.sucesso(publicado ? 'Desafio publicado com sucesso' : 'Desafio voltou a rascunho'); router.refresh() }
    })
  }

  function onExcluir(id: string, titulo: string) {
    if (!confirm(`Excluir o desafio "${titulo}"? Essa ação não pode ser desfeita.`)) return
    startTransition(async () => {
      const r = await excluirDesafio(id)
      if (!r.ok) toast.erro(r.erro)
      else { toast.sucesso('Desafio excluído com sucesso'); router.refresh() }
    })
  }

  return (
    <div className="ad-cursos">
      <AdminToastContainer toasts={toast.toasts} remover={toast.remover} />
      <div className="ad-cursos-cab">
        <div>
          <h1>Desafios</h1>
          <p className="ad-sub">Casos periciais gamificados — "O Caso". Categorias, quesitos, documentos e gabarito.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="ad-btn-secundario" onClick={() => setMostrarCategorias(v => !v)}>Categorias</button>
          <button type="button" className="ad-btn-primario" onClick={() => setCriando(v => !v)}>+ Novo desafio</button>
        </div>
      </div>

      {mostrarCategorias && <CategoriasBloco categorias={categorias} onErro={toast.erro} onSucesso={toast.sucesso} />}

      {criando && (
        <div className="ad-busca-card">
          <label>Título
            <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: A Fraude no Extrato" autoFocus />
          </label>
          <label>Categoria
            <select value={categoriaId} onChange={e => setCategoriaId(e.target.value)}>
              <option value="">—</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>
          <div className="ad-form-acoes">
            <button type="button" className="ad-btn-primario" disabled={pendente} onClick={onCriar}>
              {pendente ? 'Criando...' : 'Criar e editar'}
            </button>
            <button type="button" className="ad-btn-secundario" onClick={() => { setCriando(false); setTitulo('') }}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="ad-lista-admins">
        {desafios.length === 0 && <p className="ad-vazio">Nenhum desafio cadastrado ainda.</p>}
        {desafios.map(d => (
          <div key={d.id} className="ad-admin-linha">
            <div className="ad-admin-quem">
              <div>
                <a href={`/admin/desafios/${d.id}`}><b>{d.numero ? `#${d.numero} — ` : ''}{d.titulo}</b></a>
                <span className="ad-admin-slug">{d.categoriaNome} · {d.totalEntregas} entrega{d.totalEntregas === 1 ? '' : 's'} · {d.xp} XP · {d.moedas} moedas</span>
              </div>
            </div>
            <div className="ad-curso-acoes">
              <label className={`ad-toggle-papel${d.publicado ? ' ativo' : ''}`}>
                <input type="checkbox" checked={d.publicado} disabled={pendente} onChange={e => onAlternarPublicacao(d.id, e.target.checked)} />
                {d.publicado ? 'Publicado' : 'Rascunho'}
              </label>
              <a href={`/admin/desafios/${d.id}`} className="ad-btn-secundario">Editar</a>
              <button type="button" className="ad-btn-perigo" disabled={pendente} onClick={() => onExcluir(d.id, d.titulo)}>Excluir</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CategoriasBloco({ categorias, onErro, onSucesso }: { categorias: CategoriaAdmin[]; onErro: (e: string) => void; onSucesso: (m: string) => void }) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()
  const [nome, setNome] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editNome, setEditNome] = useState('')

  function onCriar() {
    if (!nome.trim()) return
    const fd = new FormData()
    fd.set('nome', nome)
    startTransition(async () => {
      const r = await criarCategoria(fd)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Categoria criada com sucesso'); setNome(''); router.refresh() }
    })
  }

  function onSalvarEdicao(id: string) {
    if (!editNome.trim()) return
    const fd = new FormData()
    fd.set('nome', editNome)
    startTransition(async () => {
      const r = await atualizarCategoria(id, fd)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Categoria salva com sucesso'); setEditandoId(null); router.refresh() }
    })
  }

  function onExcluir(id: string, nome: string, total: number) {
    if (total > 0 && !confirm(`"${nome}" tem ${total} desafio(s). Excluir a categoria mesmo assim? Os desafios ficam sem categoria.`)) return
    startTransition(async () => {
      const r = await excluirCategoria(id)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Categoria excluída com sucesso'); router.refresh() }
    })
  }

  return (
    <div className="ad-sublista ad-card">
      <h3>Categorias de desafio</h3>
      {categorias.length === 0 && <p className="ad-vazio-sm">Nenhuma categoria cadastrada.</p>}
      <ul>
        {categorias.map(c => (
          <li key={c.id}>
            {editandoId === c.id ? (
              <div className="ad-inline-edit">
                <input value={editNome} onChange={e => setEditNome(e.target.value)} autoFocus />
                <button type="button" onClick={() => onSalvarEdicao(c.id)} disabled={pendente}>Salvar</button>
                <button type="button" onClick={() => setEditandoId(null)}>Cancelar</button>
              </div>
            ) : (
              <>
                <span>{c.nome}</span>
                <span className="ad-sublista-meta">{c.totalDesafios} desafio{c.totalDesafios === 1 ? '' : 's'}</span>
                <button type="button" onClick={() => { setEditandoId(c.id); setEditNome(c.nome) }}><IconePencil size={13} /></button>
                <button type="button" className="ad-btn-perigo-sm" disabled={pendente} onClick={() => onExcluir(c.id, c.nome, c.totalDesafios)}><IconeTrash size={13} /></button>
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="ad-nova-linha">
        <input type="text" placeholder="Nova categoria" value={nome} onChange={e => setNome(e.target.value)} />
        <button type="button" className="ad-btn-secundario" disabled={pendente} onClick={onCriar}>+ Categoria</button>
      </div>
    </div>
  )
}

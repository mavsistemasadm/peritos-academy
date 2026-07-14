// components/AdminComunidadeContent.tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { PostAdmin, ComentarioAdmin, DuvidaAulaAdmin } from '@/lib/queries/admin-comunidade'
import {
  alternarFixado, alternarDestaque, excluirPost,
  marcarMelhorResposta, desmarcarMelhorResposta, excluirComentario,
  excluirDuvidaAula,
} from '@/app/admin/comunidade/actions'
import { useAdminToast, AdminToastContainer } from '@/components/AdminToast'

type Aba = 'posts' | 'comentarios' | 'duvidas'

export default function AdminComunidadeContent({ posts, comentarios, duvidas }: {
  posts: PostAdmin[]; comentarios: ComentarioAdmin[]; duvidas: DuvidaAulaAdmin[]
}) {
  const [aba, setAba] = useState<Aba>('posts')
  const toast = useAdminToast()

  return (
    <div className="ad-cursos">
      <AdminToastContainer toasts={toast.toasts} remover={toast.remover} />
      <div className="ad-cursos-cab">
        <div>
          <h1>Comunidade</h1>
          <p className="ad-sub">Modere posts, comentários e dúvidas de aula.</p>
        </div>
      </div>

      <div className="ad-abas">
        <button type="button" className={`ad-aba${aba === 'posts' ? ' ativa' : ''}`} onClick={() => setAba('posts')}>Posts ({posts.length})</button>
        <button type="button" className={`ad-aba${aba === 'comentarios' ? ' ativa' : ''}`} onClick={() => setAba('comentarios')}>Comentários ({comentarios.length})</button>
        <button type="button" className={`ad-aba${aba === 'duvidas' ? ' ativa' : ''}`} onClick={() => setAba('duvidas')}>Dúvidas de aula ({duvidas.length})</button>
      </div>

      {aba === 'posts' && <PostsAba posts={posts} onErro={toast.erro} onSucesso={toast.sucesso} />}
      {aba === 'comentarios' && <ComentariosAba comentarios={comentarios} onErro={toast.erro} onSucesso={toast.sucesso} />}
      {aba === 'duvidas' && <DuvidasAba duvidas={duvidas} onErro={toast.erro} onSucesso={toast.sucesso} />}
    </div>
  )
}

function PostsAba({ posts, onErro, onSucesso }: { posts: PostAdmin[]; onErro: (e: string) => void; onSucesso: (m: string) => void }) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()

  function onFixar(id: string, fixado: boolean) {
    startTransition(async () => {
      const r = await alternarFixado(id, fixado)
      if (!r.ok) onErro(r.erro)
      else { onSucesso(fixado ? 'Post fixado com sucesso' : 'Post desafixado com sucesso'); router.refresh() }
    })
  }

  function onDestacar(id: string, destaque: boolean) {
    startTransition(async () => {
      const r = await alternarDestaque(id, destaque)
      if (!r.ok) onErro(r.erro)
      else { onSucesso(destaque ? 'Post destacado com sucesso' : 'Destaque removido com sucesso'); router.refresh() }
    })
  }

  function onExcluir(id: string, titulo: string | null) {
    if (!confirm(`Remover o post "${titulo ?? 'sem título'}"? Os comentários vinculados também somem.`)) return
    startTransition(async () => {
      const r = await excluirPost(id)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Post removido com sucesso'); router.refresh() }
    })
  }

  return (
    <div className="ad-lista-admins">
      {posts.length === 0 && <p className="ad-vazio">Nenhum post ainda.</p>}
      {posts.map(p => (
        <div key={p.id} className="ad-admin-linha">
          <div className="ad-admin-quem">
            <div>
              <b>{p.titulo ?? (p.corpo ?? '').slice(0, 60) ?? 'Post'}</b>
              <span className="ad-admin-slug">{p.espacoNome} · {p.autorNome ?? 'Perito'} · {p.tipo} · {p.totalComentarios} comentário{p.totalComentarios === 1 ? '' : 's'}</span>
            </div>
          </div>
          <div className="ad-curso-acoes">
            <label className={`ad-toggle-papel${p.fixado ? ' ativo' : ''}`}>
              <input type="checkbox" checked={p.fixado} disabled={pendente} onChange={e => onFixar(p.id, e.target.checked)} />
              Fixado
            </label>
            <label className={`ad-toggle-papel${p.destaque ? ' ativo' : ''}`}>
              <input type="checkbox" checked={p.destaque} disabled={pendente} onChange={e => onDestacar(p.id, e.target.checked)} />
              Destaque
            </label>
            <button type="button" className="ad-btn-perigo" disabled={pendente} onClick={() => onExcluir(p.id, p.titulo)}>Remover</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function ComentariosAba({ comentarios, onErro, onSucesso }: { comentarios: ComentarioAdmin[]; onErro: (e: string) => void; onSucesso: (m: string) => void }) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()

  function onMarcar(id: string, postId: string | null) {
    if (!postId) return
    startTransition(async () => {
      const r = await marcarMelhorResposta(id, postId)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Melhor resposta marcada com sucesso'); router.refresh() }
    })
  }

  function onDesmarcar(id: string) {
    startTransition(async () => {
      const r = await desmarcarMelhorResposta(id)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Melhor resposta desmarcada com sucesso'); router.refresh() }
    })
  }

  function onExcluir(id: string) {
    if (!confirm('Remover este comentário?')) return
    startTransition(async () => {
      const r = await excluirComentario(id)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Comentário removido com sucesso'); router.refresh() }
    })
  }

  return (
    <div className="ad-lista-admins">
      {comentarios.length === 0 && <p className="ad-vazio">Nenhum comentário ainda.</p>}
      {comentarios.map(c => (
        <div key={c.id} className="ad-admin-linha">
          <div className="ad-admin-quem">
            <div>
              <b>{c.autorNome ?? 'Perito'}</b>
              <span className="ad-admin-slug">em "{c.postTitulo}" · {(c.corpo ?? '').slice(0, 80)}</span>
            </div>
          </div>
          <div className="ad-curso-acoes">
            {c.melhorResposta
              ? <button type="button" className="ad-btn-secundario" disabled={pendente} onClick={() => onDesmarcar(c.id)}>Desmarcar melhor resposta</button>
              : <button type="button" className="ad-btn-secundario" disabled={pendente} onClick={() => onMarcar(c.id, c.postId)}>Marcar melhor resposta</button>}
            <button type="button" className="ad-btn-perigo" disabled={pendente} onClick={() => onExcluir(c.id)}>Remover</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function DuvidasAba({ duvidas, onErro, onSucesso }: { duvidas: DuvidaAulaAdmin[]; onErro: (e: string) => void; onSucesso: (m: string) => void }) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()

  function onExcluir(id: string) {
    if (!confirm('Remover esta dúvida?')) return
    startTransition(async () => {
      const r = await excluirDuvidaAula(id)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Dúvida removida com sucesso'); router.refresh() }
    })
  }

  return (
    <div className="ad-lista-admins">
      {duvidas.length === 0 && <p className="ad-vazio">Nenhuma dúvida ainda.</p>}
      {duvidas.map(d => (
        <div key={d.id} className="ad-admin-linha">
          <div className="ad-admin-quem">
            <div>
              <b>{d.autorNome ?? 'Perito'}</b>
              <span className="ad-admin-slug">na aula "{d.aulaTitulo}" · {(d.texto ?? '').slice(0, 80)}</span>
            </div>
          </div>
          <div className="ad-curso-acoes">
            <button type="button" className="ad-btn-perigo" disabled={pendente} onClick={() => onExcluir(d.id)}>Remover</button>
          </div>
        </div>
      ))}
    </div>
  )
}

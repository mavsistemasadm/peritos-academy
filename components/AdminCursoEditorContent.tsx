// components/AdminCursoEditorContent.tsx
'use client'

import { useState, useTransition } from 'react'
import type { FormEvent, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { CursoAdmin, ModuloAdmin, AulaAdmin } from '@/lib/queries/admin-cursos'
import {
  atualizarCurso, uploadCapaCurso, alternarPublicacaoCurso, excluirCurso,
  criarModulo, atualizarModulo, excluirModulo, moverModulo,
  criarAula, atualizarAula, excluirAula, moverAula, uploadCapaAula,
  criarCapitulo, excluirCapitulo, criarMaterial, excluirMaterial,
} from '@/app/admin/cursos/actions'

function segParaLabel(seg: number) {
  const m = Math.floor(seg / 60)
  const s = seg % 60
  return `${m}min ${s}s`
}

export default function AdminCursoEditorContent({ curso, modulos }: { curso: CursoAdmin; modulos: ModuloAdmin[] }) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, startTransition] = useTransition()
  const [moduloExpandido, setModuloExpandido] = useState<string | null>(modulos[0]?.id ?? null)
  const [aulaExpandida, setAulaExpandida] = useState<string | null>(null)
  const [novoModuloTitulo, setNovoModuloTitulo] = useState('')

  function refresh() { router.refresh() }

  function onSalvarDados(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await atualizarCurso(curso.id, fd)
      if (!r.ok) setErro(r.erro)
      else refresh()
    })
  }

  function onUploadCapa(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setErro(null)
    const fd = new FormData()
    fd.set('capa', file)
    startTransition(async () => {
      const r = await uploadCapaCurso(curso.id, fd)
      if (!r.ok) setErro(r.erro)
      else refresh()
    })
  }

  function onAlternarPublicacao(publicado: boolean) {
    setErro(null)
    startTransition(async () => {
      const r = await alternarPublicacaoCurso(curso.id, publicado)
      if (!r.ok) setErro(r.erro)
      else refresh()
    })
  }

  function onExcluirCurso() {
    if (!confirm(`Excluir o curso "${curso.titulo}"? Isso apaga módulos, aulas e avaliações vinculadas. Essa ação não pode ser desfeita.`)) return
    setErro(null)
    startTransition(async () => {
      const r = await excluirCurso(curso.id)
      if (!r.ok) setErro(r.erro)
      else router.push('/admin/cursos')
    })
  }

  function onCriarModulo() {
    if (!novoModuloTitulo.trim()) return
    setErro(null)
    const fd = new FormData()
    fd.set('titulo', novoModuloTitulo)
    startTransition(async () => {
      const r = await criarModulo(curso.id, fd)
      if (!r.ok) setErro(r.erro)
      else { setNovoModuloTitulo(''); refresh() }
    })
  }

  return (
    <div className="ad-curso-editor">
      <a href="/admin/cursos" className="ad-voltar">← Cursos</a>
      <div className="ad-editor-cab">
        <h1>{curso.titulo}</h1>
        <div className="ad-editor-cab-acoes">
          <label className={`ad-toggle-papel${curso.publicado ? ' ativo' : ''}`}>
            <input type="checkbox" checked={curso.publicado} disabled={pendente} onChange={e => onAlternarPublicacao(e.target.checked)} />
            {curso.publicado ? 'Publicado' : 'Rascunho'}
          </label>
          <button type="button" className="ad-btn-perigo" disabled={pendente} onClick={onExcluirCurso}>Excluir curso</button>
        </div>
      </div>

      {erro && <p className="ad-erro">{erro}</p>}

      <div className="ad-editor-grid">
        <section className="ad-card">
          <h2>Capa</h2>
          <div className="ad-capa-preview" style={curso.capaUrl ? { backgroundImage: `url(${curso.capaUrl})` } : undefined}>
            {!curso.capaUrl && <span>Sem capa</span>}
          </div>
          <label className="ad-btn-secundario ad-upload-btn">
            Trocar capa
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onUploadCapa} hidden disabled={pendente} />
          </label>
        </section>

        <section className="ad-card ad-card-dados">
          <h2>Dados gerais</h2>
          <form onSubmit={onSalvarDados} className="ad-form">
            <label>Título
              <input name="titulo" defaultValue={curso.titulo} required minLength={3} />
            </label>
            <label>Subtítulo
              <input name="subtitulo" defaultValue={curso.subtitulo ?? ''} />
            </label>
            <label>Nível
              <select name="nivel" defaultValue={curso.nivel ?? ''}>
                <option value="">—</option>
                <option value="Iniciante">Iniciante</option>
                <option value="Intermediário">Intermediário</option>
                <option value="Avançado">Avançado</option>
              </select>
            </label>
            <div className="ad-form-linha">
              <label>Instrutor
                <input name="instrutor_nome" defaultValue={curso.instrutorNome ?? ''} />
              </label>
              <label>Título do instrutor
                <input name="instrutor_titulo" defaultValue={curso.instrutorTitulo ?? ''} />
              </label>
              <label>Iniciais
                <input name="instrutor_iniciais" defaultValue={curso.instrutorIniciais ?? ''} maxLength={3} />
              </label>
            </div>
            <label>Citação de destaque
              <textarea name="citacao" defaultValue={curso.citacao ?? ''} rows={2} />
            </label>
            <label>Objetivos (um por linha)
              <textarea name="objetivos" defaultValue={curso.objetivos.join('\n')} rows={4} />
            </label>
            <div className="ad-form-linha">
              <label className="ad-checkbox-linha">
                <input type="checkbox" name="emite_certificado" defaultChecked={curso.emiteCertificado} />
                Emite certificado
              </label>
              <label>Carga horária (h)
                <input name="carga_horas" type="number" step="0.5" min="0" defaultValue={curso.cargaHoras ?? ''} />
              </label>
            </div>
            <button type="submit" className="ad-btn-primario" disabled={pendente}>{pendente ? 'Salvando...' : 'Salvar dados gerais'}</button>
          </form>
        </section>
      </div>

      <section className="ad-card">
        <h2>Módulos e aulas</h2>
        <div className="ad-nova-linha">
          <input
            type="text"
            placeholder="Título do novo módulo"
            value={novoModuloTitulo}
            onChange={e => setNovoModuloTitulo(e.target.value)}
          />
          <button type="button" className="ad-btn-primario" disabled={pendente} onClick={onCriarModulo}>+ Módulo</button>
        </div>

        {modulos.length === 0 && <p className="ad-vazio">Nenhum módulo cadastrado ainda.</p>}

        <div className="ad-modulos-lista">
          {modulos.map((m, i) => (
            <ModuloBloco
              key={m.id}
              modulo={m}
              cursoId={curso.id}
              indice={i}
              total={modulos.length}
              expandido={moduloExpandido === m.id}
              aulaExpandida={aulaExpandida}
              onToggle={() => setModuloExpandido(moduloExpandido === m.id ? null : m.id)}
              onToggleAula={id => setAulaExpandida(aulaExpandida === id ? null : id)}
              onErro={setErro}
              onRefresh={refresh}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function ModuloBloco({
  modulo, cursoId, indice, total, expandido, aulaExpandida, onToggle, onToggleAula, onErro, onRefresh,
}: {
  modulo: ModuloAdmin
  cursoId: string
  indice: number
  total: number
  expandido: boolean
  aulaExpandida: string | null
  onToggle: () => void
  onToggleAula: (id: string) => void
  onErro: (erro: string | null) => void
  onRefresh: () => void
}) {
  const [pendente, startTransition] = useTransition()
  const [editando, setEditando] = useState(false)
  const [titulo, setTitulo] = useState(modulo.titulo)
  const [novaAulaTitulo, setNovaAulaTitulo] = useState('')

  function onSalvarTitulo() {
    if (!titulo.trim()) return
    onErro(null)
    const fd = new FormData()
    fd.set('titulo', titulo)
    startTransition(async () => {
      const r = await atualizarModulo(modulo.id, cursoId, fd)
      if (!r.ok) onErro(r.erro)
      else { setEditando(false); onRefresh() }
    })
  }

  function onMover(direcao: 'up' | 'down') {
    onErro(null)
    startTransition(async () => {
      const r = await moverModulo(cursoId, modulo.id, direcao)
      if (!r.ok) onErro(r.erro)
      else onRefresh()
    })
  }

  function onExcluir() {
    if (!confirm(`Excluir o módulo "${modulo.titulo}" e todas as suas aulas?`)) return
    onErro(null)
    startTransition(async () => {
      const r = await excluirModulo(modulo.id, cursoId)
      if (!r.ok) onErro(r.erro)
      else onRefresh()
    })
  }

  function onCriarAula() {
    if (!novaAulaTitulo.trim()) return
    onErro(null)
    const fd = new FormData()
    fd.set('titulo', novaAulaTitulo)
    startTransition(async () => {
      const r = await criarAula(modulo.id, cursoId, fd)
      if (!r.ok) onErro(r.erro)
      else { setNovaAulaTitulo(''); onRefresh() }
    })
  }

  return (
    <div className="ad-modulo-bloco">
      <div className="ad-modulo-cab">
        {editando ? (
          <div className="ad-inline-edit">
            <input value={titulo} onChange={e => setTitulo(e.target.value)} autoFocus />
            <button type="button" className="ad-btn-secundario" disabled={pendente} onClick={onSalvarTitulo}>Salvar</button>
            <button type="button" className="ad-btn-secundario" onClick={() => { setEditando(false); setTitulo(modulo.titulo) }}>Cancelar</button>
          </div>
        ) : (
          <>
            <button type="button" className="ad-modulo-toggle" onClick={onToggle}>
              {expandido ? '▾' : '▸'} {modulo.titulo}
            </button>
            <div className="ad-modulo-acoes">
              <span className="ad-modulo-contagem">{modulo.aulas.length} aula{modulo.aulas.length === 1 ? '' : 's'}</span>
              <button type="button" disabled={pendente || indice === 0} onClick={() => onMover('up')} title="Mover para cima">↑</button>
              <button type="button" disabled={pendente || indice === total - 1} onClick={() => onMover('down')} title="Mover para baixo">↓</button>
              <button type="button" onClick={() => setEditando(true)} title="Renomear">✎</button>
              <button type="button" className="ad-btn-perigo-sm" disabled={pendente} onClick={onExcluir} title="Excluir módulo">🗑</button>
            </div>
          </>
        )}
      </div>

      {expandido && (
        <div className="ad-modulo-corpo">
          {modulo.aulas.map((a, i) => (
            <AulaBloco
              key={a.id}
              aula={a}
              cursoId={cursoId}
              moduloId={modulo.id}
              indice={i}
              total={modulo.aulas.length}
              expandida={aulaExpandida === a.id}
              onToggle={() => onToggleAula(a.id)}
              onErro={onErro}
              onRefresh={onRefresh}
            />
          ))}
          <div className="ad-nova-linha">
            <input type="text" placeholder="Título da nova aula" value={novaAulaTitulo} onChange={e => setNovaAulaTitulo(e.target.value)} />
            <button type="button" className="ad-btn-secundario" disabled={pendente} onClick={onCriarAula}>+ Aula</button>
          </div>
        </div>
      )}
    </div>
  )
}

function AulaBloco({
  aula, cursoId, moduloId, indice, total, expandida, onToggle, onErro, onRefresh,
}: {
  aula: AulaAdmin
  cursoId: string
  moduloId: string
  indice: number
  total: number
  expandida: boolean
  onToggle: () => void
  onErro: (erro: string | null) => void
  onRefresh: () => void
}) {
  const [pendente, startTransition] = useTransition()

  function onMover(direcao: 'up' | 'down') {
    onErro(null)
    startTransition(async () => {
      const r = await moverAula(moduloId, cursoId, aula.id, direcao)
      if (!r.ok) onErro(r.erro)
      else onRefresh()
    })
  }

  function onExcluir() {
    if (!confirm(`Excluir a aula "${aula.titulo}"?`)) return
    onErro(null)
    startTransition(async () => {
      const r = await excluirAula(aula.id, cursoId)
      if (!r.ok) onErro(r.erro)
      else onRefresh()
    })
  }

  function onSalvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    onErro(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await atualizarAula(aula.id, cursoId, fd)
      if (!r.ok) onErro(r.erro)
      else onRefresh()
    })
  }

  function onUploadCapa(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    onErro(null)
    const fd = new FormData()
    fd.set('capa', file)
    startTransition(async () => {
      const r = await uploadCapaAula(aula.id, cursoId, fd)
      if (!r.ok) onErro(r.erro)
      else onRefresh()
    })
  }

  return (
    <div className="ad-aula-bloco">
      <div className="ad-aula-cab">
        <button type="button" className="ad-aula-toggle" onClick={onToggle}>
          {expandida ? '▾' : '▸'} {aula.titulo}
        </button>
        <div className="ad-aula-acoes">
          <span className="ad-aula-meta">{segParaLabel(aula.duracaoSeg)} · {aula.xp} XP</span>
          <button type="button" disabled={pendente || indice === 0} onClick={() => onMover('up')} title="Mover para cima">↑</button>
          <button type="button" disabled={pendente || indice === total - 1} onClick={() => onMover('down')} title="Mover para baixo">↓</button>
          <button type="button" className="ad-btn-perigo-sm" disabled={pendente} onClick={onExcluir} title="Excluir aula">🗑</button>
        </div>
      </div>

      {expandida && (
        <div className="ad-aula-corpo">
          <form onSubmit={onSalvar} className="ad-form">
            <label>Título
              <input name="titulo" defaultValue={aula.titulo} required />
            </label>
            <label>Descrição
              <textarea name="descricao" defaultValue={aula.descricao ?? ''} rows={2} />
            </label>
            <label>URL do vídeo (Panda Video)
              <input name="video_url" defaultValue={aula.videoUrl ?? ''} placeholder="https://player-vz-....tv.pandavideo.com.br/embed/?v=..." />
            </label>
            <div className="ad-form-linha">
              <label>Duração (segundos)
                <input name="duracao_seg" type="number" min="0" defaultValue={aula.duracaoSeg} />
              </label>
              <label>XP
                <input name="xp" type="number" min="0" defaultValue={aula.xp} />
              </label>
              <label>Tipo
                <input name="tipo" defaultValue={aula.tipo} />
              </label>
            </div>
            <label>Sobre esta aula (um tópico por linha)
              <textarea name="sobre" defaultValue={aula.sobre.join('\n')} rows={3} />
            </label>
            <button type="submit" className="ad-btn-primario" disabled={pendente}>{pendente ? 'Salvando...' : 'Salvar aula'}</button>
          </form>

          <div className="ad-aula-capa-linha">
            <div className="ad-capa-preview ad-capa-preview-sm" style={aula.capaUrl ? { backgroundImage: `url(${aula.capaUrl})` } : undefined}>
              {!aula.capaUrl && <span>Sem capa</span>}
            </div>
            <label className="ad-btn-secundario ad-upload-btn">
              Trocar capa da aula
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onUploadCapa} hidden disabled={pendente} />
            </label>
          </div>

          <CapitulosBloco aula={aula} cursoId={cursoId} onErro={onErro} onRefresh={onRefresh} />
          <MateriaisBloco aula={aula} cursoId={cursoId} onErro={onErro} onRefresh={onRefresh} />
        </div>
      )}
    </div>
  )
}

function CapitulosBloco({ aula, cursoId, onErro, onRefresh }: {
  aula: AulaAdmin; cursoId: string; onErro: (e: string | null) => void; onRefresh: () => void
}) {
  const [pendente, startTransition] = useTransition()
  const [titulo, setTitulo] = useState('')
  const [tempo, setTempo] = useState('')

  function onCriar() {
    if (!titulo.trim()) return
    onErro(null)
    const fd = new FormData()
    fd.set('titulo', titulo)
    fd.set('tempo_seg', tempo || '0')
    startTransition(async () => {
      const r = await criarCapitulo(aula.id, cursoId, fd)
      if (!r.ok) onErro(r.erro)
      else { setTitulo(''); setTempo(''); onRefresh() }
    })
  }

  function onExcluir(id: string) {
    onErro(null)
    startTransition(async () => {
      const r = await excluirCapitulo(id, cursoId)
      if (!r.ok) onErro(r.erro)
      else onRefresh()
    })
  }

  return (
    <div className="ad-sublista">
      <h3>Capítulos do vídeo</h3>
      {aula.capitulos.length === 0 && <p className="ad-vazio-sm">Nenhum capítulo.</p>}
      <ul>
        {aula.capitulos.map(c => (
          <li key={c.id}>
            <span>{c.titulo}</span>
            <span className="ad-sublista-meta">{segParaLabel(c.tempoSeg)}</span>
            <button type="button" className="ad-btn-perigo-sm" disabled={pendente} onClick={() => onExcluir(c.id)}>🗑</button>
          </li>
        ))}
      </ul>
      <div className="ad-nova-linha">
        <input type="text" placeholder="Título do capítulo" value={titulo} onChange={e => setTitulo(e.target.value)} />
        <input type="number" placeholder="Segundos" min="0" value={tempo} onChange={e => setTempo(e.target.value)} className="ad-input-sm" />
        <button type="button" className="ad-btn-secundario" disabled={pendente} onClick={onCriar}>+ Capítulo</button>
      </div>
    </div>
  )
}

function MateriaisBloco({ aula, cursoId, onErro, onRefresh }: {
  aula: AulaAdmin; cursoId: string; onErro: (e: string | null) => void; onRefresh: () => void
}) {
  const [pendente, startTransition] = useTransition()
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<'pdf' | 'xls'>('pdf')
  const [url, setUrl] = useState('')

  function onCriar() {
    if (!nome.trim() || !url.trim()) { onErro('Nome e link do material são obrigatórios.'); return }
    onErro(null)
    const fd = new FormData()
    fd.set('nome', nome)
    fd.set('tipo', tipo)
    fd.set('arquivo_url', url)
    startTransition(async () => {
      const r = await criarMaterial(aula.id, cursoId, fd)
      if (!r.ok) onErro(r.erro)
      else { setNome(''); setUrl(''); onRefresh() }
    })
  }

  function onExcluir(id: string) {
    onErro(null)
    startTransition(async () => {
      const r = await excluirMaterial(id, cursoId)
      if (!r.ok) onErro(r.erro)
      else onRefresh()
    })
  }

  return (
    <div className="ad-sublista">
      <h3>Materiais de apoio</h3>
      {aula.materiais.length === 0 && <p className="ad-vazio-sm">Nenhum material.</p>}
      <ul>
        {aula.materiais.map(m => (
          <li key={m.id}>
            <span>{m.nome}</span>
            <span className="ad-sublista-meta">{m.tipo.toUpperCase()}</span>
            <button type="button" className="ad-btn-perigo-sm" disabled={pendente} onClick={() => onExcluir(m.id)}>🗑</button>
          </li>
        ))}
      </ul>
      <div className="ad-nova-linha">
        <input type="text" placeholder="Nome do material" value={nome} onChange={e => setNome(e.target.value)} />
        <select value={tipo} onChange={e => setTipo(e.target.value as 'pdf' | 'xls')}>
          <option value="pdf">PDF</option>
          <option value="xls">XLS</option>
        </select>
        <input type="text" placeholder="Link do arquivo" value={url} onChange={e => setUrl(e.target.value)} />
        <button type="button" className="ad-btn-secundario" disabled={pendente} onClick={onCriar}>+ Material</button>
      </div>
    </div>
  )
}

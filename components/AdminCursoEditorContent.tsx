// components/AdminCursoEditorContent.tsx
'use client'

import { useState, useTransition } from 'react'
import type { FormEvent, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { CursoAdmin, ModuloAdmin, AulaAdmin } from '@/lib/queries/admin-cursos'
import {
  atualizarCurso, criarUploadCapaCurso, confirmarCapaCurso, alternarPublicacaoCurso, excluirCurso,
  criarModulo, atualizarModulo, excluirModulo, moverModulo,
  criarAula, atualizarAula, excluirAula, moverAula, criarUploadCapaAula, confirmarCapaAula,
  criarCapitulo, excluirCapitulo, uploadMateriais, renomearMaterial, moverMaterial, excluirMaterial,
} from '@/app/admin/cursos/actions'
import { criarClienteBrowser } from '@/lib/supabase/client'
import { IconeChevronLeft, IconeArrowUp, IconeArrowDown, IconePencil, IconeTrash, IconeUpload } from '@/components/Icones'
import { useAdminToast, AdminToastContainer } from '@/components/AdminToast'

function segParaLabel(seg: number) {
  const m = Math.floor(seg / 60)
  const s = seg % 60
  return `${m}min ${s}s`
}

const TAMANHO_MAX_CAPA = 5 * 1024 * 1024
const TIPOS_CAPA = ['image/png', 'image/jpeg', 'image/webp']

// Envia o arquivo direto do navegador pro Storage (bypassa a function
// serverless da Vercel, que tem teto fixo de 4.5MB) — ver comentário em
// criarUploadCapaCurso (app/admin/cursos/actions.ts) pra explicação completa.
async function enviarCapaDireto(path: string, token: string, file: File): Promise<{ ok: true } | { ok: false; erro: string }> {
  const supabase = criarClienteBrowser()
  const { error } = await supabase.storage.from('capas').uploadToSignedUrl(path, token, file, { contentType: file.type })
  if (error) return { ok: false, erro: error.message }
  return { ok: true }
}

export default function AdminCursoEditorContent({ curso, modulos }: { curso: CursoAdmin; modulos: ModuloAdmin[] }) {
  const router = useRouter()
  const toast = useAdminToast()
  const [pendente, startTransition] = useTransition()
  const [moduloExpandido, setModuloExpandido] = useState<string | null>(modulos[0]?.id ?? null)
  const [aulaExpandida, setAulaExpandida] = useState<string | null>(null)
  const [novoModuloTitulo, setNovoModuloTitulo] = useState('')

  function refresh() { router.refresh() }

  function onSalvarDados(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await atualizarCurso(curso.id, fd)
      if (!r.ok) toast.erro(r.erro)
      else { toast.sucesso('Dados gerais salvos com sucesso'); refresh() }
    })
  }

  function onUploadCapa(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!TIPOS_CAPA.includes(file.type)) { toast.erro('Formato não aceito. Use JPG, PNG ou WebP.'); return }
    if (file.size > TAMANHO_MAX_CAPA) { toast.erro('Imagem muito grande. Máximo 5 MB.'); return }
    startTransition(async () => {
      try {
        const prep = await criarUploadCapaCurso(curso.id, file.name)
        if (!prep.ok || !prep.path || !prep.token) { toast.erro(!prep.ok ? prep.erro : 'Falha ao preparar upload.'); return }
        const envio = await enviarCapaDireto(prep.path, prep.token, file)
        if (!envio.ok) { toast.erro(envio.erro); return }
        const r = await confirmarCapaCurso(curso.id, prep.path)
        if (!r.ok) { toast.erro(r.erro); return }
        toast.sucesso('Capa atualizada com sucesso')
        refresh()
      } catch {
        toast.erro('Não foi possível enviar a imagem. Tente novamente.')
      }
    })
  }

  function onAlternarPublicacao(publicado: boolean) {
    startTransition(async () => {
      const r = await alternarPublicacaoCurso(curso.id, publicado)
      if (!r.ok) toast.erro(r.erro)
      else { toast.sucesso(publicado ? 'Curso publicado com sucesso' : 'Curso voltou a rascunho'); refresh() }
    })
  }

  function onExcluirCurso() {
    if (!confirm(`Excluir o curso "${curso.titulo}"? Isso apaga módulos, aulas e avaliações vinculadas. Essa ação não pode ser desfeita.`)) return
    startTransition(async () => {
      const r = await excluirCurso(curso.id)
      if (!r.ok) toast.erro(r.erro)
      else router.push('/admin/cursos')
    })
  }

  function onCriarModulo() {
    if (!novoModuloTitulo.trim()) return
    const fd = new FormData()
    fd.set('titulo', novoModuloTitulo)
    startTransition(async () => {
      const r = await criarModulo(curso.id, fd)
      if (!r.ok) toast.erro(r.erro)
      else { toast.sucesso('Módulo criado com sucesso'); setNovoModuloTitulo(''); refresh() }
    })
  }

  return (
    <div className="pnl-curso-editor">
      <AdminToastContainer toasts={toast.toasts} remover={toast.remover} />
      <a href="/admin/cursos" className="pnl-voltar"><IconeChevronLeft size={14} /> Cursos</a>
      <div className="pnl-editor-cab">
        <h1>{curso.titulo}</h1>
        <div className="pnl-editor-cab-acoes">
          <label className={`pnl-toggle-papel${curso.publicado ? ' ativo' : ''}`}>
            <input type="checkbox" checked={curso.publicado} disabled={pendente} onChange={e => onAlternarPublicacao(e.target.checked)} />
            {curso.publicado ? 'Publicado' : 'Rascunho'}
          </label>
          {/* Lembrete permanente no alto da tela: sem ele, quem abre o editor
              de um curso de turma fechada não tem como saber que a lista de
              alunos é o que decide quem enxerga o trabalho todo. */}
          {curso.restrito && (
            <a href={`/admin/acessos?escopo=curso&curso=${curso.id}`} className="pnl-btn-secundario">
              Turma fechada · ver matriculados
            </a>
          )}
          <button type="button" className="pnl-btn-perigo" disabled={pendente} onClick={onExcluirCurso}>Excluir curso</button>
        </div>
      </div>

      <div className="pnl-editor-grid">
        <section className="pnl-card">
          <h2>Capa</h2>
          <div className="pnl-capa-preview" style={curso.capaUrl ? { backgroundImage: `url(${curso.capaUrl})` } : undefined}>
            {!curso.capaUrl && <span>Sem capa</span>}
          </div>
          <label className="pnl-btn-secundario pnl-upload-btn">
            Trocar capa
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onUploadCapa} hidden disabled={pendente} />
          </label>
        </section>

        <section className="pnl-card pnl-card-dados">
          <h2>Dados gerais</h2>
          <form onSubmit={onSalvarDados} className="pnl-form">
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
            <div className="pnl-form-linha">
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
            <div className="pnl-form-linha">
              <label className="pnl-checkbox-linha">
                <input type="checkbox" name="emite_certificado" defaultChecked={curso.emiteCertificado} />
                Emite certificado
              </label>
              <label>Carga horária (h)
                <input name="carga_horas" type="number" step="0.5" min="0" defaultValue={curso.cargaHoras ?? ''} />
              </label>
            </div>
            {/* ══════════════════════════════════════════════════
                TURMA FECHADA
                Rascunho não servia para isto: esconde o curso de todo mundo,
                inclusive de quem foi matriculado. Este é o meio-termo que
                faltava, e ele só faz sentido junto de "Publicado".
                ══════════════════════════════════════════════════ */}
            <label className="pnl-checkbox-linha" style={{ alignItems: 'flex-start' }}>
              <input type="checkbox" name="restrito" defaultChecked={curso.restrito} />
              <span>
                Turma fechada
                <small style={{ display: 'block', marginTop: 4 }}>
                  Só quem for matriculado nominalmente em Acessos vê este curso. Ele some do catálogo, da
                  vitrine da home e da jornada para todo o resto, e nem assinatura nem acesso vitalício o
                  abrem. Quem tentar pelo link direto recebe 404. Você, como admin, continua vendo.
                </small>
              </span>
            </label>
            <label>Contexto do certificado (email de conclusão)
              <textarea
                name="contexto_certificado"
                defaultValue={curso.contextoCertificado ?? ''}
                rows={3}
                placeholder="Deixe em branco pra usar o texto genérico padrão do email de certificado."
              />
            </label>
            <button type="submit" className="pnl-btn-primario" disabled={pendente}>{pendente ? 'Salvando...' : 'Salvar dados gerais'}</button>
          </form>
        </section>
      </div>

      <section className="pnl-card">
        <h2>Módulos e aulas</h2>
        <div className="pnl-nova-linha">
          <input
            type="text"
            placeholder="Título do novo módulo"
            value={novoModuloTitulo}
            onChange={e => setNovoModuloTitulo(e.target.value)}
          />
          <button type="button" className="pnl-btn-primario" disabled={pendente} onClick={onCriarModulo}>+ Módulo</button>
        </div>

        {modulos.length === 0 && <p className="pnl-vazio">Nenhum módulo cadastrado ainda.</p>}

        <div className="pnl-modulos-lista">
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
              onErro={toast.erro}
              onSucesso={toast.sucesso}
              onRefresh={refresh}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function ModuloBloco({
  modulo, cursoId, indice, total, expandido, aulaExpandida, onToggle, onToggleAula, onErro, onSucesso, onRefresh,
}: {
  modulo: ModuloAdmin
  cursoId: string
  indice: number
  total: number
  expandido: boolean
  aulaExpandida: string | null
  onToggle: () => void
  onToggleAula: (id: string) => void
  onErro: (erro: string) => void
  onSucesso: (m: string) => void
  onRefresh: () => void
}) {
  const [pendente, startTransition] = useTransition()
  const [editando, setEditando] = useState(false)
  const [titulo, setTitulo] = useState(modulo.titulo)
  const [novaAulaTitulo, setNovaAulaTitulo] = useState('')

  function onSalvarTitulo() {
    if (!titulo.trim()) return
    const fd = new FormData()
    fd.set('titulo', titulo)
    startTransition(async () => {
      const r = await atualizarModulo(modulo.id, cursoId, fd)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Módulo renomeado com sucesso'); setEditando(false); onRefresh() }
    })
  }

  function onMover(direcao: 'up' | 'down') {
    startTransition(async () => {
      const r = await moverModulo(cursoId, modulo.id, direcao)
      if (!r.ok) onErro(r.erro)
      else onRefresh()
    })
  }

  function onExcluir() {
    if (!confirm(`Excluir o módulo "${modulo.titulo}" e todas as suas aulas?`)) return
    startTransition(async () => {
      const r = await excluirModulo(modulo.id, cursoId)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Módulo excluído com sucesso'); onRefresh() }
    })
  }

  function onCriarAula() {
    if (!novaAulaTitulo.trim()) return
    const fd = new FormData()
    fd.set('titulo', novaAulaTitulo)
    startTransition(async () => {
      const r = await criarAula(modulo.id, cursoId, fd)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Aula criada com sucesso'); setNovaAulaTitulo(''); onRefresh() }
    })
  }

  return (
    <div className="pnl-modulo-bloco">
      <div className="pnl-modulo-cab">
        {editando ? (
          <div className="pnl-inline-edit">
            <input value={titulo} onChange={e => setTitulo(e.target.value)} autoFocus />
            <button type="button" className="pnl-btn-secundario" disabled={pendente} onClick={onSalvarTitulo}>Salvar</button>
            <button type="button" className="pnl-btn-secundario" onClick={() => { setEditando(false); setTitulo(modulo.titulo) }}>Cancelar</button>
          </div>
        ) : (
          <>
            <button type="button" className="pnl-modulo-toggle" onClick={onToggle}>
              {expandido ? '▾' : '▸'} {modulo.titulo}
            </button>
            <div className="pnl-modulo-acoes">
              <span className="pnl-modulo-contagem">{modulo.aulas.length} aula{modulo.aulas.length === 1 ? '' : 's'}</span>
              <button type="button" disabled={pendente || indice === 0} onClick={() => onMover('up')} title="Mover para cima"><IconeArrowUp size={13} /></button>
              <button type="button" disabled={pendente || indice === total - 1} onClick={() => onMover('down')} title="Mover para baixo"><IconeArrowDown size={13} /></button>
              <button type="button" onClick={() => setEditando(true)} title="Renomear"><IconePencil size={13} /></button>
              <button type="button" className="pnl-btn-perigo-sm" disabled={pendente} onClick={onExcluir} title="Excluir módulo"><IconeTrash size={13} /></button>
            </div>
          </>
        )}
      </div>

      {expandido && (
        <div className="pnl-modulo-corpo">
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
              onSucesso={onSucesso}
              onRefresh={onRefresh}
            />
          ))}
          <div className="pnl-nova-linha">
            <input type="text" placeholder="Título da nova aula" value={novaAulaTitulo} onChange={e => setNovaAulaTitulo(e.target.value)} />
            <button type="button" className="pnl-btn-secundario" disabled={pendente} onClick={onCriarAula}>+ Aula</button>
          </div>
        </div>
      )}
    </div>
  )
}

function AulaBloco({
  aula, cursoId, moduloId, indice, total, expandida, onToggle, onErro, onSucesso, onRefresh,
}: {
  aula: AulaAdmin
  cursoId: string
  moduloId: string
  indice: number
  total: number
  expandida: boolean
  onToggle: () => void
  onErro: (erro: string) => void
  onSucesso: (m: string) => void
  onRefresh: () => void
}) {
  const [pendente, startTransition] = useTransition()

  function onMover(direcao: 'up' | 'down') {
    startTransition(async () => {
      const r = await moverAula(moduloId, cursoId, aula.id, direcao)
      if (!r.ok) onErro(r.erro)
      else onRefresh()
    })
  }

  function onExcluir() {
    if (!confirm(`Excluir a aula "${aula.titulo}"?`)) return
    startTransition(async () => {
      const r = await excluirAula(aula.id, cursoId)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Aula excluída com sucesso'); onRefresh() }
    })
  }

  function onSalvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await atualizarAula(aula.id, cursoId, fd)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Aula salva com sucesso'); onRefresh() }
    })
  }

  function onUploadCapa(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!TIPOS_CAPA.includes(file.type)) { onErro('Formato não aceito. Use JPG, PNG ou WebP.'); return }
    if (file.size > TAMANHO_MAX_CAPA) { onErro('Imagem muito grande. Máximo 5 MB.'); return }
    startTransition(async () => {
      try {
        const prep = await criarUploadCapaAula(aula.id, file.name)
        if (!prep.ok || !prep.path || !prep.token) { onErro(!prep.ok ? prep.erro : 'Falha ao preparar upload.'); return }
        const envio = await enviarCapaDireto(prep.path, prep.token, file)
        if (!envio.ok) { onErro(envio.erro); return }
        const r = await confirmarCapaAula(aula.id, cursoId, prep.path)
        if (!r.ok) { onErro(r.erro); return }
        onSucesso('Capa da aula atualizada com sucesso')
        onRefresh()
      } catch {
        onErro('Não foi possível enviar a imagem. Tente novamente.')
      }
    })
  }

  return (
    <div className="pnl-aula-bloco">
      <div className="pnl-aula-cab">
        <button type="button" className="pnl-aula-toggle" onClick={onToggle}>
          {expandida ? '▾' : '▸'} {aula.titulo}
        </button>
        <div className="pnl-aula-acoes">
          <span className="pnl-aula-meta">{segParaLabel(aula.duracaoSeg)} · {aula.xp} XP</span>
          <button type="button" disabled={pendente || indice === 0} onClick={() => onMover('up')} title="Mover para cima"><IconeArrowUp size={13} /></button>
          <button type="button" disabled={pendente || indice === total - 1} onClick={() => onMover('down')} title="Mover para baixo"><IconeArrowDown size={13} /></button>
          <button type="button" className="pnl-btn-perigo-sm" disabled={pendente} onClick={onExcluir} title="Excluir aula"><IconeTrash size={13} /></button>
        </div>
      </div>

      {expandida && (
        <div className="pnl-aula-corpo">
          <form onSubmit={onSalvar} className="pnl-form">
            <label>Título
              <input name="titulo" defaultValue={aula.titulo} required />
            </label>
            <label>Descrição
              <textarea name="descricao" defaultValue={aula.descricao ?? ''} rows={2} />
            </label>
            <label>URL do vídeo (Panda Video)
              <input name="video_url" defaultValue={aula.videoUrl ?? ''} placeholder="https://player-vz-....tv.pandavideo.com.br/embed/?v=..." />
            </label>
            <div className="pnl-form-linha">
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
            <button type="submit" className="pnl-btn-primario" disabled={pendente}>{pendente ? 'Salvando...' : 'Salvar aula'}</button>
          </form>

          <div className="pnl-aula-capa-linha">
            <div className="pnl-capa-preview pnl-capa-preview-sm" style={aula.capaUrl ? { backgroundImage: `url(${aula.capaUrl})` } : undefined}>
              {!aula.capaUrl && <span>Sem capa</span>}
            </div>
            <label className="pnl-btn-secundario pnl-upload-btn">
              Trocar capa da aula
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onUploadCapa} hidden disabled={pendente} />
            </label>
          </div>

          <CapitulosBloco aula={aula} cursoId={cursoId} onErro={onErro} onSucesso={onSucesso} onRefresh={onRefresh} />
          <MateriaisBloco aula={aula} cursoId={cursoId} onErro={onErro} onSucesso={onSucesso} onRefresh={onRefresh} />
        </div>
      )}
    </div>
  )
}

function CapitulosBloco({ aula, cursoId, onErro, onSucesso, onRefresh }: {
  aula: AulaAdmin; cursoId: string; onErro: (e: string) => void; onSucesso: (m: string) => void; onRefresh: () => void
}) {
  const [pendente, startTransition] = useTransition()
  const [titulo, setTitulo] = useState('')
  const [tempo, setTempo] = useState('')

  function onCriar() {
    if (!titulo.trim()) return
    const fd = new FormData()
    fd.set('titulo', titulo)
    fd.set('tempo_seg', tempo || '0')
    startTransition(async () => {
      const r = await criarCapitulo(aula.id, cursoId, fd)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Capítulo criado com sucesso'); setTitulo(''); setTempo(''); onRefresh() }
    })
  }

  function onExcluir(id: string) {
    startTransition(async () => {
      const r = await excluirCapitulo(id, cursoId)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Capítulo excluído com sucesso'); onRefresh() }
    })
  }

  return (
    <div className="pnl-sublista">
      <h3>Capítulos do vídeo</h3>
      {aula.capitulos.length === 0 && <p className="pnl-vazio-sm">Nenhum capítulo.</p>}
      <ul>
        {aula.capitulos.map(c => (
          <li key={c.id}>
            <span>{c.titulo}</span>
            <span className="pnl-sublista-meta">{segParaLabel(c.tempoSeg)}</span>
            <button type="button" className="pnl-btn-perigo-sm" disabled={pendente} onClick={() => onExcluir(c.id)}><IconeTrash size={13} /></button>
          </li>
        ))}
      </ul>
      <div className="pnl-nova-linha">
        <input type="text" placeholder="Título do capítulo" value={titulo} onChange={e => setTitulo(e.target.value)} />
        <input type="number" placeholder="Segundos" min="0" value={tempo} onChange={e => setTempo(e.target.value)} className="pnl-input-sm" />
        <button type="button" className="pnl-btn-secundario" disabled={pendente} onClick={onCriar}>+ Capítulo</button>
      </div>
    </div>
  )
}

function fmtBytes(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function MateriaisBloco({ aula, cursoId, onErro, onSucesso, onRefresh }: {
  aula: AulaAdmin; cursoId: string; onErro: (e: string) => void; onSucesso: (m: string) => void; onRefresh: () => void
}) {
  const [pendente, startTransition] = useTransition()
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [nomeEditado, setNomeEditado] = useState('')

  function onUpload(e: ChangeEvent<HTMLInputElement>) {
    const arquivos = e.target.files
    if (!arquivos || arquivos.length === 0) return
    const fd = new FormData()
    Array.from(arquivos).forEach(f => fd.append('arquivos', f))
    startTransition(async () => {
      const r = await uploadMateriais(aula.id, cursoId, fd)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Materiais enviados com sucesso'); e.target.value = ''; onRefresh() }
    })
  }

  function onSalvarNome(id: string) {
    if (!nomeEditado.trim()) return
    startTransition(async () => {
      const r = await renomearMaterial(id, cursoId, nomeEditado)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Material renomeado com sucesso'); setEditandoId(null); onRefresh() }
    })
  }

  function onMover(id: string, direcao: 'up' | 'down') {
    startTransition(async () => {
      const r = await moverMaterial(aula.id, cursoId, id, direcao)
      if (!r.ok) onErro(r.erro)
      else onRefresh()
    })
  }

  function onExcluir(id: string, nome: string) {
    if (!confirm(`Excluir o material "${nome}"? Essa ação não pode ser desfeita.`)) return
    startTransition(async () => {
      const r = await excluirMaterial(id, cursoId)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Material excluído com sucesso'); onRefresh() }
    })
  }

  return (
    <div className="pnl-sublista">
      <h3>Materiais de apoio</h3>
      {aula.materiais.length === 0 && <p className="pnl-vazio-sm">Nenhum material.</p>}
      <ul>
        {aula.materiais.map((m, i) => (
          <li key={m.id}>
            {editandoId === m.id ? (
              <div className="pnl-inline-edit">
                <input value={nomeEditado} onChange={e => setNomeEditado(e.target.value)} autoFocus />
                <button type="button" className="pnl-btn-secundario" disabled={pendente} onClick={() => onSalvarNome(m.id)}>Salvar</button>
                <button type="button" className="pnl-btn-secundario" onClick={() => setEditandoId(null)}>Cancelar</button>
              </div>
            ) : (
              <>
                <span>{m.nome}</span>
                <span className="pnl-sublista-meta">{m.tipo.toUpperCase()}{m.tamanhoBytes ? ` · ${fmtBytes(m.tamanhoBytes)}` : ''}</span>
                <button type="button" disabled={pendente || i === 0} onClick={() => onMover(m.id, 'up')} title="Mover para cima"><IconeArrowUp size={13} /></button>
                <button type="button" disabled={pendente || i === aula.materiais.length - 1} onClick={() => onMover(m.id, 'down')} title="Mover para baixo"><IconeArrowDown size={13} /></button>
                <button type="button" onClick={() => { setEditandoId(m.id); setNomeEditado(m.nome) }} title="Renomear"><IconePencil size={13} /></button>
                <button type="button" className="pnl-btn-perigo-sm" disabled={pendente} onClick={() => onExcluir(m.id, m.nome)} title="Excluir"><IconeTrash size={13} /></button>
              </>
            )}
          </li>
        ))}
      </ul>
      <label className="pnl-btn-secundario pnl-upload-btn">
        <IconeUpload size={13} /> Enviar arquivos (PDF, XLSX, DOCX, ZIP, até 20MB cada)
        <input type="file" multiple accept=".pdf,.xlsx,.xls,.docx,.doc,.zip" onChange={onUpload} hidden disabled={pendente} />
      </label>
    </div>
  )
}

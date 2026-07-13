// components/AdminEventoEditorContent.tsx
'use client'

import { useState, useTransition } from 'react'
import type { FormEvent, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { EventoAdmin } from '@/lib/queries/admin-agenda'
import type { CursoPicker } from '@/lib/queries/admin-trilhas'
import { atualizarEvento, uploadThumbEvento, alternarPublicacaoEvento, excluirEvento } from '@/app/admin/agenda/actions'
import { IconeChevronLeft } from '@/components/Icones'

function paraDatetimeLocal(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function AdminEventoEditorContent({ evento, cursos }: { evento: EventoAdmin; cursos: CursoPicker[] }) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, startTransition] = useTransition()

  function refresh() { router.refresh() }

  function onSalvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await atualizarEvento(evento.id, fd)
      if (!r.ok) setErro(r.erro)
      else refresh()
    })
  }

  function onUploadThumb(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setErro(null)
    const fd = new FormData()
    fd.set('thumb', file)
    startTransition(async () => {
      const r = await uploadThumbEvento(evento.id, fd)
      if (!r.ok) setErro(r.erro)
      else refresh()
    })
  }

  function onAlternarPublicacao(publicado: boolean) {
    setErro(null)
    startTransition(async () => {
      const r = await alternarPublicacaoEvento(evento.id, publicado)
      if (!r.ok) setErro(r.erro)
      else refresh()
    })
  }

  function onExcluir() {
    if (!confirm(`Excluir o evento "${evento.titulo}"?`)) return
    setErro(null)
    startTransition(async () => {
      const r = await excluirEvento(evento.id)
      if (!r.ok) setErro(r.erro)
      else router.push('/admin/agenda')
    })
  }

  return (
    <div className="ad-curso-editor">
      <a href="/admin/agenda" className="ad-voltar"><IconeChevronLeft size={14} /> Agenda</a>
      <div className="ad-editor-cab">
        <h1>{evento.titulo}</h1>
        <div className="ad-editor-cab-acoes">
          <label className={`ad-toggle-papel${evento.publicado ? ' ativo' : ''}`}>
            <input type="checkbox" checked={evento.publicado} disabled={pendente} onChange={e => onAlternarPublicacao(e.target.checked)} />
            {evento.publicado ? 'Publicado' : 'Rascunho'}
          </label>
          <button type="button" className="ad-btn-perigo" disabled={pendente} onClick={onExcluir}>Excluir evento</button>
        </div>
      </div>

      {erro && <p className="ad-erro">{erro}</p>}

      <div className="ad-editor-grid">
        <section className="ad-card">
          <h2>Thumbnail</h2>
          <div className="ad-capa-preview" style={evento.gravacaoThumbUrl ? { backgroundImage: `url(${evento.gravacaoThumbUrl})` } : undefined}>
            {!evento.gravacaoThumbUrl && <span>Sem imagem</span>}
          </div>
          <label className="ad-btn-secundario ad-upload-btn">
            Trocar imagem
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onUploadThumb} hidden disabled={pendente} />
          </label>
        </section>

        <section className="ad-card ad-card-dados">
          <h2>Dados do evento</h2>
          <form onSubmit={onSalvar} className="ad-form">
            <label>Título
              <input name="titulo" defaultValue={evento.titulo} required minLength={3} />
            </label>
            <div className="ad-form-linha">
              <label>Tipo
                <select name="tipo" defaultValue={evento.tipo}>
                  <option value="sala_analise">Sala de análise</option>
                  <option value="aula_ao_vivo">Aula ao vivo</option>
                  <option value="plantao">Plantão</option>
                  <option value="mentoria">Mentoria</option>
                  <option value="lancamento">Lançamento</option>
                </select>
              </label>
              <label>Visibilidade
                <select name="visibilidade" defaultValue={evento.visibilidade}>
                  <option value="todos">Todos</option>
                  <option value="curso">Alunos do curso</option>
                  <option value="assinatura">Assinantes</option>
                  <option value="turma">Turma</option>
                </select>
              </label>
            </div>
            <label>Descrição
              <textarea name="descricao" defaultValue={evento.descricao ?? ''} rows={3} />
            </label>
            <div className="ad-form-linha">
              <label>Data e hora de início
                <input name="inicia_em" type="datetime-local" defaultValue={paraDatetimeLocal(evento.iniciaEm)} />
              </label>
              <label>Duração (segundos)
                <input name="duracao_seg" type="number" min="0" defaultValue={evento.duracaoSeg} />
              </label>
            </div>
            <label>Link da transmissão
              <input name="link_transmissao" defaultValue={evento.linkTransmissao ?? ''} placeholder="https://..." />
            </label>
            <label>Link da gravação (após o evento)
              <input name="gravacao_url" defaultValue={evento.gravacaoUrl ?? ''} placeholder="https://..." />
            </label>
            <div className="ad-form-linha">
              <label>Apresentador (nome)
                <input name="apresentador_nome" defaultValue={evento.apresentadorNome ?? ''} />
              </label>
              <label>Apresentador (cargo)
                <input name="apresentador_cargo" defaultValue={evento.apresentadorCargo ?? ''} />
              </label>
            </div>
            <div className="ad-form-linha">
              <label>Curso vinculado (opcional)
                <select name="curso_id" defaultValue={evento.cursoId ?? ''}>
                  <option value="">—</option>
                  {cursos.map(c => <option key={c.id} value={c.id}>{c.titulo}</option>)}
                </select>
              </label>
              <label>Rótulo do alvo
                <input name="alvo_rotulo" defaultValue={evento.alvoRotulo ?? ''} placeholder="Ex.: Turma de Perícia Bancária" />
              </label>
            </div>
            <label>Observação extra
              <input name="meta_extra" defaultValue={evento.metaExtra ?? ''} />
            </label>
            <div className="ad-form-linha">
              <label className="ad-checkbox-linha">
                <input type="checkbox" name="gravar" defaultChecked={evento.gravar} />
                Gravar
              </label>
              <label className="ad-checkbox-linha">
                <input type="checkbox" name="lembrete" defaultChecked={evento.lembrete} />
                Enviar lembrete
              </label>
              <label className="ad-checkbox-linha">
                <input type="checkbox" name="publicar_feed" defaultChecked={evento.publicarFeed} />
                Publicar no feed da comunidade
              </label>
            </div>
            <button type="submit" className="ad-btn-primario" disabled={pendente}>{pendente ? 'Salvando...' : 'Salvar evento'}</button>
          </form>
        </section>
      </div>

      <p className="ad-sub">{evento.totalReservas} reserva{evento.totalReservas === 1 ? '' : 's'} de alunos pra este evento.</p>
    </div>
  )
}

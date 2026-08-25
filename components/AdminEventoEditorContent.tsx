// components/AdminEventoEditorContent.tsx
'use client'

import { useState, useTransition } from 'react'
import type { FormEvent, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { EventoAdmin } from '@/lib/queries/admin-agenda'
import type { CursoPicker } from '@/lib/queries/admin-trilhas'
import { atualizarEvento, uploadThumbEvento, alternarPublicacaoEvento, excluirEvento } from '@/app/admin/agenda/actions'
import { IconeChevronLeft, IconeLink, IconeSend, IconeEye, IconeDownload } from '@/components/Icones'
import { useAdminToast, AdminToastContainer } from '@/components/AdminToast'
import { SITE_URL } from '@/lib/site'

function paraDatetimeLocal(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}


// ══════════════════════════════════════════════════════════════════
// LINK DE DIVULGAÇÃO
//
// A razão de o evento ter ganhado endereço próprio: alguém precisa copiar esse
// link e colar no WhatsApp da turma. Fica no topo da tela, antes dos campos,
// porque é o que se vem buscar aqui depois que o evento já está montado.
//
// ⚠️ O botão de copiar some enquanto o evento é rascunho, em vez de copiar um
// link que dá 404. Copiar agora e colar no grupo daqui a duas horas, com a
// publicação esquecida no meio, é exatamente o erro que ninguém percebe antes
// de a mensagem já ter sido lida por trezentas pessoas.
// ══════════════════════════════════════════════════════════════════
const TIPO_ROTULO: Record<string, string> = {
  sala_analise: 'Sala de análise',
  aula_ao_vivo: 'Aula ao vivo',
  plantao: 'Plantão de dúvidas',
  mentoria: 'Mentoria de turma',
  lancamento: 'Lançamento',
}

function quandoPorExtenso(iso: string | null) {
  if (!iso) return null
  const t = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
  return t.charAt(0).toUpperCase() + t.slice(1) + ', horário de Brasília'
}

/** O texto que vai colado na conversa. Sem emoji e sem exclamação: o convite
 *  precisa parecer recado de professor, não disparo de robô — é o que decide
 *  se alguém abre. A última linha é o link sozinho, para o WhatsApp montar a
 *  prévia com a imagem em vez de engolir a URL no meio do parágrafo. */
function textoDoConvite(evento: EventoAdmin, url: string) {
  const linhas = [`${TIPO_ROTULO[evento.tipo] ?? 'Evento'}: ${evento.titulo}`]
  const quando = quandoPorExtenso(evento.iniciaEm)
  if (quando) linhas.push(quando)
  if (evento.apresentadorNome) linhas.push(`Com ${evento.apresentadorNome}.`)
  linhas.push('')
  // Numa live aberta o convite vai para grupos onde a maioria não é aluna, e
  // a primeira pergunta de quem lê é "isso é para mim?". Responder antes de
  // ela ser feita é o que decide se a pessoa clica.
  linhas.push(evento.abertoAoPublico
    ? 'É aberto e gratuito, não precisa ser aluno. Inscreva-se aqui:'
    : 'Reserve seu lugar:')
  linhas.push(url)
  return linhas.join('\n')
}

function LinkDeDivulgacao({ evento, toast, ogImagePadrao }: {
  evento: EventoAdmin
  toast: ReturnType<typeof useAdminToast>
  ogImagePadrao: string | null
}) {
  const url = evento.slug ? `${SITE_URL}/evento/${evento.slug}` : null
  // Sem figura, o WhatsApp mostra o convite como uma tira de texto — abre
  // muito menos. Vale um aviso aqui, ao lado do botão de copiar, e não uma
  // descoberta depois da mensagem já enviada para o grupo.
  const semFigura = !evento.gravacaoThumbUrl && !ogImagePadrao

  async function copiar(texto: string, oque: string) {
    try {
      await navigator.clipboard.writeText(texto)
      toast.sucesso(`${oque} copiado. É só colar no WhatsApp.`)
    } catch {
      // Área de transferência negada (permissão, http, navegador antigo).
      // Silenciar seria pior: a pessoa cola uma coisa velha achando que colou
      // o convite. O campo ao lado continua selecionável à mão.
      toast.erro('Seu navegador bloqueou a cópia. Selecione o link do campo e copie com Ctrl+C.')
    }
  }

  if (!url) {
    return (
      <section className="pnl-card">
        <h2>Link de divulgação</h2>
        <p className="pnl-sub">Este evento ainda não tem endereço público. Salve o evento uma vez para gerá-lo.</p>
      </section>
    )
  }

  return (
    <section className="pnl-card">
      <h2>Link de divulgação</h2>
      <p className="pnl-sub">
        {evento.abertoAoPublico
          ? 'Este encontro está aberto a quem não é aluno: a página pede nome e email, confirma por email e manda lembrete na véspera e na hora de começar. Pode divulgar em qualquer lugar.'
          : 'Endereço público deste evento. Abre sem login e mostra data e apresentador, mas só aluno entra na sala. Para abrir a quem ainda não é aluno, marque "Aberto a quem não é aluno" nos dados abaixo.'}
      </p>

      <div className="pnl-form-linha" style={{ alignItems: 'flex-end' }}>
        <label style={{ flex: 1 }}>Endereço
          <input value={url} readOnly onFocus={e => e.currentTarget.select()} />
        </label>
      </div>

      {semFigura && (
        <p className="pnl-sub" style={{ marginTop: 12 }}>
          ⚠️ Este evento não tem <b>Thumbnail</b> e a plataforma não tem imagem padrão: o convite vai
          chegar no WhatsApp como texto sem figura. Suba uma imagem no campo Thumbnail abaixo.
        </p>
      )}

      {evento.publicado ? (
        <div className="pnl-editor-cab-acoes" style={{ marginTop: 12 }}>
          <button type="button" className="pnl-btn-primario" onClick={() => copiar(url, 'Link')}>
            <IconeLink size={14} /> Copiar link
          </button>
          <button type="button" className="pnl-btn-secundario" onClick={() => copiar(textoDoConvite(evento, url), 'Convite')}>
            <IconeSend size={14} /> Copiar convite pronto
          </button>
          <a className="pnl-btn-secundario" href={url} target="_blank" rel="noreferrer">
            <IconeEye size={14} /> Abrir a página
          </a>
        </div>
      ) : (
        <p className="pnl-sub" style={{ marginTop: 12 }}>
          O evento está em <b>rascunho</b>: este endereço responde 404 para qualquer pessoa.
          Publique acima antes de divulgar.
        </p>
      )}
    </section>
  )
}


// ══════════════════════════════════════════════════════════════════
// OS CONVIDADOS DE UMA LIVE ABERTA
//
// Gente que não tem conta e deixou nome e email para assistir. Para uma live
// de apresentação, esta lista é o resultado do evento — mais do que a
// contagem de quem assistiu. Daí o CSV: ela precisa sair daqui e ir para
// onde o acompanhamento acontece.
//
// A coluna "já é aluno" existe para separar as duas leituras que a mesma
// lista tem: quantas pessoas novas o convite trouxe, e quantas eram de casa.
// Sem ela, 40 inscritos parecem 40 oportunidades quando podem ser 5.
// ══════════════════════════════════════════════════════════════════
function Inscritos({ evento }: { evento: EventoAdmin }) {
  if (!evento.abertoAoPublico && evento.inscricoes.length === 0) return null

  const novos = evento.inscricoes.filter(i => !i.jaEAluno).length

  function baixarCsv() {
    const cabecalho = ['Nome', 'Email', 'WhatsApp', 'Ja e aluno', 'Inscrito em']
    // Aspas duplicadas e campo entre aspas: é o que faz um nome com vírgula
    // ("Silva, Jr.") não virar duas colunas na planilha de quem abrir.
    const escapar = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const linhas = evento.inscricoes.map(i => [
      i.nome, i.email, i.whatsapp ?? '', i.jaEAluno ? 'sim' : 'nao',
      new Date(i.criadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    ].map(escapar).join(','))

    // O BOM na frente é o que faz o Excel em português abrir o arquivo com os
    // acentos certos em vez de "JosÃ©".
    const csv = '\ufeff' + [cabecalho.map(escapar).join(','), ...linhas].join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `inscritos-${evento.slug ?? evento.id}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="pnl-card">
      <h2>Inscritos pela página pública</h2>
      {evento.inscricoes.length === 0 ? (
        <p className="pnl-sub">
          Ninguém se inscreveu ainda. O formulário aparece na página pública deste evento porque ele está
          marcado como aberto a quem não é aluno.
        </p>
      ) : (
        <>
          <p className="pnl-sub">
            {evento.inscricoes.length} inscrito{evento.inscricoes.length === 1 ? '' : 's'} ·{' '}
            <b>{novos}</b> {novos === 1 ? 'ainda não é aluno' : 'ainda não são alunos'}.
          </p>
          <div className="pnl-editor-cab-acoes" style={{ margin: '12px 0' }}>
            <button type="button" className="pnl-btn-secundario" onClick={baixarCsv}>
              <IconeDownload size={14} /> Baixar CSV
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="pnl-tabela">
              <thead>
                <tr><th>Nome</th><th>Email</th><th>WhatsApp</th><th>Já é aluno</th><th>Inscrito em</th></tr>
              </thead>
              <tbody>
                {evento.inscricoes.map(i => (
                  <tr key={i.email}>
                    <td>{i.nome}</td>
                    <td>{i.email}</td>
                    <td>{i.whatsapp ?? '—'}</td>
                    <td>{i.jaEAluno ? 'sim' : '—'}</td>
                    <td>{new Date(i.criadoEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}

export default function AdminEventoEditorContent({ evento, cursos, ogImagePadrao }: {
  evento: EventoAdmin; cursos: CursoPicker[]; ogImagePadrao: string | null
}) {
  const router = useRouter()
  const toast = useAdminToast()
  const [pendente, startTransition] = useTransition()

  function refresh() { router.refresh() }

  function onSalvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await atualizarEvento(evento.id, fd)
      if (!r.ok) toast.erro(r.erro)
      else { toast.sucesso('Evento salvo com sucesso'); refresh() }
    })
  }

  function onUploadThumb(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.set('thumb', file)
    startTransition(async () => {
      const r = await uploadThumbEvento(evento.id, fd)
      if (!r.ok) toast.erro(r.erro)
      else { toast.sucesso('Thumbnail atualizada com sucesso'); refresh() }
    })
  }

  function onAlternarPublicacao(publicado: boolean) {
    startTransition(async () => {
      const r = await alternarPublicacaoEvento(evento.id, publicado)
      if (!r.ok) toast.erro(r.erro)
      else { toast.sucesso(publicado ? 'Evento publicado com sucesso' : 'Evento voltou a rascunho'); refresh() }
    })
  }

  function onExcluir() {
    if (!confirm(`Excluir o evento "${evento.titulo}"?`)) return
    startTransition(async () => {
      const r = await excluirEvento(evento.id)
      if (!r.ok) toast.erro(r.erro)
      else router.push('/admin/agenda')
    })
  }

  return (
    <div className="pnl-curso-editor">
      <AdminToastContainer toasts={toast.toasts} remover={toast.remover} />
      <a href="/admin/agenda" className="pnl-voltar"><IconeChevronLeft size={14} /> Agenda</a>
      <div className="pnl-editor-cab">
        <h1>{evento.titulo}</h1>
        <div className="pnl-editor-cab-acoes">
          <label className={`pnl-toggle-papel${evento.publicado ? ' ativo' : ''}`}>
            <input type="checkbox" checked={evento.publicado} disabled={pendente} onChange={e => onAlternarPublicacao(e.target.checked)} />
            {evento.publicado ? 'Publicado' : 'Rascunho'}
          </label>
          <button type="button" className="pnl-btn-perigo" disabled={pendente} onClick={onExcluir}>Excluir evento</button>
        </div>
      </div>

      <LinkDeDivulgacao evento={evento} toast={toast} ogImagePadrao={ogImagePadrao} />

      <div className="pnl-editor-grid">
        <section className="pnl-card">
          <h2>Thumbnail</h2>
          <div className="pnl-capa-preview" style={evento.gravacaoThumbUrl ? { backgroundImage: `url(${evento.gravacaoThumbUrl})` } : undefined}>
            {!evento.gravacaoThumbUrl && <span>Sem imagem</span>}
          </div>
          <label className="pnl-btn-secundario pnl-upload-btn">
            Trocar imagem
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onUploadThumb} hidden disabled={pendente} />
          </label>
        </section>

        <section className="pnl-card pnl-card-dados">
          <h2>Dados do evento</h2>
          <form onSubmit={onSalvar} className="pnl-form">
            <label>Título
              <input name="titulo" defaultValue={evento.titulo} required minLength={3} />
            </label>
            <div className="pnl-form-linha">
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
            <div className="pnl-form-linha">
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
            <div className="pnl-form-linha">
              <label>Apresentador (nome)
                <input name="apresentador_nome" defaultValue={evento.apresentadorNome ?? ''} />
              </label>
              <label>Apresentador (cargo)
                <input name="apresentador_cargo" defaultValue={evento.apresentadorCargo ?? ''} />
              </label>
            </div>
            <div className="pnl-form-linha">
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
            <label>Recado curto
              <input name="meta_extra" defaultValue={evento.metaExtra ?? ''} placeholder="Ex.: Traga um extrato seu" />
              <small>Uma linha que aparece no card do evento, abaixo do apresentador. Deixe vazio se não tiver.</small>
            </label>

            {/* ══════════════════════════════════════════════════
                Estes cinco interruptores estavam espalhados em duas fileiras
                iguais às dos campos de texto, o que os esticava pela largura
                toda e não dizia o que nenhum deles fazia. Agora são cartões,
                cada um com uma linha explicando a consequência de ligar.

                "Aberto a quem não é aluno" vem primeiro porque é o único que
                muda quem pode entrar; os outros quatro são detalhes de
                produção.
                ══════════════════════════════════════════════════ */}
            <fieldset className="pnl-opcoes">
              <legend>Como este encontro funciona</legend>

              <label className="pnl-opcao pnl-opcao-destaque">
                <input type="checkbox" name="aberto_ao_publico" defaultChecked={evento.abertoAoPublico} />
                <span>
                  <b>Aberto a quem não é aluno</b>
                  <small>
                    A página pública passa a pedir nome e email de quem não tem conta, confirma por
                    email e manda os lembretes. Use nas lives de divulgação.
                  </small>
                </span>
              </label>

              <label className="pnl-opcao">
                <input type="checkbox" name="lembrete" defaultChecked={evento.lembrete} />
                <span>
                  <b>Enviar lembretes por email</b>
                  <small>
                    Três emails para quem se inscreveu: na manhã do dia, uma hora antes e quando
                    a transmissão entra no ar.
                  </small>
                </span>
              </label>

              <label className="pnl-opcao">
                <input type="checkbox" name="chat_ao_vivo" defaultChecked={evento.chatAoVivo} />
                <span>
                  <b>Embutir o chat do YouTube</b>
                  <small>
                    Mostra o chat ao lado do vídeo. Desligue quando a transmissão não tiver chat,
                    senão aparece uma caixa de aviso do YouTube dentro da página.
                  </small>
                </span>
              </label>

              <label className="pnl-opcao">
                <input type="checkbox" name="gravar" defaultChecked={evento.gravar} />
                <span>
                  <b>Vai ser gravado</b>
                  <small>
                    Só anota a intenção. A gravação em si é o link que você cola em
                    &quot;Link da gravação&quot;, depois do encontro.
                  </small>
                </span>
              </label>

              <label className="pnl-opcao">
                <input type="checkbox" name="publicar_feed" defaultChecked={evento.publicarFeed} />
                <span>
                  <b>Publicar no feed da comunidade</b>
                  <small>Anuncia o encontro para os alunos dentro da Comunidade.</small>
                </span>
              </label>
            </fieldset>
            <button type="submit" className="pnl-btn-primario" disabled={pendente}>{pendente ? 'Salvando...' : 'Salvar evento'}</button>
          </form>
        </section>
      </div>

      <Inscritos evento={evento} />

      <p className="pnl-sub">{evento.totalReservas} reserva{evento.totalReservas === 1 ? '' : 's'} de alunos pra este evento.</p>
    </div>
  )
}

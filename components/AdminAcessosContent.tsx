// components/AdminAcessosContent.tsx
'use client'

import { useState, useTransition } from 'react'
import type { FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { AcessoLinha, CursoOpcao, Escopo } from '@/lib/queries/admin-acessos'
import {
  concederAcesso, alterarPrazoAcesso, revogarAcesso, reativarAcesso,
  enviarEmailDeAcesso, linkDeEntrada, concederAcessoEmLote,
} from '@/app/admin/acessos/actions'
import type { LinhaLote } from '@/app/admin/acessos/actions'
import { separarEmails } from '@/lib/acessos/conceder'
import { useAdminToast, AdminToastContainer } from '@/components/AdminToast'

type Filtros = { busca?: string; escopo?: string; curso?: string; status?: string; pagina?: string }

/** O que acabou de ser concedido — sustenta o painel de "e agora, avise a pessoa". */
type Recem = {
  usuarioId: string
  nome: string
  email: string
  oQueGanhou: string
  vigencia: string
  contaCriada: boolean
  redundante: boolean
  /** Data de fim já formatada, ou null quando vitalício. */
  ate: string | null
  escopo: Escopo
  cursoSlug: string | null
  /** Título do curso, para o e-mail dizer o que digitar na busca do catálogo. */
  cursoTitulo: string | null
  tags: string[]
  nexus: { ok: boolean; criada: boolean; jaEraAssinante: boolean; erro?: string }
}

function formatarBR(iso: string | null): string {
  if (!iso) return '—'
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

function descreverAcesso(escopo: Escopo, cursoTitulo: string | null): string {
  if (escopo === 'curso') return cursoTitulo ? `Curso: ${cursoTitulo}` : 'Curso (removido)'
  if (escopo === 'biblioteca') return 'Biblioteca'
  return 'Tudo (acesso total)'
}

export default function AdminAcessosContent({
  acessos, total, pagina, porPagina, cursos, filtros,
}: {
  acessos: AcessoLinha[]
  total: number
  pagina: number
  porPagina: number
  cursos: CursoOpcao[]
  filtros: Filtros
}) {
  const router = useRouter()
  const toast = useAdminToast()
  const [pendente, startTransition] = useTransition()
  const [abrirForm, setAbrirForm] = useState(false)
  const [abrirLote, setAbrirLote] = useState(false)
  const [recem, setRecem] = useState<Recem | null>(null)
  const [lote, setLote] = useState<{ linhas: LinhaLote[]; concedidos: number; cursoTitulo: string } | null>(null)

  const totalPaginas = Math.max(1, Math.ceil(total / porPagina))

  function irPara(mudanca: Partial<Filtros>) {
    const p = new URLSearchParams()
    const novo = { ...filtros, ...mudanca }
    for (const [k, v] of Object.entries(novo)) if (v) p.set(k, String(v))
    // Qualquer troca de filtro volta para a primeira página: manter a página 4
    // de um filtro anterior mostra "nenhum resultado" sobre uma lista que tem
    // resultados, e parece defeito.
    if (!('pagina' in mudanca)) p.delete('pagina')
    router.push(`/admin/acessos?${p.toString()}`)
  }

  return (
    <div className="pnl-cursos">
      <AdminToastContainer toasts={toast.toasts} remover={toast.remover} />

      <div className="pnl-cursos-cab">
        <div>
          <h1>Acessos</h1>
          <p className="pnl-sub">
            Libere um curso, a biblioteca ou a plataforma inteira para um aluno, com prazo ou vitalício.
            Serve para quem comprou por fora da assinatura — inclusive quem ainda nem tem login aqui.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="pnl-btn-secundario" onClick={() => { setAbrirLote(v => !v); setAbrirForm(false); setRecem(null); setLote(null) }}>
            {abrirLote ? 'Fechar' : 'Matricular turma'}
          </button>
          <button type="button" className="pnl-btn-primario" onClick={() => { setAbrirForm(v => !v); setAbrirLote(false); setRecem(null); setLote(null) }}>
            {abrirForm ? 'Fechar' : '+ Conceder acesso'}
          </button>
        </div>
      </div>

      {abrirForm && (
        <FormConcessao
          cursos={cursos}
          pendente={pendente}
          onErro={toast.erro}
          onConcedido={(r) => { setRecem(r); setAbrirForm(false); router.refresh() }}
          startTransition={startTransition}
        />
      )}

      {abrirLote && (
        <FormLote
          cursos={cursos}
          pendente={pendente}
          onErro={toast.erro}
          onPronto={(r) => { setLote(r); setAbrirLote(false); router.refresh() }}
          startTransition={startTransition}
        />
      )}

      {lote && <PainelLote lote={lote} onFechar={() => setLote(null)} />}

      {recem && <PainelRecem recem={recem} onErro={toast.erro} onSucesso={toast.sucesso} onFechar={() => setRecem(null)} />}

      <section className="pnl-card">
        <div className="pnl-filtros" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
          <label style={{ flex: '1 1 220px' }}>Buscar aluno
            <input
              defaultValue={filtros.busca ?? ''}
              placeholder="Nome ou e-mail do aluno"
              onKeyDown={e => { if (e.key === 'Enter') irPara({ busca: (e.target as HTMLInputElement).value }) }}
            />
          </label>
          <label>Curso
            <select value={filtros.curso ?? ''} onChange={e => irPara({ curso: e.target.value })}>
              <option value="">Todos</option>
              {cursos.map(c => <option key={c.id} value={c.id}>{c.titulo}</option>)}
            </select>
          </label>
          <label>Tipo
            <select value={filtros.escopo ?? ''} onChange={e => irPara({ escopo: e.target.value })}>
              <option value="">Todos</option>
              <option value="curso">Curso</option>
              <option value="total">Acesso total</option>
              <option value="biblioteca">Biblioteca</option>
            </select>
          </label>
          <label>Situação
            <select value={filtros.status ?? 'vigentes'} onChange={e => irPara({ status: e.target.value })}>
              <option value="vigentes">Vigentes</option>
              <option value="vencidos">Vencidos</option>
              <option value="revogados">Revogados</option>
              <option value="todos">Todos</option>
            </select>
          </label>
        </div>

        {acessos.length === 0 && <p className="pnl-vazio">Nenhum acesso encontrado com esses filtros.</p>}

        {acessos.length > 0 && (
          <div className="pnl-tabela-scroll">
            <table className="pnl-tabela">
              <thead>
                <tr><th>Aluno</th><th>Acesso</th><th>Vigência</th><th>Origem</th><th></th></tr>
              </thead>
              <tbody>
                {acessos.map(a => (
                  <LinhaAcesso
                    key={a.id}
                    acesso={a}
                    pendente={pendente}
                    onErro={toast.erro}
                    onSucesso={toast.sucesso}
                    startTransition={startTransition}
                    aoMudar={() => router.refresh()}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPaginas > 1 && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 16 }}>
            <button type="button" className="pnl-btn-secundario" disabled={pagina <= 1}
              onClick={() => irPara({ pagina: String(pagina - 1) })}>Anterior</button>
            <span className="pnl-sub">Página {pagina} de {totalPaginas} · {total} concessões</span>
            <button type="button" className="pnl-btn-secundario" disabled={pagina >= totalPaginas}
              onClick={() => irPara({ pagina: String(pagina + 1) })}>Próxima</button>
          </div>
        )}
      </section>
    </div>
  )
}

// ============================================================
// O formulário
// ============================================================
function FormConcessao({
  cursos, pendente, onErro, onConcedido, startTransition,
}: {
  cursos: CursoOpcao[]
  pendente: boolean
  onErro: (e: string) => void
  onConcedido: (r: Recem) => void
  startTransition: (cb: () => void) => void
}) {
  const [escopo, setEscopo] = useState<Escopo>('curso')
  const [vitalicio, setVitalicio] = useState(false)

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const email = String(fd.get('email') ?? '').trim()
    const nome = String(fd.get('nome') ?? '').trim()
    const cursoId = escopo === 'curso' ? String(fd.get('curso') ?? '') || null : null
    const expiraEm = vitalicio ? null : String(fd.get('expira') ?? '') || null
    const observacao = String(fd.get('observacao') ?? '')

    startTransition(async () => {
      const curso0 = cursos.find(c => c.id === cursoId)
      const r = await concederAcesso({ email, nome, escopo, cursoId, cursoSlug: curso0?.slug ?? null, vitalicio, expiraEm, observacao })
      if (!r.ok) { onErro(r.erro); return }
      const curso = cursos.find(c => c.id === cursoId)
      onConcedido({
        usuarioId: r.usuarioId,
        nome: r.nome,
        email,
        oQueGanhou: escopo === 'curso' ? `o curso ${curso?.titulo ?? ''}`.trim()
          : escopo === 'biblioteca' ? 'o acesso à biblioteca'
          : 'o acesso completo à plataforma',
        vigencia: vitalicio ? 'com acesso vitalício' : `com acesso até ${formatarBR(expiraEm)}`,
        contaCriada: r.contaCriada,
        redundante: r.redundante,
        ate: vitalicio ? null : formatarBR(expiraEm),
        escopo,
        cursoSlug: curso0?.slug ?? null,
        cursoTitulo: curso0?.titulo ?? null,
        tags: r.nexus.tags ?? [],
        nexus: r.nexus,
      })
    })
  }

  return (
    <section className="pnl-card">
      <h2>Conceder acesso</h2>
      <p className="pnl-sub">
        Se o e-mail ainda não tiver conta na plataforma, ela é criada aqui — com senha aleatória que ninguém
        conhece. A pessoa entra pela página de primeiro acesso e define a senha dela.
      </p>

      <form onSubmit={onSubmit} className="pnl-form">
        <div className="pnl-form-linha">
          <label style={{ flex: 2 }}>E-mail do aluno
            <input name="email" type="email" required placeholder="pessoa@email.com" autoComplete="off" />
          </label>
          <label style={{ flex: 2 }}>Nome completo
            <input name="nome" placeholder="Usado só se a conta ainda não existir" autoComplete="off" />
          </label>
        </div>

        <div className="pnl-form-linha">
          <label>O que ela ganha
            <select value={escopo} onChange={e => setEscopo(e.target.value as Escopo)}>
              <option value="curso">Um curso</option>
              <option value="biblioteca">Biblioteca</option>
              <option value="total">Plataforma inteira</option>
            </select>
          </label>

          {escopo === 'curso' && (
            <label style={{ flex: 2 }}>Curso
              <select name="curso" required defaultValue="">
                <option value="" disabled>Escolha o curso</option>
                {cursos.map(c => (
                  <option key={c.id} value={c.id}>{c.titulo}{c.publicado ? '' : ' (não publicado)'}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="pnl-form-linha" style={{ alignItems: 'flex-end' }}>
          <label style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={vitalicio} onChange={e => setVitalicio(e.target.checked)} style={{ width: 'auto' }} />
            Acesso vitalício
          </label>
          {!vitalicio && (
            <label>Acesso até
              <input name="expira" type="date" required />
            </label>
          )}
        </div>

        <label>Observação (opcional)
          <input name="observacao" placeholder="Ex.: comprou o PASEP na Ensinio em 2025, pedido #1234" autoComplete="off" />
        </label>

        <button type="submit" className="pnl-btn-primario" disabled={pendente}>
          {pendente ? 'Concedendo...' : 'Conceder acesso'}
        </button>
      </form>
    </section>
  )
}

// ============================================================
// Matricular uma turma
// ============================================================
// A tela nasceu para cadastrar um comprador antigo por vez. Turma de mentoria é
// outra coisa: uma lista pronta, colada de algum lugar, que precisa entrar
// inteira e mostrar o que aconteceu com CADA linha — não um "sucesso" verde que
// esconde as três que ficaram de fora.
function FormLote({
  cursos, pendente, onErro, onPronto, startTransition,
}: {
  cursos: CursoOpcao[]
  pendente: boolean
  onErro: (e: string) => void
  onPronto: (r: { linhas: LinhaLote[]; concedidos: number; cursoTitulo: string }) => void
  startTransition: (cb: () => void) => void
}) {
  const [emails, setEmails] = useState('')
  const [vitalicio, setVitalicio] = useState(true)
  const [cursoId, setCursoId] = useState('')

  // A contagem aparece enquanto se cola, e já sem as repetidas. Uma lista de
  // WhatsApp quase sempre tem o mesmo endereço duas vezes, e descobrir isso
  // depois de gravar é tarde.
  const quantos = separarEmails(emails).length

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const expiraEm = vitalicio ? null : String(fd.get('expira') ?? '') || null
    const curso = cursos.find(c => c.id === cursoId)
    if (!curso) { onErro('Escolha o curso.'); return }

    if (!confirm(
      `Matricular ${quantos} pessoa${quantos === 1 ? '' : 's'} em "${curso.titulo}"?\n\n`
      + 'Ninguém é avisado: nenhum email sai, e nenhuma conta nova é criada. '
      + 'Quem não tiver conta aqui aparece na lista para você resolver.',
    )) return

    startTransition(async () => {
      const r = await concederAcessoEmLote({
        emails,
        cursoId,
        vitalicio,
        expiraEm,
        observacao: String(fd.get('observacao') ?? ''),
      })
      if (!r.ok) { onErro(r.erro); return }
      onPronto({ linhas: r.linhas, concedidos: r.concedidos, cursoTitulo: curso.titulo })
    })
  }

  return (
    <section className="pnl-card">
      <h2>Matricular turma</h2>
      <p className="pnl-sub">
        Cole os emails da turma, um por linha. Serve para mentoria e qualquer curso de grupo fechado.
        Se o curso estiver marcado como turma fechada no editor dele, quem não estiver nesta lista não
        vê o curso no catálogo nem os eventos dele na agenda.
      </p>

      <form onSubmit={onSubmit} className="pnl-form">
        <label>Emails da turma
          <textarea
            value={emails}
            onChange={e => setEmails(e.target.value)}
            rows={8}
            required
            placeholder={'pessoa1@email.com\npessoa2@email.com\npessoa3@email.com'}
          />
          <small>
            {quantos === 0
              ? 'Um por linha. Vírgula e ponto e vírgula também servem.'
              : `${quantos} email${quantos === 1 ? '' : 's'} distinto${quantos === 1 ? '' : 's'} na lista.`}
          </small>
        </label>

        <div className="pnl-form-linha">
          <label style={{ flex: 2 }}>Curso
            <select value={cursoId} onChange={e => setCursoId(e.target.value)} required>
              <option value="" disabled>Escolha o curso</option>
              {cursos.map(c => (
                <option key={c.id} value={c.id}>
                  {c.titulo}{c.publicado ? '' : ' (não publicado)'}{c.restrito ? ' · turma fechada' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="pnl-form-linha" style={{ alignItems: 'flex-end' }}>
          <label style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={vitalicio} onChange={e => setVitalicio(e.target.checked)} style={{ width: 'auto' }} />
            Acesso vitalício
          </label>
          {!vitalicio && (
            <label>Acesso até
              <input name="expira" type="date" required />
            </label>
          )}
        </div>

        <label>Observação (opcional)
          <input name="observacao" placeholder="Ex.: Mentoria turma de setembro/2026" autoComplete="off" />
        </label>

        <button type="submit" className="pnl-btn-primario" disabled={pendente || quantos === 0 || !cursoId}>
          {pendente ? 'Matriculando...' : `Matricular ${quantos || ''}`.trim()}
        </button>
      </form>
    </section>
  )
}

const ROTULO_LOTE: Record<LinhaLote['situacao'], { texto: string; cor: string }> = {
  concedido: { texto: 'matriculado', cor: '#20D9A6' },
  ja_tinha: { texto: 'já tinha', cor: '#B9BFB8' },
  sem_conta: { texto: 'sem conta aqui', cor: '#F5A623' },
  erro: { texto: 'não entrou', cor: '#F03434' },
}

// O relatório fica na tela até ser fechado, e as linhas que não entraram vêm
// primeiro. Um lote de 60 com 3 problemas no meio da lista, ordenado por email,
// é um lote em que ninguém percebe os 3.
function PainelLote({
  lote, onFechar,
}: {
  lote: { linhas: LinhaLote[]; concedidos: number; cursoTitulo: string }
  onFechar: () => void
}) {
  const peso: Record<LinhaLote['situacao'], number> = { erro: 0, sem_conta: 1, ja_tinha: 2, concedido: 3 }
  const ordenadas = [...lote.linhas].sort((a, b) => peso[a.situacao] - peso[b.situacao])
  const pendencias = lote.linhas.filter(l => l.situacao === 'sem_conta' || l.situacao === 'erro').length

  return (
    <section className="pnl-card">
      <h2>Turma matriculada</h2>
      <p style={{ margin: '0 0 6px' }}>
        <strong>{lote.concedidos}</strong> de {lote.linhas.length} entraram agora em &quot;{lote.cursoTitulo}&quot;.
      </p>
      {pendencias > 0 && (
        <p className="pnl-sub" style={{ margin: '0 0 6px', color: '#F5A623', fontWeight: 600 }}>
          {pendencias} não {pendencias === 1 ? 'entrou' : 'entraram'}. Quem aparece como &quot;sem conta aqui&quot;
          precisa ser cadastrado um a um em &quot;Conceder acesso&quot;, que é onde a conta é criada.
        </p>
      )}
      <p className="pnl-sub" style={{ margin: '0 0 12px' }}>
        <strong>Ninguém foi avisado.</strong> Nenhum email saiu.
      </p>

      <table className="pnl-tabela">
        <thead>
          <tr><th>Email</th><th>Nome</th><th>Situação</th></tr>
        </thead>
        <tbody>
          {ordenadas.map(l => (
            <tr key={l.email}>
              <td>{l.email}</td>
              <td className="pnl-sub">{l.nome || '—'}</td>
              <td style={{ color: ROTULO_LOTE[l.situacao].cor, fontWeight: 600 }}>
                {ROTULO_LOTE[l.situacao].texto}
                {l.detalhe && <span className="pnl-sub" style={{ display: 'block', fontWeight: 400 }}>{l.detalhe}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 12 }}>
        <button type="button" className="pnl-btn-secundario" onClick={onFechar}>Fechar</button>
      </div>
    </section>
  )
}


// ============================================================
// Depois de conceder — a pessoa ainda não sabe
// ============================================================
// Este painel existe porque o cadastro NÃO avisa ninguém. Sem ele, a operação
// termina com um "sucesso" verde e uma pessoa que continua sem saber que tem
// acesso — que é exatamente o mesmo silêncio de não ter concedido nada.
function PainelRecem({
  recem, onErro, onSucesso, onFechar,
}: {
  recem: Recem
  onErro: (e: string) => void
  onSucesso: (m: string) => void
  onFechar: () => void
}) {
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function onEnviar() {
    setEnviando(true)
    const r = await enviarEmailDeAcesso(recem.email, recem.nome, recem.usuarioId, recem.oQueGanhou, recem.ate, { escopo: recem.escopo, cursoSlug: recem.cursoSlug }, recem.cursoTitulo)
    setEnviando(false)
    if (!r.ok) { onErro(r.erro); return }
    setEnviado(true)
    onSucesso(`E-mail enviado para ${recem.email}`)
  }

  async function onCopiar() {
    const link = await linkDeEntrada()
    await navigator.clipboard.writeText(link)
    onSucesso('Link de entrada do Nexus copiado')
  }

  return (
    <section className="pnl-card">
      <h2>Concedido</h2>
      <p style={{ margin: '0 0 6px' }}>
        <strong>{recem.nome}</strong> ({recem.email}) — {recem.oQueGanhou}, {recem.vigencia}.
      </p>

      {recem.contaCriada && (
        <p className="pnl-sub" style={{ margin: '0 0 6px' }}>
          A conta da Academy foi criada agora, com senha aleatória que ninguém conhece.
        </p>
      )}

      {/* A entrada dessa pessoa é o Nexus, e por isso o estado da conta de lá é
          o que decide se o cadastro terminou ou não. Sem este bloco, um Nexus
          fora do ar deixaria o operador fechar a tela achando que acabou. */}
      {!recem.nexus.ok && (
        <p className="pnl-sub" style={{ margin: '0 0 6px', color: '#F03434', fontWeight: 600 }}>
          A conta do Nexus NÃO foi criada: {recem.nexus.erro}. O acesso ao curso já está gravado, mas ela
          ainda não tem por onde entrar — refaça o envio pelo botão abaixo quando o Nexus responder.
        </p>
      )}
      {recem.nexus.ok && recem.nexus.criada && (
        <p className="pnl-sub" style={{ margin: '0 0 6px' }}>
          Conta do Nexus criada. É por lá que ela entra: vai ver o painel em modo vitrine, com a oferta,
          e o cartão da Academy abrindo o curso dela.
        </p>
      )}
      {recem.nexus.ok && recem.nexus.jaEraAssinante && (
        <p className="pnl-sub" style={{ margin: '0 0 6px', fontWeight: 600 }}>
          Atenção: essa pessoa já é assinante do Nexus, então o plano dela foi mantido intacto. Ela já
          tinha acesso à plataforma inteira — confira se este cadastro de curso avulso era mesmo o caso.
        </p>
      )}

      {recem.redundante && (
        <p className="pnl-sub" style={{ margin: '0 0 6px' }}>
          Atenção: esse aluno já tem acesso à plataforma inteira vigente, então esta concessão de curso é
          redundante hoje. Ela continua valendo se o acesso total expirar antes.
        </p>
      )}

      {recem.tags.length > 0 && (
        <p className="pnl-sub" style={{ margin: '0 0 6px' }}>
          Na base do Nexus com as etiquetas{' '}
          {recem.tags.map((t, i) => (
            <span key={t}>
              {i > 0 && ' e '}
              <code style={{ background: 'rgba(255,255,255,.07)', padding: '1px 6px', borderRadius: 5 }}>{t}</code>
            </span>
          ))}
          {' '}— é por elas que você monta a audiência para vender a assinatura.
        </p>
      )}
      {recem.nexus.ok && recem.tags.length === 0 && (
        <p className="pnl-sub" style={{ margin: '0 0 6px', color: '#F5A623' }}>
          A conta foi criada, mas nenhuma etiqueta entrou na base do Nexus. Essa pessoa não vai aparecer
          em recorte de campanha até isso ser resolvido.
        </p>
      )}

      <p className="pnl-sub" style={{ margin: '0 0 14px' }}>
        <strong>Ela ainda não sabe.</strong> Nada foi enviado automaticamente.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="pnl-btn-primario" disabled={enviando || enviado} onClick={onEnviar}>
          {enviado ? 'Convite enviado' : enviando ? 'Enviando...' : 'Enviar convite para criar senha'}
        </button>
        <button type="button" className="pnl-btn-secundario" onClick={onCopiar}>Copiar link do Nexus</button>
        <button type="button" className="pnl-btn-secundario" onClick={onFechar}>Fechar</button>
      </div>
    </section>
  )
}

// ============================================================
// A linha
// ============================================================
function LinhaAcesso({
  acesso, pendente, onErro, onSucesso, startTransition, aoMudar,
}: {
  acesso: AcessoLinha
  pendente: boolean
  onErro: (e: string) => void
  onSucesso: (m: string) => void
  startTransition: (cb: () => void) => void
  aoMudar: () => void
}) {
  const [editando, setEditando] = useState(false)
  const [vitalicio, setVitalicio] = useState(acesso.vitalicio)
  const [data, setData] = useState(acesso.expiraEm ?? '')

  function onSalvarPrazo() {
    startTransition(async () => {
      const r = await alterarPrazoAcesso(acesso.id, vitalicio, vitalicio ? null : data || null)
      if (!r.ok) { onErro(r.erro); return }
      setEditando(false)
      onSucesso('Prazo atualizado')
      aoMudar()
    })
  }

  function onRevogar() {
    if (!confirm(`Revogar o acesso de ${acesso.alunoNome} a "${descreverAcesso(acesso.escopo, acesso.cursoTitulo)}"? Ele perde o acesso na hora, e dá para reativar depois.`)) return
    startTransition(async () => {
      const r = await revogarAcesso(acesso.id)
      if (!r.ok) { onErro(r.erro); return }
      onSucesso('Acesso revogado')
      aoMudar()
    })
  }

  function onReativar() {
    startTransition(async () => {
      const r = await reativarAcesso(acesso.id)
      if (!r.ok) { onErro(r.erro); return }
      onSucesso('Acesso reativado')
      aoMudar()
    })
  }

  const vigencia = !acesso.ativo
    ? <span style={{ color: '#8b929e' }}>revogado</span>
    : acesso.vitalicio
      ? <span>vitalício</span>
      : acesso.vigente
        ? <span>até {formatarBR(acesso.expiraEm)}</span>
        : <span style={{ color: '#F03434', fontWeight: 700 }}>venceu {formatarBR(acesso.expiraEm)}</span>

  return (
    <tr>
      <td>
        <div>{acesso.alunoNome}</div>
        <div className="pnl-sub" style={{ fontSize: 12.5 }}>{acesso.alunoEmail ?? '—'}</div>
      </td>
      <td>{descreverAcesso(acesso.escopo, acesso.cursoTitulo)}
        {acesso.escopo === 'total' && acesso.observacao?.includes('EXCETO') ? ' *' : ''}
      </td>
      <td>
        {editando ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, margin: 0 }}>
              <input type="checkbox" checked={vitalicio} onChange={e => setVitalicio(e.target.checked)} style={{ width: 'auto' }} />
              vitalício
            </label>
            {!vitalicio && <input type="date" value={data} onChange={e => setData(e.target.value)} />}
            <button type="button" className="pnl-btn-primario" disabled={pendente} onClick={onSalvarPrazo}>Salvar</button>
            <button type="button" className="pnl-btn-secundario" disabled={pendente} onClick={() => setEditando(false)}>Cancelar</button>
          </div>
        ) : vigencia}
      </td>
      <td className="pnl-sub">{acesso.origem === 'migracao_ensinio' ? 'migração' : acesso.origem}</td>
      <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {!editando && <button type="button" className="pnl-btn-secundario" disabled={pendente} onClick={() => setEditando(true)}>Alterar prazo</button>}
        {acesso.ativo
          ? <button type="button" className="pnl-btn-perigo" disabled={pendente} onClick={onRevogar}>Revogar</button>
          : <button type="button" className="pnl-btn-secundario" disabled={pendente} onClick={onReativar}>Reativar</button>}
      </td>
    </tr>
  )
}

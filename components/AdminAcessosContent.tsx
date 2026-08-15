// components/AdminAcessosContent.tsx
'use client'

import { useState, useTransition } from 'react'
import type { FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { AcessoLinha, CursoOpcao, Escopo } from '@/lib/queries/admin-acessos'
import {
  concederAcesso, alterarPrazoAcesso, revogarAcesso, reativarAcesso,
  enviarEmailDeAcesso, linkDeEntrada,
} from '@/app/admin/acessos/actions'
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
  const [recem, setRecem] = useState<Recem | null>(null)

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
    <div className="ad-cursos">
      <AdminToastContainer toasts={toast.toasts} remover={toast.remover} />

      <div className="ad-cursos-cab">
        <div>
          <h1>Acessos</h1>
          <p className="ad-sub">
            Libere um curso, a biblioteca ou a plataforma inteira para um aluno, com prazo ou vitalício.
            Serve para quem comprou por fora da assinatura — inclusive quem ainda nem tem login aqui.
          </p>
        </div>
        <button type="button" className="ad-btn-primario" onClick={() => { setAbrirForm(v => !v); setRecem(null) }}>
          {abrirForm ? 'Fechar' : '+ Conceder acesso'}
        </button>
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

      {recem && <PainelRecem recem={recem} onErro={toast.erro} onSucesso={toast.sucesso} onFechar={() => setRecem(null)} />}

      <section className="ad-card">
        <div className="ad-filtros" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
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

        {acessos.length === 0 && <p className="ad-vazio">Nenhum acesso encontrado com esses filtros.</p>}

        {acessos.length > 0 && (
          <div className="ad-tabela-scroll">
            <table className="ad-tabela">
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
            <button type="button" className="ad-btn-secundario" disabled={pagina <= 1}
              onClick={() => irPara({ pagina: String(pagina - 1) })}>Anterior</button>
            <span className="ad-sub">Página {pagina} de {totalPaginas} · {total} concessões</span>
            <button type="button" className="ad-btn-secundario" disabled={pagina >= totalPaginas}
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
    <section className="ad-card">
      <h2>Conceder acesso</h2>
      <p className="ad-sub">
        Se o e-mail ainda não tiver conta na plataforma, ela é criada aqui — com senha aleatória que ninguém
        conhece. A pessoa entra pela página de primeiro acesso e define a senha dela.
      </p>

      <form onSubmit={onSubmit} className="ad-form">
        <div className="ad-form-linha">
          <label style={{ flex: 2 }}>E-mail do aluno
            <input name="email" type="email" required placeholder="pessoa@email.com" autoComplete="off" />
          </label>
          <label style={{ flex: 2 }}>Nome completo
            <input name="nome" placeholder="Usado só se a conta ainda não existir" autoComplete="off" />
          </label>
        </div>

        <div className="ad-form-linha">
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

        <div className="ad-form-linha" style={{ alignItems: 'flex-end' }}>
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

        <button type="submit" className="ad-btn-primario" disabled={pendente}>
          {pendente ? 'Concedendo...' : 'Conceder acesso'}
        </button>
      </form>
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
    <section className="ad-card">
      <h2>Concedido</h2>
      <p style={{ margin: '0 0 6px' }}>
        <strong>{recem.nome}</strong> ({recem.email}) — {recem.oQueGanhou}, {recem.vigencia}.
      </p>

      {recem.contaCriada && (
        <p className="ad-sub" style={{ margin: '0 0 6px' }}>
          A conta da Academy foi criada agora, com senha aleatória que ninguém conhece.
        </p>
      )}

      {/* A entrada dessa pessoa é o Nexus, e por isso o estado da conta de lá é
          o que decide se o cadastro terminou ou não. Sem este bloco, um Nexus
          fora do ar deixaria o operador fechar a tela achando que acabou. */}
      {!recem.nexus.ok && (
        <p className="ad-sub" style={{ margin: '0 0 6px', color: '#F03434', fontWeight: 600 }}>
          A conta do Nexus NÃO foi criada: {recem.nexus.erro}. O acesso ao curso já está gravado, mas ela
          ainda não tem por onde entrar — refaça o envio pelo botão abaixo quando o Nexus responder.
        </p>
      )}
      {recem.nexus.ok && recem.nexus.criada && (
        <p className="ad-sub" style={{ margin: '0 0 6px' }}>
          Conta do Nexus criada. É por lá que ela entra: vai ver o painel em modo vitrine, com a oferta,
          e o cartão da Academy abrindo o curso dela.
        </p>
      )}
      {recem.nexus.ok && recem.nexus.jaEraAssinante && (
        <p className="ad-sub" style={{ margin: '0 0 6px', fontWeight: 600 }}>
          Atenção: essa pessoa já é assinante do Nexus, então o plano dela foi mantido intacto. Ela já
          tinha acesso à plataforma inteira — confira se este cadastro de curso avulso era mesmo o caso.
        </p>
      )}

      {recem.redundante && (
        <p className="ad-sub" style={{ margin: '0 0 6px' }}>
          Atenção: esse aluno já tem acesso à plataforma inteira vigente, então esta concessão de curso é
          redundante hoje. Ela continua valendo se o acesso total expirar antes.
        </p>
      )}

      {recem.tags.length > 0 && (
        <p className="ad-sub" style={{ margin: '0 0 6px' }}>
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
        <p className="ad-sub" style={{ margin: '0 0 6px', color: '#F5A623' }}>
          A conta foi criada, mas nenhuma etiqueta entrou na base do Nexus. Essa pessoa não vai aparecer
          em recorte de campanha até isso ser resolvido.
        </p>
      )}

      <p className="ad-sub" style={{ margin: '0 0 14px' }}>
        <strong>Ela ainda não sabe.</strong> Nada foi enviado automaticamente.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="ad-btn-primario" disabled={enviando || enviado} onClick={onEnviar}>
          {enviado ? 'Convite enviado' : enviando ? 'Enviando...' : 'Enviar convite para criar senha'}
        </button>
        <button type="button" className="ad-btn-secundario" onClick={onCopiar}>Copiar link do Nexus</button>
        <button type="button" className="ad-btn-secundario" onClick={onFechar}>Fechar</button>
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
        <div className="ad-sub" style={{ fontSize: 12.5 }}>{acesso.alunoEmail ?? '—'}</div>
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
            <button type="button" className="ad-btn-primario" disabled={pendente} onClick={onSalvarPrazo}>Salvar</button>
            <button type="button" className="ad-btn-secundario" disabled={pendente} onClick={() => setEditando(false)}>Cancelar</button>
          </div>
        ) : vigencia}
      </td>
      <td className="ad-sub">{acesso.origem === 'migracao_ensinio' ? 'migração' : acesso.origem}</td>
      <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {!editando && <button type="button" className="ad-btn-secundario" disabled={pendente} onClick={() => setEditando(true)}>Alterar prazo</button>}
        {acesso.ativo
          ? <button type="button" className="ad-btn-perigo" disabled={pendente} onClick={onRevogar}>Revogar</button>
          : <button type="button" className="ad-btn-secundario" disabled={pendente} onClick={onReativar}>Reativar</button>}
      </td>
    </tr>
  )
}

// components/AdminFinanceiroContent.tsx
'use client'

import { Fragment, useState, useTransition } from 'react'
import type { FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type {
  PainelFinanceiro, AssinaturaAdmin, PlanoAdmin, WebhookEventoAdmin, StatusAssinatura,
} from '@/lib/queries/admin-financeiro'
import {
  buscarUsuarioPorEmail, concederCortesia, suspenderAssinatura, reativarAssinatura, cancelarAssinatura,
  criarPlano, atualizarPlano, excluirPlano, atualizarDiasCarencia,
} from '@/app/admin/financeiro/actions'
import { IconeSearch, IconePlus, IconeTrash, IconePencil } from '@/components/Icones'
import { useAdminToast, AdminToastContainer } from '@/components/AdminToast'

type Aba = 'painel' | 'assinaturas' | 'planos' | 'webhooks'

const NOME_STATUS: Record<StatusAssinatura, string> = {
  ativa: 'Ativa', inadimplente: 'Inadimplente', suspensa: 'Suspensa', cancelada: 'Cancelada', cortesia: 'Cortesia',
}

function fmtBRL(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtData(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

export default function AdminFinanceiroContent({ painel, assinaturas, planos, webhooks }: {
  painel: PainelFinanceiro; assinaturas: AssinaturaAdmin[]; planos: PlanoAdmin[]; webhooks: WebhookEventoAdmin[]
}) {
  const [aba, setAba] = useState<Aba>('painel')
  const toast = useAdminToast()

  return (
    <div className="ad-cursos">
      <AdminToastContainer toasts={toast.toasts} remover={toast.remover} />
      <div className="ad-cursos-cab">
        <div>
          <h1>Financeiro</h1>
          <p className="ad-sub">Assinaturas, planos e integração com o Asaas (webhooks).</p>
        </div>
      </div>

      <div className="ad-abas">
        <button type="button" className={`ad-aba${aba === 'painel' ? ' ativa' : ''}`} onClick={() => setAba('painel')}>Painel</button>
        <button type="button" className={`ad-aba${aba === 'assinaturas' ? ' ativa' : ''}`} onClick={() => setAba('assinaturas')}>Assinaturas ({assinaturas.length})</button>
        <button type="button" className={`ad-aba${aba === 'planos' ? ' ativa' : ''}`} onClick={() => setAba('planos')}>Planos ({planos.length})</button>
        <button type="button" className={`ad-aba${aba === 'webhooks' ? ' ativa' : ''}`} onClick={() => setAba('webhooks')}>Webhooks ({webhooks.length})</button>
      </div>

      {aba === 'painel' && <PainelAba painel={painel} onErro={toast.erro} onSucesso={toast.sucesso} />}
      {aba === 'assinaturas' && <AssinaturasAba assinaturas={assinaturas} onErro={toast.erro} onSucesso={toast.sucesso} />}
      {aba === 'planos' && <PlanosAba planos={planos} onErro={toast.erro} onSucesso={toast.sucesso} />}
      {aba === 'webhooks' && <WebhooksAba webhooks={webhooks} />}
    </div>
  )
}

// ============================================================
// Painel
// ============================================================
function PainelAba({ painel, onErro, onSucesso }: { painel: PainelFinanceiro; onErro: (e: string) => void; onSucesso: (m: string) => void }) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()
  const maxReceita = Math.max(1, ...painel.receitaPorMes.map(r => r.valorCentavos))

  function onSalvarCarencia(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await atualizarDiasCarencia(fd)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Carência salva com sucesso'); router.refresh() }
    })
  }

  return (
    <>
      <div className="ad-fin-stats">
        <div className="ad-fin-stat"><b>{fmtBRL(painel.mrrCentavos)}</b><span>MRR</span></div>
        <div className="ad-fin-stat"><b>{painel.assinantesAtivos}</b><span>Assinantes ativos</span></div>
        <div className="ad-fin-stat"><b>{painel.inadimplentes}</b><span>Inadimplentes</span></div>
        <div className="ad-fin-stat"><b>{painel.cortesias}</b><span>Cortesias</span></div>
        <div className="ad-fin-stat"><b>{fmtBRL(painel.faturamentoMesCentavos)}</b><span>Faturamento do mês</span></div>
      </div>

      <section className="ad-card">
        <h2>Receita por mês</h2>
        {painel.receitaPorMes.length === 0 && <p className="ad-vazio">Nenhuma cobrança confirmada ainda.</p>}
        {painel.receitaPorMes.length > 0 && (
          <div className="ad-fin-grafico">
            {painel.receitaPorMes.map(r => (
              <div className="ad-fin-barra-col" key={r.mes}>
                <div className="ad-fin-barra" style={{ height: `${Math.max(4, (r.valorCentavos / maxReceita) * 100)}%` }} title={fmtBRL(r.valorCentavos)} />
                <span className="ad-fin-barra-rot">{r.mes}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="ad-card">
        <h2>Carência de inadimplência</h2>
        <p>Dias que um aluno inadimplente mantém acesso ao conteúdo antes de ser bloqueado.</p>
        <form onSubmit={onSalvarCarencia} className="ad-form" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <input name="dias_carencia" type="number" min="0" step="1" defaultValue={painel.diasCarencia} className="ad-input-sm" />
          <button type="submit" className="ad-btn-secundario" disabled={pendente}>{pendente ? 'Salvando...' : 'Salvar'}</button>
        </form>
      </section>
    </>
  )
}

// ============================================================
// Assinaturas
// ============================================================
function AssinaturasAba({ assinaturas, onErro, onSucesso }: { assinaturas: AssinaturaAdmin[]; onErro: (e: string) => void; onSucesso: (m: string) => void }) {
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<StatusAssinatura | 'todas'>('todas')
  const [expandida, setExpandida] = useState<string | null>(null)

  const filtradas = assinaturas.filter(a => {
    if (filtroStatus !== 'todas' && a.status !== filtroStatus) return false
    if (busca.trim() && !a.usuarioNome.toLowerCase().includes(busca.trim().toLowerCase())) return false
    return true
  })

  return (
    <>
      <ConcederCortesiaCard onErro={onErro} onSucesso={onSucesso} />

      <section className="ad-card">
        <h2>Assinaturas ({filtradas.length})</h2>
        <div className="ad-form-linha" style={{ marginBottom: 12 }}>
          <label>Buscar aluno
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nome do aluno..." />
          </label>
          <label>Status
            <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as StatusAssinatura | 'todas')}>
              <option value="todas">Todas</option>
              {(['ativa', 'inadimplente', 'suspensa', 'cortesia', 'cancelada'] as StatusAssinatura[]).map(s => (
                <option key={s} value={s}>{NOME_STATUS[s]}</option>
              ))}
            </select>
          </label>
        </div>

        {filtradas.length === 0 && <p className="ad-vazio">Nenhuma assinatura encontrada.</p>}
        {filtradas.length > 0 && (
          <div className="ad-tabela-scroll">
            <table className="ad-tabela">
              <thead><tr><th>Aluno</th><th>Plano</th><th>Status</th><th>Próxima cobrança</th><th>Iniciada em</th><th></th></tr></thead>
              <tbody>
                {filtradas.map(a => (
                  <Fragment key={a.id}>
                    <tr>
                      <td>{a.usuarioNome}</td>
                      <td>{a.planoNome}</td>
                      <td><span className={`ad-status-pill ${a.status}`}>{NOME_STATUS[a.status]}</span></td>
                      <td>{fmtData(a.proximaCobranca)}</td>
                      <td>{fmtData(a.iniciadaEm)}</td>
                      <td>
                        <button type="button" className="ad-btn-secundario" onClick={() => setExpandida(expandida === a.id ? null : a.id)}>
                          {expandida === a.id ? 'Fechar' : 'Detalhes'}
                        </button>
                      </td>
                    </tr>
                    {expandida === a.id && (
                      <tr>
                        <td colSpan={6}>
                          <AssinaturaDetalhe assinatura={a} onErro={onErro} onSucesso={onSucesso} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

function ConcederCortesiaCard({ onErro, onSucesso }: { onErro: (e: string) => void; onSucesso: (m: string) => void }) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()
  const [email, setEmail] = useState('')
  const [observacao, setObservacao] = useState('')
  const [achado, setAchado] = useState<{ id: string; nome: string; jaTemAssinatura: boolean } | null>(null)

  function onBuscar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setAchado(null)
    startTransition(async () => {
      const r = await buscarUsuarioPorEmail(email)
      if (!r.ok) onErro(r.erro)
      else setAchado(r.usuario!)
    })
  }

  function onConceder() {
    if (!achado) return
    startTransition(async () => {
      const r = await concederCortesia(achado.id, observacao)
      if (!r.ok) onErro(r.erro)
      else {
        onSucesso('Cortesia concedida com sucesso')
        setAchado(null)
        setEmail('')
        setObservacao('')
        router.refresh()
      }
    })
  }

  return (
    <section className="ad-card">
      <h2>Conceder cortesia</h2>
      <p>Dá acesso completo a um aluno sem cobrança, pra parcerias, testes ou pré-lançamento.</p>
      <form onSubmit={onBuscar} className="ad-form-linha" style={{ alignItems: 'flex-end' }}>
        <label style={{ flex: 2 }}>E-mail do aluno
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="aluno@email.com" required />
        </label>
        <button type="submit" className="ad-btn-secundario" disabled={pendente}><IconeSearch size={14} /> Buscar</button>
      </form>

      {achado && (
        <div style={{ marginTop: 12 }}>
          <p>Encontrado: <b>{achado.nome}</b>{achado.jaTemAssinatura && '. Já tem uma assinatura (será atualizada pra cortesia).'}</p>
          <label>Observação (opcional)
            <input value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Motivo da cortesia..." />
          </label>
          <div className="ad-fin-detalhe-acoes">
            <button type="button" className="ad-btn-primario" disabled={pendente} onClick={onConceder}>Conceder cortesia</button>
          </div>
        </div>
      )}
    </section>
  )
}

function AssinaturaDetalhe({ assinatura, onErro, onSucesso }: { assinatura: AssinaturaAdmin; onErro: (e: string) => void; onSucesso: (m: string) => void }) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()

  function acao(fn: (id: string, obs: string) => Promise<{ ok: true } | { ok: false; erro: string }>, rotulo: string, mensagemSucesso: string, exigeConfirmacao: boolean) {
    if (exigeConfirmacao && !confirm(`${rotulo} a assinatura de ${assinatura.usuarioNome}?`)) return
    const observacao = prompt(`Observação (opcional) · ${rotulo}:`) ?? ''
    startTransition(async () => {
      const r = await fn(assinatura.id, observacao)
      if (!r.ok) onErro(r.erro)
      else { onSucesso(mensagemSucesso); router.refresh() }
    })
  }

  return (
    <div className="ad-fin-detalhe">
      {assinatura.observacao && <p className="ad-fin-nota">Observação atual: {assinatura.observacao}</p>}

      <h3 style={{ fontSize: 13.5, fontWeight: 650, marginBottom: 8 }}>Histórico de cobranças</h3>
      {assinatura.cobrancas.length === 0 && <p className="ad-vazio-sm">Nenhuma cobrança registrada.</p>}
      {assinatura.cobrancas.length > 0 && (
        <div className="ad-tabela-scroll">
          <table className="ad-tabela">
            <thead><tr><th>Valor</th><th>Status</th><th>Vencimento</th><th>Pago em</th><th>Método</th></tr></thead>
            <tbody>
              {assinatura.cobrancas.map(c => (
                <tr key={c.id}>
                  <td>{fmtBRL(c.valorCentavos)}</td>
                  <td><span className={`ad-status-pill ${c.status}`}>{c.status}</span></td>
                  <td>{fmtData(c.vencimento)}</td>
                  <td>{fmtData(c.pagoEm)}</td>
                  <td>{c.metodo ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="ad-fin-detalhe-acoes">
        {assinatura.status !== 'suspensa' && (
          <button type="button" className="ad-btn-secundario" disabled={pendente} onClick={() => acao(suspenderAssinatura, 'Suspender', 'Assinatura suspensa com sucesso', true)}>Suspender</button>
        )}
        {assinatura.status !== 'ativa' && assinatura.status !== 'cancelada' && (
          <button type="button" className="ad-btn-secundario" disabled={pendente} onClick={() => acao(reativarAssinatura, 'Reativar', 'Assinatura reativada com sucesso', false)}>Reativar</button>
        )}
        {assinatura.status !== 'cancelada' && (
          <button type="button" className="ad-btn-perigo" disabled={pendente} onClick={() => acao(cancelarAssinatura, 'Cancelar', 'Assinatura cancelada com sucesso', true)}>Cancelar</button>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Planos
// ============================================================
function PlanosAba({ planos, onErro, onSucesso }: { planos: PlanoAdmin[]; onErro: (e: string) => void; onSucesso: (m: string) => void }) {
  const [criando, setCriando] = useState(false)

  return (
    <section className="ad-card">
      <div className="ad-cursos-cab">
        <h2 style={{ margin: 0 }}>Planos</h2>
        <button type="button" className="ad-btn-primario" onClick={() => setCriando(v => !v)}>
          <IconePlus size={14} /> Novo plano
        </button>
      </div>

      {criando && <PlanoForm onCancelar={() => setCriando(false)} onErro={onErro} onSucesso={onSucesso} />}

      {planos.length === 0 && <p className="ad-vazio">Nenhum plano cadastrado.</p>}
      {planos.length > 0 && (
        <div className="ad-tabela-scroll">
          <table className="ad-tabela">
            <thead><tr><th>Nome</th><th>Valor</th><th>Periodicidade</th><th>Ativo</th><th></th></tr></thead>
            <tbody>
              {planos.map(p => <PlanoLinha key={p.id} plano={p} onErro={onErro} onSucesso={onSucesso} />)}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function PlanoLinha({ plano, onErro, onSucesso }: { plano: PlanoAdmin; onErro: (e: string) => void; onSucesso: (m: string) => void }) {
  const router = useRouter()
  const [editando, setEditando] = useState(false)
  const [pendente, startTransition] = useTransition()

  function onExcluir() {
    if (!confirm(`Excluir o plano "${plano.nome}"?`)) return
    startTransition(async () => {
      const r = await excluirPlano(plano.id)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Plano excluído com sucesso'); router.refresh() }
    })
  }

  if (editando) {
    return (
      <tr>
        <td colSpan={5}>
          <PlanoForm plano={plano} onCancelar={() => setEditando(false)} onErro={onErro} onSucesso={onSucesso} />
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td>{plano.nome}{plano.nome === 'Cortesia' && <span className="ad-fin-nota" style={{ marginLeft: 6 }}>(interno, não excluir)</span>}</td>
      <td>{fmtBRL(plano.valorCentavos)}</td>
      <td>{plano.periodicidade === 'mensal' ? 'Mensal' : 'Anual'}</td>
      <td>{plano.ativo ? 'Sim' : 'Não'}</td>
      <td style={{ display: 'flex', gap: 6 }}>
        <button type="button" className="ad-btn-secundario" onClick={() => setEditando(true)}><IconePencil size={13} /></button>
        <button type="button" className="ad-btn-perigo-sm" disabled={pendente} onClick={onExcluir}><IconeTrash size={13} /></button>
      </td>
    </tr>
  )
}

function PlanoForm({ plano, onCancelar, onErro, onSucesso }: { plano?: PlanoAdmin; onCancelar: () => void; onErro: (e: string) => void; onSucesso: (m: string) => void }) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()

  function onSalvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = plano ? await atualizarPlano(plano.id, fd) : await criarPlano(fd)
      if (!r.ok) onErro(r.erro)
      else { onSucesso(plano ? 'Plano salvo com sucesso' : 'Plano criado com sucesso'); onCancelar(); router.refresh() }
    })
  }

  return (
    <form onSubmit={onSalvar} className="ad-form" style={{ margin: '10px 0', padding: 12, border: '1px solid var(--linha-suave)', borderRadius: 12 }}>
      <div className="ad-form-linha">
        <label>Nome
          <input name="nome" defaultValue={plano?.nome} required />
        </label>
        <label>Valor (R$)
          <input name="valor_reais" type="number" step="0.01" min="0" defaultValue={plano ? (plano.valorCentavos / 100).toFixed(2) : ''} required />
        </label>
        <label>Periodicidade
          <select name="periodicidade" defaultValue={plano?.periodicidade ?? 'mensal'}>
            <option value="mensal">Mensal</option>
            <option value="anual">Anual</option>
          </select>
        </label>
        <label className="ad-checkbox-linha">
          <input type="checkbox" name="ativo" defaultChecked={plano?.ativo ?? true} />
          Ativo
        </label>
      </div>
      <label>Descrição
        <input name="descricao" defaultValue={plano?.descricao ?? ''} />
      </label>
      <div className="ad-fin-detalhe-acoes">
        <button type="submit" className="ad-btn-primario" disabled={pendente}>{pendente ? 'Salvando...' : 'Salvar'}</button>
        <button type="button" className="ad-btn-secundario" onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  )
}

// ============================================================
// Webhooks
// ============================================================
function WebhooksAba({ webhooks }: { webhooks: WebhookEventoAdmin[] }) {
  const [expandido, setExpandido] = useState<string | null>(null)

  return (
    <section className="ad-card">
      <h2>Últimos eventos recebidos</h2>
      <p>Log bruto do que chega em /api/webhooks/asaas, útil pra depurar a integração quando as chaves reais entrarem.</p>
      {webhooks.length === 0 && <p className="ad-vazio">Nenhum evento recebido ainda.</p>}
      {webhooks.length > 0 && (
        <div className="ad-tabela-scroll">
          <table className="ad-tabela">
            <thead><tr><th>Recebido em</th><th>Tipo</th><th>Status</th><th>Erro</th><th></th></tr></thead>
            <tbody>
              {webhooks.map(w => (
                <Fragment key={w.id}>
                  <tr>
                    <td>{new Date(w.recebidoEm).toLocaleString('pt-BR')}</td>
                    <td>{w.tipo ?? '—'}</td>
                    <td><span className={`ad-status-pill ${w.processado ? 'ativa' : 'inadimplente'}`}>{w.processado ? 'Processado' : 'Pendente'}</span></td>
                    <td>{w.erro ?? '—'}</td>
                    <td>
                      <button type="button" className="ad-btn-secundario" onClick={() => setExpandido(expandido === w.id ? null : w.id)}>
                        {expandido === w.id ? 'Fechar' : 'Payload'}
                      </button>
                    </td>
                  </tr>
                  {expandido === w.id && (
                    <tr>
                      <td colSpan={5}>
                        <pre className="ad-fin-payload">{JSON.stringify(w.payload, null, 2)}</pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

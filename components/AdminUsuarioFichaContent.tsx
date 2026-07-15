// components/AdminUsuarioFichaContent.tsx
'use client'

import { useState, useTransition } from 'react'
import type { FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type {
  FichaUsuario, ExtratoPaginado, ComunidadeUsuario, AuditoriaLinha, CursoParaCertificado,
} from '@/lib/queries/admin-suporte'
import {
  suspenderUsuario, reativarUsuario, banirUsuario, resetarSenhaUsuario, concederCortesiaUsuario,
  ajustarGamificacaoUsuario, emitirCertificadoManual, carregarMaisExtrato,
} from '@/app/admin/usuarios/actions'
import { IconeUser, IconeMail, IconeMapPin, IconeCalendar, IconeClock, IconeLock, IconeEye } from '@/components/Icones'
import { XP, Moeda, SeloNivel, FogoStreak, Certificado } from '@/components/Emblemas'
import { useAdminToast, AdminToastContainer } from '@/components/AdminToast'

type Aba = 'geral' | 'progresso' | 'gamificacao' | 'financeiro' | 'comunidade' | 'auditoria'

const NOME_STATUS_CONTA: Record<string, string> = { ativo: 'Ativo', suspenso: 'Suspenso', banido: 'Banido' }

function fmtData(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}
function fmtDataHora(iso: string | null) {
  if (!iso) return 'nunca'
  return new Date(iso).toLocaleString('pt-BR')
}
function fmtBRL(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function AdminUsuarioFichaContent({ ficha, extratoInicial, comunidade, auditoria, cursos }: {
  ficha: FichaUsuario; extratoInicial: ExtratoPaginado; comunidade: ComunidadeUsuario; auditoria: AuditoriaLinha[]; cursos: CursoParaCertificado[]
}) {
  const [aba, setAba] = useState<Aba>('geral')
  const toast = useAdminToast()

  return (
    <div className="ad-cursos">
      <AdminToastContainer toasts={toast.toasts} remover={toast.remover} />
      <div className="ad-cursos-cab">
        <div>
          <h1>{ficha.nome}</h1>
          <p className="ad-sub">{ficha.email ?? '—'} · <span className={`ad-status-pill ${ficha.status}`}>{NOME_STATUS_CONTA[ficha.status]}</span></p>
        </div>
        <button type="button" className="ad-btn-secundario" disabled title="Em breve. Impersonação exige um desenho de segurança dedicado (sessão separada, banner visível, log reforçado, expiração)">
          <IconeEye size={14} /> Ver como este aluno
        </button>
      </div>

      <div className="ad-abas">
        <button type="button" className={`ad-aba${aba === 'geral' ? ' ativa' : ''}`} onClick={() => setAba('geral')}>Visão geral</button>
        <button type="button" className={`ad-aba${aba === 'progresso' ? ' ativa' : ''}`} onClick={() => setAba('progresso')}>Progresso</button>
        <button type="button" className={`ad-aba${aba === 'gamificacao' ? ' ativa' : ''}`} onClick={() => setAba('gamificacao')}>Gamificação</button>
        <button type="button" className={`ad-aba${aba === 'financeiro' ? ' ativa' : ''}`} onClick={() => setAba('financeiro')}>Financeiro</button>
        <button type="button" className={`ad-aba${aba === 'comunidade' ? ' ativa' : ''}`} onClick={() => setAba('comunidade')}>Comunidade</button>
        <button type="button" className={`ad-aba${aba === 'auditoria' ? ' ativa' : ''}`} onClick={() => setAba('auditoria')}>Auditoria ({auditoria.length})</button>
      </div>

      {aba === 'geral' && <VisaoGeralAba ficha={ficha} onErro={toast.erro} onSucesso={toast.sucesso} />}
      {aba === 'progresso' && <ProgressoAba ficha={ficha} cursos={cursos} onErro={toast.erro} onSucesso={toast.sucesso} />}
      {aba === 'gamificacao' && <GamificacaoAba ficha={ficha} extratoInicial={extratoInicial} onErro={toast.erro} onSucesso={toast.sucesso} />}
      {aba === 'financeiro' && <FinanceiroAba ficha={ficha} />}
      {aba === 'comunidade' && <ComunidadeAba comunidade={comunidade} />}
      {aba === 'auditoria' && <AuditoriaAba auditoria={auditoria} />}
    </div>
  )
}

// ============================================================
// Visão geral
// ============================================================
function VisaoGeralAba({ ficha, onErro, onSucesso }: { ficha: FichaUsuario; onErro: (e: string) => void; onSucesso: (m: string) => void }) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()

  function acaoComJustificativa(
    fn: (id: string, justificativa: string) => Promise<{ ok: true } | { ok: false; erro: string }>,
    rotulo: string,
    mensagemSucesso: string,
  ) {
    if (!confirm(`${rotulo} a conta de ${ficha.nome}?`)) return
    const justificativa = (prompt(`Justificativa (obrigatória) · ${rotulo}:`) ?? '').trim()
    if (!justificativa) { onErro('Justificativa é obrigatória. Ação cancelada.'); return }
    startTransition(async () => {
      const r = await fn(ficha.id, justificativa)
      if (!r.ok) onErro(r.erro)
      else { onSucesso(mensagemSucesso); router.refresh() }
    })
  }

  return (
    <>
      <section className="ad-card">
        <h2>Dados do perfil</h2>
        <div className="ad-usu-info">
          <div><IconeUser size={14} /> {ficha.nome}</div>
          <div><IconeMail size={14} /> {ficha.email ?? '—'}</div>
          <div><IconeMapPin size={14} /> {[ficha.cidade, ficha.estado].filter(Boolean).join(', ') || '—'}</div>
          <div><IconeCalendar size={14} /> Cadastrado em {fmtData(ficha.criadoEm)}</div>
          <div><IconeClock size={14} /> Último acesso: {fmtDataHora(ficha.ultimoAcesso)}</div>
        </div>
      </section>

      <section className="ad-card">
        <h2>Assinatura atual</h2>
        {!ficha.assinatura && <p className="ad-vazio">Sem assinatura.</p>}
        {ficha.assinatura && (
          <p>
            <span className={`ad-status-pill ${ficha.assinatura.status}`}>{ficha.assinatura.status}</span>
            {' '}{ficha.assinatura.planoNome}, próxima cobrança em {fmtData(ficha.assinatura.proximaCobranca)}
          </p>
        )}
      </section>

      <section className="ad-card">
        <h2>Ações administrativas</h2>
        <div className="ad-fin-detalhe-acoes">
          {ficha.status !== 'ativo' && (
            <button type="button" className="ad-btn-secundario" disabled={pendente} onClick={() => acaoComJustificativa(reativarUsuario, 'Reativar', 'Conta reativada com sucesso')}>Reativar</button>
          )}
          {ficha.status !== 'suspenso' && (
            <button type="button" className="ad-btn-secundario" disabled={pendente} onClick={() => acaoComJustificativa(suspenderUsuario, 'Suspender', 'Conta suspensa com sucesso')}>Suspender</button>
          )}
          {ficha.status !== 'banido' && (
            <button type="button" className="ad-btn-perigo" disabled={pendente} onClick={() => acaoComJustificativa(banirUsuario, 'Banir', 'Conta banida com sucesso')}>Banir</button>
          )}
          <button type="button" className="ad-btn-secundario" disabled={pendente} onClick={() => acaoComJustificativa(resetarSenhaUsuario, 'Resetar senha (envia e-mail de recuperação)', 'E-mail de redefinição enviado com sucesso')}>
            <IconeLock size={14} /> Resetar senha
          </button>
          <button type="button" className="ad-btn-secundario" disabled={pendente} onClick={() => acaoComJustificativa(concederCortesiaUsuario, 'Conceder cortesia', 'Cortesia concedida com sucesso')}>Conceder cortesia</button>
        </div>
      </section>
    </>
  )
}

// ============================================================
// Progresso
// ============================================================
function ProgressoAba({ ficha, cursos, onErro, onSucesso }: { ficha: FichaUsuario; cursos: CursoParaCertificado[]; onErro: (e: string) => void; onSucesso: (m: string) => void }) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()
  const [cursoId, setCursoId] = useState('')

  function onEmitirManual(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!cursoId) { onErro('Selecione um curso.'); return }
    const justificativa = (prompt('Justificativa (obrigatória) · Emitir certificado manual:') ?? '').trim()
    if (!justificativa) { onErro('Justificativa é obrigatória. Ação cancelada.'); return }
    startTransition(async () => {
      const r = await emitirCertificadoManual(ficha.id, cursoId, justificativa)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Certificado emitido com sucesso'); setCursoId(''); router.refresh() }
    })
  }

  return (
    <>
      <section className="ad-card">
        <h2>Cursos</h2>
        {ficha.cursos.length === 0 && <p className="ad-vazio">Nenhum curso iniciado ainda.</p>}
        {ficha.cursos.length > 0 && (
          <div className="ad-tabela-scroll">
            <table className="ad-tabela">
              <thead><tr><th>Curso</th><th>Aulas concluídas</th><th>Progresso</th></tr></thead>
              <tbody>
                {ficha.cursos.map(c => (
                  <tr key={c.cursoId}>
                    <td>{c.titulo}</td>
                    <td>{c.aulasConcluidas} / {c.totalAulas}</td>
                    <td>{c.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="ad-card">
        <h2>Avaliações</h2>
        {ficha.avaliacoes.length === 0 && <p className="ad-vazio">Nenhuma avaliação feita ainda.</p>}
        {ficha.avaliacoes.length > 0 && (
          <div className="ad-tabela-scroll">
            <table className="ad-tabela">
              <thead><tr><th>Avaliação</th><th>Curso</th><th>Melhor nota</th><th>Aprovado</th><th>Tentativas</th></tr></thead>
              <tbody>
                {ficha.avaliacoes.map(a => (
                  <tr key={a.avaliacaoId}>
                    <td>{a.titulo}</td>
                    <td>{a.cursoTitulo}</td>
                    <td>{a.melhorNota ?? '—'}</td>
                    <td>{a.aprovado ? 'Sim' : 'Não'}</td>
                    <td>{a.tentativas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="ad-card">
        <h2>Certificados emitidos</h2>
        {ficha.certificados.length === 0 && <p className="ad-vazio">Nenhum certificado emitido ainda.</p>}
        {ficha.certificados.length > 0 && (
          <div className="ad-tabela-scroll">
            <table className="ad-tabela">
              <thead><tr><th>Número</th><th>Curso</th><th>Nota</th><th>Emitido em</th></tr></thead>
              <tbody>
                {ficha.certificados.map(c => (
                  <tr key={c.id}>
                    <td>{c.numero}</td>
                    <td>{c.cursoTitulo}</td>
                    <td>{c.nota ?? '—'}</td>
                    <td>{fmtData(c.emitidoEm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <form onSubmit={onEmitirManual} className="ad-form-linha" style={{ marginTop: 12, alignItems: 'flex-end' }}>
          <label style={{ flex: 2 }}>Emitir certificado manual pra
            <select value={cursoId} onChange={e => setCursoId(e.target.value)}>
              <option value="">Selecione um curso...</option>
              {cursos.map(c => <option key={c.id} value={c.id}>{c.titulo}</option>)}
            </select>
          </label>
          <button type="submit" className="ad-btn-primario" disabled={pendente}><Certificado size={14} variante="mono" /> Emitir</button>
        </form>
      </section>
    </>
  )
}

// ============================================================
// Gamificação
// ============================================================
function GamificacaoAba({ ficha, extratoInicial, onErro, onSucesso }: { ficha: FichaUsuario; extratoInicial: ExtratoPaginado; onErro: (e: string) => void; onSucesso: (m: string) => void }) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()
  const [extrato, setExtrato] = useState(extratoInicial)
  const [paginaExtrato, setPaginaExtrato] = useState(1)
  const [pontos, setPontos] = useState('')
  const [moedas, setMoedas] = useState('')

  function onAjustar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const p = Number(pontos) || 0
    const m = Number(moedas) || 0
    if (p === 0 && m === 0) { onErro('Informe pontos ou moedas diferentes de zero.'); return }
    const justificativa = (prompt('Justificativa (obrigatória) · Ajuste manual de gamificação:') ?? '').trim()
    if (!justificativa) { onErro('Justificativa é obrigatória. Ação cancelada.'); return }
    startTransition(async () => {
      const r = await ajustarGamificacaoUsuario(ficha.id, p, m, justificativa)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Ajuste de gamificação salvo com sucesso'); setPontos(''); setMoedas(''); router.refresh() }
    })
  }

  function onCarregarMais() {
    const proxima = paginaExtrato + 1
    startTransition(async () => {
      const r = await carregarMaisExtrato(ficha.id, proxima)
      if (!r.ok) { onErro(r.erro); return }
      setExtrato(d => ({ linhas: [...d.linhas, ...r.dados.linhas], totalCount: r.dados.totalCount }))
      setPaginaExtrato(proxima)
    })
  }

  return (
    <>
      <section className="ad-card">
        <h2>Resumo</h2>
        <div className="ad-fin-stats">
          <div className="ad-fin-stat"><b><XP size={16} variante="mono" /> {ficha.xp}</b><span>XP total</span></div>
          <div className="ad-fin-stat"><b><Moeda size={16} variante="mono" /> {ficha.moedas}</b><span>Moedas</span></div>
          <div className="ad-fin-stat"><b><SeloNivel size={16} variante="mono" nivel={ficha.nivel} /> {ficha.nivelNome}</b><span>Nível</span></div>
          <div className="ad-fin-stat"><b><FogoStreak size={16} variante="mono" /> {ficha.streak}</b><span>Dias de sequência</span></div>
        </div>
      </section>

      <section className="ad-card">
        <h2>Ajuste manual</h2>
        <p>Correção pontual de XP/moedas, use valores negativos pra descontar. Fica registrado no extrato e na auditoria.</p>
        <form onSubmit={onAjustar} className="ad-form-linha" style={{ alignItems: 'flex-end' }}>
          <label>Pontos<input type="number" value={pontos} onChange={e => setPontos(e.target.value)} placeholder="0" /></label>
          <label>Moedas<input type="number" value={moedas} onChange={e => setMoedas(e.target.value)} placeholder="0" /></label>
          <button type="submit" className="ad-btn-primario" disabled={pendente}>Ajustar</button>
        </form>
      </section>

      <section className="ad-card">
        <h2>Extrato ({extrato.totalCount})</h2>
        {extrato.linhas.length === 0 && <p className="ad-vazio">Nenhum lançamento ainda.</p>}
        {extrato.linhas.length > 0 && (
          <div className="ad-tabela-scroll">
            <table className="ad-tabela">
              <thead><tr><th>Gatilho</th><th>Pontos</th><th>Moedas</th><th>Data</th></tr></thead>
              <tbody>
                {extrato.linhas.map(l => (
                  <tr key={l.id}>
                    <td>{l.gatilhoNome ?? l.gatilhoCodigo}</td>
                    <td>{l.pontos}</td>
                    <td>{l.moedas}</td>
                    <td>{fmtDataHora(l.criadoEm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {extrato.linhas.length < extrato.totalCount && (
          <button type="button" className="ad-btn-secundario" disabled={pendente} onClick={onCarregarMais} style={{ marginTop: 10 }}>
            {pendente ? 'Carregando...' : 'Carregar mais'}
          </button>
        )}
      </section>
    </>
  )
}

// ============================================================
// Financeiro
// ============================================================
function FinanceiroAba({ ficha }: { ficha: FichaUsuario }) {
  return (
    <section className="ad-card">
      <h2>Assinatura e cobranças</h2>
      <p>Leitura apenas. Ações financeiras (suspender/cancelar assinatura, editar planos) ficam no <a href="/admin/financeiro" style={{ textDecoration: 'underline' }}>módulo Financeiro</a>.</p>

      {!ficha.assinatura && <p className="ad-vazio">Sem assinatura.</p>}
      {ficha.assinatura && (
        <>
          <p style={{ marginBottom: 12 }}>
            <span className={`ad-status-pill ${ficha.assinatura.status}`}>{ficha.assinatura.status}</span>
            {' '}{ficha.assinatura.planoNome}
            {ficha.assinatura.observacao && <span className="ad-fin-nota"> · {ficha.assinatura.observacao}</span>}
          </p>

          {ficha.assinatura.cobrancas.length === 0 && <p className="ad-vazio-sm">Nenhuma cobrança registrada.</p>}
          {ficha.assinatura.cobrancas.length > 0 && (
            <div className="ad-tabela-scroll">
              <table className="ad-tabela">
                <thead><tr><th>Valor</th><th>Status</th><th>Vencimento</th><th>Pago em</th><th>Método</th></tr></thead>
                <tbody>
                  {ficha.assinatura.cobrancas.map(c => (
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
        </>
      )}
    </section>
  )
}

// ============================================================
// Comunidade
// ============================================================
function ComunidadeAba({ comunidade }: { comunidade: ComunidadeUsuario }) {
  return (
    <>
      <section className="ad-card">
        <h2>Posts recentes</h2>
        <p>Leitura apenas. Moderação (fixar, ocultar, excluir) fica no <a href="/admin/comunidade" style={{ textDecoration: 'underline' }}>módulo Comunidade</a>.</p>
        {comunidade.posts.length === 0 && <p className="ad-vazio">Nenhum post ainda.</p>}
        {comunidade.posts.length > 0 && (
          <ul className="ad-usu-lista">
            {comunidade.posts.map(p => (
              <li key={p.id}>
                <b>{p.titulo ?? '(sem título)'}</b> <span className="ad-fin-nota">{fmtDataHora(p.criadoEm)}</span>
                <p>{p.corpo}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ad-card">
        <h2>Comentários recentes</h2>
        {comunidade.comentarios.length === 0 && <p className="ad-vazio">Nenhum comentário ainda.</p>}
        {comunidade.comentarios.length > 0 && (
          <ul className="ad-usu-lista">
            {comunidade.comentarios.map(c => (
              <li key={c.id}>
                <span className="ad-fin-nota">{fmtDataHora(c.criadoEm)}</span>
                <p>{c.corpo}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

// ============================================================
// Auditoria
// ============================================================
const NOME_ACAO: Record<string, string> = {
  suspender: 'Suspendeu a conta', reativar: 'Reativou a conta', banir: 'Baniu a conta',
  resetar_senha: 'Resetou a senha', ajuste_gamificacao: 'Ajustou gamificação',
  emitir_certificado_manual: 'Emitiu certificado manual', conceder_cortesia: 'Concedeu cortesia',
}

function AuditoriaAba({ auditoria }: { auditoria: AuditoriaLinha[] }) {
  return (
    <section className="ad-card">
      <h2>Log de ações administrativas</h2>
      {auditoria.length === 0 && <p className="ad-vazio">Nenhuma ação registrada ainda.</p>}
      {auditoria.length > 0 && (
        <div className="ad-tabela-scroll">
          <table className="ad-tabela">
            <thead><tr><th>Quando</th><th>Admin</th><th>Ação</th><th>Justificativa</th></tr></thead>
            <tbody>
              {auditoria.map(a => (
                <tr key={a.id}>
                  <td>{fmtDataHora(a.criadoEm)}</td>
                  <td>{a.adminNome}</td>
                  <td>{NOME_ACAO[a.acao] ?? a.acao}</td>
                  <td>{a.justificativa ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// components/AdminUsuarioFichaContent.tsx
'use client'

import { useState, useTransition } from 'react'
import type { FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type {
  FichaUsuario, ExtratoPaginado, ComunidadeUsuario, AuditoriaLinha, CursoParaCertificado,
  StatusNexus,
} from '@/lib/queries/admin-suporte'
import {
  suspenderUsuario, reativarUsuario, banirUsuario, resetarSenhaUsuario, concederCortesiaUsuario,
  ajustarGamificacaoUsuario, emitirCertificadoManual, carregarMaisExtrato,
  definirNexusStatusUsuario,
  previaDeExclusao,
  excluirUsuario,
  type PreviaExclusao,
} from '@/app/admin/usuarios/actions'
import { IconeUser, IconeMail, IconeMapPin, IconeCalendar, IconeClock, IconeLock, IconeEye } from '@/components/Icones'
import { XP, Moeda, SeloNivel, FogoStreak, Certificado } from '@/components/Emblemas'
import { useAdminToast, AdminToastContainer } from '@/components/AdminToast'

const NOME_NEXUS: Record<StatusNexus, string> = {
  none: 'Sem Nexus',
  active: 'Assinante ativo',
  cancelled: 'Ex-assinante',
}

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

export default function AdminUsuarioFichaContent({ ficha, extratoInicial, comunidade, auditoria, cursos, nexusStatus }: {
  ficha: FichaUsuario; extratoInicial: ExtratoPaginado; comunidade: ComunidadeUsuario; auditoria: AuditoriaLinha[]; cursos: CursoParaCertificado[]
  nexusStatus: StatusNexus
}) {
  const [aba, setAba] = useState<Aba>('geral')
  const toast = useAdminToast()

  return (
    <div className="pnl-cursos">
      <AdminToastContainer toasts={toast.toasts} remover={toast.remover} />
      <div className="pnl-cursos-cab">
        <div>
          <h1>{ficha.nome}</h1>
          <p className="pnl-sub">{ficha.email ?? '—'} · <span className={`pnl-status-pill ${ficha.status}`}>{NOME_STATUS_CONTA[ficha.status]}</span></p>
        </div>
        <button type="button" className="pnl-btn-secundario" disabled title="Em breve. Impersonação exige um desenho de segurança dedicado (sessão separada, banner visível, log reforçado, expiração)">
          <IconeEye size={14} /> Ver como este aluno
        </button>
      </div>

      <div className="pnl-abas">
        <button type="button" className={`pnl-aba${aba === 'geral' ? ' ativa' : ''}`} onClick={() => setAba('geral')}>Visão geral</button>
        <button type="button" className={`pnl-aba${aba === 'progresso' ? ' ativa' : ''}`} onClick={() => setAba('progresso')}>Progresso</button>
        <button type="button" className={`pnl-aba${aba === 'gamificacao' ? ' ativa' : ''}`} onClick={() => setAba('gamificacao')}>Gamificação</button>
        <button type="button" className={`pnl-aba${aba === 'financeiro' ? ' ativa' : ''}`} onClick={() => setAba('financeiro')}>Financeiro</button>
        <button type="button" className={`pnl-aba${aba === 'comunidade' ? ' ativa' : ''}`} onClick={() => setAba('comunidade')}>Comunidade</button>
        <button type="button" className={`pnl-aba${aba === 'auditoria' ? ' ativa' : ''}`} onClick={() => setAba('auditoria')}>Auditoria ({auditoria.length})</button>
      </div>

      {aba === 'geral' && <VisaoGeralAba ficha={ficha} nexusStatus={nexusStatus} onErro={toast.erro} onSucesso={toast.sucesso} />}
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
function VisaoGeralAba({ ficha, nexusStatus, onErro, onSucesso }: { ficha: FichaUsuario; nexusStatus: StatusNexus; onErro: (e: string) => void; onSucesso: (m: string) => void }) {
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
      <section className="pnl-card">
        <h2>Dados do perfil</h2>
        <div className="pnl-usu-info">
          <div><IconeUser size={14} /> {ficha.nome}</div>
          <div><IconeMail size={14} /> {ficha.email ?? '—'}</div>
          <div><IconeMapPin size={14} /> {[ficha.cidade, ficha.estado].filter(Boolean).join(', ') || '—'}</div>
          <div><IconeCalendar size={14} /> Cadastrado em {fmtData(ficha.criadoEm)}</div>
          <div><IconeClock size={14} /> Último acesso: {fmtDataHora(ficha.ultimoAcesso)}</div>
        </div>
      </section>

      <section className="pnl-card">
        <h2>Assinatura atual</h2>
        {!ficha.assinatura && <p className="pnl-vazio">Sem assinatura.</p>}
        {ficha.assinatura && (
          <p>
            <span className={`pnl-status-pill ${ficha.assinatura.status}`}>{ficha.assinatura.status}</span>
            {' '}{ficha.assinatura.planoNome}, próxima cobrança em {fmtData(ficha.assinatura.proximaCobranca)}
          </p>
        )}
      </section>

      <section className="pnl-card">
        <h2>MH Nexus</h2>
        <p>
          <span className={`pnl-status-pill ${nexusStatus === 'active' ? 'ativa' : nexusStatus === 'cancelled' ? 'inadimplente' : ''}`}>
            {NOME_NEXUS[nexusStatus]}
          </span>
        </p>
        <p className="pnl-fin-nota">
          {nexusStatus === 'active'
            ? 'Assinante ativo: nenhuma sugestão do Nexus aparece pra este aluno.'
            : nexusStatus === 'cancelled'
              ? 'Ex-assinante: vê as sugestões com o texto de retomada.'
              : 'Nunca assinou: vê as sugestões normais do ecossistema.'}
          {' '}Enquanto não há integração de assinatura entre as plataformas, esta marcação é manual.
        </p>
        <div className="pnl-fin-detalhe-acoes" style={{ marginTop: 10 }}>
          {(['active', 'cancelled', 'none'] as const)
            .filter(alvo => alvo !== nexusStatus)
            .map(alvo => (
              <button
                key={alvo}
                type="button"
                className="pnl-btn-secundario"
                disabled={pendente}
                onClick={() => {
                  const just = prompt(`Marcar como "${NOME_NEXUS[alvo]}". Justificativa:`)
                  if (!just?.trim()) return
                  startTransition(async () => {
                    const r = await definirNexusStatusUsuario(ficha.id, alvo, just.trim())
                    if (!r.ok) onErro(r.erro)
                    else { onSucesso(`Status do Nexus: ${NOME_NEXUS[alvo]}`); router.refresh() }
                  })
                }}
              >
                Marcar como {NOME_NEXUS[alvo]}
              </button>
            ))}
        </div>
      </section>

      <section className="pnl-card">
        <h2>Ações administrativas</h2>
        <div className="pnl-fin-detalhe-acoes">
          {ficha.status !== 'ativo' && (
            <button type="button" className="pnl-btn-secundario" disabled={pendente} onClick={() => acaoComJustificativa(reativarUsuario, 'Reativar', 'Conta reativada com sucesso')}>Reativar</button>
          )}
          {ficha.status !== 'suspenso' && (
            <button type="button" className="pnl-btn-secundario" disabled={pendente} onClick={() => acaoComJustificativa(suspenderUsuario, 'Suspender', 'Conta suspensa com sucesso')}>Suspender</button>
          )}
          {ficha.status !== 'banido' && (
            <button type="button" className="pnl-btn-perigo" disabled={pendente} onClick={() => acaoComJustificativa(banirUsuario, 'Banir', 'Conta banida com sucesso')}>Banir</button>
          )}
          <button type="button" className="pnl-btn-secundario" disabled={pendente} onClick={() => acaoComJustificativa(resetarSenhaUsuario, 'Resetar senha (envia e-mail de recuperação)', 'E-mail de redefinição enviado com sucesso')}>
            <IconeLock size={14} /> Resetar senha
          </button>
          <button type="button" className="pnl-btn-secundario" disabled={pendente} onClick={() => acaoComJustificativa(concederCortesiaUsuario, 'Conceder cortesia', 'Cortesia concedida com sucesso')}>Conceder cortesia</button>
        </div>
      </section>

      <ExcluirDeVez ficha={ficha} onErro={onErro} onSucesso={onSucesso} />
    </>
  )
}

// ============================================================
// Excluir de vez
// ============================================================
// Card SEPARADO das outras ações, e não mais um botão na mesma fileira: as de
// cima são reversíveis, esta não é. Botão irreversível ao lado de botões
// reversíveis é clicado com a mão de quem esperava poder desfazer.
//
// O fluxo tem três portas: pedir a prévia, ler o que vai junto, e digitar o
// e-mail. Nenhum `confirm()` — aquele é clicado sem ler, e o erro mais provável
// aqui não é "não quis apagar", é "apaguei a pessoa errada".
function ExcluirDeVez({ ficha, onErro, onSucesso }: { ficha: FichaUsuario; onErro: (e: string) => void; onSucesso: (m: string) => void }) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()
  const [previa, setPrevia] = useState<PreviaExclusao | null>(null)
  const [emailDigitado, setEmailDigitado] = useState('')
  const [motivo, setMotivo] = useState('')

  function onPedirPrevia() {
    startTransition(async () => {
      const r = await previaDeExclusao(ficha.id)
      if (!r.ok) { onErro(r.erro); return }
      setPrevia(r.previa)
    })
  }

  function onExcluir() {
    startTransition(async () => {
      const r = await excluirUsuario(ficha.id, emailDigitado, motivo)
      if (!r.ok) { onErro(r.erro); return }
      onSucesso(`Conta excluída dos dois bancos (${r.nexus})`)
      router.push('/admin/usuarios')
    })
  }

  return (
    <section className="pnl-card" style={{ borderColor: 'rgba(240,52,52,.35)' }}>
      <h2 style={{ color: '#F03434' }}>Excluir de vez</h2>
      <p className="pnl-sub">
        Apaga a conta desta plataforma <strong>e do Nexus</strong>. Não tem desfazer. Para quase todo caso,
        <strong> suspender ou banir resolve</strong> e preserva o histórico.
      </p>

      {!previa && (
        <button type="button" className="pnl-btn-secundario" disabled={pendente} onClick={onPedirPrevia}>
          {pendente ? 'Conferindo...' : 'Ver o que será apagado'}
        </button>
      )}

      {previa && (
        <>
          <div className="pnl-tabela-scroll" style={{ margin: '14px 0' }}>
            <table className="pnl-tabela">
              <thead><tr><th>Vai junto</th><th>Peritos Academy</th><th>Nexus</th></tr></thead>
              <tbody>
                <tr><td>Conta de login</td><td>sim</td><td>{previa.nexus.contaNoAuth ? 'sim' : '—'}</td></tr>
                <tr><td>Certificados emitidos</td><td className="num">{previa.academy.certificados}</td><td>—</td></tr>
                <tr><td>Concessões de acesso</td><td className="num">{previa.academy.acessos}</td><td>—</td></tr>
                <tr><td>Progresso de aulas</td><td className="num">{previa.academy.progressoAulas}</td><td>—</td></tr>
                <tr><td>Contato na base</td><td>—</td><td>{previa.nexus.contatoNaBase ? 'sim' : '—'}</td></tr>
                <tr><td>Etiquetas</td><td>—</td><td className="num">{previa.nexus.tags}</td></tr>
                <tr><td>Inscrições em esteira</td><td>—</td><td className="num">{previa.nexus.inscricoesEmEsteira}</td></tr>
                <tr><td>Histórico de envios</td><td>—</td><td className="num">{previa.nexus.enviosDeMarketing}</td></tr>
              </tbody>
            </table>
          </div>

          {previa.academy.postsComunidade > 0 && (
            <p className="pnl-sub">
              {previa.academy.postsComunidade} post(s) na comunidade <strong>permanecem</strong>, sem autor. Some o nome, não o texto.
            </p>
          )}
          {previa.academy.ehAdmin && (
            <p className="pnl-sub" style={{ color: '#F03434', fontWeight: 600 }}>
              Esta conta é administradora da plataforma. Remova o papel de admin antes de excluir.
            </p>
          )}
          {!previa.nexus.ok && (
            <p className="pnl-sub" style={{ color: '#F5A623' }}>
              Não consegui falar com o Nexus ({previa.nexus.erro}). A exclusão não vai começar sem ele.
            </p>
          )}

          <div className="pnl-form" style={{ marginTop: 14 }}>
            <label>Digite <code>{previa.email}</code> para confirmar
              <input value={emailDigitado} onChange={e => setEmailDigitado(e.target.value)} autoComplete="off" placeholder={previa.email} />
            </label>
            <label>Motivo (fica no log do servidor)
              <input value={motivo} onChange={e => setMotivo(e.target.value)} autoComplete="off" placeholder="Ex.: conta de teste, pedido de remoção do titular" />
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="pnl-btn-perigo"
                disabled={pendente || previa.academy.ehAdmin || !previa.nexus.ok
                  || emailDigitado.trim().toLowerCase() !== previa.email.toLowerCase() || !motivo.trim()}
                onClick={onExcluir}
              >
                {pendente ? 'Excluindo...' : 'Excluir dos dois bancos'}
              </button>
              <button type="button" className="pnl-btn-secundario" disabled={pendente} onClick={() => { setPrevia(null); setEmailDigitado(''); setMotivo('') }}>
                Cancelar
              </button>
            </div>
          </div>
        </>
      )}
    </section>
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
      <section className="pnl-card">
        <h2>Cursos</h2>
        {ficha.cursos.length === 0 && <p className="pnl-vazio">Nenhum curso iniciado ainda.</p>}
        {ficha.cursos.length > 0 && (
          <div className="pnl-tabela-scroll">
            <table className="pnl-tabela">
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

      <section className="pnl-card">
        <h2>Avaliações</h2>
        {ficha.avaliacoes.length === 0 && <p className="pnl-vazio">Nenhuma avaliação feita ainda.</p>}
        {ficha.avaliacoes.length > 0 && (
          <div className="pnl-tabela-scroll">
            <table className="pnl-tabela">
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

      <section className="pnl-card">
        <h2>Certificados emitidos</h2>
        {ficha.certificados.length === 0 && <p className="pnl-vazio">Nenhum certificado emitido ainda.</p>}
        {ficha.certificados.length > 0 && (
          <div className="pnl-tabela-scroll">
            <table className="pnl-tabela">
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

        <form onSubmit={onEmitirManual} className="pnl-form-linha" style={{ marginTop: 12, alignItems: 'flex-end' }}>
          <label style={{ flex: 2 }}>Emitir certificado manual pra
            <select value={cursoId} onChange={e => setCursoId(e.target.value)}>
              <option value="">Selecione um curso...</option>
              {cursos.map(c => <option key={c.id} value={c.id}>{c.titulo}</option>)}
            </select>
          </label>
          <button type="submit" className="pnl-btn-primario" disabled={pendente}><Certificado size={14} variante="mono" /> Emitir</button>
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
      <section className="pnl-card">
        <h2>Resumo</h2>
        <div className="pnl-fin-stats">
          <div className="pnl-fin-stat"><b><XP size={16} variante="mono" /> {ficha.xp}</b><span>XP total</span></div>
          <div className="pnl-fin-stat"><b><Moeda size={16} variante="mono" /> {ficha.moedas}</b><span>Moedas</span></div>
          <div className="pnl-fin-stat"><b><SeloNivel size={16} variante="mono" nivel={ficha.nivel} /> {ficha.nivelNome}</b><span>Nível</span></div>
          <div className="pnl-fin-stat"><b><FogoStreak size={16} variante="mono" /> {ficha.streak}</b><span>Dias de sequência</span></div>
        </div>
      </section>

      <section className="pnl-card">
        <h2>Ajuste manual</h2>
        <p>Correção pontual de XP/moedas, use valores negativos pra descontar. Fica registrado no extrato e na auditoria.</p>
        <form onSubmit={onAjustar} className="pnl-form-linha" style={{ alignItems: 'flex-end' }}>
          <label>Pontos<input type="number" value={pontos} onChange={e => setPontos(e.target.value)} placeholder="0" /></label>
          <label>Moedas<input type="number" value={moedas} onChange={e => setMoedas(e.target.value)} placeholder="0" /></label>
          <button type="submit" className="pnl-btn-primario" disabled={pendente}>Ajustar</button>
        </form>
      </section>

      <section className="pnl-card">
        <h2>Extrato ({extrato.totalCount})</h2>
        {extrato.linhas.length === 0 && <p className="pnl-vazio">Nenhum lançamento ainda.</p>}
        {extrato.linhas.length > 0 && (
          <div className="pnl-tabela-scroll">
            <table className="pnl-tabela">
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
          <button type="button" className="pnl-btn-secundario" disabled={pendente} onClick={onCarregarMais} style={{ marginTop: 10 }}>
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
    <section className="pnl-card">
      <h2>Assinatura e cobranças</h2>
      <p>Leitura apenas. Ações financeiras (suspender/cancelar assinatura, editar planos) ficam no <a href="/admin/financeiro" style={{ textDecoration: 'underline' }}>módulo Financeiro</a>.</p>

      {!ficha.assinatura && <p className="pnl-vazio">Sem assinatura.</p>}
      {ficha.assinatura && (
        <>
          <p style={{ marginBottom: 12 }}>
            <span className={`pnl-status-pill ${ficha.assinatura.status}`}>{ficha.assinatura.status}</span>
            {' '}{ficha.assinatura.planoNome}
            {ficha.assinatura.observacao && <span className="pnl-fin-nota"> · {ficha.assinatura.observacao}</span>}
          </p>

          {ficha.assinatura.cobrancas.length === 0 && <p className="pnl-vazio-sm">Nenhuma cobrança registrada.</p>}
          {ficha.assinatura.cobrancas.length > 0 && (
            <div className="pnl-tabela-scroll">
              <table className="pnl-tabela">
                <thead><tr><th>Valor</th><th>Status</th><th>Vencimento</th><th>Pago em</th><th>Método</th></tr></thead>
                <tbody>
                  {ficha.assinatura.cobrancas.map(c => (
                    <tr key={c.id}>
                      <td>{fmtBRL(c.valorCentavos)}</td>
                      <td><span className={`pnl-status-pill ${c.status}`}>{c.status}</span></td>
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
      <section className="pnl-card">
        <h2>Posts recentes</h2>
        <p>Leitura apenas. Moderação (fixar, ocultar, excluir) fica no <a href="/admin/comunidade" style={{ textDecoration: 'underline' }}>módulo Comunidade</a>.</p>
        {comunidade.posts.length === 0 && <p className="pnl-vazio">Nenhum post ainda.</p>}
        {comunidade.posts.length > 0 && (
          <ul className="pnl-usu-lista">
            {comunidade.posts.map(p => (
              <li key={p.id}>
                <b>{p.titulo ?? '(sem título)'}</b> <span className="pnl-fin-nota">{fmtDataHora(p.criadoEm)}</span>
                <p>{p.corpo}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="pnl-card">
        <h2>Comentários recentes</h2>
        {comunidade.comentarios.length === 0 && <p className="pnl-vazio">Nenhum comentário ainda.</p>}
        {comunidade.comentarios.length > 0 && (
          <ul className="pnl-usu-lista">
            {comunidade.comentarios.map(c => (
              <li key={c.id}>
                <span className="pnl-fin-nota">{fmtDataHora(c.criadoEm)}</span>
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
    <section className="pnl-card">
      <h2>Log de ações administrativas</h2>
      {auditoria.length === 0 && <p className="pnl-vazio">Nenhuma ação registrada ainda.</p>}
      {auditoria.length > 0 && (
        <div className="pnl-tabela-scroll">
          <table className="pnl-tabela">
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

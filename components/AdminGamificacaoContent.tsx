// components/AdminGamificacaoContent.tsx
'use client'

import { useState, useTransition } from 'react'
import type { FormEvent, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { ConfigGamificacao, GatilhoAdmin, NivelAdmin, CategoriaGatilho } from '@/lib/queries/admin-gamificacao'
import {
  atualizarConfigGamificacao, atualizarGatilho,
  criarNivel, atualizarNivel, excluirNivel, moverNivel, uploadSeloNivel,
  recalcularCurvaNiveis,
} from '@/app/admin/gamificacao/actions'
import { IconeArrowUp, IconeArrowDown, IconePencil, IconeTrash } from '@/components/Icones'
import { useAdminToast, AdminToastContainer } from '@/components/AdminToast'

type Aba = 'definicoes' | 'gatilhos' | 'niveis'

const NOME_CATEGORIA: Record<CategoriaGatilho, string> = {
  comum: 'Comum', marco: 'Marco', quiz: 'Quiz', especial: 'Especial',
}

export default function AdminGamificacaoContent({ config, gatilhos, niveis }: {
  config: ConfigGamificacao; gatilhos: GatilhoAdmin[]; niveis: NivelAdmin[]
}) {
  const [aba, setAba] = useState<Aba>('definicoes')
  const toast = useAdminToast()

  return (
    <div className="ad-cursos">
      <AdminToastContainer toasts={toast.toasts} remover={toast.remover} />
      <div className="ad-cursos-cab">
        <div>
          <h1>Gamificação</h1>
          <p className="ad-sub">XP, moedas, níveis e os gatilhos que creditam pontos na plataforma.</p>
        </div>
      </div>

      <div className="ad-abas">
        <button type="button" className={`ad-aba${aba === 'definicoes' ? ' ativa' : ''}`} onClick={() => setAba('definicoes')}>Definições</button>
        <button type="button" className={`ad-aba${aba === 'gatilhos' ? ' ativa' : ''}`} onClick={() => setAba('gatilhos')}>Gatilhos ({gatilhos.length})</button>
        <button type="button" className={`ad-aba${aba === 'niveis' ? ' ativa' : ''}`} onClick={() => setAba('niveis')}>Níveis ({niveis.length})</button>
      </div>

      {aba === 'definicoes' && <DefinicoesAba config={config} onErro={toast.erro} onSucesso={toast.sucesso} />}
      {aba === 'gatilhos' && <GatilhosAba gatilhos={gatilhos} onErro={toast.erro} onSucesso={toast.sucesso} />}
      {aba === 'niveis' && <NiveisAba niveis={niveis} config={config} onErro={toast.erro} onSucesso={toast.sucesso} />}
    </div>
  )
}

function DefinicoesAba({ config, onErro, onSucesso }: { config: ConfigGamificacao; onErro: (e: string) => void; onSucesso: (m: string) => void }) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()

  function onSalvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await atualizarConfigGamificacao(fd)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Definições salvas com sucesso'); router.refresh() }
    })
  }

  return (
    <section className="ad-card">
      <form onSubmit={onSalvar} className="ad-form">
        <h2>Switches</h2>
        <div className="ad-form-linha">
          <label className="ad-checkbox-linha">
            <input type="checkbox" name="gamificacao_ativa" defaultChecked={config.gamificacaoAtiva} />
            Gamificação ativa
          </label>
          <label className="ad-checkbox-linha">
            <input type="checkbox" name="gatilhos_ativos" defaultChecked={config.gatilhosAtivos} />
            Gatilhos ativos
          </label>
          <label className="ad-checkbox-linha">
            <input type="checkbox" name="ranking_ativo" defaultChecked={config.rankingAtivo} />
            Ranking ativo
          </label>
          <label className="ad-checkbox-linha">
            <input type="checkbox" name="niveis_ativos" defaultChecked={config.niveisAtivos} />
            Níveis ativos
          </label>
          <label className="ad-checkbox-linha">
            <input type="checkbox" name="loja_ativa" defaultChecked={config.lojaAtiva} />
            Loja ativa (em breve)
          </label>
        </div>
        <div className="ad-form-linha">
          <label className="ad-checkbox-linha">
            <input type="checkbox" name="exibir_pontuacao_perfil" defaultChecked={config.exibirPontuacaoPerfil} />
            Exibir pontuação no perfil
          </label>
          <label className="ad-checkbox-linha">
            <input type="checkbox" name="exibir_nivel_previa_perfil" defaultChecked={config.exibirNivelPreviaPerfil} />
            Exibir prévia do nível no perfil
          </label>
        </div>

        <h2 className="ad-form-subtitulo">Nomenclatura de XP</h2>
        <div className="ad-form-linha">
          <label>Singular
            <input name="xp_singular" defaultValue={config.xpSingular} />
          </label>
          <label>Plural
            <input name="xp_plural" defaultValue={config.xpPlural} />
          </label>
          <label>Abreviação
            <input name="xp_abreviacao" defaultValue={config.xpAbreviacao} />
          </label>
        </div>

        <h2 className="ad-form-subtitulo">Nomenclatura de moedas</h2>
        <div className="ad-form-linha">
          <label>Singular
            <input name="moeda_singular" defaultValue={config.moedaSingular} />
          </label>
          <label>Plural
            <input name="moeda_plural" defaultValue={config.moedaPlural} />
          </label>
          <label>Abreviação
            <input name="moeda_abreviacao" defaultValue={config.moedaAbreviacao} />
          </label>
        </div>
        <div className="ad-form-linha">
          <label>Cor (hex)
            <input name="moeda_cor" defaultValue={config.moedaCor ?? ''} placeholder="#DDF784" />
          </label>
          <label>Ícone (emoji)
            <input name="moeda_icone" defaultValue={config.moedaIcone ?? ''} placeholder="🪙" />
          </label>
        </div>

        <h2 className="ad-form-subtitulo">Como acumular (texto explicativo)</h2>
        <label>Texto
          <textarea name="texto_como_acumular" defaultValue={config.textoComoAcumular ?? ''} rows={5} />
        </label>

        <h2 className="ad-form-subtitulo">Motor de XP</h2>
        <div className="ad-form-linha">
          <label>XP base de avaliação
            <input name="avaliacao_xp_base" type="number" min="0" defaultValue={config.avaliacaoXpBase} />
          </label>
          <label>Bônus por curso concluído
            <input name="bonus_curso_concluido" type="number" min="0" defaultValue={config.bonusCursoConcluido} />
          </label>
          <label>Teto diário de engajamento
            <input name="teto_engajamento_diario" type="number" min="0" defaultValue={config.tetoEngajamentoDiario} />
          </label>
          <label>Moeda a cada X XP
            <input name="moeda_a_cada_xp" type="number" min="1" defaultValue={config.moedaACadaXp ?? ''} placeholder="sem conversão" />
          </label>
        </div>
        <p className="ad-sublista-meta">
          XP base de avaliação: multiplicado por peso × % de acerto, só na 1ª aprovação. Bônus de curso: creditado ao concluir todas as aulas/avaliações. Teto de engajamento: soma diária máxima de XP dos gatilhos marcados &quot;conta pro teto&quot; (aba Gatilhos). Moeda a cada X XP: conversão automática quando o gatilho não define moedas fixas.
        </p>

        <h2 className="ad-form-subtitulo">Gatilhos pendentes de agendamento</h2>
        <label>Códigos (separados por vírgula)
          <input name="gatilhos_pendentes_agendamento" defaultValue={config.gatilhosPendentesAgendamento.join(', ')} placeholder="aniversario, aniversario_plataforma" />
        </label>
        <p className="ad-sublista-meta">
          Gatilhos ativos no catálogo mas sem mecanismo de disparo (cron) ligado ainda. Aparecem pro aluno em /gamificacao com selo &quot;em breve&quot;, sem prometer um valor de XP. Tire o código daqui assim que o agendamento for ligado de verdade, o valor real volta a aparecer sozinho.
        </p>

        <button type="submit" className="ad-btn-primario" disabled={pendente}>{pendente ? 'Salvando...' : 'Salvar definições'}</button>
      </form>
    </section>
  )
}

function GatilhosAba({ gatilhos, onErro, onSucesso }: { gatilhos: GatilhoAdmin[]; onErro: (e: string) => void; onSucesso: (m: string) => void }) {
  const categorias: CategoriaGatilho[] = ['comum', 'marco', 'quiz', 'especial']
  return (
    <>
      {categorias.map(cat => {
        const doCat = gatilhos.filter(g => g.categoria === cat)
        if (doCat.length === 0) return null
        return (
          <section className="ad-card" key={cat}>
            <h2>{NOME_CATEGORIA[cat]}</h2>
            <div className="ad-tabela-scroll">
              <table className="ad-tabela">
                <thead><tr><th>Gatilho</th><th>Pontos</th><th>Moedas</th><th>Limite/dia</th><th>Ativo</th><th></th></tr></thead>
                <tbody>
                  {doCat.map(g => <GatilhoLinha key={g.codigo} gatilho={g} onErro={onErro} onSucesso={onSucesso} />)}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
    </>
  )
}

// Esses gatilhos têm o campo "Pontos" abaixo ignorado na prática: a RPC que
// credita (creditar_gamificacao) recebe um p_pontos_override dinâmico vindo
// de outra fonte, então o valor salvo aqui nunca é o que o aluno recebe.
const FONTE_REAL_DINAMICA: Record<string, string> = {
  concluir_aula: 'valor real vem de aulas.xp (por aula)',
  concluir_etapa: 'valor real vem de etapas.xp_conclusao (por etapa)',
  concluir_curso: 'valor real vem de config_gamificacao.bonus_curso_concluido (aba Definições)',
  entregar_desafio: 'valor real vem de desafios.xp (por desafio)',
  avaliacao_aprovada: 'valor real vem de avaliacao_xp_base (aba Definições) × peso da avaliação × % de acerto',
}

function GatilhoLinha({ gatilho, onErro, onSucesso }: { gatilho: GatilhoAdmin; onErro: (e: string) => void; onSucesso: (m: string) => void }) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()
  const fonteReal = FONTE_REAL_DINAMICA[gatilho.codigo]

  function onSalvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await atualizarGatilho(gatilho.codigo, fd)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Gatilho salvo com sucesso'); router.refresh() }
    })
  }

  return (
    <tr>
      <td>
        <b>{gatilho.nome}</b>
        {gatilho.descricao && <><br /><span className="ad-sublista-meta">{gatilho.descricao}</span></>}
        {fonteReal && <><br /><span className="ad-sublista-meta" style={{ color: 'var(--ciano)' }}>Pontos abaixo é só o valor padrão, não o creditado. {fonteReal}.</span></>}
      </td>
      <td colSpan={4}>
        <form onSubmit={onSalvar} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <input name="pontos" type="number" min="0" defaultValue={gatilho.pontos} className="ad-input-sm" title="Pontos" />
          <input name="moedas" type="number" min="0" defaultValue={gatilho.moedas} className="ad-input-sm" title="Moedas" />
          <input name="limite_diario" type="number" min="0" defaultValue={gatilho.limiteDiario ?? ''} placeholder="sem limite" className="ad-input-sm" title="Limite diário" />
          <label className="ad-checkbox-linha">
            <input type="checkbox" name="ativo" defaultChecked={gatilho.ativo} />
            Ativo
          </label>
          <label className="ad-checkbox-linha" title="Soma no teto diário combinado de engajamento (config em Definições)">
            <input type="checkbox" name="conta_teto_engajamento" defaultChecked={gatilho.contaTetoEngajamento} />
            Conta pro teto
          </label>
          <button type="submit" className="ad-btn-secundario" disabled={pendente}>{pendente ? 'Salvando...' : 'Salvar'}</button>
        </form>
      </td>
    </tr>
  )
}

function NiveisAba({ niveis, config, onErro, onSucesso }: { niveis: NivelAdmin[]; config: ConfigGamificacao; onErro: (e: string) => void; onSucesso: (m: string) => void }) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()
  const [recalculando, setRecalculando] = useState(false)
  const [criando, setCriando] = useState(false)
  const [nome, setNome] = useState('')
  const [pontosMinimos, setPontosMinimos] = useState('')

  function onCriar() {
    if (!nome.trim()) { onErro('Nome é obrigatório.'); return }
    const fd = new FormData()
    fd.set('nome', nome)
    fd.set('pontos_minimos', pontosMinimos || '0')
    startTransition(async () => {
      const r = await criarNivel(fd)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Nível criado com sucesso'); setNome(''); setPontosMinimos(''); setCriando(false); router.refresh() }
    })
  }

  function onRecalcular() {
    setRecalculando(true)
    startTransition(async () => {
      const r = await recalcularCurvaNiveis()
      setRecalculando(false)
      if (!r.ok) onErro(r.erro)
      else { onSucesso(`Curva recalculada, novo teto: ${r.teto?.toLocaleString('pt-BR')} XP`); router.refresh() }
    })
  }

  return (
    <section className="ad-card">
      <h2>Níveis</h2>
      <p>Nível atual do aluno exige XP mínimo <b>e</b> o requisito composto do nível ao mesmo tempo. Excedente de XP não substitui um requisito faltante.</p>

      <div className="ad-card-destaque" style={{ marginBottom: 16 }}>
        <div>
          <b>Teto de XP calculado:</b> {config.xpTetoCalculado?.toLocaleString('pt-BR') ?? 'nunca calculado'}
          {config.xpTetoCalculadoEm && (
            <span className="ad-sublista-meta"> · em {new Date(config.xpTetoCalculadoEm).toLocaleString('pt-BR')}</span>
          )}
          <br />
          <span className="ad-sublista-meta">
            Soma de todo XP de estudo disponível hoje (aulas + avaliações + etapas + desafios + bônus de curso). Os limiares dos 10 níveis são recalculados como percentuais desse teto. Rode de novo sempre que publicar avaliações/desafios novos.
          </span>
        </div>
        <button type="button" className="ad-btn-primario" disabled={pendente || recalculando} onClick={onRecalcular}>
          {recalculando ? 'Recalculando...' : 'Recalcular curva'}
        </button>
      </div>

      {criando && (
        <div className="ad-nova-linha">
          <input type="text" placeholder="Nome do nível" value={nome} onChange={e => setNome(e.target.value)} />
          <input type="number" placeholder="XP mínimo" min="0" value={pontosMinimos} onChange={e => setPontosMinimos(e.target.value)} className="ad-input-sm" />
          <button type="button" className="ad-btn-primario" disabled={pendente} onClick={onCriar}>Criar</button>
          <button type="button" className="ad-btn-secundario" onClick={() => setCriando(false)}>Cancelar</button>
        </div>
      )}
      {!criando && (
        <button type="button" className="ad-btn-primario" onClick={() => setCriando(true)} style={{ marginBottom: 14 }}>+ Novo nível</button>
      )}

      <div className="ad-modulos-lista">
        {niveis.map((n, i) => (
          <NivelLinha key={n.id} nivel={n} indice={i} total={niveis.length} onErro={onErro} onSucesso={onSucesso} />
        ))}
      </div>
    </section>
  )
}

function NivelLinha({ nivel, indice, total, onErro, onSucesso }: { nivel: NivelAdmin; indice: number; total: number; onErro: (e: string) => void; onSucesso: (m: string) => void }) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()
  const [editando, setEditando] = useState(false)

  function onSalvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await atualizarNivel(nivel.id, fd)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Nível salvo com sucesso'); setEditando(false); router.refresh() }
    })
  }

  function onMover(direcao: 'up' | 'down') {
    startTransition(async () => {
      const r = await moverNivel(nivel.id, direcao)
      if (!r.ok) onErro(r.erro)
      else router.refresh()
    })
  }

  function onExcluir() {
    if (!confirm(`Excluir o nível "${nivel.nome}"?`)) return
    startTransition(async () => {
      const r = await excluirNivel(nivel.id)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Nível excluído com sucesso'); router.refresh() }
    })
  }

  function onUploadSelo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.set('selo', file)
    startTransition(async () => {
      const r = await uploadSeloNivel(nivel.id, fd)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Selo atualizado com sucesso'); router.refresh() }
    })
  }

  return (
    <div className="ad-modulo-bloco">
      <div className="ad-modulo-cab">
        <span className="ad-modulo-toggle">
          {nivel.seloUrl && <img src={nivel.seloUrl} alt="" style={{ width: 22, height: 22, borderRadius: '50%', marginRight: 8, verticalAlign: 'middle', objectFit: 'cover' }} />}
          {nivel.nome} <span className="ad-sublista-meta">· {nivel.pontosMinimos} XP mínimo{formatarRequisitos(nivel) && ` · ${formatarRequisitos(nivel)}`}</span>
        </span>
        <div className="ad-modulo-acoes">
          <button type="button" disabled={pendente || indice === 0} onClick={() => onMover('up')} title="Mover para cima"><IconeArrowUp size={13} /></button>
          <button type="button" disabled={pendente || indice === total - 1} onClick={() => onMover('down')} title="Mover para baixo"><IconeArrowDown size={13} /></button>
          <label className="ad-btn-secundario ad-upload-btn" style={{ padding: '6px 10px', fontSize: 12 }}>
            Selo
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onUploadSelo} hidden disabled={pendente} />
          </label>
          <button type="button" onClick={() => setEditando(v => !v)} title="Editar"><IconePencil size={13} /></button>
          <button type="button" className="ad-btn-perigo-sm" disabled={pendente} onClick={onExcluir} title="Excluir"><IconeTrash size={13} /></button>
        </div>
      </div>
      {editando && (
        <div className="ad-modulo-corpo">
          <form onSubmit={onSalvar} className="ad-form">
            <div className="ad-form-linha">
              <label>Nome
                <input name="nome" defaultValue={nivel.nome} required />
              </label>
              <label>XP mínimo
                <input name="pontos_minimos" type="number" min="0" defaultValue={nivel.pontosMinimos} required />
              </label>
            </div>
            <h2 className="ad-form-subtitulo">Requisito composto (além do XP)</h2>
            <p className="ad-sublista-meta">Vazio = sem exigência nesse critério. -1 = 100% do que existe hoje (só faz sentido em cursos/avaliações/desafios).</p>
            <div className="ad-form-linha">
              <label>Aulas concluídas
                <input name="aulas_concluidas" type="number" defaultValue={nivel.aulasConcluidas ?? ''} placeholder="—" />
              </label>
              <label>Cursos completos
                <input name="cursos_completos" type="number" defaultValue={nivel.cursosCompletos ?? ''} placeholder="—" />
              </label>
              <label>Avaliações aprovadas
                <input name="avaliacoes_aprovadas" type="number" defaultValue={nivel.avaliacoesAprovadas ?? ''} placeholder="—" />
              </label>
              <label>Desafios completos
                <input name="desafios_completos" type="number" defaultValue={nivel.desafiosCompletos ?? ''} placeholder="—" />
              </label>
              <label>Streak marco (dias)
                <input name="streak_marco_dias" type="number" defaultValue={nivel.streakMarcoDias ?? ''} placeholder="—" />
              </label>
              <label>Participações comunidade
                <input name="participacoes_comunidade" type="number" defaultValue={nivel.participacoesComunidade ?? ''} placeholder="—" />
              </label>
            </div>
            <button type="submit" className="ad-btn-primario" disabled={pendente}>{pendente ? 'Salvando...' : 'Salvar nível'}</button>
          </form>
        </div>
      )}
    </div>
  )
}

function formatarRequisitos(nivel: NivelAdmin): string {
  const partes: string[] = []
  const add = (valor: number | null, rotulo: string) => {
    if (valor === null) return
    partes.push(`${rotulo}: ${valor === -1 ? '100%' : valor}`)
  }
  add(nivel.aulasConcluidas, 'aulas')
  add(nivel.cursosCompletos, 'cursos')
  add(nivel.avaliacoesAprovadas, 'avaliações')
  add(nivel.desafiosCompletos, 'desafios')
  add(nivel.streakMarcoDias, 'streak')
  add(nivel.participacoesComunidade, 'comunidade')
  return partes.join(', ')
}

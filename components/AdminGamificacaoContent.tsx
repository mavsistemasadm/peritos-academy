// components/AdminGamificacaoContent.tsx
'use client'

import { useState, useTransition } from 'react'
import type { FormEvent, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { ConfigGamificacao, GatilhoAdmin, NivelAdmin, CategoriaGatilho } from '@/lib/queries/admin-gamificacao'
import {
  atualizarConfigGamificacao, atualizarGatilho,
  criarNivel, atualizarNivel, excluirNivel, moverNivel, uploadSeloNivel,
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
      {aba === 'niveis' && <NiveisAba niveis={niveis} onErro={toast.erro} onSucesso={toast.sucesso} />}
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

function GatilhoLinha({ gatilho, onErro, onSucesso }: { gatilho: GatilhoAdmin; onErro: (e: string) => void; onSucesso: (m: string) => void }) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()

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
          <button type="submit" className="ad-btn-secundario" disabled={pendente}>{pendente ? 'Salvando...' : 'Salvar'}</button>
        </form>
      </td>
    </tr>
  )
}

function NiveisAba({ niveis, onErro, onSucesso }: { niveis: NivelAdmin[]; onErro: (e: string) => void; onSucesso: (m: string) => void }) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()
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

  return (
    <section className="ad-card">
      <h2>Níveis</h2>
      <p>Nível atual do aluno é derivado em tempo real pelo XP total (maior nível com pontos mínimos ≤ XP do usuário).</p>

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
          {nivel.nome} <span className="ad-sublista-meta">· {nivel.pontosMinimos} XP mínimo</span>
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
            <button type="submit" className="ad-btn-primario" disabled={pendente}>{pendente ? 'Salvando...' : 'Salvar nível'}</button>
          </form>
        </div>
      )}
    </div>
  )
}

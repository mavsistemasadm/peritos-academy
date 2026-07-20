// components/BibliotecaContent.tsx
// Biblioteca do perito: abas por área, filtro por tipo, busca,
// favoritas, mais baixadas — e modo vitrine pra quem não tem acesso.
'use client'

import { useMemo, useState, useTransition } from 'react'
import { baixarItem, alternarFavorita } from '@/app/biblioteca/actions'
import NavPlataforma from '@/components/NavPlataforma'
import type { DadosNav } from '@/lib/queries/nav'
import type { DadosBiblioteca, ItemBiblioteca } from '@/lib/queries/biblioteca'
import { IconeBarChart, IconeFileText, IconeScale, IconeLock, IconeStar, IconeSearch, IconeDownload } from '@/components/Icones'

const fmtNum = (n: number) => n.toLocaleString('pt-BR')
const fmtData = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', month: 'short', year: 'numeric' })

const ROTULO_TIPO: Record<string, string> = { planilha: 'Planilha', laudo: 'Modelo de laudo', peticao: 'Modelo de petição' }
const ICONE_TIPO: Record<string, typeof IconeBarChart> = { planilha: IconeBarChart, laudo: IconeFileText, peticao: IconeScale }

function tamanhoBonito(kb: number | null) {
  if (!kb) return ''
  return kb >= 1024 ? `${(kb / 1024).toFixed(1).replace('.', ',')} MB` : `${kb} KB`
}

export default function BibliotecaContent({ dados, nav }: { dados: DadosBiblioteca; nav: DadosNav }) {
  const d = dados
  const [abaArea, setAbaArea] = useState<string>('todas')     // 'todas' | slug | 'favoritas' | 'top'
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [busca, setBusca] = useState('')
  const [baixando, setBaixando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [favs, setFavs] = useState<Set<string>>(
    () => new Set(d.areas.flatMap(a => a.itens.filter(i => i.favorita).map(i => i.id)))
  )
  const [, start] = useTransition()

  const todos = useMemo(() => d.areas.flatMap(a => a.itens.map(i => ({ ...i, areaNome: d.areas.find(x => x.itens.includes(i))!.nome }))), [d.areas])

  function filtrarLista<T extends ItemBiblioteca>(lista: T[]): T[] {
    let out = lista
    if (filtroTipo !== 'todos') out = out.filter(i => i.tipo === filtroTipo)
    if (busca.trim()) {
      const q = busca.trim().toLowerCase()
      out = out.filter(i => i.nome.toLowerCase().includes(q) || (i.descricao ?? '').toLowerCase().includes(q))
    }
    return out
  }

  // "todas" e um slug de área exibem por seção; favoritas/top continuam lista única.
  const secoesVisiveis = useMemo(() => {
    if (abaArea === 'favoritas' || abaArea === 'top') return null
    const areasFiltradas = abaArea === 'todas' ? d.areas : d.areas.filter(a => a.slug === abaArea)
    return areasFiltradas
      .map(a => ({ slug: a.slug, nome: a.nome, itens: filtrarLista(a.itens) }))
      .filter(a => a.itens.length > 0)
  }, [d.areas, abaArea, filtroTipo, busca])

  const listaFlat = useMemo(() => {
    if (abaArea === 'favoritas') return filtrarLista(todos.filter(i => favs.has(i.id)))
    if (abaArea === 'top') return filtrarLista([...todos].sort((a, b) => b.downloads - a.downloads))
    return []
  }, [abaArea, todos, favs, filtroTipo, busca])

  const tiposPresentes = useMemo(() => [...new Set(todos.map(i => i.tipo))], [todos])

  async function baixarPorId(id: string) {
    if (!d.temAcesso) return
    setErro(null); setBaixando(id)
    const r = await baixarItem(id)
    setBaixando(null)
    if (!r.ok) { setErro(r.erro); return }
    // dispara o download pelo link assinado
    const a = document.createElement('a')
    a.href = r.url; a.download = ''
    document.body.appendChild(a); a.click(); a.remove()
  }

  async function baixar(item: ItemBiblioteca) {
    await baixarPorId(item.id)
  }

  function favoritar(id: string) {
    setFavs(f => { const n = new Set(f); n.has(id) ? n.delete(id) : n.add(id); return n })
    start(async () => { await alternarFavorita(id) })
  }

  return (
    <div className="pagina-biblioteca">
      <div className="grao" aria-hidden="true"></div>
      <NavPlataforma dados={nav} ativo="biblioteca" />

      {/* ============ HERO ============ */}
      <header className="bib-hero">
        <div className="wrap">
          <span className="eyebrow">Biblioteca do perito</span>
          <h1>Ferramentas prontas para o <span className="grad-txt">próximo caso.</span></h1>
          <p className="sub">Planilhas de cálculo, modelos de laudo e petições, revisadas e atualizadas pela equipe.</p>
          <div className="bib-selos num">
            <div className="selo"><b>{d.totalItens}</b><span>arquivos disponíveis</span></div>
            <div className="selo"><b>{fmtNum(d.totalDownloads)}</b><span>downloads realizados</span></div>
            <div className="selo"><b>{d.areas.length}</b><span>áreas de atuação</span></div>
          </div>
        </div>
      </header>

      <main className="wrap bib-corpo">
        {/* aviso pra quem não tem acesso */}
        {!d.temAcesso && (
          <div className="bib-trava" role="note">
            <b><IconeLock size={14} /> Sua conta ainda não tem acesso à Biblioteca.</b>
            <span>Este é um benefício de um grupo de alunos. Fale com o suporte para saber como participar.</span>
          </div>
        )}

        {/* ============ FILTROS ============ */}
        <div className="bib-filtros">
          <div className="abas" role="tablist" aria-label="Áreas">
            <button role="tab" aria-selected={abaArea === 'todas'} className={abaArea === 'todas' ? 'ativa' : ''} onClick={() => setAbaArea('todas')}>Todas</button>
            {d.areas.map(a => (
              <button key={a.slug} role="tab" aria-selected={abaArea === a.slug} className={abaArea === a.slug ? 'ativa' : ''} onClick={() => setAbaArea(a.slug)}>
                {a.nome} <small className="num">{a.itens.length}</small>
              </button>
            ))}
            <button role="tab" aria-selected={abaArea === 'top'} className={abaArea === 'top' ? 'ativa' : ''} onClick={() => setAbaArea('top')}>Mais baixadas</button>
            <button role="tab" aria-selected={abaArea === 'favoritas'} className={abaArea === 'favoritas' ? 'ativa' : ''} onClick={() => setAbaArea('favoritas')}><IconeStar size={13} /> Favoritas</button>
          </div>

          <div className="bib-filtros-linha2">
            {tiposPresentes.length > 1 && (
              <div className="tipos">
                <button className={filtroTipo === 'todos' ? 'ativa' : ''} onClick={() => setFiltroTipo('todos')}>Todos os tipos</button>
                {tiposPresentes.map(t => {
                  const IconeT = ICONE_TIPO[t]
                  return (
                    <button key={t} className={filtroTipo === t ? 'ativa' : ''} onClick={() => setFiltroTipo(t)}>
                      <IconeT size={13} /> {ROTULO_TIPO[t]}
                    </button>
                  )
                })}
              </div>
            )}
            <label className="bib-busca">
              <IconeSearch size={14} strokeWidth={2.2} />
              <input type="search" placeholder="Buscar por nome ou tema…" value={busca} onChange={e => setBusca(e.target.value)} />
            </label>
          </div>
        </div>

        {erro && <p className="bib-erro" role="alert">{erro}</p>}

        {/* ============ GRADE (por seção de área, ou lista única em favoritas/top) ============ */}
        {abaArea === 'favoritas' || abaArea === 'top' ? (
          listaFlat.length === 0 ? (
            <p className="bib-vazio">Nada por aqui. Tenta outra busca ou outra aba.</p>
          ) : (
            <div className="bib-grade">{listaFlat.map(item => renderCard(item))}</div>
          )
        ) : secoesVisiveis!.length === 0 ? (
          <p className="bib-vazio">Nada por aqui. Tenta outra busca ou outra aba.</p>
        ) : (
          secoesVisiveis!.map(area => (
            <section key={area.slug} className="bib-area-secao">
              <h2 className="bib-area-titulo">{area.nome} <small className="num">{area.itens.length}</small></h2>
              <div className="bib-grade">{area.itens.map(item => renderCard(item))}</div>
            </section>
          ))
        )}
      </main>

      <footer className="bib-footer">
        <div className="wrap">
          <span>© 2026 Peritos Academy · Biblioteca do perito</span>
          {d.termosUso && (
            <button
              className="bib-termos-link"
              onClick={() => baixarPorId(d.termosUso!.id)}
              disabled={!d.temAcesso || baixando === d.termosUso.id}
              title={!d.temAcesso ? 'Requer acesso à Biblioteca' : undefined}
            >
              {!d.temAcesso ? <IconeLock size={12} /> : null}
              {baixando === d.termosUso.id ? 'Gerando link…' : 'Termos de uso da Biblioteca'}
            </button>
          )}
        </div>
      </footer>
    </div>
  )

  function renderCard(item: ItemBiblioteca) {
    const IconeT = ICONE_TIPO[item.tipo]
    return (
      <article key={item.id} className={`bib-card${!d.temAcesso ? ' bloqueado' : ''}`}>
        <div className="card-topo">
          <span className="tipo-selo"><IconeT size={13} /> {ROTULO_TIPO[item.tipo]}</span>
          {item.novo && <span className="selo-novo">Novo</span>}
          <button
            className={`fav${favs.has(item.id) ? ' ativa' : ''}`}
            aria-label={favs.has(item.id) ? 'Remover das favoritas' : 'Adicionar às favoritas'}
            onClick={() => favoritar(item.id)}
            disabled={!d.temAcesso}
          ><IconeStar size={14} /></button>
        </div>
        <h3>{item.nome}</h3>
        {item.descricao && <p className="desc">{item.descricao}</p>}
        <div className="card-meta num">
          <span className="formato">.{item.formato}</span>
          {item.tamanhoKb ? <span>{tamanhoBonito(item.tamanhoKb)}</span> : null}
          <span>Atualizada {fmtData.format(new Date(item.atualizadoEm)).replace(/\./g, '').replace(' de ', '/')}</span>
        </div>
        <div className="card-rodape">
          <span className="downloads num" title="Downloads">
            <IconeDownload size={13} strokeWidth={2.2} />
            {fmtNum(item.downloads)}
          </span>
          {d.temAcesso ? (
            <button className="btn-baixar" onClick={() => baixar(item)} disabled={baixando === item.id}>
              {baixando === item.id ? 'Gerando link…' : item.baixada ? 'Baixar de novo' : 'Baixar'}
            </button>
          ) : (
            <span className="btn-baixar travado"><IconeLock size={12} /> Restrito</span>
          )}
        </div>
      </article>
    )
  }
}
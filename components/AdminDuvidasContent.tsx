'use client'

// components/AdminDuvidasContent.tsx — a tela aberta durante a live de
// tira-dúvidas. Abertas em cima, na ordem em que chegaram; "Respondida" dá
// baixa na hora (otimista) e a dúvida sai da fila. Recarrega sozinha a cada
// 20 segundos, porque dúvida continua chegando com a live no ar.
import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { marcarDuvida, linkDoAnexo } from '@/app/admin/agenda/[id]/duvidas/actions'
import { useAdminToast, AdminToastContainer } from '@/components/AdminToast'
import { SITE_URL } from '@/lib/site'

export type DuvidaAdmin = {
  id: string
  ehAluno: boolean
  nome: string
  email: string
  texto: string
  anexo: { nome: string; tipo: string; bytes: number } | null
  respondida: boolean
  respondidaEm: string | null
  criadaEm: string
}

type Filtro = 'abertas' | 'respondidas' | 'todas'

const hora = (iso: string) => new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
}).format(new Date(iso)).replace(',', ' às')
const tamanho = (b: number) => b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`

export default function AdminDuvidasContent({ evento, duvidas }: {
  evento: { id: string; titulo: string; slug: string | null; quando: string; recebeDuvidas: boolean }
  duvidas: DuvidaAdmin[]
}) {
  const router = useRouter()
  const toast = useAdminToast()
  const [filtro, setFiltro] = useState<Filtro>('abertas')
  const [locais, setLocais] = useState<Record<string, boolean>>({})
  const [abrindo, setAbrindo] = useState<string | null>(null)
  const [, start] = useTransition()

  // Dúvida chega durante a live: a lista se atualiza sozinha.
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) router.refresh() }, 20_000)
    return () => clearInterval(t)
  }, [router])

  // O que veio do servidor manda; o clique local só vale até a próxima carga.
  useEffect(() => { setLocais({}) }, [duvidas])

  const lista = duvidas.map(d => (d.id in locais ? { ...d, respondida: locais[d.id] } : d))
  const abertas = lista.filter(d => !d.respondida)
  const respondidas = lista.filter(d => d.respondida)
  // O número é a ordem de chegada, e não muda com o filtro: "a #4" na live é
  // a mesma #4 na tela de quem conduz.
  const ordem = new Map(duvidas.map((d, i) => [d.id, i + 1]))
  const visiveis = filtro === 'abertas' ? abertas : filtro === 'respondidas' ? respondidas : lista

  function alternar(d: DuvidaAdmin) {
    const alvo = !d.respondida
    setLocais(m => ({ ...m, [d.id]: alvo }))
    start(async () => {
      const r = await marcarDuvida(d.id, alvo)
      if (!r.ok) { setLocais(m => ({ ...m, [d.id]: !alvo })); toast.erro(r.erro); return }
      router.refresh()
    })
  }

  async function abrirAnexo(id: string) {
    setAbrindo(id)
    const r = await linkDoAnexo(id)
    setAbrindo(null)
    if (!r.ok) { toast.erro(r.erro); return }
    window.open(r.url, '_blank', 'noopener')
  }

  const linkFormulario = evento.slug ? `${SITE_URL}/evento/${evento.slug}#duvida` : null

  return (
    <div className="pnl-cursos pnl-duv">
      <AdminToastContainer toasts={toast.toasts} remover={toast.remover} />
      <div className="pnl-cursos-cab">
        <div>
          <a href="/admin/agenda" className="pnl-duv-voltar">← Agenda</a>
          <h1>Dúvidas da live</h1>
          <p className="pnl-sub">{evento.titulo} · {evento.quando}</p>
        </div>
        <div className="pnl-duv-cab-acoes">
          {linkFormulario && (
            <button type="button" className="pnl-btn-secundario" onClick={() => { navigator.clipboard?.writeText(linkFormulario); toast.sucesso('Link do formulário copiado') }}>
              Copiar link do formulário
            </button>
          )}
          <a href={`/admin/agenda/${evento.id}`} className="pnl-btn-secundario">Editar evento</a>
        </div>
      </div>

      {!evento.recebeDuvidas && (
        <p className="pnl-duv-aviso">
          Este evento não está recebendo dúvidas: a página pública não mostra o formulário. Ligue
          &quot;Live de tira-dúvidas&quot; em <a href={`/admin/agenda/${evento.id}`}>Editar evento</a>.
        </p>
      )}

      <div className="pnl-duv-resumo">
        <div><b>{abertas.length}</b><span>para responder</span></div>
        <div><b>{respondidas.length}</b><span>respondidas</span></div>
        <div><b>{lista.filter(d => d.anexo).length}</b><span>com anexo</span></div>
      </div>

      <div className="pnl-duv-filtros" role="tablist">
        {([['abertas', `Para responder (${abertas.length})`], ['respondidas', `Respondidas (${respondidas.length})`], ['todas', `Todas (${lista.length})`]] as [Filtro, string][]).map(([f, r]) => (
          <button key={f} type="button" role="tab" aria-selected={filtro === f} className={filtro === f ? 'ativo' : ''} onClick={() => setFiltro(f)}>{r}</button>
        ))}
      </div>

      {visiveis.length === 0 ? (
        <p className="pnl-vazio">
          {filtro === 'abertas'
            ? lista.length ? 'Tudo respondido. As novas aparecem aqui sozinhas.' : 'Nenhuma dúvida ainda. Esta tela se atualiza sozinha a cada 20 segundos.'
            : 'Nada aqui.'}
        </p>
      ) : (
        <ol className="pnl-duv-lista">
          {visiveis.map(d => (
            <li key={d.id} className={`pnl-duv-item${d.respondida ? ' respondida' : ''}`}>
              <div className="pnl-duv-topo">
                <span className="pnl-duv-num">#{ordem.get(d.id)}</span>
                <b>{d.nome}</b>
                <span className={`pnl-duv-selo${d.ehAluno ? ' aluno' : ''}`}>{d.ehAluno ? 'Aluno' : 'Convidado'}</span>
                <span className="pnl-duv-meta">{d.email} · {hora(d.criadaEm)}</span>
              </div>
              <p className="pnl-duv-texto">{d.texto}</p>
              <div className="pnl-duv-acoes">
                {d.anexo && (
                  <button type="button" className="pnl-btn-secundario" disabled={abrindo === d.id} onClick={() => abrirAnexo(d.id)}>
                    {abrindo === d.id ? 'Abrindo…' : `📎 ${d.anexo.nome} · ${tamanho(d.anexo.bytes)}`}
                  </button>
                )}
                <button type="button" className={d.respondida ? 'pnl-btn-secundario' : 'pnl-btn-primario'} onClick={() => alternar(d)}>
                  {d.respondida ? 'Reabrir' : '✓ Respondida'}
                </button>
                {d.respondida && d.respondidaEm && <span className="pnl-duv-meta">Respondida em {hora(d.respondidaEm)}</span>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

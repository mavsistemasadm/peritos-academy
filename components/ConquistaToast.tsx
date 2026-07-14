// components/ConquistaToast.tsx
// Toasts de celebração (5 tipos) — detecta novas conquistas via polling leve
// (não Realtime, ver CLAUDE.md) na tabela notificacoes, filtrando celebracao=true.
// Fila com prioridade quando várias conquistas chegam juntas; som sintetizado
// (lib/sons) por trás de cada toast, nunca sobreposto.
'use client'

import { useEffect, useRef, useState } from 'react'
import { criarClienteBrowser } from '@/lib/supabase/client'
import { tocarSom, type TipoSom } from '@/lib/sons'
import type { Notificacao } from '@/lib/queries/avisos'
import { Trofeu, Certificado, FogoStreak, XP, SeloNivel } from '@/components/Emblemas'

const PRIORIDADE: Record<string, number> = {
  nivel_up: 0, curso_concluido: 1, avaliacao_aprovada: 2, streak: 3, primeira_aula: 4,
}

const NIVEL_IMG: Record<number, string> = {
  1: '/niveis/nivel-01-explorador-novato.png',
  2: '/niveis/nivel-02-conhecedor-de-logicas.png',
  3: '/niveis/nivel-03-aspirante-a-perito.png',
  4: '/niveis/nivel-04-decifrador-de-calculos.png',
  5: '/niveis/nivel-05-profissao-perito.png',
  6: '/niveis/nivel-06-autoridade-pericial.png',
  7: '/niveis/nivel-07-desenvolvedor-de-teses.png',
  8: '/niveis/nivel-08-estrategista-expert.png',
  9: '/niveis/nivel-09-mestre-supremo.png',
  10: '/niveis/nivel-10-eu-sou-a-lenda.png',
}

const DURACAO_MS: Record<string, number> = {
  nivel_up: 4000, curso_concluido: 4500, avaliacao_aprovada: 4500, streak: 4200, primeira_aula: 3800,
}

function num(v: unknown): number | undefined { return typeof v === 'number' ? v : undefined }
function str(v: unknown): string | undefined { return typeof v === 'string' ? v : undefined }

export default function ConquistaToast({ logado, sonsConquista }: { logado: boolean; sonsConquista: boolean }) {
  const [atual, setAtual] = useState<Notificacao | null>(null)
  const [saindo, setSaindo] = useState(false)

  const filaRef = useRef<Notificacao[]>([])
  const cursorRef = useRef<string>(new Date().toISOString())
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fecharTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const emAndamentoRef = useRef(false)
  const sonsRef = useRef(sonsConquista)
  useEffect(() => { sonsRef.current = sonsConquista }, [sonsConquista])

  function fecharAtual() {
    if (fecharTimerRef.current) { clearTimeout(fecharTimerRef.current); fecharTimerRef.current = null }
    setSaindo(true)
    setTimeout(() => {
      setAtual(null)
      setSaindo(false)
      emAndamentoRef.current = false
      avancar()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, 320)
  }

  async function avancar() {
    if (emAndamentoRef.current) return
    if (filaRef.current.length === 0) return

    filaRef.current.sort((a, b) => (PRIORIDADE[a.tipo] ?? 99) - (PRIORIDADE[b.tipo] ?? 99))
    const proxima = filaRef.current.shift()
    if (!proxima) return
    emAndamentoRef.current = true

    // toast de curso_concluido espera o popup de certificado (se estiver aberto) fechar primeiro
    if (proxima.tipo === 'curso_concluido' && typeof window !== 'undefined') {
      let tentativas = 0
      while (sessionStorage.getItem('cert-popup-aberto') && tentativas < 25) {
        await new Promise(r => setTimeout(r, 400))
        tentativas++
      }
    }

    setAtual(proxima)
    setSaindo(false)
    if (sonsRef.current) tocarSom(proxima.tipo as TipoSom)

    fecharTimerRef.current = setTimeout(fecharAtual, DURACAO_MS[proxima.tipo] ?? 4000)
  }

  // polling — pausa quando a aba está oculta, retoma (com checagem imediata) ao voltar o foco
  useEffect(() => {
    if (!logado) return
    const supabase = criarClienteBrowser()

    async function checar() {
      const { data } = await supabase
        .from('notificacoes')
        .select('*')
        .eq('celebracao', true)
        .gt('criado_em', cursorRef.current)
        .order('criado_em', { ascending: true })

      if (data && data.length > 0) {
        cursorRef.current = data[data.length - 1].criado_em
        filaRef.current.push(...(data as Notificacao[]))
        avancar()
      }
    }

    function iniciar() {
      if (pollRef.current) return
      checar()
      pollRef.current = setInterval(checar, 8000)
    }
    function pausar() {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }
    function aoMudarVisibilidade() {
      if (document.hidden) pausar()
      else iniciar()
    }

    if (!document.hidden) iniciar()
    document.addEventListener('visibilitychange', aoMudarVisibilidade)
    return () => {
      pausar()
      document.removeEventListener('visibilitychange', aoMudarVisibilidade)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logado])

  if (!logado || !atual) return null

  if (atual.tipo === 'nivel_up') {
    return <ToastNivel n={atual} saindo={saindo} onFechar={fecharAtual} />
  }

  return (
    <div className="conquista-toast">
      {atual.tipo === 'avaliacao_aprovada' && <ToastAvaliacao n={atual} saindo={saindo} />}
      {atual.tipo === 'curso_concluido' && <ToastCurso n={atual} saindo={saindo} />}
      {atual.tipo === 'streak' && <ToastStreak key={atual.id} n={atual} saindo={saindo} />}
      {atual.tipo === 'primeira_aula' && <ToastPrimeiraAula n={atual} saindo={saindo} />}
    </div>
  )
}

function ToastNivel({ n, saindo, onFechar }: { n: Notificacao; saindo: boolean; onFechar: () => void }) {
  const ordemNova = num(n.dados?.nivel_ordem)
  const ordemAntiga = num(n.dados?.nivel_ordem_anterior)
  const xpTotal = num(n.dados?.xp_total)
  const nome = str(n.dados?.nivel_nome) ?? n.destaque ?? ''
  const imgNova = ordemNova ? NIVEL_IMG[ordemNova] : undefined
  const imgAntiga = ordemAntiga ? NIVEL_IMG[ordemAntiga] : undefined

  return (
    <div
      className={`conquista-toast ct-overlay${saindo ? ' ct-saindo' : ''}`}
      role="dialog" aria-modal="true" aria-label={`Você alcançou o nível ${nome}`}
      onClick={onFechar}
    >
      <div className="ct-particulas" aria-hidden="true">
        {Array.from({ length: 22 }).map((_, i) => (
          <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 8) * 0.18}s` }} />
        ))}
      </div>
      <div className="ct-nivel-selos">
        {imgAntiga && <img src={imgAntiga} alt="" className="ct-selo-antigo" />}
        {imgNova
          ? <img src={imgNova} alt="" className="ct-selo-novo" />
          : <div className="ct-selo-novo ct-selo-fallback"><SeloNivel nivel={ordemNova} size={120} /></div>}
      </div>
      <p className="ct-nivel-rotulo">Você alcançou o nível</p>
      <h2 className="ct-nivel-nome">{nome}</h2>
      {xpTotal !== undefined && <p className="ct-nivel-xp num">{xpTotal.toLocaleString('pt-BR')} XP</p>}
      <p className="ct-nivel-dica">Toque em qualquer lugar pra continuar</p>
    </div>
  )
}

function ToastAvaliacao({ n, saindo }: { n: Notificacao; saindo: boolean }) {
  const nota = num(n.dados?.nota)
  const titulo = str(n.dados?.titulo) ?? n.destaque ?? ''
  return (
    <div className={`ct-toast ct-avaliacao${saindo ? ' ct-saindo' : ''}`} role="status">
      <span className="ct-toast-ico"><Trofeu size={26} /></span>
      <div className="ct-toast-corpo">
        <b>Aprovado!</b>
        <span>{titulo}</span>
        {nota !== undefined && <span className="ct-toast-nota num">Nota {nota.toFixed(1).replace('.', ',')}</span>}
      </div>
    </div>
  )
}

function ToastCurso({ n, saindo }: { n: Notificacao; saindo: boolean }) {
  const capa = str(n.dados?.capa_url)
  const titulo = str(n.dados?.curso_titulo) ?? n.destaque ?? ''
  return (
    <div className={`ct-toast ct-curso${saindo ? ' ct-saindo' : ''}`} role="status">
      {capa && <img src={capa} alt="" className="ct-curso-capa" />}
      <span className="ct-toast-ico"><Certificado size={26} /></span>
      <div className="ct-toast-corpo">
        <b>Curso concluído!</b>
        <span>{titulo}</span>
      </div>
    </div>
  )
}

function ToastStreak({ n, saindo }: { n: Notificacao; saindo: boolean }) {
  const alvo = num(n.dados?.streak_dias) ?? 0
  const [contagem, setContagem] = useState(0)

  useEffect(() => {
    setContagem(0)
    if (alvo <= 0) return
    let atual = 0
    const passo = Math.max(1, Math.ceil(alvo / 20))
    const id = setInterval(() => {
      atual = Math.min(alvo, atual + passo)
      setContagem(atual)
      if (atual >= alvo) clearInterval(id)
    }, 45)
    return () => clearInterval(id)
  }, [alvo])

  return (
    <div className={`ct-toast ct-streak${saindo ? ' ct-saindo' : ''}`} role="status">
      <span className="ct-toast-ico ct-streak-fogo"><FogoStreak size={26} /></span>
      <div className="ct-toast-corpo">
        <b>Sequência de {contagem} {contagem === 1 ? 'dia' : 'dias'}!</b>
        <span>Continue estudando todo dia</span>
      </div>
    </div>
  )
}

function ToastPrimeiraAula({ saindo }: { n: Notificacao; saindo: boolean }) {
  return (
    <div className={`ct-toast ct-primeira${saindo ? ' ct-saindo' : ''}`} role="status">
      <span className="ct-toast-ico"><XP size={26} /></span>
      <div className="ct-toast-corpo">
        <b>Sua jornada começou!</b>
        <span>Primeira aula concluída — continue assim</span>
      </div>
    </div>
  )
}

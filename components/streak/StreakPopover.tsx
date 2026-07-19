// components/streak/StreakPopover.tsx
// Pílula da chaminha no header + popover com calendário de acesso.
// sequenciaDias/recorde/protecoesRestantes vêm como prop inicial de
// lib/queries/nav.ts (registrar_acesso_diario, chamada uma vez por render
// da página) — evita um fetch extra só pra abrir com o número certo. O
// calendário em si (obter_streak) é buscado no client, por mês, só quando
// o popover abre — não dá pra saber de antemão quais meses o usuário vai
// navegar.
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { criarClienteBrowser } from '@/lib/supabase/client'
import { FogoStreak } from '@/components/Emblemas'
import { IconeChevronLeft, IconeChevronRight, IconeShield } from '@/components/Icones'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS_SEMANA = [
  { rotulo: 'D', nome: 'Domingo' }, { rotulo: 'S', nome: 'Segunda' }, { rotulo: 'T', nome: 'Terça' },
  { rotulo: 'Q', nome: 'Quarta' }, { rotulo: 'Q', nome: 'Quinta' }, { rotulo: 'S', nome: 'Sexta' }, { rotulo: 'S', nome: 'Sábado' },
]

type DiaStreak = { dia: string; protegido: boolean }
type DadosMes = { protecoesRestantes: number; dias: DiaStreak[] }
type CacheMes = DadosMes | 'erro' | undefined

const pad2 = (n: number) => String(n).padStart(2, '0')

function gerarGrade(mes: number, ano: number): (number | null)[] {
  const offset = new Date(ano, mes - 1, 1).getDay()
  const diasNoMes = new Date(ano, mes, 0).getDate()
  const celulas: (number | null)[] = Array(offset).fill(null)
  for (let d = 1; d <= diasNoMes; d++) celulas.push(d)
  while (celulas.length % 7 !== 0) celulas.push(null)
  return celulas
}

export default function StreakPopover({
  sequenciaDias, recorde, protecoesRestantes,
}: { sequenciaDias: number; recorde: number; protecoesRestantes: number }) {
  const [aberto, setAberto] = useState(false)
  const hojeInicial = new Date()
  const [nav, setNav] = useState({ mes: hojeInicial.getMonth() + 1, ano: hojeInicial.getFullYear() })
  const [cache, setCache] = useState<Record<string, CacheMes>>({})
  const wrapRef = useRef<HTMLDivElement>(null)
  const gatilhoRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  const chave = `${nav.ano}-${nav.mes}`

  const buscarMes = useCallback(async (mes: number, ano: number) => {
    const chaveAlvo = `${ano}-${mes}`
    try {
      const supabase = criarClienteBrowser()
      const { data, error } = await supabase.rpc('obter_streak', { p_mes: mes, p_ano: ano })
      if (error || !data) {
        setCache(c => ({ ...c, [chaveAlvo]: 'erro' }))
        return
      }
      setCache(c => ({
        ...c,
        [chaveAlvo]: {
          protecoesRestantes: data.protecoes_restantes ?? 0,
          dias: Array.isArray(data.dias) ? data.dias : [],
        },
      }))
    } catch {
      setCache(c => ({ ...c, [chaveAlvo]: 'erro' }))
    }
  }, [])

  useEffect(() => {
    if (!aberto) return
    if (cache[chave] === undefined) buscarMes(nav.mes, nav.ano)
  }, [aberto, chave, nav, cache, buscarMes])

  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setAberto(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setAberto(false); gatilhoRef.current?.focus() } }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc) }
  }, [aberto])

  useEffect(() => {
    if (aberto) popRef.current?.focus()
  }, [aberto])

  function navegarMes(delta: number) {
    setNav(({ mes, ano }) => {
      const total = mes - 1 + delta
      const novoAno = ano + Math.floor(total / 12)
      const novoMes = ((total % 12) + 12) % 12 + 1
      return { mes: novoMes, ano: novoAno }
    })
  }

  function fechar() {
    setAberto(false)
    gatilhoRef.current?.focus()
  }

  const dadosMes = cache[chave]
  const carregandoMes = aberto && dadosMes === undefined
  const erroMes = dadosMes === 'erro'
  const diasMapa = new Map<number, boolean>()
  if (dadosMes && dadosMes !== 'erro') {
    for (const d of dadosMes.dias) diasMapa.set(Number(d.dia.slice(8, 10)), d.protegido)
  }

  const hoje = new Date()
  const hojeStr = `${hoje.getFullYear()}-${pad2(hoje.getMonth() + 1)}-${pad2(hoje.getDate())}`
  const grade = gerarGrade(nav.mes, nav.ano)

  // proteções restantes do MÊS CORRENTE (não do mês navegado) — só o popover
  // aberto no mês atual reflete cache; fora dele usa a prop inicial.
  const ehMesCorrente = nav.mes === hoje.getMonth() + 1 && nav.ano === hoje.getFullYear()
  const protecoesExibidas = ehMesCorrente && dadosMes && dadosMes !== 'erro' ? dadosMes.protecoesRestantes : protecoesRestantes

  return (
    <div className="np-fogo-wrap" ref={wrapRef}>
      <button
        ref={gatilhoRef}
        className="np-pilula fogo"
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-label={`Sequência de ${sequenciaDias} ${sequenciaDias === 1 ? 'dia' : 'dias'}, abrir calendário de acessos`}
        onClick={() => setAberto(v => !v)}
      >
        <FogoStreak size={14} />
        <b className="num">{sequenciaDias} {sequenciaDias === 1 ? 'dia' : 'dias'}</b>
      </button>

      {aberto && (
        <>
          <div className="streak-pop-backdrop" onClick={fechar} />
          <div className="streak-pop" role="dialog" aria-label="Sua sequência de acessos" tabIndex={-1} ref={popRef}>
            <button className="streak-pop-fechar" aria-label="Fechar" onClick={fechar}>×</button>

            <p className="streak-pop-texto">
              A consistência é o que separa quem estuda de quem se transforma. Cada dia de
              acesso fortalece sua sequência e sua sequência conta pontos na sua jornada.
            </p>

            <div className="streak-pop-recorde">
              <span>Seu recorde</span>
              <b className="num">{recorde} {recorde === 1 ? 'dia' : 'dias'}</b>
            </div>

            <div className="streak-pop-protecoes">
              <div className="streak-pop-protecoes-cab">
                <span>Proteções do mês</span>
                <span className="streak-pop-escudos" aria-hidden="true">
                  {[0, 1].map(i => (
                    <IconeShield key={i} size={16} className={i < protecoesExibidas ? 'ativo' : 'usado'} />
                  ))}
                </span>
              </div>
              <p className="streak-pop-legenda">Proteções cobrem um dia de falta automaticamente.</p>
            </div>

            <div className="streak-pop-mescab">
              <button aria-label="Mês anterior" onClick={() => navegarMes(-1)}><IconeChevronLeft size={16} /></button>
              <b className="num">{MESES[nav.mes - 1]} {nav.ano}</b>
              <button aria-label="Próximo mês" onClick={() => navegarMes(1)}><IconeChevronRight size={16} /></button>
            </div>

            <div className="streak-pop-semana" aria-hidden="true">
              {DIAS_SEMANA.map((d, i) => <span key={i} title={d.nome}>{d.rotulo}</span>)}
            </div>

            {carregandoMes ? (
              <div className="streak-pop-grade streak-pop-skeleton" aria-hidden="true">
                {Array.from({ length: 35 }).map((_, i) => <span key={i} />)}
              </div>
            ) : (
              <div className="streak-pop-grade">
                {grade.map((dia, i) => {
                  if (dia === null) return <span key={i} className="streak-dia vazio" />
                  const cellStr = `${nav.ano}-${pad2(nav.mes)}-${pad2(dia)}`
                  const acessado = !erroMes && diasMapa.has(dia)
                  const protegido = acessado && diasMapa.get(dia)
                  const futuro = cellStr > hojeStr
                  const ehHoje = cellStr === hojeStr
                  return (
                    <span
                      key={i}
                      className={`streak-dia${ehHoje ? ' hoje' : ''}${futuro ? ' futuro' : ''}`}
                      title={`${dia} de ${MESES[nav.mes - 1].toLowerCase()}${acessado ? (protegido ? ', dia protegido' : ', acesso registrado') : ''}`}
                    >
                      {acessado ? (
                        <span className="streak-dia-chama">
                          <FogoStreak size={13} />
                          {protegido && <span className="streak-dia-escudo"><IconeShield size={8} /></span>}
                        </span>
                      ) : (
                        <span className="streak-dia-num">{dia}</span>
                      )}
                    </span>
                  )
                })}
              </div>
            )}

            {erroMes && <p className="streak-pop-erro">Não foi possível carregar este mês agora.</p>}
          </div>
        </>
      )}
    </div>
  )
}

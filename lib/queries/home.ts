// lib/queries/home.ts
// O dashboard: junta perfil, progresso de cursos, jornada real (via
// lib/queries/jornada.ts), agenda real e comunidade numa passada só.
// Nenhum dado inventado — o que não existe ainda mostra estado vazio.
import { criarClienteServidor } from '@/lib/supabase/server'
import { carregarResumoAcesso } from '@/lib/acesso/verificar'
import { carregarJornada } from '@/lib/queries/jornada'
import { getPlanoVivo } from '@/lib/queries/meuPlano'
import { carregarAgenda } from '@/lib/queries/agenda'
import { tituloHeroDoDia } from '@/lib/titulosHero'

export type CursoCard = {
  slug: string
  titulo: string
  capa_url: string | null  // já resolvido pra capa_vertical_url (fallback capa_url), card é formato pôster (3/4)
  capa_horizontal_url: string | null  // cru, SEM fallback pra capa_url. O hero cai pra aurora quando é null, não pra capa_url
  aulas: number
  progressoPct: number      // 0 = ainda não começou
  concluidasPct: number     // idem, para a barra
  novo: boolean             // publicado nos últimos 30 dias e sem progresso
  motivo: string            // rótulo do badge ("Continuar" | "Começar" | "Próximo na sua formação" | "Descubra" ...)
  href: string              // link exato (pode apontar direto pra próxima aula)
}

export type EtapaTrilho = {
  numero: number
  nome: string
  estado: 'feita' | 'atual' | 'a-seguir'
  detalhe: string           // "Concluído" | "6 de 9 cursos" | "A seguir"
}

export type MovItem = {
  iniciais: string
  titulo: string
  detalhe: string
  quando: string
  link: string
}

export type DadosHome = {
  logado: boolean
  // nav / popover
  nome: string
  primeiroNome: string
  iniciais: string
  moedas: number
  // hero
  saudacao: string             // "Bom dia" | "Boa tarde" | "Boa noite"
  dataHoje: string
  tituloHero: string           // título rotativo do dia (determinístico por usuário+dia)
  heroCapaUrl: string | null   // capa_horizontal_url do curso em destaque no hero (null = aurora)
  continuarCurso: CursoCard | null
  missaoAtualNome: string
  missaoAtualPct: number
  proximaAulaNome: string | null
  // indicadores
  metaDias: string             // "4 de 5 dias"
  proximaConquista: string
  proximaConquistaFalta: string
  eventoHoje: { titulo: string; hora: string } | null
  // jornada — sempre a trilha protagonista (mais atividade recente; default = Formação)
  trilho: EtapaTrilho[]
  evolucaoTitulo: string
  evolucaoDescricao: string | null
  // vitrines
  vitrine: CursoCard[]         // régua de recomendação, até 3
  /** Convite para a anamnese, só para quem ainda não tem rota. null = tem plano. */
  conviteRota: typeof CONVITE_ROTA | null
  // ao vivo + comunidade
  eventoLive: {
    titulo: string; descricao: string | null
    apresentador: string; apresentadorIniciais: string; horaRotulo: string
  } | null
  movimento: MovItem[]
  // tour guiado de boas-vindas
  mostrarTourInicial: boolean       // true só na primeira visita (perfis.tour_visto_em IS NULL)
  tourPrimeiraAulaHref: string      // alvo do CTA final do tour — próxima aula pendente da Formação (ou /jornada)
  // boas-vindas do aluno que veio de outra plataforma (importação em lote):
  // aparece uma vez só, antes do tour, e explica que o acesso dele foi
  // transferido. Null = não é aluno migrado (ou já viu).
  boasVindasMigrado: { plataforma: string } | null
}

const TZ = 'America/Sao_Paulo'
const fmtHora = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
const fmtDataLonga = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'long', day: '2-digit', month: 'long' })
const fmtDiaCurto = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit' })
const fmtDiaISO = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const fmtDiaSemanaISO = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }) // "Mon".."Sun"
const META_DIAS_SEMANA = 5

function iniciaisDe(nome: string) {
  return nome.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

/**
 * O convite para montar a rota, quando o aluno ainda não fez a anamnese.
 *
 * Texto aqui e não no componente pelo mesmo motivo do resto: quem decide o que
 * a seção oferece é a consulta, e o componente só desenha. Se a decisão de
 * mostrar migrar para outro lugar um dia, o texto vai junto.
 */
export const CONVITE_ROTA = {
  titulo: 'Monte a sua rota',
  // ⚠️ Sem número de perguntas. A anamnese é adaptativa — ela se estende
  // conforme as respostas (ver 20260724_anamnese_expansao_continua.sql), então
  // qualquer quantidade escrita aqui vira promessa quebrada no meio do caminho
  // para quem receber mais perguntas do que o card anunciou.
  texto: 'Conte onde você quer chegar e a plataforma passa a recomendar pelo seu objetivo, não pelo que é mais recente.',
  ctaRotulo: 'Responder agora',
  href: '/anamnese',
} as const

/** Semana ISO aproximada — só precisa mudar uma vez por semana e ser estável. */
function semanaDoAno(): number {
  const agora = new Date()
  const inicio = Date.UTC(agora.getUTCFullYear(), 0, 1)
  return Math.floor((agora.getTime() - inicio) / (7 * 864e5))
}

/** Hash pobre e suficiente: só serve para dar um deslocamento por aluno. */
function somaDosCodigos(texto: string): number {
  let soma = 0
  for (let i = 0; i < texto.length; i++) soma = (soma + texto.charCodeAt(i)) % 1_000_003
  return soma
}
/**
 * A saudação do topo da home.
 *
 * ⚠️ A MADRUGADA NÃO É MANHÃ. A faixa era `h < 12 → 'Bom dia'`, o que fazia o
 * aluno que abre a plataforma às 00h21 ser recebido com "bom dia" — reportado
 * em 11/08/2026, e o tipo de detalhe que faz a tela parecer que não sabe que
 * horas são. Quem entra de madrugada não começou o dia: ainda não dormiu.
 *
 * As faixas: 5h–11h manhã, 12h–17h tarde, 18h–4h noite.
 *
 * `hourCycle: 'h23'` em vez de `hour12: false`: com `hour12: false` algumas
 * versões do ICU devolvem **24** para a meia-noite em vez de 0, e 24 cairia na
 * faixa da noite por acidente — certo pelo motivo errado, e quebrado no dia em
 * que o runtime mudasse.
 */
function saudacaoPorHora(): string {
  const h = Number(new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23' }).format(new Date()))
  if (h < 5) return 'Boa noite'
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}
function tempoRel(iso: string) {
  const min = Math.floor((Date.now() - +new Date(iso)) / 60000)
  if (min < 60) return min <= 1 ? 'agora' : `há ${min} min`
  const hh = Math.floor(min / 60)
  if (hh < 24) return `há ${hh}h`
  const d = Math.floor(hh / 24)
  return d === 1 ? 'ontem' : `há ${d} dias`
}
function extrairSlug(href: string | null): string | null {
  if (!href) return null
  const m = href.match(/^\/curso\/([^/]+)/)
  return m ? m[1] : null
}

export async function carregarHome(): Promise<DadosHome | null> {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return null
  const uid = auth.user.id

  const [
    { data: perfil },
    { data: cursosRaw },
    { data: modulosRaw },
    { data: cursoTrilhaRaw },
    { data: postsRaw },
    { data: saldo },
    { data: statusNivel },
    jornada,
    agenda,
    plano,
  ] = await Promise.all([
    supabase.from('perfis').select('nome, tour_visto_em, migrado_de, boas_vindas_migrado_em').eq('id', uid).single(),
    supabase.from('cursos').select('id, slug, titulo, capa_url, capa_vertical_url, capa_horizontal_url, atualizado_em').eq('publicado', true).order('atualizado_em', { ascending: false }),
    supabase.from('modulos').select('id, curso_id, ordem').order('ordem', { ascending: true }),
    // Vínculo curso→trilha, para a afinidade do último nível da régua. A view
    // é DISTINCT ON (curso_id), ou seja, no máximo UMA trilha por curso — o
    // suficiente aqui: afinidade é sinal fraco de propósito, e um curso que
    // esteja em duas trilhas não muda a recomendação a ponto de justificar ler
    // as tabelas base.
    supabase.from('curso_trilha').select('curso_id, trilha_slug'),
    supabase.from('comunidade_posts').select('*').order('criado_em', { ascending: false }).limit(3),
    supabase.from('gamificacao_saldo').select('xp_total, moedas_total').eq('usuario_id', uid).maybeSingle(),
    // nível real (XP + requisito composto) — nunca derivar localmente só por
    // XP, ver gam_status_proximo_nivel().
    supabase.rpc('gam_status_proximo_nivel'),
    carregarJornada(),
    carregarAgenda(),
    // A rota prescrita pela anamnese. Entra aqui porque a régua de recomendação
    // abaixo passou a consultá-la — ver o bloco dela para o porquê.
    getPlanoVivo(),
  ])
  if (!perfil) return null

  const { data: aulasRaw } = await supabase.from('aulas').select('id, modulo_id, ordem').order('ordem', { ascending: true })
  const { data: progresso } = await supabase.from('aula_progresso').select('aula_id, concluida, concluida_em').eq('usuario_id', uid).eq('concluida', true)
  const { data: tentativas } = await supabase.from('avaliacao_tentativas').select('criada_em').eq('usuario_id', uid)

  // ---------- aulas ordenadas por curso (modulo.ordem, aula.ordem) ----------
  const modulosPorCurso = new Map<string, string[]>()
  for (const m of modulosRaw ?? []) {
    if (!modulosPorCurso.has(m.curso_id)) modulosPorCurso.set(m.curso_id, [])
    modulosPorCurso.get(m.curso_id)!.push(m.id)
  }
  const aulasPorModulo = new Map<string, string[]>()
  for (const a of aulasRaw ?? []) {
    if (!aulasPorModulo.has(a.modulo_id)) aulasPorModulo.set(a.modulo_id, [])
    aulasPorModulo.get(a.modulo_id)!.push(a.id)
  }
  const aulasPorCurso = new Map<string, string[]>() // curso_id -> [aula_id] ordenadas
  for (const [cursoId, moduloIds] of modulosPorCurso) {
    const aulaIds: string[] = []
    for (const mid of moduloIds) aulaIds.push(...(aulasPorModulo.get(mid) ?? []))
    aulasPorCurso.set(cursoId, aulaIds)
  }
  const concluidas = new Set((progresso ?? []).map(p => p.aula_id))

  const TRINTA_DIAS = 30 * 864e5
  function montaCard(c: any): CursoCard {
    const aulasIds = aulasPorCurso.get(c.id) ?? []
    const feitas = aulasIds.filter(id => concluidas.has(id)).length
    const pct = aulasIds.length ? Math.round((feitas / aulasIds.length) * 100) : 0
    const recente = c.atualizado_em && (Date.now() - +new Date(c.atualizado_em) < TRINTA_DIAS)
    const emAndamento = pct > 0 && pct < 100
    const proximaAula = aulasIds.find(id => !concluidas.has(id))
    return {
      slug: c.slug, titulo: c.titulo, capa_url: c.capa_vertical_url ?? c.capa_url,
      capa_horizontal_url: c.capa_horizontal_url,
      aulas: aulasIds.length,
      progressoPct: pct, concluidasPct: pct,
      novo: pct === 0 && !!recente,
      motivo: emAndamento ? 'Continuar' : 'Começar',
      href: proximaAula ? `/curso/${c.slug}/aula/${proximaAula}` : `/curso/${c.slug}`,
    }
  }

  const cursos = (cursosRaw ?? []).map(montaCard)
  const cursoPorSlug = new Map(cursos.map(c => [c.slug, c]))

  // slug do curso -> trilhas dele, para a afinidade da régua.
  const slugPorId = new Map((cursosRaw ?? []).map(c => [c.id, c.slug]))
  const trilhasPorCursoSlug = new Map<string, string[]>()
  for (const ct of cursoTrilhaRaw ?? []) {
    const slug = slugPorId.get(ct.curso_id)
    if (!slug || !ct.trilha_slug) continue
    if (!trilhasPorCursoSlug.has(slug)) trilhasPorCursoSlug.set(slug, [])
    trilhasPorCursoSlug.get(slug)!.push(ct.trilha_slug)
  }

  // curso a continuar: o de maior progresso ainda não terminado
  const emAndamento = cursos.filter(c => c.progressoPct > 0 && c.progressoPct < 100)
    .sort((a, b) => b.progressoPct - a.progressoPct)
  const continuarCurso = emAndamento[0] ? { ...emAndamento[0], motivo: 'Continue de onde parou' } : null

  // ══════════════════════════════════════════════════════
  // A RÉGUA DE RECOMENDAÇÃO — "Escolhido para o seu momento"
  //
  // Três vagas. O que decide cada uma está abaixo, em ordem.
  //
  // ── O QUE ESTAVA ERRADO (11/08/2026) ──
  //
  // A régua não era fixa: ela DEGRADAVA. Os cinco primeiros níveis dependem de
  // progresso, e o último preenchia o que sobrasse com "os cursos mais
  // recentes" — a mesma lista para toda a base. Quem tinha pouco progresso caía
  // quase inteiro nesse último nível, ou seja, o aluno NOVO — justamente quem
  // mais precisa de direção — recebia a vitrine mais genérica da plataforma.
  //
  // ── AS QUATRO DECISÕES ──
  //
  // 1. **O plano da anamnese entra em segundo lugar.** A plataforma faz a
  //    anamnese, o motor gera uma rota (`plano_trilhas`) e ela aparece na mesma
  //    tela, logo abaixo, em "Minha Rota do Perito". Esta seção ignorava isso
  //    completamente. Perguntar ao aluno o que ele quer e não usar a resposta na
  //    vitrine é o desperdício mais caro que havia aqui.
  //
  // 2. **No máximo DUAS vagas de continuidade.** A terceira é sempre descoberta.
  //    Sem esse teto, quem tem plano e cursos em andamento recebe três "continue
  //    de onde parou" e a seção vira lista de tarefas — deixa de mostrar que
  //    existe algo além do caminho já traçado, que é a função de uma vitrine.
  //
  // 3. **Quem não fez a anamnese recebe um convite, não enchimento.** Ver
  //    `conviteRota` no retorno: em vez da terceira vaga virar um curso
  //    aleatório, ela vira "monte sua rota". A seção passa a converter.
  //
  // 4. **O último nível deixou de ser global.** Primeiro afinidade (cursos das
  //    trilhas que a pessoa já tocou), depois rotação determinística por semana
  //    e por aluno. Dois alunos lado a lado deixam de ver a mesma coisa, e a
  //    vitrine muda sozinha toda semana sem ninguém publicar nada.
  // ══════════════════════════════════════════════════════
  const VAGAS = 3
  const MAX_CONTINUIDADE = 2

  const regua: CursoCard[] = []
  const usados = new Set<string>()
  let continuidade = 0

  /**
   * `ehContinuidade` marca o que é "siga o caminho que você já está". Só essas
   * contam para o teto — descoberta nunca é barrada, senão a decisão 2 se
   * inverte quando o aluno tem muito progresso.
   */
  function tenta(card: CursoCard | null | undefined, ehContinuidade = true) {
    if (!card || usados.has(card.slug) || regua.length >= VAGAS) return
    if (ehContinuidade && continuidade >= MAX_CONTINUIDADE) return
    regua.push(card); usados.add(card.slug)
    if (ehContinuidade) continuidade++
  }

  tenta(continuarCurso)

  // ── NÍVEL 2: a rota que o próprio aluno pediu ──
  //
  // `estacoes` vem ordenada e traz o estado calculado; a "atual" é a estação em
  // que ele está. `continuarHref` dela já aponta para o próximo curso pendente
  // daquela trilha, então não há prescrição recalculada aqui — só leitura, no
  // mesmo padrão de meuPlano.ts.
  if (plano.temPlano) {
    const estacaoAtual = plano.estacoes.find(e => e.estado === 'atual' && e.continuarHref)
    if (estacaoAtual?.continuarHref) {
      const slug = extrairSlug(estacaoAtual.continuarHref)
      const base = slug ? cursoPorSlug.get(slug) : null
      if (base) tenta({ ...base, motivo: 'Do seu plano', href: estacaoAtual.continuarHref })
    }
  }

  if (jornada.painelFormacao?.continuarHref) {
    const slug = extrairSlug(jornada.painelFormacao.continuarHref)
    const base = slug ? cursoPorSlug.get(slug) : null
    if (base) tenta({ ...base, motivo: 'Próximo na sua formação', href: jornada.painelFormacao.continuarHref })
  }
  if (jornada.painelProtagonista?.continuarHref) {
    const slug = extrairSlug(jornada.painelProtagonista.continuarHref)
    const base = slug ? cursoPorSlug.get(slug) : null
    if (base) tenta({ ...base, motivo: 'Continue sua especialização', href: jornada.painelProtagonista.continuarHref })
  }
  // território com progresso (trilha ativa) sempre disputa a vaga antes de
  // descoberta, mesmo antes do Selo de Excelência, quando painelProtagonista
  // (que só existe pós-formação) ainda é null. Sem isso, um território
  // começado (mas não terminado) era pulado direto pra "Descubra".
  if (regua.length < 3) {
    const territorioAtivo = jornada.territorios.find(t => t.progressoPct > 0 && t.progressoPct < 100 && t.proximoHref)
    if (territorioAtivo?.proximoHref) {
      const slug = extrairSlug(territorioAtivo.proximoHref)
      const base = slug ? cursoPorSlug.get(slug) : null
      if (base) tenta({ ...base, motivo: 'Próximo na sua trilha', href: territorioAtivo.proximoHref })
    }
  }
  if (regua.length < VAGAS) {
    const territorioAberto = jornada.territorios.find(t => t.progressoPct === 0 && t.proximoHref)
    if (territorioAberto?.proximoHref) {
      const slug = extrairSlug(territorioAberto.proximoHref)
      const base = slug ? cursoPorSlug.get(slug) : null
      // Descoberta: não conta para o teto de continuidade.
      if (base) tenta({ ...base, motivo: 'Descubra', href: territorioAberto.proximoHref }, false)
    }
  }

  // ── ÚLTIMO NÍVEL: afinidade, e só então rotação ──
  //
  // Era `for (const c of cursos) tenta(c)` — e `cursos` vem ordenado por
  // `atualizado_em`, então todo aluno sem progresso via exatamente os mesmos
  // três cards, para sempre. Era essa a queixa.
  const naoUsados = cursos.filter(c => !usados.has(c.slug) && c.progressoPct === 0)

  // Afinidade: trilhas onde a pessoa já encostou em algum curso. É o sinal mais
  // barato que existe aqui e não depende da anamnese — serve para quem nunca a
  // respondeu mas já começou alguma coisa.
  const trilhasTocadas = new Set(
    cursos.filter(c => c.progressoPct > 0).flatMap(c => trilhasPorCursoSlug.get(c.slug) ?? [])
  )
  const afins = trilhasTocadas.size
    ? naoUsados.filter(c => (trilhasPorCursoSlug.get(c.slug) ?? []).some(t => trilhasTocadas.has(t)))
    : []
  for (const c of afins) {
    if (regua.length >= VAGAS) break
    tenta({ ...c, motivo: 'Combina com o que você estuda' }, false)
  }

  // Rotação determinística: muda por SEMANA e por ALUNO. Determinística de
  // propósito — `Math.random()` daria um card diferente a cada F5, e a pessoa
  // nunca reencontraria o que viu há um minuto. Com semana + id, a vitrine é
  // estável enquanto a semana durar e diferente entre dois alunos lado a lado.
  const giro = semanaDoAno() + somaDosCodigos(uid)
  for (let i = 0; i < naoUsados.length && regua.length < VAGAS; i++) {
    const c = naoUsados[(giro + i) % naoUsados.length]
    tenta({ ...c, motivo: c.novo ? 'Novo na plataforma' : 'Para conhecer' }, false)
  }

  // Rede de segurança: base pequena, tudo já usado ou tudo com progresso. Aqui
  // repetir é melhor que devolver uma seção vazia.
  for (const c of cursos) {
    if (regua.length >= VAGAS) break
    tenta(c, false)
  }

  // ── O CONVITE ──
  //
  // Só quando não há plano E sobrou vaga depois de tudo acima. Um convite que
  // aparece para quem já tem rota seria ruído; e roubar a vaga de um curso de
  // quem tem catálogo cheio para pedir anamnese seria trocar conteúdo por
  // formulário. Quem decide o que fazer com ele é o componente.
  // ⚠️ **QUEM NÃO TEM A PLATAFORMA NÃO É APRESENTADO A ELA** (14/08/2026).
  //
  // O comprador de um curso avulso entra aqui para abrir UM curso. Tudo o que a
  // home oferece de onboarding fala do plano completo, e cada peça termina numa
  // tela de cadeado:
  //
  //   - o TOUR passa pela Jornada, pela Comunidade e pela Agenda, que ele não
  //     abre. Seis paradas em que a maioria é vitrine ensinam, na primeira
  //     visita, que a tela inteira é propaganda;
  //   - o CONVITE DA ROTA leva à cerimônia da Rota do Perito, que é do plano
  //     completo — clicar dá cadeado, e o primeiro clique de alguém que acabou
  //     de pagar não pode ser numa recusa;
  //   - as BOAS-VINDAS DE MIGRADO dizem que a conta foi transferida de outra
  //     plataforma, o que para ele não aconteceu.
  //
  // É a mesma decisão que o Nexus já tomou para o modo vitrine (ver
  // lib/acesso/__tests__/onboarding-vitrine.test.ts lá): a apresentação da casa
  // fica para quem vive nela; para quem comprou um cômodo, ela é uma lista do
  // que ele não tem.
  const acessoCompleto = (await carregarResumoAcesso()).completo

  const conviteRota = !acessoCompleto || plano.temPlano ? null : CONVITE_ROTA

  // ---------- hero: capa de fundo do curso em destaque ----------
  // Mesmo curso do "Você está em {curso}" do subtítulo. Conta nova sem
  // nenhum progresso (continuarCurso null) cai pro primeiro curso pendente
  // da Formação (painelFormacao.continuarHref já aponta pra ele nesse caso).
  const slugHeroFormacao = jornada.painelFormacao?.continuarHref ? extrairSlug(jornada.painelFormacao.continuarHref) : null
  const cursoHero = continuarCurso ?? (slugHeroFormacao ? cursoPorSlug.get(slugHeroFormacao) : null) ?? null
  const heroCapaUrl = cursoHero?.capa_horizontal_url ?? null

  // ---------- meta semanal: dias com atividade real nesta semana (seg-dom) ----------
  const diasAtividade = new Set<string>()
  for (const p of progresso ?? []) if (p.concluida_em) diasAtividade.add(fmtDiaISO.format(new Date(p.concluida_em)))
  for (const t of tentativas ?? []) if (t.criada_em) diasAtividade.add(fmtDiaISO.format(new Date(t.criada_em)))

  const hoje = new Date()
  const diaSemanaHoje = fmtDiaSemanaISO.format(hoje) // "Mon".."Sun"
  const ORDEM_SEMANA = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const offsetHoje = ORDEM_SEMANA.indexOf(diaSemanaHoje)
  let diasNaSemana = 0
  for (let i = 0; i <= offsetHoje; i++) {
    const d = new Date(hoje); d.setDate(d.getDate() - (offsetHoje - i))
    if (diasAtividade.has(fmtDiaISO.format(d))) diasNaSemana++
  }

  // ---------- próximo nível (pra "próxima conquista") ----------
  const xp = saldo?.xp_total ?? 0
  const statusDados = statusNivel as { proximo_nivel?: { nome: string; xp_necessario: number } | null } | null
  const proximoNivel = statusDados?.proximo_nivel ?? null
  const faltaXp = proximoNivel ? Math.max(0, proximoNivel.xp_necessario - xp) : 0

  // ---------- trilho: trilha protagonista (mais atividade recente; default = Formação) ----------
  const trilho: EtapaTrilho[] = jornada.trilhaProtagonistaHome.marcos.map((m, i) => ({
    numero: i + 1, nome: m.nome,
    estado: m.estado === 'feita' ? 'feita' : m.estado === 'atual' ? 'atual' : 'a-seguir',
    detalhe: m.estado === 'feita' ? 'Concluído' : m.estado === 'atual' ? 'Em andamento' : 'A seguir',
  }))

  // ---------- hero: barra da missão ----------
  let missaoAtualNome = jornada.trilhaPrincipalNome ?? 'Sua jornada'
  let missaoAtualPct = 0
  let proximaAulaNome: string | null = null
  if (jornada.painelFormacao) {
    const p = jornada.painelFormacao
    missaoAtualNome = `${p.nome} · ${p.marcosFeitos} de ${p.marcosTotal} etapas`
    missaoAtualPct = p.progressoPct
    proximaAulaNome = p.proximoTexto
  } else if (jornada.seloConquistado && jornada.painelProtagonista) {
    const p = jornada.painelProtagonista
    missaoAtualNome = p.nome
    missaoAtualPct = p.progressoPct
    proximaAulaNome = p.proximoTexto
  } else if (jornada.seloConquistado) {
    missaoAtualNome = 'Selo de Excelência conquistado'
    missaoAtualPct = 100
  }

  // ---------- comunidade: movimento ----------
  const movimento: MovItem[] = (postsRaw ?? []).map(p => ({
    iniciais: iniciaisDe(p.autor_nome ?? 'Perito'),
    titulo: p.tipo === 'vitoria'
      ? `${(p.autor_nome ?? 'Perito').split(' ')[0]} ${p.vitoria_rotulo ?? 'conquistou algo'}`
      : `${(p.autor_nome ?? 'Perito').split(' ')[0]} ${p.tipo === 'caso' ? 'compartilhou um caso' : 'abriu uma dúvida'}`,
    detalhe: p.titulo ?? p.vitoria_detalhe ?? '',
    quando: tempoRel(p.criado_em),
    link: '/comunidade',
  }))

  // ---------- agenda: hoje / ao vivo ----------
  const evAoVivo = agenda.aoVivo[0] ?? null
  const evProximo = agenda.proximos[0] ?? null
  const ehHoje = (iso: string) => new Date(iso).toDateString() === new Date().toDateString()
  const eventoHojeRaw = evAoVivo ?? (evProximo && ehHoje(evProximo.inicia_em) ? evProximo : null)
  const eventoLiveRaw = evAoVivo ?? evProximo

  return {
    logado: true,
    nome: perfil.nome ?? 'Perito',
    primeiroNome: (perfil.nome ?? 'Perito').split(' ')[0],
    iniciais: iniciaisDe(perfil.nome ?? 'PA'),
    moedas: saldo?.moedas_total ?? 0,
    saudacao: saudacaoPorHora(),
    dataHoje: fmtDataLonga.format(new Date()).replace(/^\w/, c => c.toUpperCase()),
    tituloHero: tituloHeroDoDia(uid, fmtDiaISO.format(new Date())),
    heroCapaUrl,
    continuarCurso,
    missaoAtualNome, missaoAtualPct, proximaAulaNome,
    metaDias: `${diasNaSemana} de ${META_DIAS_SEMANA} dias`,
    proximaConquista: proximoNivel?.nome ?? 'Nível máximo alcançado',
    proximaConquistaFalta: proximoNivel ? `Faltam ${faltaXp} XP` : 'Você chegou ao topo',
    eventoHoje: eventoHojeRaw
      ? { titulo: eventoHojeRaw.titulo, hora: fmtHora.format(new Date(eventoHojeRaw.inicia_em)).replace(':', 'h') }
      : null,
    trilho,
    evolucaoTitulo: jornada.trilhaProtagonistaHome.nome || 'Sua jornada',
    evolucaoDescricao: jornada.trilhaProtagonistaHome.descricao,
    vitrine: regua,
    conviteRota,
    eventoLive: eventoLiveRaw
      ? {
          titulo: eventoLiveRaw.titulo,
          descricao: eventoLiveRaw.descricao,
          apresentador: eventoLiveRaw.apresentador_nome ?? 'Especialista',
          apresentadorIniciais: iniciaisDe(eventoLiveRaw.apresentador_nome ?? 'PA'),
          horaRotulo: evAoVivo
            ? 'Ao vivo agora'
            : `${ehHoje(eventoLiveRaw.inicia_em) ? 'Hoje' : fmtDiaCurto.format(new Date(eventoLiveRaw.inicia_em))} · ${fmtHora.format(new Date(eventoLiveRaw.inicia_em)).replace(':', 'h')}`,
        }
      : null,
    movimento,
    mostrarTourInicial: acessoCompleto && !perfil.tour_visto_em,
    boasVindasMigrado:
      acessoCompleto && perfil.migrado_de && !perfil.boas_vindas_migrado_em
        ? { plataforma: perfil.migrado_de }
        : null,
    tourPrimeiraAulaHref: jornada.painelFormacao?.continuarHref ?? jornada.trilhaProtagonistaHome.continuarHref ?? '/jornada',
  }
}

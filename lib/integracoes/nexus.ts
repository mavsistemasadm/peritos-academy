// ══════════════════════════════════════════════════════════════════
// lib/integracoes/nexus.ts — AS DUAS CONVERSAS COM O NEXUS
//
// A Academy é outro projeto Supabase e não tem — nem deve ter — credencial do
// banco do Nexus. Fala por HTTP, como já faz em `/api/nexus-sso`.
//
//   ehAssinanteDoNexus     GET  /api/acesso/status   (x-acesso-key)
//   registrarContatoNoNexus POST /api/integracoes/sdr-contato (x-admin-key)
//
// ⚠️ AS DUAS FALHAM PARA LADOS OPOSTOS, e cada direção é uma decisão.
// ══════════════════════════════════════════════════════════════════

const NEXUS_URL = (process.env.NEXUS_URL?.trim() || 'https://www.nexuspericial.com.br').replace(/\/+$/, '')

const TEMPO_LIMITE_MS = 4000

async function comTempoLimite(url: string, init: RequestInit): Promise<Response | null> {
  const abortar = new AbortController()
  const relogio = setTimeout(() => abortar.abort(), TEMPO_LIMITE_MS)
  try {
    return await fetch(url, { ...init, signal: abortar.signal, cache: 'no-store' })
  } catch (e) {
    console.error('[nexus] rede falhou em', url, e)
    return null
  } finally {
    clearTimeout(relogio)
  }
}

// ─────────────────────────────────────────────────────────────
// 1. "Esta pessoa paga o Nexus?"
// ─────────────────────────────────────────────────────────────

/**
 * ⚠️ FALHA DIZENDO QUE SIM, e o motivo é a assimetria do erro.
 *
 * Esta resposta alimenta a porta da aula gratuita. Errar para "é assinante"
 * custa um convidado a mais numa sala que já ia acontecer. Errar para "não é"
 * diz "você já usou sua aula gratuita" para alguém que paga R$1.497,90 por ano
 * — na porta de um encontro que a assinatura dele inclui.
 *
 * É a mesma régua que o próprio `/api/acesso/status` do Nexus aplica aos cinco
 * produtos: indisponibilidade nossa não pode virar apagão para quem paga.
 *
 * ⚠️ CHAVE AUSENTE É A EXCEÇÃO, E FALHA PARA O OUTRO LADO.
 *
 * Env que ninguém criou na Vercel não é indisponibilidade: é configuração, e
 * ela não se conserta sozinha. Devolvendo `true` aqui, TODA pessoa vira
 * assinante e a porta da aula única nunca fecha para ninguém — a feature
 * nasceria morta e sem avisar, que é o preço que o batimento da Academy já
 * cobrou uma vez neste ecossistema.
 *
 * Fechar é seguro por causa de uma garantia que existe do outro lado: o cron
 * `academy-acesso` do Nexus dá concessão em `acessos_conteudo` a TODO
 * assinante válido, e essa concessão é verificada ANTES desta chamada, no
 * mesmo banco. Ou seja, o assinante em dia já passou pela primeira porta e
 * nunca chega aqui.
 *
 * ⚠️ Isso é um ACOPLAMENTO declarado: se o batimento for desligado
 * (`ACADEMY_BATIMENTO_ATIVO=0`) E a chave sumir ao mesmo tempo, um assinante
 * sem concessão levaria a recusa. Ele lê, na própria tela, que provavelmente
 * usou outro e-mail e que basta entrar pela conta — é recuperável, e é o
 * preço de a regra existir de verdade em vez de existir no papel.
 */
export async function ehAssinanteDoNexus(email: string): Promise<boolean> {
  const chave = process.env.NEXUS_ACESSO_KEY?.trim()
  if (!chave) {
    console.error(
      '[nexus] NEXUS_ACESSO_KEY ausente. A porta da aula unica passa a decidir ' +
      'so pelo acesso vigente nesta plataforma. Crie a env na Vercel com o ' +
      'mesmo valor de ACESSO_STATUS_KEY do Nexus.',
    )
    return false
  }

  const url = `${NEXUS_URL}/api/acesso/status?email=${encodeURIComponent(email)}&app=academy`
  // Daqui para baixo a chave existe, então tudo que der errado é o Nexus não
  // ter respondido — indisponibilidade, e não configuração. Aí sim vale a
  // regra de sempre: uma queda nossa não pode barrar quem paga.
  const r = await comTempoLimite(url, { headers: { 'x-acesso-key': chave } })
  if (!r) return true

  if (!r.ok) {
    console.error('[nexus] /api/acesso/status respondeu', r.status)
    return true
  }

  const corpo = (await r.json().catch(() => null)) as
    | { encontrado?: boolean; estado?: string; conclusivo?: boolean }
    | null
  if (!corpo) return true
  // O 503 de indisponibilidade do Nexus vem com `conclusivo: false`. Ele não
  // respondeu; não é um "não".
  if (corpo.conclusivo === false) return true

  // ⚠️ TRÊS RESPOSTAS SIGNIFICAM "NÃO ASSINA", e a primeira é a que engana.
  //
  // E-mail desconhecido NÃO volta 404: a rota responde 200 com
  // `encontrado: false` e `estado: 'liberado'` — porque "quem não é do Nexus
  // não é bloqueado pelo Nexus". Lendo só o estado, todo visitante do mundo
  // seria assinante, e a porta nunca fecharia para ninguém.
  if (corpo.encontrado === false) return false
  // Aluno da Academy (migrado ou de curso avulso): tem conta, não tem
  // assinatura. Ele pode ser da casa pelo outro lado — o acesso vigente na
  // própria Academy — e é lá que essa pergunta é feita.
  if (corpo.estado === 'sem_plano' || corpo.estado === 'prazo_encerrado') return false

  // Todo o resto — liberado, em_atraso, suspenso, encerrando, encerrado — é
  // gente que assinou, e nenhuma delas perde a aula por causa da régua de
  // cobrança: quem deve continua sendo cliente, e a sala é onde ele volta.
  return true
}

// ─────────────────────────────────────────────────────────────
// 2. "Guarda esta pessoa na base de marketing"
// ─────────────────────────────────────────────────────────────

/**
 * ⚠️ FALHA EM SILÊNCIO, e nunca desfaz a inscrição.
 *
 * A pessoa reservou lugar; dizer que não deu certo porque a base de marketing
 * de outro projeto não respondeu seria mentira na cara dela. Fica o log — a
 * mesma decisão que a própria server action já toma com `registrar_contato`.
 *
 * O que ela grava do lado de lá: contato com `origem: 'live-academy'`, que a
 * tabela `TAG_POR_ORIGEM` do Nexus traduz na tag `live-inscrito`. O nome da
 * tag NÃO viaja daqui: quem traduz fato em tag é o repositório dono da tabela
 * `tags`, senão um rename no painel quebra em silêncio um sistema que nem sabe
 * que está gravando.
 */
export async function registrarContatoNoNexus(entrada: {
  nome: string
  email: string
  whatsapp: string | null
  slugEvento: string
}): Promise<boolean> {
  const chave = process.env.NEXUS_CONTATO_KEY?.trim()
  if (!chave) {
    console.error('[nexus] NEXUS_CONTATO_KEY ausente: contato da live não foi para a base')
    return false
  }

  const r = await comTempoLimite(`${NEXUS_URL}/api/integracoes/sdr-contato`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': chave },
    body: JSON.stringify({
      email: entrada.email,
      nome: entrada.nome,
      telefone: entrada.whatsapp,
      origem: 'live-academy',
      consentimento: {
        canal: `live:${entrada.slugEvento}`,
        instancia: null,
        telefone: entrada.whatsapp,
        em: new Date().toISOString(),
      },
    }),
  })

  if (!r || !r.ok) {
    console.error('[nexus] contato da live não sincronizou:', r?.status ?? 'sem resposta')
    return false
  }
  return true
}

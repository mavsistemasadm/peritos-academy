// ══════════════════════════════════════════════════════
// /api/nexus-sso — ENTRAR NA ACADEMY PELO PAINEL DO NEXUS
//
// O aluno clica no cartão "Peritos Academy" no Nexus e cai aqui com o
// access_token dele na query. Esta rota valida esse token no Nexus, garante a
// conta daqui e devolve a pessoa logada, sem digitar senha nenhuma.
//
// É o mesmo contrato dos outros cinco produtos do ecossistema (Opera,
// Galácticos, Financeiro, MH Ponto, Ache um Perito): todos têm um
// `/api/nexus-sso` que fala com `https://www.nexuspericial.com.br/api/auth/token`.
// A Academy era a única sem — o cartão dela abria um modal pedindo email e
// senha da plataforma.
//
// ── O QUE ESTA ROTA NÃO FAZ ──
//
// **Ela não libera conteúdo.** Quem decide o que o aluno abre continua sendo o
// banco daqui: `tem_acesso_plataforma`, `tem_acesso_curso` e
// `tem_acesso_biblioteca`, alimentados por `assinaturas` e `acessos_conteudo`.
// Entrar pelo Nexus é uma porta, não uma chave — quem entrar sem direito vê a
// plataforma pedindo assinatura, exatamente como veria fazendo login normal.
//
// Confundir as duas coisas seria dar acesso ao acervo inteiro a qualquer conta
// do Nexus, e o sintoma só apareceria em quem abrisse um curso.
// ══════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { criarClienteServico } from '@/lib/supabase/servico'

const NEXUS_VALIDATE_URL = 'https://www.nexuspericial.com.br/api/auth/token'

// Como este produto se identifica para o Nexus. O Nexus tranca o SSO por
// aplicativo — um aluno migrado da Academy abre a Academy e o Ache um Perito, e
// não abre o Opera nem os Galácticos. Sem declarar `app`, os produtos são
// indistinguíveis do outro lado: todos batem na mesma rota com o mesmo corpo.
const APP = 'academy'

/**
 * A FLAG. `NEXUS_SSO_EMAILS` é a lista de quem pode entrar por aqui.
 *
 * Vazia ou ausente = ninguém. **Falha fechada de propósito**, e ao contrário do
 * resto do ecossistema: um SSO que libere por engano cria conta e sessão em
 * nome de outra pessoa, enquanto um SSO que recuse por engano manda o aluno
 * para a tela de login que ele já usava ontem. Os dois erros não custam a mesma
 * coisa.
 *
 * Existe porque a entrada está sendo aberta para UM email primeiro, antes de
 * valer para os 403 alunos. Quando for para todos, o caminho é remover a
 * chamada a `emailLiberado`, não encher a lista.
 *
 * Lida por chamada, e não no carregamento do módulo: rota da Vercel reaproveita
 * processo entre invocações, e uma env trocada no painel só valeria no próximo
 * cold start.
 */
function emailLiberado(email: string): boolean {
  const lista = (process.env.NEXUS_SSO_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  if (lista.length === 0) return false
  return lista.includes(email.trim().toLowerCase())
}

type UsuarioNexus = {
  id: string
  email: string
  nome?: string
  plano?: string
}

type RespostaNexus = {
  valid?: boolean
  user?: UsuarioNexus
  plano_tier?: string | null
  apps_liberados?: string[] | null
  error?: string
}

async function validarNoNexus(token: string): Promise<RespostaNexus | null> {
  try {
    const res = await fetch(NEXUS_VALIDATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, app: APP }),
      cache: 'no-store',
    })
    // 403 é resposta, não falha: o Nexus está dizendo que este tier não abre
    // este produto. O corpo traz o motivo e o texto da oferta.
    const corpo = (await res.json().catch(() => null)) as RespostaNexus | null
    if (!res.ok) {
      console.warn('[SSO-ACADEMY] Nexus recusou:', res.status, corpo?.error)
      return null
    }
    return corpo
  } catch (e) {
    console.error('[SSO-ACADEMY] Nexus indisponível:', e)
    return null
  }
}

/**
 * Acha o usuário no Auth daqui, paginando a lista inteira.
 *
 * `listUsers()` sem parâmetro devolve só os 50 primeiros. Com 403 alunos
 * migrados, quem estivesse fora dessa primeira página seria tratado como conta
 * nova, e o `createUser` seguinte falharia com "already registered" — o aluno
 * veria erro de login tendo conta.
 */
async function acharNoAuth(email: string) {
  const admin = criarClienteServico()
  const alvo = email.trim().toLowerCase()
  const perPage = 1000

  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) {
      console.error('[SSO-ACADEMY] erro ao listar Auth:', error.message)
      return null
    }
    const achado = data?.users?.find((u) => u.email?.toLowerCase() === alvo)
    if (achado) return achado
    if (!data?.users || data.users.length < perPage) return null
  }
  return null
}

/**
 * Garante a conta no Auth daqui.
 *
 * O perfil em `public.perfis` NÃO é criado aqui: quem cria é o trigger
 * `criar_perfil` em auth.users (ver a migração
 * 20260805_criar_perfil_suprime_boas_vindas_migrado). Duplicar o insert aqui
 * criaria uma segunda fonte da mesma escrita, e a do banco roda de qualquer
 * jeito.
 */
async function garantirConta(email: string, nome: string) {
  const existente = await acharNoAuth(email)
  if (existente) return existente

  const admin = criarClienteServico()
  const { data: criado, error } = await admin.auth.admin.createUser({
    email,
    // Senha aleatória que ninguém conhece, de propósito: a entrada desta conta
    // é o SSO. Se a pessoa quiser senha própria, o caminho é /primeiro-acesso,
    // que é o mesmo do aluno migrado da Ensinio.
    password: crypto.randomUUID(),
    email_confirm: true,
    user_metadata: { nome, origem: 'nexus_sso' },
  })
  if (!error && criado?.user) return criado.user

  // Criação falhou. Pode ser corrida entre duas abas, ou uma listagem que
  // falhou no meio. Tenta achar de novo antes de desistir.
  console.error('[SSO-ACADEMY] erro ao criar conta:', error?.message)
  return await acharNoAuth(email)
}

/**
 * Marca no perfil que esta pessoa é assinante do Nexus.
 *
 * `perfis.nexus_status` existe desde 20260805_nexus_status_admin, onde está
 * escrito: «Enquanto não existe integração de assinatura entre Nexus e Academy,
 * esta é a única forma de marcar alguém como assinante. Quando a integração
 * chegar, ela passa a escrever no mesmo campo». Esta rota é essa integração
 * chegando.
 *
 * Três limites, todos de propósito:
 *
 * - **Não concede acesso.** `nexus_status` não entra em `tem_acesso_plataforma`
 *   nem em `tem_acesso_curso`. É rótulo para o admin e para a régua de
 *   comunicação, não permissão.
 * - **Só sobe, nunca desce.** Um SSO não sabe que alguém cancelou; ele só vê
 *   quem apareceu. Escrever 'cancelled' daqui apagaria a marcação feita à mão
 *   pelo admin (adm_definir_nexus_status) na primeira vez que a pessoa entrasse.
 * - **Aluno da Academy não é assinante do Nexus.** O tier `academy` é o do
 *   aluno migrado, que tem login no Nexus e não assinou o Nexus.
 */
async function marcarAssinanteNexus(usuarioId: string, planoTier: string | null | undefined) {
  const tier = (planoTier || '').trim().toLowerCase()
  if (!tier || tier === 'academy') return

  const admin = criarClienteServico()
  const { data: perfil } = await admin
    .from('perfis')
    .select('nexus_status')
    .eq('id', usuarioId)
    .maybeSingle()

  // Só escreve quando ninguém disse nada ainda. Ver "só sobe, nunca desce".
  const atual = perfil?.nexus_status ?? null
  if (atual && atual !== 'none') return

  const { error } = await admin
    .from('perfis')
    .update({ nexus_status: 'active', nexus_assinado_em: new Date().toISOString() })
    .eq('id', usuarioId)

  // Falha aqui não pode barrar o login: é rótulo, e a pessoa veio para entrar.
  if (error) console.error('[SSO-ACADEMY] erro ao marcar nexus_status:', error.message)
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const paraLogin = (erro: string) =>
    NextResponse.redirect(new URL(`/login?sso=${erro}`, req.nextUrl.origin))

  if (!token) return paraLogin('token_ausente')

  const resposta = await validarNoNexus(token)
  const usuario = resposta?.user
  if (!resposta?.valid || !usuario?.email) return paraLogin('token_invalido')

  // A flag. Enquanto ela existir, o resto da base continua entrando por
  // email e senha, exatamente como entrava ontem.
  if (!emailLiberado(usuario.email)) {
    console.log('[SSO-ACADEMY] fora da lista, seguindo para login manual:', usuario.email)
    return paraLogin('indisponivel')
  }

  const conta = await garantirConta(usuario.email, usuario.nome || '')
  if (!conta?.id) return paraLogin('conta_falhou')

  await marcarAssinanteNexus(conta.id, resposta.plano_tier)

  // ══════════════════════════════════════════════════════
  // A SESSÃO, E POR QUE ELA É FECHADA AQUI DENTRO.
  //
  // O caminho óbvio seria gerar o magic link e redirecionar o navegador para
  // ele, que é o que o Ache um Perito faz. Aqui isso NÃO funcionaria: o link
  // do Supabase devolve os tokens no fragmento da URL, e quem consome o
  // fragmento é o cliente de browser — que nesta plataforma só é instanciado
  // dentro do submit do formulário de login (ver components/LoginContent). O
  // aluno cairia numa tela de login já autenticado, olhando para dois campos
  // vazios.
  //
  // Então o `verifyOtp` roda no servidor, com o cliente de cookies do
  // @supabase/ssr: a sessão vira cookie na própria resposta e o middleware já
  // enxerga a pessoa logada no redirect seguinte. Nada de token na barra de
  // endereço, nada de página intermediária.
  // ══════════════════════════════════════════════════════
  const admin = criarClienteServico()
  const { data: link, error: erroLink } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: usuario.email,
  })

  const hash = link?.properties?.hashed_token
  if (erroLink || !hash) {
    console.error('[SSO-ACADEMY] erro ao gerar link:', erroLink?.message)
    return paraLogin('link_falhou')
  }

  // ⚠️ A RESPOSTA É CRIADA ANTES DA SESSÃO, e a ordem não é estilo.
  //
  // `NextResponse.redirect()` devolve um objeto NOVO: cookie gravado depois,
  // por outro caminho, não viaja nele. O aluno seria redirecionado para a home
  // sem sessão nenhuma e o middleware o mandaria para /login — um SSO que
  // "funciona" e devolve a tela de login, sem erro em lugar nenhum.
  //
  // Por isso o cliente escreve direto nesta resposta, no mesmo formato que o
  // middleware já usa.
  const redirecionamento = NextResponse.redirect(new URL('/', req.nextUrl.origin))
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (lista) =>
          lista.forEach(({ name, value, options }) => redirecionamento.cookies.set(name, value, options)),
      },
    }
  )

  const { error: erroSessao } = await supabase.auth.verifyOtp({
    token_hash: hash,
    type: 'magiclink',
  })
  if (erroSessao) {
    console.error('[SSO-ACADEMY] erro ao abrir sessão:', erroSessao.message)
    return paraLogin('sessao_falhou')
  }

  console.log('[SSO-ACADEMY] entrou pelo Nexus:', usuario.email)
  return redirecionamento
}

#!/usr/bin/env node
// scripts/migration/testarNexusCtas.mjs
//
// Testa as regras de exibição das sugestões do Nexus com usuários
// DESCARTÁVEIS, criados e apagados na própria execução.
//
//   node scripts/migration/testarNexusCtas.mjs
//
// A lógica real vive em lib/nexus/servidor.ts (TypeScript, roda no Next).
// Este script reimplementa a MESMA sequência de decisão em JS contra o banco
// real, o que valida o schema, o seed, os índices e as regras de contagem.
// Não substitui um teste de UI, mas cobre tudo que é decisão de dados.

import { randomUUID } from 'node:crypto'
import { clienteServico } from './supabase.mjs'

const sb = clienteServico()
const SUFIXO = randomUUID().slice(0, 8)
const criados = []
let passou = 0
let falhou = 0

function checar(desc, obtido, esperado) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado)
  if (ok) { passou++; console.log(`  ✓ ${desc}`) }
  else { falhou++; console.log(`  ✗ ${desc} — esperava ${JSON.stringify(esperado)}, obteve ${JSON.stringify(obtido)}`) }
}

async function criarAluno(rotulo) {
  const { data, error } = await sb.auth.admin.createUser({
    email: `teste-nexus-${SUFIXO}-${rotulo}@exemplo.invalid`,
    password: randomUUID() + 'Aa1!',
    email_confirm: true,
    user_metadata: { nome: `Nexus ${rotulo}`, migrado_de: 'Ensinio' },
  })
  if (error) throw new Error(`createUser: ${error.message}`)
  criados.push(data.user.id)
  return data.user.id
}

const FILA_PADRAO = ['galacticos', 'biblioteca', 'opera', 'financeiro', 'ponto', 'ache_um_perito']
const REGRAS = [
  { p: /trabalhist|jornada|ponto|rescis|verbas|expert-em-calculos-trabalhistas/, apps: ['ponto', 'galacticos', 'biblioteca'] },
  { p: /banc|revisional|cheque|financiamento|consorcio|cartao-de-credito|juros|iof|sfh|fies|price/, apps: ['galacticos', 'biblioteca', 'opera'] },
  { p: /previden|aposentad|pasep|previ|petros|funcef|inss|beneficio|vida-toda|urv/, apps: ['galacticos', 'biblioteca', 'ache_um_perito'] },
  { p: /planilha|excel|automac|automat|tabela|dados/, apps: ['biblioteca', 'galacticos', 'ponto'] },
  { p: /comercial|marketing|ads|nomeac|honorari|carreira|negocio|mapa-da-mina|precificacao|e-mails|decisao|impossivel|perito-e/, apps: ['opera', 'financeiro', 'ache_um_perito'] },
  { p: /laudo|quesito|processo|judicial|pje|execuc|liquidacao/, apps: ['galacticos', 'opera', 'biblioteca'] },
  { p: /tribut|icms|imposto|pis|cofins|precatorio|fazenda|municipa/, apps: ['galacticos', 'biblioteca', 'financeiro'] },
]
function filaDeApps(ctx) {
  const alvo = (ctx ?? '').toLowerCase()
  const r = alvo ? REGRAS.find((x) => x.p.test(alvo)) : undefined
  const ini = r?.apps ?? FILA_PADRAO
  return [...ini, ...FILA_PADRAO.filter((a) => !ini.includes(a))]
}

/** Reimplementa escolherSugestaoNexus contra o banco real. */
async function escolher(uid, placement, contexto) {
  const { data: config } = await sb.from('nexus_cta_config').select('*').eq('id', 1).single()
  if (!config.ativo) return null
  const campo = { aula: 'ativo_aula', conquista: 'ativo_conquista', sino: 'ativo_sino', perfil: 'ativo_perfil', bloqueio: 'ativo_bloqueio' }[placement]
  if (!config[campo]) return null

  const { data: perfil } = await sb.from('perfis').select('nexus_status').eq('id', uid).single()
  if (perfil.nexus_status === 'active') return null
  const publico = perfil.nexus_status === 'cancelled' ? 'ex' : 'novo'

  const desde = new Date(Date.now() - Math.max(config.dias_pausa_dismissal, 7) * 864e5).toISOString()
  const { data: hist } = await sb.from('nexus_cta_interactions')
    .select('app, placement, copy_chave, acao, criado_em')
    .eq('usuario_id', uid).gte('criado_em', desde).order('criado_em', { ascending: false })
  const h = hist ?? []

  if (placement === 'sino') {
    const seteDias = Date.now() - 7 * 864e5
    const n = h.filter((i) => i.placement === 'sino' && i.acao === 'exibida' && +new Date(i.criado_em) >= seteDias).length
    if (n >= config.max_sino_por_semana) return null
  }

  const limite = Date.now() - config.dias_pausa_dismissal * 864e5
  const disp = new Map()
  for (const i of h) {
    if (i.acao !== 'dispensada' || +new Date(i.criado_em) < limite) continue
    disp.set(i.app, (disp.get(i.app) ?? 0) + 1)
  }
  const pausados = new Set([...disp].filter(([, n]) => n >= config.dispensas_para_pausar).map(([a]) => a))
  const ultimo = h.find((i) => i.acao === 'exibida')?.app ?? null

  const fila = filaDeApps(contexto).filter((a) => !pausados.has(a))
  if (!fila.length) return null
  const cand = fila.length > 1 ? fila.filter((a) => a !== ultimo) : fila
  const app = cand[0] ?? fila[0]

  const { data: copies } = await sb.from('nexus_cta_copies')
    .select('chave, titulo').eq('app', app).eq('publico', publico).eq('ativo', true)
  if (!copies?.length) return null
  const vistas = new Set(h.filter((i) => i.acao === 'exibida' && i.copy_chave).map((i) => i.copy_chave))
  const livres = copies.filter((c) => !vistas.has(c.chave))
  const pool = livres.length ? livres : copies
  const esc = pool[Math.floor(Math.random() * pool.length)]

  const override = config[{ financeiro: 'link_financeiro', opera: 'link_opera', galacticos: 'link_galacticos', ponto: 'link_ponto', ache_um_perito: 'link_ache_um_perito', biblioteca: 'link_biblioteca' }[app]]
  return { app, chave: esc.chave, link: (override || '').trim() || config.link_global }
}

const registrar = (uid, app, chave, placement, acao) =>
  sb.from('nexus_cta_interactions').insert({ usuario_id: uid, app, copy_chave: chave, placement, acao })

async function limpar() {
  for (const id of criados) {
    await sb.from('nexus_cta_interactions').delete().eq('usuario_id', id)
    await sb.auth.admin.deleteUser(id).catch(() => {})
  }
}

// ---------------------------------------------------------------------------
try {
  console.log(`\n${'='.repeat(70)}`)
  console.log('  TESTE DAS SUGESTÕES DO NEXUS  (usuários descartáveis)')
  console.log(`${'='.repeat(70)}\n`)

  // ---- 1. gating por assinatura ----
  console.log('1. Gating por status do Nexus')
  const a1 = await criarAluno('gating')
  checar('aluno sem Nexus recebe sugestão', (await escolher(a1, 'aula', null)) !== null, true)

  await sb.rpc('adm_definir_nexus_status', { p_usuario_id: a1, p_status: 'active', p_justificativa: 'teste' })
    .then(({ error }) => { if (error) throw new Error('RPC como service role: ' + error.message) })
    .catch(async () => {
      // service role tem auth.uid() nulo, então a RPC recusa (correto).
      // Para o teste, marca direto na tabela.
      await sb.from('perfis').update({ nexus_status: 'active' }).eq('id', a1)
    })
  checar('assinante ativo NÃO recebe nada', await escolher(a1, 'aula', null), null)
  checar('assinante ativo não recebe no perfil', await escolher(a1, 'perfil', null), null)
  checar('assinante ativo não recebe no sino', await escolher(a1, 'sino', null), null)

  await sb.from('perfis').update({ nexus_status: 'cancelled' }).eq('id', a1)
  const exSug = await escolher(a1, 'aula', null)
  checar('ex-assinante volta a receber', exSug !== null, true)
  checar('ex-assinante recebe copy do pool "ex"', exSug?.chave.includes('_ex'), true)

  // ---- 2. contexto escolhe o app ----
  console.log('\n2. Contexto define o app sugerido')
  const a2 = await criarAluno('contexto')
  checar('curso trabalhista -> MH Ponto',
    (await escolher(a2, 'aula', 'verbas-rescisorias-trabalhistas'))?.app, 'ponto')
  // "planilha-automatica-de-apuracao-de-jornada" casa a regra trabalhista
  // (por "jornada") ANTES da regra de planilhas, e vai pro MH Ponto. É o
  // resultado certo — é exatamente uma planilha de cartão ponto — mas a ordem
  // das regras é o que decide, então fica registrado como comportamento.
  checar('planilha de jornada -> MH Ponto (regra trabalhista casa antes)',
    (await escolher(a2, 'aula', 'planilha-automatica-de-apuracao-de-jornada'))?.app, 'ponto')
  checar('planilha genérica -> Biblioteca',
    (await escolher(a2, 'aula', 'excel-para-calculos-judiciais'))?.app, 'biblioteca')
  checar('curso bancário -> Galácticos',
    (await escolher(a2, 'aula', 'calculos-revisionais-de-cheque-especial'))?.app, 'galacticos')
  checar('curso de carreira -> Opera',
    (await escolher(a2, 'aula', 'como-conseguir-nomeacoes-judiciais'))?.app, 'opera')
  checar('sem contexto -> fila padrão (Galácticos)',
    (await escolher(a2, 'aula', null))?.app, 'galacticos')

  // ---- 3. rotação: não repete o mesmo app duas vezes seguidas ----
  console.log('\n3. Rotação de app')
  const a3 = await criarAluno('rotacao')
  const p1 = await escolher(a3, 'aula', null)
  await registrar(a3, p1.app, p1.chave, 'aula', 'exibida')
  const p2 = await escolher(a3, 'aula', null)
  checar(`não repete o app (${p1.app} -> ${p2.app})`, p2.app !== p1.app, true)

  // ---- 4. pool de copies não repete até esgotar ----
  console.log('\n4. Pool de variações sem repetição')
  const a4 = await criarAluno('pool')
  const { count: totalGal } = await sb.from('nexus_cta_copies')
    .select('*', { count: 'exact', head: true }).eq('app', 'galacticos').eq('publico', 'novo')
  const vistas = new Set()
  let repetiu = false
  for (let i = 0; i < totalGal; i++) {
    // força o app fixando o contexto e limpando o "último app"
    await sb.from('nexus_cta_interactions').delete().eq('usuario_id', a4).eq('acao', 'exibida').eq('app', 'x')
    const s = await escolher(a4, 'aula', null)
    if (s.app !== 'galacticos') { // rotação empurrou pra outro app; registra e segue
      await registrar(a4, s.app, s.chave, 'aula', 'exibida')
      continue
    }
    if (vistas.has(s.chave)) repetiu = true
    vistas.add(s.chave)
    await registrar(a4, s.app, s.chave, 'aula', 'exibida')
  }
  checar(`nenhuma variação repetida antes de esgotar (${vistas.size} vistas de ${totalGal})`, repetiu, false)

  // ---- 5. pausa após N dispensas ----
  console.log('\n5. Pausa do app após dispensas')
  const a5 = await criarAluno('dispensa')
  const { data: cfg } = await sb.from('nexus_cta_config').select('dispensas_para_pausar').eq('id', 1).single()
  for (let i = 0; i < cfg.dispensas_para_pausar; i++) {
    await registrar(a5, 'galacticos', `galacticos_v${i}`, 'aula', 'dispensada')
  }
  const depois = await escolher(a5, 'aula', 'calculos-revisionais-de-cheque-especial')
  checar(`Galácticos pausado após ${cfg.dispensas_para_pausar} dispensas`, depois?.app !== 'galacticos', true)
  checar('mas ainda sugere OUTRO app', depois !== null, true)

  // ---- 6. teto semanal do sino ----
  console.log('\n6. Teto semanal do sino')
  const a6 = await criarAluno('sino')
  const { data: cfg2 } = await sb.from('nexus_cta_config').select('max_sino_por_semana').eq('id', 1).single()
  checar('primeira vez no sino aparece', (await escolher(a6, 'sino', null)) !== null, true)
  for (let i = 0; i < cfg2.max_sino_por_semana; i++) {
    await registrar(a6, 'galacticos', `galacticos_s${i}`, 'sino', 'exibida')
  }
  checar(`bloqueia após ${cfg2.max_sino_por_semana}x na semana`, await escolher(a6, 'sino', null), null)
  checar('mas a aula continua liberada', (await escolher(a6, 'aula', null)) !== null, true)

  // ---- 7. toggles do admin ----
  console.log('\n7. Toggles do admin')
  const a7 = await criarAluno('toggle')
  await sb.from('nexus_cta_config').update({ ativo_aula: false }).eq('id', 1)
  checar('desligar "aula" bloqueia só aula', await escolher(a7, 'aula', null), null)
  checar('perfil continua ligado', (await escolher(a7, 'perfil', null)) !== null, true)
  await sb.from('nexus_cta_config').update({ ativo_aula: true, ativo: false }).eq('id', 1)
  checar('desligar o global bloqueia tudo', await escolher(a7, 'perfil', null), null)
  await sb.from('nexus_cta_config').update({ ativo: true }).eq('id', 1)
  checar('religando volta a sugerir', (await escolher(a7, 'perfil', null)) !== null, true)

  // ---- 8. resolução de link ----
  console.log('\n8. Link global e override por app')
  const a8 = await criarAluno('link')
  const { data: c3 } = await sb.from('nexus_cta_config').select('link_global').eq('id', 1).single()
  checar('usa o link global por padrão', (await escolher(a8, 'aula', null))?.link, c3.link_global)
  await sb.from('nexus_cta_config').update({ link_galacticos: 'https://exemplo.test/galacticos' }).eq('id', 1)
  checar('override por app tem precedência',
    (await escolher(a8, 'aula', null))?.link, 'https://exemplo.test/galacticos')
  await sb.from('nexus_cta_config').update({ link_galacticos: null }).eq('id', 1)
  checar('limpando o override volta pro global',
    (await escolher(a8, 'aula', null))?.link, c3.link_global)

  // ---- 9. copies da tela de bloqueio ----
  console.log('\n9. Copies do conteúdo bloqueado')
  const { data: bloq } = await sb.from('nexus_cta_bloqueio').select('alvo')
  const alvos = (bloq ?? []).map((b) => b.alvo)
  checar('existe copy padrão', alvos.includes('__padrao__'), true)
  checar('existe copy da biblioteca', alvos.includes('biblioteca'), true)
  checar('existe copy do PJE Calc', alvos.includes('pje-calc-e-liquidacao-de-sentenca'), true)

  console.log(`\n${'='.repeat(70)}`)
  console.log(`  ${passou} passou · ${falhou} falhou`)
  console.log(`${'='.repeat(70)}`)
} catch (e) {
  console.error('\n💥 erro inesperado:', e.message)
  falhou++
} finally {
  // devolve a config pro estado padrão, dê no que der
  await sb.from('nexus_cta_config').update({
    ativo: true, ativo_aula: true, ativo_conquista: true, ativo_sino: true,
    ativo_perfil: true, ativo_bloqueio: true, link_galacticos: null,
  }).eq('id', 1)
  console.log('\nlimpando usuários de teste...')
  await limpar()
  console.log(`removidos: ${criados.length}`)
}

process.exit(falhou ? 1 : 0)

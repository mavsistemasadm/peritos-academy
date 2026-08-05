#!/usr/bin/env node
// scripts/migration/testarMatrizAcesso.mjs
//
// Testa a matriz de acesso com usuários DESCARTÁVEIS, criados e apagados
// dentro da própria execução. Nenhum dado real é tocado.
//
//   node scripts/migration/testarMatrizAcesso.mjs
//
// Cobre os 4 casos que a migração introduziu, mais os dois que já existiam:
//   1. acesso total vitalício          -> abre qualquer curso
//   2. acesso total COM exceções       -> abre tudo, menos os excetuados
//   3. acesso só de um curso           -> abre aquele, barra os outros
//   4. concessão vencida               -> não abre nada (expira na leitura)
//   5. sem concessão nenhuma           -> não abre nada
//   6. RLS de material de aula         -> por curso, com sessão real do aluno
//
// O caso 6 loga de verdade como o aluno (anon key + senha) em vez de usar o
// service role, porque service role ignora RLS — testar policy com service
// role daria falso positivo.

import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { clienteServico, carregarEnv } from './supabase.mjs'
import { CURSO, TRILHA } from './catalogo.mjs'

const sb = clienteServico()
const env = carregarEnv()

const SUFIXO = randomUUID().slice(0, 8)
const criados = []
let passou = 0
let falhou = 0

function checar(descricao, obtido, esperado) {
  const ok = obtido === esperado
  if (ok) { passou++; console.log(`  ✓ ${descricao}`) }
  else { falhou++; console.log(`  ✗ ${descricao} — esperava ${esperado}, obteve ${obtido}`) }
}

async function criarAluno(rotulo) {
  const email = `teste-migracao-${SUFIXO}-${rotulo}@exemplo.invalid`
  const senha = randomUUID() + 'Aa1!'
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    // migrado_de suprime o email de boas-vindas (o trigger de auth.users
    // dispara pra qualquer usuário novo, inclusive estes de teste)
    user_metadata: { nome: `Teste ${rotulo}`, migrado_de: 'Ensinio' },
  })
  if (error) throw new Error(`createUser(${rotulo}): ${error.message}`)
  criados.push(data.user.id)
  return { id: data.user.id, email, senha }
}

async function conceder(usuarioId, { escopo, cursoId = null, vitalicio = false, expiraEm = null, excecoes = [], excecoesTrilha = [] }) {
  const id = randomUUID()
  const { error } = await sb.from('acessos_conteudo').insert({
    id, usuario_id: usuarioId, escopo, curso_id: cursoId,
    vitalicio, expira_em: expiraEm, origem: 'migracao_ensinio',
    observacao: 'TESTE AUTOMATIZADO — apagar',
  })
  if (error) throw new Error(`conceder(${escopo}): ${error.message}`)
  const linhas = [
    ...excecoes.map((cid) => ({ acesso_id: id, curso_id: cid, trilha_slug: null })),
    ...excecoesTrilha.map((slug) => ({ acesso_id: id, curso_id: null, trilha_slug: slug })),
  ]
  if (linhas.length) {
    const { error: e2 } = await sb.from('acessos_excecoes').insert(linhas)
    if (e2) throw new Error(`excecoes: ${e2.message}`)
  }
  return id
}

const podeCurso = async (uid, slug) =>
  (await sb.rpc('tem_acesso_curso', { p_usuario_id: uid, p_curso_slug: slug })).data
const podePlataforma = async (uid) =>
  (await sb.rpc('tem_acesso_plataforma', { p_usuario_id: uid })).data
const podeBiblioteca = async (uid) =>
  (await sb.rpc('tem_acesso_biblioteca', { p_usuario_id: uid })).data

async function limpar() {
  for (const id of criados) {
    await sb.from('acessos_conteudo').delete().eq('usuario_id', id)
    await sb.auth.admin.deleteUser(id).catch(() => {})
  }
}

// ---------------------------------------------------------------------------
try {
  console.log(`\n${'='.repeat(70)}`)
  console.log('  TESTE DA MATRIZ DE ACESSO  (usuários descartáveis)')
  console.log(`${'='.repeat(70)}\n`)

  // ids dos cursos usados nos testes
  const { data: cursos, error: erroCursos } = await sb
    .from('cursos').select('id, slug')
    .in('slug', [CURSO.pasep, CURSO.pjeCalc, CURSO.desapropriacao, CURSO.lei14905])
  if (erroCursos) throw new Error(erroCursos.message)
  const idDe = Object.fromEntries(cursos.map((c) => [c.slug, c.id]))
  // um curso qualquer que NÃO está em nenhuma lista de exceção
  const { data: livre } = await sb.from('cursos')
    .select('slug').not('slug', 'in', `(${Object.values(CURSO).join(',')})`).limit(1).single()
  const SLUG_LIVRE = livre.slug
  console.log(`curso "livre" usado nos testes: ${SLUG_LIVRE}\n`)

  // ---- 1. total vitalício ----
  console.log('1. Acesso total vitalício (Membro Fundador Infinity)')
  const a1 = await criarAluno('total')
  await conceder(a1.id, { escopo: 'total', vitalicio: true })
  await conceder(a1.id, { escopo: 'biblioteca', vitalicio: true })
  checar('abre curso livre', await podeCurso(a1.id, SLUG_LIVRE), true)
  checar('abre PJE Calc', await podeCurso(a1.id, CURSO.pjeCalc), true)
  checar('abre PASEP', await podeCurso(a1.id, CURSO.pasep), true)
  checar('tem acesso à plataforma', await podePlataforma(a1.id), true)
  checar('tem biblioteca', await podeBiblioteca(a1.id), true)

  // ---- 2. total com exceções (Black Friday) ----
  console.log('\n2. Acesso total com 8 exceções (Black Friday 2023)')
  const a2 = await criarAluno('excecoes')
  await conceder(a2.id, {
    escopo: 'total', vitalicio: true,
    excecoes: [idDe[CURSO.pjeCalc], idDe[CURSO.desapropriacao], idDe[CURSO.lei14905]],
  })
  checar('abre curso livre', await podeCurso(a2.id, SLUG_LIVRE), true)
  checar('abre PASEP (não excetuado)', await podeCurso(a2.id, CURSO.pasep), true)
  checar('BARRA PJE Calc (excetuado)', await podeCurso(a2.id, CURSO.pjeCalc), false)
  checar('BARRA Desapropriação (excetuado)', await podeCurso(a2.id, CURSO.desapropriacao), false)
  checar('BARRA Lei 14905 (excetuado)', await podeCurso(a2.id, CURSO.lei14905), false)
  checar('NÃO tem biblioteca', await podeBiblioteca(a2.id), false)

  // ---- 2b. exceção de TRILHA inteira (MasterClass, do Black Friday) ----
  console.log('\n2b. Exceção de trilha inteira (MasterClass)')
  // cursos que pertencem à trilha MasterClass hoje (via tabelas base, não a
  // view curso_trilha, que é DISTINCT ON (curso_id))
  const { data: membros } = await sb
    .from('etapa_missoes')
    .select('curso_id, etapas!inner(trilhas!inner(slug)), cursos!inner(slug)')
    .eq('etapas.trilhas.slug', TRILHA.masterClass)
  const slugsMasterClass = [...new Set((membros ?? []).map((m) => m.cursos.slug))]
  console.log(`  trilha tem ${slugsMasterClass.length} curso(s): ${slugsMasterClass.join(', ')}`)

  const a2b = await criarAluno('trilha')
  await conceder(a2b.id, {
    escopo: 'total', vitalicio: true,
    excecoesTrilha: [TRILHA.masterClass],
  })
  checar('abre curso livre', await podeCurso(a2b.id, SLUG_LIVRE), true)
  for (const slug of slugsMasterClass) {
    checar(`BARRA ${slug} (curso da trilha excetuada)`, await podeCurso(a2b.id, slug), false)
  }

  // ---- 3. só um curso ----
  console.log('\n3. Apenas um curso, com prazo futuro (PJE Calc avulso)')
  const a3 = await criarAluno('avulso')
  await conceder(a3.id, { escopo: 'curso', cursoId: idDe[CURSO.pjeCalc], expiraEm: '2099-12-31' })
  checar('abre PJE Calc', await podeCurso(a3.id, CURSO.pjeCalc), true)
  checar('BARRA curso livre', await podeCurso(a3.id, SLUG_LIVRE), false)
  checar('BARRA PASEP', await podeCurso(a3.id, CURSO.pasep), false)
  checar('tem acesso à plataforma (comunidade/agenda)', await podePlataforma(a3.id), true)
  checar('NÃO tem biblioteca', await podeBiblioteca(a3.id), false)

  // ---- 4. vencido ----
  console.log('\n4. Concessão vencida (expira na leitura, sem cron)')
  const a4 = await criarAluno('vencido')
  await conceder(a4.id, { escopo: 'curso', cursoId: idDe[CURSO.pasep], expiraEm: '2025-01-01' })
  await conceder(a4.id, { escopo: 'biblioteca', expiraEm: '2025-01-01' })
  checar('BARRA PASEP (vencido)', await podeCurso(a4.id, CURSO.pasep), false)
  checar('NÃO tem acesso à plataforma', await podePlataforma(a4.id), false)
  checar('NÃO tem biblioteca (vencida)', await podeBiblioteca(a4.id), false)

  // vira a data pra ontem/amanhã e confere que o gate acompanha sem job algum
  const amanha = new Date(Date.now() + 864e5).toISOString().slice(0, 10)
  await sb.from('acessos_conteudo').update({ expira_em: amanha })
    .eq('usuario_id', a4.id).eq('escopo', 'curso')
  checar('libera ao empurrar o vencimento pra amanhã', await podeCurso(a4.id, CURSO.pasep), true)
  const ontem = new Date(Date.now() - 864e5).toISOString().slice(0, 10)
  await sb.from('acessos_conteudo').update({ expira_em: ontem })
    .eq('usuario_id', a4.id).eq('escopo', 'curso')
  checar('barra de novo ao voltar pra ontem', await podeCurso(a4.id, CURSO.pasep), false)

  // ---- 5. sem concessão ----
  console.log('\n5. Aluno sem concessão nenhuma')
  const a5 = await criarAluno('nada')
  checar('BARRA curso livre', await podeCurso(a5.id, SLUG_LIVRE), false)
  checar('NÃO tem acesso à plataforma', await podePlataforma(a5.id), false)
  checar('NÃO tem biblioteca', await podeBiblioteca(a5.id), false)

  // ---- 6. RLS de material, com sessão real ----
  console.log('\n6. RLS de aula_materiais (sessão real do aluno, não service role)')
  const { data: material } = await sb
    .from('aula_materiais')
    .select('id, aula_id, aulas!inner(modulo_id, modulos!inner(curso_id, cursos!inner(slug)))')
    .not('arquivo_url', 'is', null)
    .limit(1)
    .maybeSingle()

  if (!material) {
    console.log('  ⚠ nenhum material com arquivo no banco — teste de RLS pulado')
  } else {
    const slugDoMaterial = material.aulas.modulos.cursos.slug
    const cursoDoMaterial = material.aulas.modulos.curso_id
    console.log(`  material de teste: aula ${material.aula_id} (curso ${slugDoMaterial})`)

    // aluno COM acesso àquele curso
    const comAcesso = await criarAluno('mat-ok')
    await conceder(comAcesso.id, { escopo: 'curso', cursoId: cursoDoMaterial, vitalicio: true })
    // aluno com acesso a OUTRO curso só
    const semAcesso = await criarAluno('mat-no')
    const outro = Object.values(idDe).find((id) => id !== cursoDoMaterial)
    await conceder(semAcesso.id, { escopo: 'curso', cursoId: outro, vitalicio: true })

    for (const [rotulo, aluno, esperado] of [
      ['aluno COM acesso ao curso vê o material', comAcesso, true],
      ['aluno SEM acesso ao curso NÃO vê o material', semAcesso, false],
    ]) {
      const cli = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        auth: { persistSession: false },
      })
      const { error: erroLogin } = await cli.auth.signInWithPassword({
        email: aluno.email, password: aluno.senha,
      })
      if (erroLogin) { console.log(`  ✗ login falhou (${rotulo}): ${erroLogin.message}`); falhou++; continue }
      const { data: visto } = await cli.from('aula_materiais').select('id').eq('id', material.id).maybeSingle()
      checar(rotulo, visto !== null, esperado)
      await cli.auth.signOut()
    }
  }

  console.log(`\n${'='.repeat(70)}`)
  console.log(`  ${passou} passou · ${falhou} falhou`)
  console.log(`${'='.repeat(70)}`)
} catch (e) {
  console.error('\n💥 erro inesperado:', e.message)
  falhou++
} finally {
  console.log('\nlimpando usuários de teste...')
  await limpar()
  console.log(`removidos: ${criados.length}`)
}

process.exit(falhou ? 1 : 0)

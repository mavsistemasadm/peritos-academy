#!/usr/bin/env node
// scripts/migration/importarAlunos.mjs
//
// Importa os alunos da Ensinio para a Peritos Academy.
//
//   node scripts/migration/importarAlunos.mjs                 # dry-run (não escreve nada)
//   node scripts/migration/importarAlunos.mjs --executar      # grava de verdade
//   node scripts/migration/importarAlunos.mjs --limite=5 --executar
//   node scripts/migration/importarAlunos.mjs --hoje=2026-08-05
//
// PRÉ-REQUISITO: a migração supabase/migrations/20260805_migracao_alunos_entitlements.sql
// precisa ter sido rodada no SQL Editor. O script confere isso antes de começar.
//
// Segurança embutida:
//  - dry-run é o DEFAULT; só grava com --executar explícito;
//  - nenhum email é disparado (os usuários são criados com o metadata
//    `migrado_de`, que faz /api/internal/email-evento suprimir as boas-vindas);
//  - idempotente: rodar duas vezes não duplica nada (a tabela migracao_alunos
//    é o livro-caixa — linha já registrada é pulada);
//  - a senha temporária é aleatória, nunca é impressa nem enviada; o aluno
//    entra pelo fluxo de "definir senha".

import { randomBytes, randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { planejar } from './planejar.mjs'
import { clienteServico } from './supabase.mjs'

const ARQUIVO_PADRAO = 'migracao/migracao_peritos_academy_FINAL.xlsx'
const PLATAFORMA = 'Ensinio'

// ---------------------------------------------------------------- argumentos
const args = process.argv.slice(2)
const temFlag = (n) => args.includes(`--${n}`)
const valorFlag = (n, def) => {
  const a = args.find((x) => x.startsWith(`--${n}=`))
  return a ? a.slice(n.length + 3) : def
}
const EXECUTAR = temFlag('executar')
const LIMITE = Number(valorFlag('limite', '0')) || 0
const ARQUIVO = valorFlag('arquivo', ARQUIVO_PADRAO)
const HOJE = valorFlag('hoje', undefined)

const log = []
const registrar = (msg) => { log.push(msg); console.log(msg) }

// ------------------------------------------------------------------ helpers
function senhaAleatoria() {
  // 32 bytes urlsafe — nunca sai daqui, o aluno define a dele no primeiro acesso
  return randomBytes(32).toString('base64url')
}

async function mapaEmailParaId(sb) {
  // Não existe getUserByEmail no SDK; pagina listUsers e monta o índice.
  const mapa = new Map()
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await sb.auth.admin.listUsers({ page: pagina, perPage: 1000 })
    if (error) throw new Error(`listUsers falhou: ${error.message}`)
    for (const u of data.users) if (u.email) mapa.set(u.email.toLowerCase(), u.id)
    if (data.users.length < 1000) break
  }
  return mapa
}

async function conferirMigracao(sb) {
  const faltando = []
  for (const t of ['acessos_conteudo', 'acessos_excecoes', 'migracao_alunos']) {
    // `.limit(1)` sem head de propósito: com `{ head: true }` o PostgREST
    // devolve 200 e count nulo pra tabela INEXISTENTE, sem erro nenhum — o
    // que faria esta checagem passar em branco (verificado). Uma query normal
    // devolve "Could not find the table ..." de verdade, e uma tabela
    // existente e vazia devolve [] sem erro.
    const { error } = await sb.from(t).select('*').limit(1)
    if (error) faltando.push(`${t} (${error.message})`)
  }
  const { error: erroRpc } = await sb.rpc('tem_acesso_curso', {
    p_usuario_id: '00000000-0000-0000-0000-000000000000',
    p_curso_slug: '__inexistente__',
  })
  if (erroRpc) faltando.push(`RPC tem_acesso_curso (${erroRpc.message})`)
  if (faltando.length) {
    console.error('\n❌ A migração de banco não foi aplicada. Falta:')
    for (const f of faltando) console.error('   - ' + f)
    console.error('\nRode supabase/migrations/20260805_migracao_alunos_entitlements.sql no SQL Editor e tente de novo.\n')
    process.exit(1)
  }
}

// --------------------------------------------------------------------- main
const sb = clienteServico()

console.log(`\n${'='.repeat(70)}`)
console.log(`  IMPORTAÇÃO DE ALUNOS — ${EXECUTAR ? '⚠️  MODO EXECUÇÃO (grava no banco)' : '🔍 DRY-RUN (não grava nada)'}`)
console.log(`${'='.repeat(70)}\n`)

await conferirMigracao(sb)

const plano = planejar(ARQUIVO, HOJE ? { hoje: HOJE } : {})
const r = plano.resumo

registrar(`Arquivo ........... ${ARQUIVO}`)
registrar(`Data de corte ..... ${plano.hoje} (vigência calculada contra esta data)`)
registrar(`Linhas lidas ...... ${r.linhasLidas}`)
registrar(`Linhas com erro ... ${r.linhasComErro}`)
registrar('')
registrar(`Alunos a importar ............... ${r.alunosAImportar}`)
registrar(`Alunos ignorados (tudo vencido) . ${r.alunosIgnorados}`)
registrar(`Concessões de acesso ............ ${r.concessoesTotal}`)
registrar(`  escopo total .................. ${r.concessoesPorEscopo.total}`)
registrar(`  escopo curso .................. ${r.concessoesPorEscopo.curso}`)
registrar(`  escopo biblioteca ............. ${r.concessoesPorEscopo.biblioteca}`)
registrar(`  vitalícias .................... ${r.concessoesVitalicias}`)
registrar(`  com prazo ..................... ${r.concessoesComPrazo}`)
registrar('')
registrar('Produtos VIGENTES (serão importados):')
for (const [p, n] of r.porProdutoVigente) registrar(`  ${String(n).padStart(4)}  ${p}`)
registrar('')
registrar('Produtos VENCIDOS (não importados, só histórico):')
for (const [p, n] of r.porProdutoIgnorado) registrar(`  ${String(n).padStart(4)}  ${p}`)

if (plano.erros.length) {
  registrar('\n⚠️  ERROS DE LEITURA (linhas puladas):')
  for (const e of plano.erros.slice(0, 50)) registrar(`  linha ${e.linha}: ${e.erro}`)
  if (plano.erros.length > 50) registrar(`  ... e mais ${plano.erros.length - 50}`)
}

// resolve slugs de curso -> uuid
const { data: cursos, error: erroCursos } = await sb.from('cursos').select('id, slug')
if (erroCursos) { console.error('falha ao carregar cursos:', erroCursos.message); process.exit(1) }
const idPorSlug = new Map(cursos.map((c) => [c.slug, c.id]))

// confere que todo slug citado no plano existe
const slugsUsados = new Set()
const trilhasUsadas = new Set()
for (const a of plano.alunos) {
  for (const c of a.concessoes) {
    if (c.cursoSlug) slugsUsados.add(c.cursoSlug)
    for (const e of c.excecoes) slugsUsados.add(e)
    for (const t of c.excecoesTrilha ?? []) trilhasUsadas.add(t)
  }
}
const slugsQuebrados = [...slugsUsados].filter((s) => !idPorSlug.has(s))
if (slugsQuebrados.length) {
  console.error('\n❌ slugs de curso inexistentes no banco:', slugsQuebrados.join(', '))
  process.exit(1)
}
registrar(`\nSlugs de curso conferidos: ${slugsUsados.size} — todos existem.`)

// confere as trilhas excetuadas
if (trilhasUsadas.size) {
  const { data: trilhas, error } = await sb.from('trilhas').select('slug').in('slug', [...trilhasUsadas])
  if (error) { console.error('falha ao carregar trilhas:', error.message); process.exit(1) }
  const achadas = new Set((trilhas ?? []).map((t) => t.slug))
  const quebradas = [...trilhasUsadas].filter((t) => !achadas.has(t))
  if (quebradas.length) {
    console.error('\n❌ slugs de trilha inexistentes no banco:', quebradas.join(', '))
    process.exit(1)
  }
  registrar(`Slugs de trilha conferidos: ${trilhasUsadas.size} — todos existem.`)
}

// histórico já gravado (idempotência)
const jaRegistrado = new Set()
{
  const { data, error } = await sb.from('migracao_alunos').select('email, plano_origem, data_vencimento')
  if (error) { console.error('falha ao ler migracao_alunos:', error.message); process.exit(1) }
  for (const m of data ?? []) {
    jaRegistrado.add(`${m.email.toLowerCase()}|${m.plano_origem}|${m.data_vencimento ?? ''}`)
  }
}
if (jaRegistrado.size) registrar(`Histórico já existente: ${jaRegistrado.size} linha(s) — serão puladas.`)

const alunosAlvo = LIMITE > 0 ? plano.alunos.slice(0, LIMITE) : plano.alunos
if (LIMITE > 0) registrar(`\n⚠️  --limite=${LIMITE}: processando só os ${alunosAlvo.length} primeiros alunos.`)

// ---------------------------------------------------------------- relatórios
const linhasCsv = [
  'email,nome_completo,produto,grupo,tipo_acesso,valor_pago,data_compra,regra_vencimento,validade,situacao,motivo',
]
const escaparCsv = (v) => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const linhaCsv = (reg, situacao, motivo) => linhasCsv.push([
  reg.email, reg.nomeCompleto, reg.produto, reg.grupo, reg.tipoAcesso,
  reg.valorPago, reg.dataCompra, reg.regraVencimento,
  reg.vitalicio ? 'Vitalício' : reg.expiraEm, situacao, motivo,
].map(escaparCsv).join(','))

if (!EXECUTAR) {
  registrar('\n' + '-'.repeat(70))
  registrar('DRY-RUN: nada foi gravado. Amostra dos 5 primeiros alunos:')
  registrar('-'.repeat(70))
  for (const a of alunosAlvo.slice(0, 5)) {
    registrar(`\n  ${a.nome} <${a.email}>${a.telefone ? ' · ' + a.telefone : ''}`)
    for (const c of a.concessoes) {
      const prazo = c.vitalicio ? 'vitalício' : `até ${c.expiraEm}`
      const alvo = c.escopo === 'curso' ? ` (${c.cursoSlug})` : ''
      const partes = []
      if (c.excecoes.length) partes.push(`${c.excecoes.length} curso(s)`)
      if ((c.excecoesTrilha ?? []).length) partes.push(`${c.excecoesTrilha.length} trilha(s)`)
      const exc = partes.length ? ` — exceto ${partes.join(' + ')}` : ''
      registrar(`      · ${c.escopo}${alvo}, ${prazo}${exc}`)
    }
  }
}

// ------------------------------------------------------------------ execução
let criados = 0, reaproveitados = 0, concedidos = 0, historico = 0, pulados = 0
const falhas = []

if (EXECUTAR) {
  registrar('\n' + '-'.repeat(70))
  registrar('EXECUTANDO...')
  registrar('-'.repeat(70))

  const emailParaId = await mapaEmailParaId(sb)
  registrar(`Usuários já existentes no Auth: ${emailParaId.size}`)

  let i = 0
  for (const aluno of alunosAlvo) {
    i++
    if (i % 25 === 0) registrar(`  ... ${i}/${alunosAlvo.length}`)

    try {
      // ---- 1. usuário ----
      let usuarioId = emailParaId.get(aluno.email)
      if (usuarioId) {
        reaproveitados++
      } else {
        const { data: novo, error } = await sb.auth.admin.createUser({
          email: aluno.email,
          password: senhaAleatoria(),
          // confirma o email na criação: o aluno já era cliente na Ensinio, e
          // sem isso o fluxo de "definir senha" não funciona.
          email_confirm: true,
          user_metadata: {
            nome: aluno.nome,
            // ESTE campo é o que suprime o email de boas-vindas automático
            // (ver app/api/internal/email-evento/route.ts). Não remover.
            migrado_de: PLATAFORMA,
          },
        })
        if (error) throw new Error(`createUser: ${error.message}`)
        usuarioId = novo.user.id
        emailParaId.set(aluno.email, usuarioId)
        criados++
      }

      // ---- 2. perfil ----
      const patch = { migrado_de: PLATAFORMA, migrado_em: new Date().toISOString() }
      if (aluno.nome) patch.nome = aluno.nome
      if (aluno.telefone) patch.telefone = aluno.telefone
      const { error: erroPerfil } = await sb.from('perfis').update(patch).eq('id', usuarioId)
      if (erroPerfil) throw new Error(`perfis.update: ${erroPerfil.message}`)

      // ---- 3. concessões + histórico, por produto vigente ----
      for (const reg of aluno.registrosVigentes) {
        const chave = `${reg.email}|${reg.produto}|${reg.expiraEm ?? ''}`
        if (jaRegistrado.has(chave)) { pulados++; continue }

        const doProduto = aluno.concessoes.filter((c) => c.registroLinha === reg.linha)
        let primeiroAcessoId = null

        for (const c of doProduto) {
          const acessoId = randomUUID()
          const { error: erroAcesso } = await sb.from('acessos_conteudo').insert({
            id: acessoId,
            usuario_id: usuarioId,
            escopo: c.escopo,
            curso_id: c.cursoSlug ? idPorSlug.get(c.cursoSlug) : null,
            vitalicio: c.vitalicio,
            expira_em: c.expiraEm,
            origem: 'migracao_ensinio',
            observacao: c.observacao,
          })
          if (erroAcesso) throw new Error(`acessos_conteudo: ${erroAcesso.message}`)
          concedidos++
          primeiroAcessoId ??= acessoId

          const excecoes = [
            ...c.excecoes.map((slug) => ({ acesso_id: acessoId, curso_id: idPorSlug.get(slug), trilha_slug: null })),
            // exceção por trilha entra como referência à trilha, não expandida
            // nos cursos que ela tem hoje (ver catalogo.mjs)
            ...(c.excecoesTrilha ?? []).map((slug) => ({ acesso_id: acessoId, curso_id: null, trilha_slug: slug })),
          ]
          if (excecoes.length) {
            const { error: erroExc } = await sb.from('acessos_excecoes').insert(excecoes)
            if (erroExc) throw new Error(`acessos_excecoes: ${erroExc.message}`)
          }
        }

        const { error: erroHist } = await sb.from('migracao_alunos').insert({
          usuario_id: usuarioId,
          email: reg.email,
          nome_completo: reg.nomeCompleto,
          plano_origem: reg.produto,
          grupo_origem: reg.grupo,
          tipo_acesso_origem: reg.tipoAcesso,
          valor_pago_origem: reg.valorPago,
          data_compra_origem: reg.dataCompra,
          acesso_concedido: reg.acessoConcedido,
          regra_vencimento: reg.regraVencimento,
          data_vencimento: reg.expiraEm,
          acesso_id: primeiroAcessoId,
          importado: true,
        })
        if (erroHist) throw new Error(`migracao_alunos: ${erroHist.message}`)
        historico++
        jaRegistrado.add(chave)
        linhaCsv(reg, 'importado', '')
      }

      // ---- 4. produtos vencidos DESTE aluno: só histórico ----
      for (const reg of aluno.registrosVencidos) {
        const chave = `${reg.email}|${reg.produto}|${reg.expiraEm ?? ''}`
        if (jaRegistrado.has(chave)) { pulados++; continue }
        const { error } = await sb.from('migracao_alunos').insert({
          usuario_id: usuarioId,
          email: reg.email,
          nome_completo: reg.nomeCompleto,
          plano_origem: reg.produto,
          grupo_origem: reg.grupo,
          tipo_acesso_origem: reg.tipoAcesso,
          valor_pago_origem: reg.valorPago,
          data_compra_origem: reg.dataCompra,
          acesso_concedido: reg.acessoConcedido,
          regra_vencimento: reg.regraVencimento,
          data_vencimento: reg.expiraEm,
          importado: false,
          motivo_nao_importado: `vencido em ${reg.expiraEm} (antes do corte ${plano.hoje})`,
        })
        if (error) throw new Error(`migracao_alunos (vencido): ${error.message}`)
        historico++
        jaRegistrado.add(chave)
        linhaCsv(reg, 'nao_importado', `vencido em ${reg.expiraEm}`)
      }
    } catch (e) {
      falhas.push({ email: aluno.email, erro: String(e.message ?? e) })
      registrar(`  ✗ ${aluno.email}: ${e.message ?? e}`)
    }
  }

  // ---- 5. alunos 100% vencidos: histórico sem usuário ----
  registrar('\nRegistrando no histórico os alunos sem nenhum acesso vigente...')
  for (const g of plano.ignorados) {
    for (const reg of g.registros) {
      const chave = `${reg.email}|${reg.produto}|${reg.expiraEm ?? ''}`
      if (jaRegistrado.has(chave)) { pulados++; continue }
      const { error } = await sb.from('migracao_alunos').insert({
        usuario_id: null,
        email: reg.email,
        nome_completo: reg.nomeCompleto,
        plano_origem: reg.produto,
        grupo_origem: reg.grupo,
        tipo_acesso_origem: reg.tipoAcesso,
        valor_pago_origem: reg.valorPago,
        data_compra_origem: reg.dataCompra,
        acesso_concedido: reg.acessoConcedido,
        regra_vencimento: reg.regraVencimento,
        data_vencimento: reg.expiraEm,
        importado: false,
        motivo_nao_importado: `aluno sem nenhum produto vigente (este venceu em ${reg.expiraEm})`,
      })
      if (error) { falhas.push({ email: reg.email, erro: error.message }); continue }
      historico++
      jaRegistrado.add(chave)
      linhaCsv(reg, 'nao_importado', 'aluno sem nenhum acesso vigente')
    }
  }
} else {
  // no dry-run o CSV sai completo, sem escrever no banco
  for (const a of alunosAlvo) {
    for (const reg of a.registrosVigentes) linhaCsv(reg, 'importado', '')
    for (const reg of a.registrosVencidos) linhaCsv(reg, 'nao_importado', `vencido em ${reg.expiraEm}`)
  }
  for (const g of plano.ignorados) {
    for (const reg of g.registros) linhaCsv(reg, 'nao_importado', 'aluno sem nenhum acesso vigente')
  }
}

// ------------------------------------------------------------------ saída
registrar('\n' + '='.repeat(70))
if (EXECUTAR) {
  registrar('  RESULTADO')
  registrar('='.repeat(70))
  registrar(`Usuários criados ................ ${criados}`)
  registrar(`Usuários já existentes (reuso) .. ${reaproveitados}`)
  registrar(`Concessões de acesso criadas .... ${concedidos}`)
  registrar(`Linhas de histórico gravadas .... ${historico}`)
  registrar(`Linhas puladas (já existiam) .... ${pulados}`)
  registrar(`Falhas .......................... ${falhas.length}`)
  if (falhas.length) {
    registrar('\nFALHAS:')
    for (const f of falhas) registrar(`  ${f.email}: ${f.erro}`)
  }
} else {
  registrar('  DRY-RUN CONCLUÍDO — nada foi gravado.')
  registrar('='.repeat(70))
  registrar('Para gravar de verdade: adicione --executar')
}

const marca = new Date().toISOString().replace(/[:.]/g, '-')
const nomeLog = `migracao/logs/importacao_${EXECUTAR ? 'exec' : 'dryrun'}_${marca}.log`
const nomeCsv = `migracao/logs/importacao_${EXECUTAR ? 'exec' : 'dryrun'}_${marca}.csv`
try {
  const { mkdirSync } = await import('node:fs')
  mkdirSync('migracao/logs', { recursive: true })
  writeFileSync(nomeLog, log.join('\n') + '\n', 'utf8')
  writeFileSync(nomeCsv, linhasCsv.join('\n') + '\n', 'utf8')
  console.log(`\nLog .. ${nomeLog}`)
  console.log(`CSV .. ${nomeCsv}  (situação de cada linha do arquivo)`)
} catch (e) {
  console.error('não consegui gravar os relatórios:', e.message)
}

process.exit(falhas.length ? 1 : 0)

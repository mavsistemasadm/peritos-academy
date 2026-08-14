// ══════════════════════════════════════════════════════
// O NEXUS MANDA LIBERAR — a ponta que faltava
//
// Quem chama é o webhook de pagamento do Nexus, quando alguém compra um curso
// avulso pelo link do Asaas. Até aqui a integração só ia num sentido (a Academy
// pedindo conta ao Nexus); a venda automática precisa do contrário, porque o
// pagamento chega no Nexus e o conteúdo mora aqui.
//
// Usa `concederAcessoNaAcademy`, o MESMO núcleo da tela do admin. Reimplementar
// aqui produziria uma venda automática que grava o que a tela recusa —
// concessão duplicada, ou nascida vencida — sem ninguém perceber, porque
// ninguém olha o que o webhook grava.
//
// ⚠️ **Idempotente de propósito.** Venda parcelada no Asaas confirma uma parcela
// por mês, e o webhook roda em todas. Da segunda em diante a concessão já
// existe: a resposta é `jaTinha: true` com 200, não erro. Um 4xx aqui faria o
// Nexus registrar doze falhas por venda que deu certo.
// ══════════════════════════════════════════════════════
import { NextResponse, type NextRequest } from 'next/server'
import { concederAcessoNaAcademy, daquiAMeses } from '@/lib/acessos/conceder'
import { criarClienteServico } from '@/lib/supabase/servico'

export async function POST(request: NextRequest) {
  // Falha fechada: chave ausente é problema de deploy, não do chamador.
  const chave = process.env.NEXUS_INTEGRACAO_KEY?.trim()
  if (!chave) {
    console.error('[CONCEDER-ACESSO] NEXUS_INTEGRACAO_KEY não configurada')
    return NextResponse.json({ error: 'integração não configurada' }, { status: 503 })
  }
  if (request.headers.get('x-integracao-key') !== chave) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }

  let corpo: {
    email?: string
    nome?: string
    /** `cursos.slug` — o Nexus não conhece os uuids daqui. */
    cursoSlug?: string
    /** Meses de acesso a partir de hoje. Ausente = vitalício. */
    meses?: number | null
    observacao?: string
  }
  try {
    corpo = await request.json()
  } catch {
    return NextResponse.json({ error: 'corpo inválido' }, { status: 400 })
  }

  const email = (corpo.email ?? '').trim().toLowerCase()
  const cursoSlug = (corpo.cursoSlug ?? '').trim()
  if (!email || !cursoSlug) {
    return NextResponse.json({ error: 'email e cursoSlug são obrigatórios' }, { status: 400 })
  }

  // O Nexus manda o SLUG, e a tradução para uuid é aqui: o catálogo é desta
  // plataforma, e um uuid de curso viajando pelo outro repositório seria um
  // valor opaco que ninguém consegue conferir na leitura do código de lá.
  const servico = criarClienteServico()
  const { data: curso } = await servico.from('cursos').select('id, titulo').eq('slug', cursoSlug).maybeSingle()
  if (!curso) {
    console.error('[CONCEDER-ACESSO] curso inexistente:', cursoSlug)
    return NextResponse.json({ error: `curso "${cursoSlug}" não existe nesta plataforma` }, { status: 404 })
  }

  const r = await concederAcessoNaAcademy({
    email,
    nome: (corpo.nome ?? '').trim(),
    escopo: 'curso',
    cursoId: curso.id,
    vitalicio: corpo.meses == null,
    expiraEm: corpo.meses == null ? null : daquiAMeses(corpo.meses),
    observacao: corpo.observacao ?? 'venda automática pelo Asaas',
  })

  if (!r.ok) {
    console.error('[CONCEDER-ACESSO] recusado:', email, cursoSlug, r.erro)
    return NextResponse.json({ error: r.erro }, { status: 422 })
  }

  console.warn(
    `[CONCEDER-ACESSO] ${email} -> ${cursoSlug} (conta ${r.contaCriada ? 'criada' : 'existente'}, ${
      r.jaTinha ? `já tinha até ${r.ate}` : 'concedido'
    })`
  )
  return NextResponse.json({
    ok: true,
    usuarioId: r.usuarioId,
    nome: r.nome,
    contaCriada: r.contaCriada,
    jaTinha: r.jaTinha,
    cursoTitulo: curso.titulo,
  })
}

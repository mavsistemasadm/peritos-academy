// app/api/webhooks/asaas/route.ts
// Primeira rota /api/ do projeto. Recebe eventos do Asaas, loga bruto em
// webhook_eventos (idempotente por evento_id_externo) e chama a RPC
// processar_evento_asaas — sem nenhuma chamada de volta pro Asaas ainda
// (chaves/validação real ficam pra quando a integração for conectada).
import { NextResponse, type NextRequest } from 'next/server'
import { criarClienteServidor } from '@/lib/supabase/server'

type PayloadAsaas = {
  event?: string
  payment?: { id?: string }
  subscription?: { id?: string }
}

export async function POST(request: NextRequest) {
  const tokenEsperado = process.env.ASAAS_WEBHOOK_TOKEN
  const tokenRecebido = request.headers.get('asaas-access-token')

  if (tokenEsperado) {
    if (tokenRecebido !== tokenEsperado) {
      return NextResponse.json({ erro: 'token inválido' }, { status: 401 })
    }
  } else {
    console.warn('[webhook/asaas] ASAAS_WEBHOOK_TOKEN não configurado — aceitando qualquer chamada sem validar origem. Configurar a env antes de conectar o Asaas de verdade.')
  }

  let body: PayloadAsaas
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ erro: 'payload inválido' }, { status: 400 })
  }

  const tipo = body?.event ?? null
  const paymentId = body?.payment?.id ?? null
  const eventoIdExterno = paymentId ? `${tipo}:${paymentId}` : null

  // Gera o id no cliente em vez de usar RETURNING: quem chama essa rota é o
  // Asaas sem sessão de usuário (role anon), que só tem policy de INSERT em
  // webhook_eventos — sem SELECT. Um `.select()` encadeado no insert exige
  // que a linha volte a passar por uma policy de SELECT, o que derruba o
  // insert inteiro com "new row violates row-level security policy" mesmo
  // a policy de insert estando correta.
  const eventoId = crypto.randomUUID()

  const supabase = await criarClienteServidor()
  const { error: erroInsert } = await supabase
    .from('webhook_eventos')
    .insert({ id: eventoId, origem: 'asaas', evento_id_externo: eventoIdExterno, tipo, payload: body })

  if (erroInsert) {
    if (erroInsert.code === '23505') return NextResponse.json({ ok: true, duplicado: true })
    console.error('[webhook/asaas] falha ao registrar evento:', erroInsert.message)
    return NextResponse.json({ erro: 'falha ao registrar evento' }, { status: 500 })
  }

  const { error: erroProcessar } = await supabase.rpc('processar_evento_asaas', { p_webhook_evento_id: eventoId })
  if (erroProcessar) {
    console.error('[webhook/asaas] falha ao processar evento:', erroProcessar.message)
  }

  return NextResponse.json({ ok: true })
}

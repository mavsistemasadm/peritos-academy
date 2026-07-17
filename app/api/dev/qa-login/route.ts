// ROTA TEMPORÁRIA DE QA — criada só pra validar visualmente o banner do hero
// (capa_horizontal_url do curso em destaque) como usuário NÃO-admin no
// navegador. Cria um usuário descartável, concede assinatura ativa e
// autentica via signInWithPassword server-side (senha gerada em memória,
// nunca digitada em nenhum formulário). Remover assim que o teste terminar.
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { criarClienteServico } from '@/lib/supabase/servico'
import { criarClienteServidor } from '@/lib/supabase/server'

const SECRET = 'qa-hero-temp-2026-07-15'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('secret') !== SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const servico = criarClienteServico()
  const email = `qa-hero-${Date.now()}@peritosacademy.com.br`
  const password = crypto.randomBytes(24).toString('hex')

  const { data: created, error: createErr } = await servico.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (createErr || !created.user) {
    return NextResponse.json({ error: createErr?.message ?? 'falha ao criar usuário' }, { status: 500 })
  }
  const userId = created.user.id

  const { data: plano } = await servico
    .from('planos_assinatura')
    .select('id')
    .eq('ativo', true)
    .limit(1)
    .maybeSingle()

  if (plano) {
    await servico.from('assinaturas').insert({
      usuario_id: userId,
      plano_id: plano.id,
      observacao: 'QA descartável — teste visual hero',
    })
  }

  const supabase = await criarClienteServidor()
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
  if (signInErr) {
    return NextResponse.json({ error: signInErr.message, userId }, { status: 500 })
  }

  return NextResponse.json({ ok: true, userId, email })
}

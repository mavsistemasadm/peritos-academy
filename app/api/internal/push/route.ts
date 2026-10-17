// ══════════════════════════════════════════════════════
// /api/internal/push — chamada pelo BANCO, não pela tela.
//
// O gatilho `trg_push_ao_notificar` posta { id } a cada linha nova em
// `notificacoes`, com o mesmo segredo do email (EMAIL_INTERNAL_SECRET aqui,
// public.email_internal_secret() no banco). Esta rota decide se o aviso vai
// ao celular (lib/push/avisos.ts) e pede a entrega à central do Nexus.
//
// Responde 200 até quando não manda nada: o pg_net não reenvia, e erro aqui
// só encheria o log do banco.
// ══════════════════════════════════════════════════════

import { NextResponse, type NextRequest } from 'next/server'
import { criarClienteServico } from '@/lib/supabase/servico'
import { avisoDoPush, vaiAoCelular, type NotificacaoDoSino } from '@/lib/push/avisos'
import { notificarNoNexus } from '@/lib/integracoes/nexus'

export async function POST(request: NextRequest) {
  const tokenEsperado = process.env.EMAIL_INTERNAL_SECRET
  const tokenRecebido = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!tokenEsperado || tokenRecebido !== tokenEsperado) {
    return NextResponse.json({ erro: 'token inválido' }, { status: 401 })
  }

  const { id } = (await request.json().catch(() => ({}))) as { id?: string }
  if (!id) return NextResponse.json({ erro: 'id obrigatório' }, { status: 400 })

  const sb = criarClienteServico()
  const { data: n, error } = await sb
    .from('notificacoes')
    .select('id, usuario_id, tipo, prefixo, destaque, sufixo, link_url, dados, lida')
    .eq('id', id)
    .maybeSingle()
  if (error || !n) {
    console.error(`[push] notificação ${id} não encontrada:`, error?.message)
    return NextResponse.json({ ok: true, enviado: false })
  }
  if (!vaiAoCelular(n.tipo) || n.lida) return NextResponse.json({ ok: true, enviado: false })

  // O email vai junto do id porque o Nexus acha o celular pelos dois: o id
  // da Academy falta em parte das contas de lá, e o email diverge em quem
  // assina com um e estuda com outro.
  const { data: conta } = await sb.auth.admin.getUserById(n.usuario_id)
  const enviado = await notificarNoNexus({
    ref: n.id,
    usuarioId: n.usuario_id,
    email: conta?.user?.email ?? null,
    ...avisoDoPush(n as NotificacaoDoSino),
  })
  return NextResponse.json({ ok: true, enviado })
}

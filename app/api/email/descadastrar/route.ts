// ══════════════════════════════════════════════════════════════════
// app/api/email/descadastrar — O DESCADASTRO DE UM CLIQUE
//
// Desde fevereiro de 2024, Gmail e Yahoo exigem descadastro de um clique de
// quem manda email em volume: o cabeçalho `List-Unsubscribe` apontando para um
// endereço que aceita **POST**, mais `List-Unsubscribe-Post`. Sem isso, a
// mensagem não é recusada — ela é **entregue com menos prioridade, ou direto
// na aba de promoções, ou na caixa de spam**. É o pior tipo de falha: nada
// erra, nada avisa, e o email simplesmente não é lido.
//
// ⚠️ Anunciar um clique e não atender o POST é PIOR do que não anunciar. O
// provedor chama esta rota sozinho, sem humano nenhum, quando a pessoa clica
// em "cancelar inscrição" no cabeçalho da própria caixa de entrada; se ela
// responder 404 ou 405, o provedor registra que o remetente promete e não
// cumpre, e isso conta contra a reputação do domínio.
//
// GET existe porque o mesmo endereço vai no rodapé do email, onde quem clica é
// gente. Aí não se apaga nada em silêncio: redireciona para a página, que
// confirma na tela o que foi feito.
// ══════════════════════════════════════════════════════════════════
import { NextResponse, type NextRequest } from 'next/server'
import { verificarTokenEmail, verificarTokenCancelamento } from '@/lib/email/token'
import { criarClienteServico } from '@/lib/supabase/servico'
import { SITE_URL } from '@/lib/site'

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  // Sempre 200, mesmo com token inválido. O provedor não distingue "token
  // errado" de "remetente quebrado": qualquer coisa fora de 2xx vira nota
  // ruim de reputação. O que existisse de errado no link já não tem conserto
  // do lado de cá neste momento.
  if (!token) return NextResponse.json({ ok: true })

  try {
    const supabase = criarClienteServico()

    // A ordem importa e é a mesma de /email/cancelar: o token de email tem
    // prefixo, o de usuário aceita qualquer payload assinado e engoliria o
    // outro, gravando um uuid que não existe.
    const email = verificarTokenEmail(token)
    if (email) {
      await supabase.from('email_optout_publico').upsert({ email: email.toLowerCase() }, { onConflict: 'email' })
      return NextResponse.json({ ok: true })
    }

    const usuarioId = verificarTokenCancelamento(token)
    if (usuarioId) {
      await supabase.from('email_preferencias')
        .upsert({ usuario_id: usuarioId, receber_emails: false }, { onConflict: 'usuario_id' })
    }
  } catch (e) {
    console.error('[descadastrar] falhou:', e)
  }

  return NextResponse.json({ ok: true })
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? ''
  return NextResponse.redirect(`${SITE_URL}/email/cancelar?token=${encodeURIComponent(token)}`)
}

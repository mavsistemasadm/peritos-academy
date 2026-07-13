// lib/gamificacao/login-diario.ts
// Credita o gatilho 'login_diario' no primeiro carregamento autenticado do dia.
// Idempotente pelo limite_diario=1 dentro de creditar_gamificacao — seguro chamar em toda request.
import { criarClienteServidor } from '@/lib/supabase/server'

export async function creditarLoginDiario(): Promise<void> {
  try {
    const supabase = await criarClienteServidor()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth?.user) return

    await supabase.rpc('creditar_gamificacao', {
      p_usuario: auth.user.id,
      p_codigo: 'login_diario',
    })
  } catch {
    // nunca deixa a gamificação quebrar o carregamento da página
  }
}

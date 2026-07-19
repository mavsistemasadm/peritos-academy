// lib/gamificacao/acesso-diario.ts
// Chokepoint único do acesso diário: streak (streak_dias/streak_estado) e o
// crédito de XP do gatilho login_diario, tudo dentro de registrar_acesso_diario()
// (idempotente por dia). Substitui o antigo lib/gamificacao/login-diario.ts, que
// chamava creditar_gamificacao direto — RPC que teve o EXECUTE revogado de
// authenticated (só é chamável de dentro de outra função security definer).
import { criarClienteServidor } from '@/lib/supabase/server'

export async function registrarAcessoDiario(): Promise<void> {
  try {
    const supabase = await criarClienteServidor()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth?.user) return

    await supabase.rpc('registrar_acesso_diario')
  } catch {
    // nunca deixa a gamificação/streak quebrar o carregamento da página
  }
}

// lib/supabase/servico.ts
// Cliente service-role — só pra jobs de sistema já autenticados por token
// compartilhado ANTES de chegar aqui (rotas /api/cron/* e
// /api/internal/email-evento, ambas gateadas por CRON_SECRET/
// EMAIL_INTERNAL_SECRET). Nunca importar de código alcançável por uma
// sessão de usuário comum — esses continuam usando criarClienteServidor().
import { createClient } from "@supabase/supabase-js";

export function criarClienteServico() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

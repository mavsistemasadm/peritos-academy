// app/api/cron/email-carta-pessoal/route.ts
// Roda 1x/dia (Vercel Cron, ver vercel.json). Usuários com conta criada
// entre 47h e 49h atrás — janela de 2h pra não duplicar entre execuções
// diárias, nem pular ninguém.
import { NextResponse, type NextRequest } from "next/server";
import { criarClienteServico } from "@/lib/supabase/servico";
import { enviarEmail } from "@/lib/email/enviar";
import { emailCartaPessoal } from "@/lib/email/templates/cartaPessoal";

function autorizado(request: NextRequest): boolean {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return !!process.env.CRON_SECRET && token === process.env.CRON_SECRET;
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] || nome;
}

export async function GET(request: NextRequest) {
  if (!autorizado(request)) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const supabase = criarClienteServico();
  const agora = Date.now();
  const de = new Date(agora - 49 * 3_600_000).toISOString();
  const ate = new Date(agora - 47 * 3_600_000).toISOString();

  const { data: candidatos, error } = await supabase
    .from("perfis")
    .select("id, nome")
    .gte("criado_em", de)
    .lte("criado_em", ate);

  if (error) {
    console.error("[cron/email-carta-pessoal] erro ao buscar candidatos", error.message);
    return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
  }

  let enviados = 0;
  for (const c of candidatos ?? []) {
    const { assunto, html } = emailCartaPessoal({ primeiroNome: primeiroNome(c.nome) });
    const r = await enviarEmail({ usuarioId: c.id, tipo: "carta_pessoal", assunto, html, remetente: "pessoal" });
    if (r.enviado) enviados++;
  }

  return NextResponse.json({ ok: true, candidatos: candidatos?.length ?? 0, enviados });
}

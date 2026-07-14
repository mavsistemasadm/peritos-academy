// app/api/cron/email-primeira-semana/route.ts
// Roda 1x/dia. Usuários com conta criada entre 6.5 e 7.5 dias atrás.
import { NextResponse, type NextRequest } from "next/server";
import { criarClienteServico } from "@/lib/supabase/servico";
import { enviarEmail } from "@/lib/email/enviar";
import { emailPrimeiraSemana } from "@/lib/email/templates/primeiraSemana";

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
  const de = new Date(agora - 7.5 * 86_400_000).toISOString();
  const ate = new Date(agora - 6.5 * 86_400_000).toISOString();

  const { data: candidatos, error } = await supabase
    .from("perfis")
    .select("id, nome, xp")
    .gte("criado_em", de)
    .lte("criado_em", ate);

  if (error) {
    console.error("[cron/email-primeira-semana] erro ao buscar candidatos", error.message);
    return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
  }

  let enviados = 0;
  for (const c of candidatos ?? []) {
    const { count: aulasConcluidas } = await supabase
      .from("aula_progresso")
      .select("id", { count: "exact", head: true })
      .eq("usuario_id", c.id)
      .eq("concluida", true);

    const { data: extrato } = await supabase
      .from("gamificacao_extrato")
      .select("criado_em")
      .eq("usuario_id", c.id);
    const diasAtivos = new Set(
      (extrato ?? []).map((e) => new Date(e.criado_em).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }))
    ).size;

    const { assunto, html } = emailPrimeiraSemana({
      primeiroNome: primeiroNome(c.nome),
      xpTotal: c.xp ?? 0,
      aulasConcluidas: aulasConcluidas ?? 0,
      diasAtivos,
    });
    const r = await enviarEmail({ usuarioId: c.id, tipo: "primeira_semana", assunto, html, remetente: "pessoal" });
    if (r.enviado) enviados++;
  }

  return NextResponse.json({ ok: true, candidatos: candidatos?.length ?? 0, enviados });
}

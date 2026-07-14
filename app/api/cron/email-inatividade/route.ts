// app/api/cron/email-inatividade/route.ts
// Roda 1x/dia, duas passagens: 7 dias (janela 6.5-7.5d, cooldown 30d) e
// 21 dias (janela 20.5-21.5d, cooldown 60d). "Última atividade" = maior
// entre gamificacao_extrato e aula_progresso, via RPC email_usuarios_inativos
// (agregação em SQL, evita N+1 em TS).
//
// ref_id = data de hoje (YYYY-MM-DD): a dedupe permanente de enviarEmail()
// é por (usuario, tipo, ref_id) — com ref_id fixo nunca mandaria de novo
// depois do cooldown. Com a data do dia, cada ciclo de inatividade (que só
// pode acontecer de novo depois do cooldown) usa uma chave nova; a checagem
// de "já recebeu nos últimos N dias" é feita aqui, direto em email_enviados.
import { NextResponse, type NextRequest } from "next/server";
import { criarClienteServico } from "@/lib/supabase/servico";
import { enviarEmail, type TipoEmail } from "@/lib/email/enviar";
import { emailInatividade } from "@/lib/email/templates/inatividade";

function autorizado(request: NextRequest): boolean {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return !!process.env.CRON_SECRET && token === process.env.CRON_SECRET;
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] || nome;
}

type CandidatoInativo = { usuario_id: string; nome: string; xp: number; nivel: number; aulas_concluidas: number };

async function processarJanela(
  supabase: ReturnType<typeof criarClienteServico>,
  opts: { diasMin: number; diasMax: number; dias: 7 | 21; tipo: TipoEmail; cooldownDias: number }
) {
  const { data: candidatos, error } = await supabase.rpc("email_usuarios_inativos", {
    p_dias_min: opts.diasMin,
    p_dias_max: opts.diasMax,
  });
  if (error) {
    console.error(`[cron/email-inatividade] erro ao buscar candidatos ${opts.dias}d`, error.message);
    return { candidatos: 0, enviados: 0 };
  }

  const cooldownIso = new Date(Date.now() - opts.cooldownDias * 86_400_000).toISOString();
  const hoje = new Date().toISOString().slice(0, 10);

  let enviados = 0;
  for (const c of (candidatos ?? []) as CandidatoInativo[]) {
    const { data: recente } = await supabase
      .from("email_enviados")
      .select("id")
      .eq("usuario_id", c.usuario_id)
      .eq("tipo", opts.tipo)
      .gte("criado_em", cooldownIso)
      .maybeSingle();
    if (recente) continue;

    const { assunto, html } = emailInatividade(opts.dias, {
      primeiroNome: primeiroNome(c.nome),
      xpTotal: c.xp ?? 0,
      aulasConcluidas: c.aulas_concluidas ?? 0,
      nivelOrdem: c.nivel ?? 0,
    });
    const r = await enviarEmail({
      usuarioId: c.usuario_id,
      tipo: opts.tipo,
      refId: hoje,
      assunto,
      html,
      remetente: "pessoal",
    });
    if (r.enviado) enviados++;
  }

  return { candidatos: candidatos?.length ?? 0, enviados };
}

export async function GET(request: NextRequest) {
  if (!autorizado(request)) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const supabase = criarClienteServico();
  const pass7 = await processarJanela(supabase, { diasMin: 6.5, diasMax: 7.5, dias: 7, tipo: "inatividade_7", cooldownDias: 30 });
  const pass21 = await processarJanela(supabase, { diasMin: 20.5, diasMax: 21.5, dias: 21, tipo: "inatividade_21", cooldownDias: 60 });

  return NextResponse.json({ ok: true, inatividade_7: pass7, inatividade_21: pass21 });
}

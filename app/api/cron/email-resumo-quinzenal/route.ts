// app/api/cron/email-resumo-quinzenal/route.ts
// Roda 1x/dia. Candidatos vêm prontos da RPC email_candidatos_resumo_quinzenal
// (já filtra "15+ dias desde o último resumo" e "teve atividade no período").
// ref_id = data de hoje — mesma lógica de email-inatividade: permite o
// próximo resumo (daqui a 15 dias) usar uma chave nova.
import { NextResponse, type NextRequest } from "next/server";
import { criarClienteServico } from "@/lib/supabase/servico";
import { enviarEmail } from "@/lib/email/enviar";
import { emailResumoQuinzenal } from "@/lib/email/templates/resumoQuinzenal";

function autorizado(request: NextRequest): boolean {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return !!process.env.CRON_SECRET && token === process.env.CRON_SECRET;
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] || nome;
}

type Candidato = {
  usuario_id: string;
  nome: string;
  xp_total: number;
  nivel_nome: string;
  xp_periodo: number;
  aulas_periodo: number;
  streak_dias: number;
  subiu_nivel: boolean;
  novo_nivel_nome: string | null;
};

export async function GET(request: NextRequest) {
  if (!autorizado(request)) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const supabase = criarClienteServico();
  const { data: candidatos, error } = await supabase.rpc("email_candidatos_resumo_quinzenal");
  if (error) {
    console.error("[cron/email-resumo-quinzenal] erro ao buscar candidatos", error.message);
    return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
  }

  const hoje = new Date().toISOString().slice(0, 10);
  let enviados = 0;
  for (const c of (candidatos ?? []) as Candidato[]) {
    // ══════════════════════════════════════════════════════
    // ⚠️ LOGIN NÃO É QUINZENA — 31/08/2026
    // ══════════════════════════════════════════════════════
    // A RPC filtra por `xp_periodo > 0 or aulas_periodo > 0`, e parece bastar.
    // Não basta: `login_diario` dá 5 XP. Quem entrou duas vezes e não assistiu
    // nada tem xp_periodo = 10 e passa no filtro.
    //
    // Foi exatamente o que aconteceu com o comprador do PJe-Calc de 15/08: dois
    // logins, zero aulas, e em 30/08 recebeu "Que quinzena, sixsurf!" com um
    // retrato de +10 XP e 0 aulas. Um resumo de estudo sem estudo nenhum.
    //
    // A guarda fica AQUI, e não na RPC, porque é reversível sem migração e
    // porque a RPC continua sendo a fonte dos números — o que muda é só quem
    // merece o retrato. Sem aula concluída no período não há quinzena a
    // resumir, e o silêncio é mais honesto que a comemoração.
    if (!c.aulas_periodo) {
      continue;
    }

    const { assunto, html } = emailResumoQuinzenal({
      primeiroNome: primeiroNome(c.nome),
      xpPeriodo: c.xp_periodo ?? 0,
      aulasPeriodo: c.aulas_periodo ?? 0,
      streakDias: c.streak_dias ?? 0,
      nivelNome: c.nivel_nome ?? "",
      xpTotal: c.xp_total ?? 0,
      subiuDeNivelNoPeriodo: c.subiu_nivel,
      novoNivelNome: c.novo_nivel_nome ?? undefined,
    });
    const r = await enviarEmail({
      usuarioId: c.usuario_id,
      tipo: "resumo_quinzenal",
      refId: hoje,
      assunto,
      html,
      remetente: "automatico",
    });
    if (r.enviado) enviados++;
  }

  return NextResponse.json({ ok: true, candidatos: candidatos?.length ?? 0, enviados });
}

// lib/email/enviar.ts
// Chokepoint único de envio de email — checa preferência, duplicata e
// limite diário de celebração/jornada, injeta os links de rodapé, chama
// Resend e registra em email_enviados. Nunca chamado do cliente. Qualquer
// falha é silenciosa (log, não lança) — mesmo padrão de
// lib/gamificacao/login-diario.ts.
import { Resend } from "resend";
import { criarClienteServico } from "@/lib/supabase/servico";
import { gerarTokenCancelamento } from "./token";

export type TipoEmail =
  | "boas_vindas"
  | "nivel_up"
  | "certificado"
  | "curso_concluido"
  | "carta_pessoal"
  | "primeira_semana"
  | "resumo_quinzenal"
  | "inatividade_7"
  | "inatividade_21";

const REMETENTES: Record<"pessoal" | "automatico", { from: string; replyTo: string }> = {
  pessoal: { from: "Marlos Henrique <marlos@peritosacademy.com.br>", replyTo: "marlos@peritosacademy.com.br" },
  automatico: { from: "Peritos Academy <noreply@peritosacademy.com.br>", replyTo: "marlos@peritosacademy.com.br" },
};

// Prioridade — índice menor = mais prioritário. Só esses tipos entram na
// checagem de "1 email de celebração por dia"; boas_vindas e certificado
// NÃO competem por esse limite (são transacionais diretos: boas-vindas é
// onboarding único, certificado é a prova formal de uma conquista — nenhum
// dos dois pode ser silenciosamente engolido por um teto de celebração).
const PRIORIDADE: TipoEmail[] = [
  "nivel_up",
  "curso_concluido",
  "carta_pessoal",
  "primeira_semana",
  "resumo_quinzenal",
  "inatividade_7",
  "inatividade_21",
];

type EnviarEmailInput = {
  usuarioId: string;
  tipo: TipoEmail;
  refId?: string;
  assunto: string;
  html: string;
  remetente: "pessoal" | "automatico";
};

type ResultadoEnvio = { enviado: boolean; motivo?: string };

function inicioDoDiaSaoPauloISO(): string {
  // Brasil não observa horário de verão desde 2019 — offset fixo UTC-3.
  const OFFSET_MS = 3 * 60 * 60 * 1000;
  const agoraUtc = new Date();
  const spAgora = new Date(agoraUtc.getTime() - OFFSET_MS);
  const meiaNoiteSpComoUtc = Date.UTC(spAgora.getUTCFullYear(), spAgora.getUTCMonth(), spAgora.getUTCDate(), 0, 0, 0);
  return new Date(meiaNoiteSpComoUtc + OFFSET_MS).toISOString();
}

function injetarLinksRodape(html: string, usuarioId: string): string {
  const prefUrl = "https://peritos-academy.vercel.app/perfil";
  const cancelarUrl = `https://peritos-academy.vercel.app/email/cancelar?token=${gerarTokenCancelamento(usuarioId)}`;
  return html.replace(
    "Preferências de email · Cancelar inscrição",
    `<a href="${prefUrl}" style="color:#b4bac6;text-decoration:underline;">Preferências de email</a> · <a href="${cancelarUrl}" style="color:#b4bac6;text-decoration:underline;">Cancelar inscrição</a>`
  );
}

export async function enviarEmail(input: EnviarEmailInput): Promise<ResultadoEnvio> {
  try {
    const supabase = criarClienteServico();

    const { data: pref } = await supabase
      .from("email_preferencias")
      .select("receber_emails")
      .eq("usuario_id", input.usuarioId)
      .maybeSingle();
    if (pref && pref.receber_emails === false) return { enviado: false, motivo: "preferencia_desligada" };

    let queryDuplicata = supabase
      .from("email_enviados")
      .select("id")
      .eq("usuario_id", input.usuarioId)
      .eq("tipo", input.tipo);
    queryDuplicata = input.refId ? queryDuplicata.eq("ref_id", input.refId) : queryDuplicata.is("ref_id", null);
    const { data: existente } = await queryDuplicata.maybeSingle();
    if (existente) return { enviado: false, motivo: "duplicado" };

    const prioridadeAtual = PRIORIDADE.indexOf(input.tipo);
    if (prioridadeAtual !== -1) {
      const { data: enviadosHoje } = await supabase
        .from("email_enviados")
        .select("tipo")
        .eq("usuario_id", input.usuarioId)
        .gte("criado_em", inicioDoDiaSaoPauloISO());
      const jaTemPrioridadeIgualOuMaior = (enviadosHoje ?? []).some((r) => {
        const idx = PRIORIDADE.indexOf(r.tipo as TipoEmail);
        return idx !== -1 && idx <= prioridadeAtual;
      });
      if (jaTemPrioridadeIgualOuMaior) return { enviado: false, motivo: "limite_diario" };
    }

    const { data: usuarioAuth, error: erroAuth } = await supabase.auth.admin.getUserById(input.usuarioId);
    const destinatario = usuarioAuth?.user?.email;
    if (erroAuth || !destinatario) return { enviado: false, motivo: "sem_email" };

    const html = injetarLinksRodape(input.html, input.usuarioId);
    const { from, replyTo } = REMETENTES[input.remetente];

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data: envio, error: erroResend } = await resend.emails.send({
      from,
      replyTo,
      to: destinatario,
      subject: input.assunto,
      html,
    });
    if (erroResend || !envio) {
      console.error("[email] falha ao enviar", input.tipo, erroResend);
      return { enviado: false, motivo: "falha_resend" };
    }

    await supabase.from("email_enviados").insert({
      usuario_id: input.usuarioId,
      tipo: input.tipo,
      ref_id: input.refId ?? null,
      assunto: input.assunto,
    });

    return { enviado: true };
  } catch (e) {
    console.error("[email] erro inesperado ao enviar", input.tipo, e);
    return { enviado: false, motivo: "erro_inesperado" };
  }
}

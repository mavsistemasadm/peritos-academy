// lib/email/marca.ts
// ══════════════════════════════════════════════════════
// A CARA DOS E-MAILS DA PERITOS ACADEMY (19/10/2026)
//
// Pedido do dono: a mesma pegada do e-mail da MH Cálculos que ele escolheu
// entre cinco modelos (mh-gestao: lib/email-marca-mh.ts). Branco, minimalista,
// a logo no centro, uma linha fina em degradê no topo (aqui verde → ciano →
// lima, as cores da marca), destaque em caixa clara, botão só com contorno e a
// faixa de números em cinza. Substitui o cabeçalho escuro em degradê e os
// botões cheios dos templates de julho.
//
// Os TEXTOS de cada e-mail continuam os aprovados (docs/email-templates/); o
// que muda é só o envelope. Todos os templates montam com estas peças, então
// um ajuste de visual se faz aqui, uma vez.
//
// ⚠️ O RODAPÉ TEM QUE TER, LITERAL, "Preferências de email · Cancelar
// inscrição": é essa frase que lib/email/enviar.ts troca pelos dois links
// reais. Mudar uma vírgula deixa o e-mail sem descadastro.
// ══════════════════════════════════════════════════════
import { SITE_URL } from "@/lib/site";

export const FONTE =
  "Nunito,'SF Pro Rounded',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif";

const LOGO = `${SITE_URL}/img/logo.png`;

export const COR = {
  texto: "#1F2937",
  suave: "#6B7280",
  apagado: "#9CA3AF",
  marinho: "#083952",
  verde: "#0e9e82",
  verdeEscuro: "#0a6e6a",
  caixa: "#F1FAF7",
};

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Um parágrafo do corpo. Recebe HTML (pode ter <b>, <br>, links). */
export function p(html: string, extra = ""): string {
  return `<p style="margin:0 0 18px;font-family:${FONTE};font-size:16px;line-height:1.7;color:${COR.texto};${extra}">${html}</p>`;
}

/** A frase de destaque, numa caixa clara (era a caixa com borda verde). */
export function destaque(html: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 26px;background:${COR.caixa};border-radius:12px;"><tr><td style="padding:18px 22px;font-family:${FONTE};font-size:16px;line-height:1.65;color:${COR.marinho};font-weight:700;">${html}</td></tr></table>`;
}

/** Linhas de rótulo e valor, numa caixa clara (o "resumo" do modelo da MH). */
export function resumo(linhas: [string, string][]): string {
  const tr = linhas
    .filter(([, v]) => v && String(v).trim())
    .map(
      ([k, v]) =>
        `<tr><td style="padding:3px 18px 3px 0;font-family:${FONTE};font-size:14px;color:${COR.apagado};white-space:nowrap;vertical-align:top;">${esc(k)}</td><td style="padding:3px 0;font-family:${FONTE};font-size:14px;color:#374151;">${v}</td></tr>`,
    )
    .join("");
  if (!tr) return "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 26px;background:${COR.caixa};border-radius:12px;"><tr><td style="padding:16px 22px;"><table role="presentation" cellpadding="0" cellspacing="0">${tr}</table></td></tr></table>`;
}

/** O botão: só contorno. Centralizado por padrão. */
export function botao(texto: string, url: string, alinhar: "center" | "left" = "center"): string {
  return `<p style="margin:8px 0 32px;text-align:${alinhar};"><a href="${url}" target="_blank" style="display:inline-block;padding:12px 26px;border:1.5px solid ${COR.verde};border-radius:10px;color:${COR.verdeEscuro};font-family:${FONTE};font-size:15px;font-weight:700;text-decoration:none;">${esc(texto)}</a></p>`;
}

/** A abertura: um sobretítulo pequeno e o título do e-mail. */
export function abertura(sobretitulo: string | null, titulo: string): string {
  return (
    (sobretitulo
      ? `<p style="margin:0 0 10px;font-family:${FONTE};font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${COR.verde};text-align:center;">${sobretitulo}</p>`
      : "") +
    `<p style="margin:0 0 30px;font-family:${FONTE};font-size:24px;line-height:1.35;font-weight:800;color:${COR.marinho};text-align:center;letter-spacing:-.3px;">${titulo}</p>`
  );
}

/** A insígnia (nível, certificado): imagem num círculo claro, rótulo, nome e uma linha. */
export function insignia(a: { img: string; rotulo: string; nome: string; linha?: string; tamanho?: number }): string {
  const t = a.tamanho ?? 84;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 30px;"><tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" style="width:${t + 36}px;height:${t + 36}px;border-radius:50%;background:${COR.caixa};"><img src="${a.img}" width="${t}" alt="" style="display:block;margin:0 auto;border:0;"></td></tr></table>
<p style="margin:14px 0 4px;font-family:${FONTE};font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${COR.verde};">${a.rotulo}</p>
<p style="margin:0 0 6px;font-family:${FONTE};font-size:20px;font-weight:800;color:${COR.marinho};">${a.nome}</p>
${a.linha ? `<p style="margin:0;font-family:${FONTE};font-size:13px;color:${COR.apagado};">${a.linha}</p>` : ""}
</td></tr></table>`;
}

/** Números lado a lado (estatística do aluno, por exemplo). */
export function numeros(itens: [string, string][]): string {
  const w = Math.floor(100 / Math.max(1, itens.length));
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 28px;"><tr>${itens
    .map(
      ([n, r], i) =>
        `<td width="${w}%" align="center" style="padding:10px 4px;font-family:${FONTE};${i ? "border-left:1px solid #EEEEEE;" : ""}"><b style="display:block;font-size:20px;color:${COR.marinho};">${n}</b><span style="font-size:12px;color:${COR.apagado};">${r}</span></td>`,
    )
    .join("")}</tr></table>`;
}

/** A assinatura de quem escreve. */
export function assinatura(nome = "Marlos Henrique", antes = "", depois = ""): string {
  return (
    (antes ? `<p style="margin:0 0 2px;font-family:${FONTE};font-size:15px;color:${COR.suave};">${antes}</p>` : "") +
    `<p style="margin:0 0 ${depois ? 2 : 30}px;font-family:${FONTE};font-size:16px;font-weight:800;color:${COR.marinho};">${nome}</p>` +
    (depois ? `<p style="margin:0 0 30px;font-family:${FONTE};font-size:14px;color:${COR.suave};">${depois}</p>` : "")
  );
}

/**
 * O envelope. `corpo` é o HTML montado com as peças acima.
 * `motivo` é a frase "Você recebeu este email porque…" do rodapé.
 * `descadastro` troca a frase de descadastro do rodapé: os emails de evento
 * saem por enviarEmailConvidado(), que procura "Não quero mais receber estes
 * e-mails" (lib/email/enviarConvidado.ts), e não a frase de enviarEmail().
 */
export function casca(a: {
  titulo: string;
  preheader?: string | null;
  corpo: string;
  motivo: string;
  descadastro?: string;
}): string {
  const pre = a.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${esc(a.preheader)}${"&zwnj;&nbsp;".repeat(40)}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800&display=swap" rel="stylesheet">
<title>${esc(a.titulo)}</title>
</head>
<body style="margin:0;padding:0;background:#FFFFFF;">
${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;"><tr><td align="center" style="padding:0 16px 36px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;">
<tr><td style="height:4px;line-height:4px;font-size:0;background-color:#1DC8A0;background-image:linear-gradient(90deg,#0e9e82 0%,#1DC8A0 35%,#36DCD1 65%,#DDF784 100%);">&nbsp;</td></tr>
<tr><td align="center" style="padding:30px 0 6px;"><img src="${LOGO}" width="52" height="53" alt="Peritos Academy" style="display:block;border:0;"></td></tr>
<tr><td align="center" style="padding:0 0 30px;font-family:${FONTE};font-size:13px;font-weight:700;letter-spacing:.08em;color:${COR.marinho};">PERITOS ACADEMY</td></tr>
<tr><td style="padding:0 4px;">
${a.corpo}
</td></tr>
<tr><td style="border-top:1px solid #EEEEEE;padding:22px 0 0;" align="center">
<p style="margin:0 0 6px;font-family:${FONTE};font-size:12px;color:${COR.apagado};">Peritos Academy · A jornada completa da perícia judicial</p>
<p style="margin:0;font-family:${FONTE};font-size:11px;line-height:1.6;color:#b4bac6;">${a.motivo}<br/>${a.descadastro ?? "Preferências de email · Cancelar inscrição"}</p>
</td></tr>
</table></td></tr></table>
</body>
</html>`;
}

// lib/email/templates/acessoLiberado.ts
// Aviso de acesso liberado — disparado por BOTÃO no /admin/acessos, nunca
// automaticamente pelo cadastro.
//
// A estrutura visual segue os outros templates (mesma moldura escura, mesmo
// bloco de rodapé com o texto "Preferências de email · Cancelar inscrição",
// que `enviarEmail` troca pelos links reais — se essa frase mudar aqui, os
// links do rodapé somem sem erro nenhum).
//
// O destino é `/primeiro-acesso`, e não um link de senha pronto: link de
// recuperação do Supabase expira, e um aviso é lido ao longo de dias. Foi a
// mesma decisão da migração dos 403 alunos da Ensinio. Para quem já tem conta,
// a página também serve — ela manda o link de definir senha para qualquer
// e-mail cadastrado.
import { SITE_URL } from "@/lib/site";

export type DadosAcessoLiberado = {
  primeiroNome: string;
  /** O que a pessoa ganhou, já escrito: "o curso Revisão do saldo da conta PASEP". */
  oQueGanhou: string;
  /** "com acesso vitalício" ou "com acesso até 30/09/2026". */
  vigencia: string;
};

export function emailAcessoLiberado(d: DadosAcessoLiberado): { assunto: string; html: string } {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#0b0f14;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0f14;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#111820;border-radius:14px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <tr><td style="padding:32px 32px 8px 32px;">
          <div style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#1DC8A0;">Peritos Academy</div>
        </td></tr>

        <tr><td style="padding:8px 32px 0 32px;">
          <h1 style="margin:0;font-size:26px;line-height:1.25;font-weight:800;color:#ffffff;">Seu acesso está liberado, ${d.primeiroNome}</h1>
        </td></tr>

        <tr><td style="padding:18px 32px 0 32px;">
          <p style="margin:0;font-size:15.5px;line-height:1.65;color:#c8cfda;">
            Liberamos ${d.oQueGanhou} na sua conta da Peritos Academy, ${d.vigencia}.
          </p>
        </td></tr>

        <tr><td style="padding:20px 32px 0 32px;">
          <p style="margin:0;font-size:15.5px;line-height:1.65;color:#c8cfda;">
            Para entrar, defina sua senha na página abaixo usando <strong style="color:#ffffff;">este mesmo e-mail</strong>.
            É rápido, e você só precisa fazer isso uma vez.
          </p>
        </td></tr>

        <tr><td align="center" style="padding:28px 32px 8px 32px;">
          <a href="${SITE_URL}/primeiro-acesso" style="display:inline-block;padding:16px 32px;background:#1DC8A0;border-radius:10px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:.01em;">Definir minha senha e entrar</a>
        </td></tr>

        <tr><td style="padding:16px 32px 0 32px;">
          <p style="margin:0;font-size:13.5px;line-height:1.6;color:#8b929e;">
            Se o botão não abrir, copie este endereço no navegador:<br />
            <span style="color:#b4bac6;">${SITE_URL}/primeiro-acesso</span>
          </p>
        </td></tr>

        <tr><td style="padding:28px 32px 32px 32px;">
          <div style="border-top:1px solid #1e2731;padding-top:18px;">
            <p style="margin:0;font-size:12.5px;line-height:1.6;color:#6f7681;">
              Você recebeu este e-mail porque tem uma conta na Peritos Academy.<br />
              Preferências de email · Cancelar inscrição
            </p>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { assunto: "Seu acesso na Peritos Academy está liberado", html };
}

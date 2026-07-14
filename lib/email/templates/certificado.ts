// lib/email/templates/certificado.ts
// HTML copiado literalmente de docs/email-templates/email_certificado_emitido.html.
// O parágrafo final do corpo ("Cada uma dessas aulas exigiu tempo...") É o
// slot de {CONTEXTO_CERTIFICADO} — usa cursos.contexto_certificado quando
// preenchido, senão essa frase exata (default do próprio template aprovado).
export type DadosCertificado = {
  primeiroNome: string;
  nomeCompleto: string;
  cursoNome: string;
  totalAulas: number;
  totalHoras: number;
  totalAvaliacoes: number;
  dataConclusao: string; // já formatada dd/mm/aaaa
  contextoCertificado: string | null;
};

const CONTEXTO_PADRAO =
  "Cada uma dessas aulas exigiu tempo, atenção e a decisão de continuar quando dava vontade de parar. Você continuou. Até o fim.";

function truncar(texto: string, max: number): string {
  return texto.length <= max ? texto : texto.slice(0, max - 1).trimEnd() + "…";
}

export function emailCertificado(d: DadosCertificado): { assunto: string; html: string } {
  const contexto = d.contextoCertificado?.trim() || CONTEXTO_PADRAO;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Certificado emitido</title>
</head>
<body style="margin:0;padding:0;">
<div style="background:#eef0f4;padding:32px 16px;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 2px 14px rgba(6,30,53,0.10);">

    <div style="background:linear-gradient(150deg,#1DC8A0 0%,#0e9e82 20%,#083d5a 50%,#061e35 80%,#040f1e 100%);padding:38px 40px 34px;">
      <p style="margin:0 0 26px;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.45);">CERTIFICADO EMITIDO</p>
      <p style="margin:0 0 22px;font-size:26px;font-weight:800;line-height:36px;color:#ffffff;letter-spacing:-0.5px;">Isso agora é seu.<br>E ninguém tira.</p>
      <div style="width:52px;height:3px;background:linear-gradient(90deg,#1DC8A0,rgba(29,200,160,0));border-radius:2px;"></div>
    </div>

    <div style="padding:40px 40px 0;text-align:center;">
      <div style="max-width:380px;margin:0 auto 24px;border:2px solid #e8e8e4;border-radius:12px;overflow:hidden;">
        <div style="background:#fdf7e3;padding:20px 24px 16px;border-bottom:2px solid #F2C21D;">
          <p style="margin:0 0 4px;font-size:11px;letter-spacing:3px;color:#B8860B;font-weight:700;">CERTIFICADO DE CONCLUSÃO</p>
          <p style="margin:0 0 10px;font-size:18px;font-weight:800;color:#083952;letter-spacing:-0.3px;">${d.cursoNome}</p>
          <p style="margin:0;font-size:13px;color:#888880;">Conferido a <strong style="color:#083952;">${d.nomeCompleto}</strong></p>
        </div>
        <div style="background:#ffffff;padding:14px 24px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#888880;">Peritos Academy · ${d.dataConclusao}</p>
        </div>
      </div>
    </div>

    <div style="padding:20px 40px 16px;">

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">${d.primeiroNome}, para e sente o peso do que você acabou de fazer.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Você concluiu o curso <strong>${d.cursoNome}</strong>. Foram <strong>${d.totalAulas} aulas</strong>, <strong>${d.totalHoras}h de conteúdo</strong> e <strong>${d.totalAvaliacoes} avaliações aprovadas</strong>. ${contexto}</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Esse certificado não é um PDF bonito. É a prova documentada de tudo isso. Ele fica disponível no seu perfil pra sempre, pronto pra usar quando você precisar.</p>

      <div style="margin:30px 0;background:#edf9f6;border-left:4px solid #1DC8A0;border-radius:0 12px 12px 0;padding:20px 24px;">
        <p style="margin:0;font-size:17px;line-height:30px;color:#083952;font-style:italic;font-weight:700;">Certificado não anda pra trás. O que você conquistou, conquistou.</p>
      </div>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Onde usar? Em processos judiciais como prova de capacitação técnica. Com clientes como diferencial de confiança. No seu currículo de nomeações como assistente técnico ou perito judicial. Ele abre portas que ficam abertas.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">E amanhã é dia de abrir o próximo capítulo. Tem mais cursos esperando, mais certificados pra conquistar, e mais um degrau na jornada que só depende de você.</p>

      <div style="margin:8px 0 36px;text-align:center;">
        <a href="https://peritos-academy.vercel.app/perfil" style="display:inline-block;padding:16px 32px;background:#1DC8A0;border-radius:10px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:.01em;">Ver meu certificado no perfil</a>
      </div>

      <div style="margin-bottom:36px;border-left:3px solid #1DC8A0;padding-left:16px;">
        <p style="margin:0 0 2px;font-size:15px;line-height:22px;color:#888880;">Orgulhoso dessa conquista,</p>
        <p style="margin:0;font-size:19px;font-weight:800;color:#083952;letter-spacing:-0.3px;">Marlos Henrique</p>
      </div>

    </div>
  </div>

  <div style="max-width:600px;margin:0 auto;text-align:center;padding:22px 16px 6px;">
    <p style="font-size:12px;color:#9aa1b0;margin:0 0 6px;">Peritos Academy · A jornada completa da perícia judicial</p>
    <p style="font-size:11px;color:#b4bac6;margin:0;">Você recebeu este email porque faz parte da Peritos Academy.<br/>Preferências de email · Cancelar inscrição</p>
  </div>
</div>
</body>
</html>`;

  return { assunto: truncar(`Certificado pronto: ${d.cursoNome}`, 50), html };
}

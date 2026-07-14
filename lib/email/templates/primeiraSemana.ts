// lib/email/templates/primeiraSemana.ts
// HTML copiado literalmente de docs/email-templates/email_primeira_semana.html
export type DadosPrimeiraSemana = {
  primeiroNome: string;
  xpTotal: number;
  aulasConcluidas: number;
  diasAtivos: number;
};

function fmtNum(n: number): string {
  return n.toLocaleString("pt-BR");
}

export function emailPrimeiraSemana(d: DadosPrimeiraSemana): { assunto: string; html: string } {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sua primeira semana</title>
</head>
<body style="margin:0;padding:0;">
<div style="background:#eef0f4;padding:32px 16px;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 2px 14px rgba(6,30,53,0.10);">

    <div style="background:linear-gradient(150deg,#1DC8A0 0%,#0e9e82 20%,#0a6e6a 45%,#083d5a 70%,#061e35 100%);padding:38px 40px 34px;">
      <p style="margin:0 0 26px;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.45);">SUA PRIMEIRA SEMANA</p>
      <p style="margin:0 0 22px;font-size:26px;font-weight:800;line-height:36px;color:#ffffff;letter-spacing:-0.5px;">7 dias. E você já não é<br>o mesmo de antes.</p>
      <div style="width:52px;height:3px;background:linear-gradient(90deg,#1DC8A0,rgba(29,200,160,0));border-radius:2px;"></div>
    </div>

    <div style="padding:36px 40px 0;text-align:center;">
      <div style="background:#edf9f6;border-radius:12px;padding:24px 20px;">
        <p style="font-size:11px;letter-spacing:3px;color:#0e9e82;font-weight:700;margin:0 0 16px;">SEUS PRIMEIROS 7 DIAS</p>
        <p style="margin:0 0 6px;font-size:28px;font-weight:800;color:#083952;">${fmtNum(d.xpTotal)} XP</p>
        <p style="margin:0;font-size:14px;color:#888880;">${d.aulasConcluidas} aulas concluídas · ${d.diasAtivos} dias ativos</p>
      </div>
    </div>

    <div style="padding:34px 40px 16px;">

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">${d.primeiroNome}, uma semana atrás você criou sua conta na Peritos Academy. Sete dias. E olha o que já aconteceu.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Esses ${fmtNum(d.xpTotal)} XP não são números soltos. Cada ponto é uma aula que você assistiu, uma decisão que você tomou, um pedaço de conhecimento que agora faz parte de quem você é como profissional.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Sabe o que a primeira semana prova? Que você não é turista. Turista cria a conta e some. Você criou a conta e <strong>estudou</strong>.</p>

      <div style="margin:30px 0;background:#edf9f6;border-left:4px solid #1DC8A0;border-radius:0 12px 12px 0;padding:20px 24px;">
        <p style="margin:0;font-size:17px;line-height:30px;color:#083952;font-style:italic;font-weight:700;">A primeira semana é onde se separa quem veio ficar de quem só veio olhar. Você ficou.</p>
      </div>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">E agora vem a parte boa: a segunda semana. O conhecimento começa a se acumular, as peças começam a se encaixar, e aquele conteúdo que parecia denso vai ficando cada vez mais natural.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Mantém o ritmo. Uma aula por dia já muda tudo. E a comunidade inteira está caminhando junto com você.</p>

      <div style="margin:8px 0 36px;text-align:center;">
        <a href="https://peritos-academy.vercel.app" style="display:inline-block;padding:16px 32px;background:#1DC8A0;border-radius:10px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:.01em;">Continuar estudando</a>
      </div>

      <div style="margin-bottom:36px;border-left:3px solid #1DC8A0;padding-left:16px;">
        <p style="margin:0 0 2px;font-size:15px;line-height:22px;color:#888880;">Feliz com sua primeira semana,</p>
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

  return { assunto: `Sua primeira semana, ${d.primeiroNome}`, html };
}

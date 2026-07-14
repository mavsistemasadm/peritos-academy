// lib/email/templates/boasVindas.ts
// HTML copiado literalmente de docs/email-templates/email_nivel_01_boas_vindas.html
export type DadosBoasVindas = { primeiroNome: string };

export function emailBoasVindas(d: DadosBoasVindas): { assunto: string; html: string } {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bem-vindo à Peritos Academy</title>
</head>
<body style="margin:0;padding:0;">
<div style="background:#eef0f4;padding:32px 16px;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 2px 14px rgba(6,30,53,0.10);">

    <div style="background:linear-gradient(150deg,#1DC8A0 0%,#0e9e82 20%,#0a6e6a 45%,#083d5a 70%,#061e35 100%);padding:38px 40px 34px;">
      <p style="margin:0 0 26px;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.45);">BEM-VINDO, ${d.primeiroNome}</p>
      <p style="margin:0 0 22px;font-size:26px;font-weight:800;line-height:36px;color:#ffffff;letter-spacing:-0.5px;">Hoje você deu o passo<br>que muda tudo.</p>
      <div style="width:52px;height:3px;background:linear-gradient(90deg,#1DC8A0,rgba(29,200,160,0));border-radius:2px;"></div>
    </div>

    <div style="padding:40px 40px 0;text-align:center;">
      <div style="width:132px;height:132px;margin:0 auto 18px;border-radius:50%;background:#edf9f6;border:2px solid #1DC8A0;text-align:center;line-height:128px;overflow:hidden;">
        <img src="https://peritos-academy.vercel.app/niveis/nivel-01-explorador-novato.png" alt="" width="92" style="vertical-align:middle;" />
      </div>
      <p style="font-size:11px;letter-spacing:3px;color:#0e9e82;font-weight:700;margin:0 0 8px;">SUA PRIMEIRA INSÍGNIA</p>
      <p style="font-size:22px;font-weight:800;color:#083952;margin:0 0 12px;letter-spacing:-0.3px;">Explorador Novato</p>
      <p style="font-size:13px;color:#888880;margin:0;">Todos os grandes começaram exatamente daqui.</p>
    </div>

    <div style="padding:34px 40px 16px;">

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Existe um momento na vida de todo profissional que decide crescer de verdade.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Para alguns, é o dia em que decidem entrar no mundo da perícia judicial e construir uma nova carreira. Para outros, é o dia em que decidem parar de aprender sozinhos, aos pedaços, e entrar num caminho com direção.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Para você, esse dia é hoje.</p>

      <div style="margin:30px 0;background:#edf9f6;border-left:4px solid #1DC8A0;border-radius:0 12px 12px 0;padding:20px 24px;">
        <p style="margin:0;font-size:17px;line-height:30px;color:#083952;font-style:italic;font-weight:700;">A Peritos Academy não é um lugar onde você assiste aulas. É o lugar onde você se torna outro profissional.</p>
      </div>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Aqui dentro, cada aula concluída deixa uma marca. Cada avaliação vencida prova algo que ninguém pode tirar de você. Cada dia de constância constrói o profissional que os tribunais procuram e que os clientes disputam.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">E você não vai caminhar sozinho. Vai caminhar ao lado de pessoas do Brasil inteiro na mesma jornada que a sua: gente dando o primeiro passo na perícia e gente experiente subindo de patamar, dentro de uma comunidade que celebra cada conquista.</p>

      <div style="margin:30px 0;background:#edf9f6;border-left:4px solid #1DC8A0;border-radius:0 12px 12px 0;padding:20px 24px;">
        <p style="margin:0;font-size:17px;line-height:30px;color:#083952;font-style:italic;font-weight:700;">Todo Explorador Novato de hoje carrega uma Lenda esperando o próximo passo.</p>
      </div>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Sua jornada começa com uma única aula. A primeira. E ela está te esperando agora.</p>

      <div style="margin:8px 0 36px;text-align:center;">
        <a href="https://peritos-academy.vercel.app" style="display:inline-block;padding:16px 32px;background:#1DC8A0;border-radius:10px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:.01em;">Dar meu primeiro passo</a>
      </div>

      <div style="margin-bottom:36px;border-left:3px solid #1DC8A0;padding-left:16px;">
        <p style="margin:0 0 2px;font-size:15px;line-height:22px;color:#888880;">Nos vemos lá dentro,</p>
        <p style="margin:0;font-size:19px;font-weight:800;color:#083952;letter-spacing:-0.3px;">Marlos Henrique</p>
      </div>

    </div>
  </div>

  <div style="max-width:600px;margin:0 auto;text-align:center;padding:22px 16px 6px;">
    <p style="font-size:12px;color:#9aa1b0;margin:0 0 6px;">Peritos Academy · A jornada completa da perícia judicial</p>
    <p style="font-size:11px;color:#b4bac6;margin:0;">Você recebeu este email porque criou sua conta na Peritos Academy.<br/>Preferências de email · Cancelar inscrição</p>
  </div>
</div>
</body>
</html>`;

  return { assunto: `Bem-vindo à Peritos Academy, ${d.primeiroNome}`, html };
}

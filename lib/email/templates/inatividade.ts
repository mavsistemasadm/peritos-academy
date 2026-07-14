// lib/email/templates/inatividade.ts
// HTML copiado literalmente de email_inatividade_07_dias.html e
// email_inatividade_21_dias.html — uma função parametrizada por dias (7|21)
// porque os dois templates têm a mesma estrutura, só cor/texto diferentes.
export type DadosInatividade = {
  primeiroNome: string;
  xpTotal: number;
  aulasConcluidas: number;
  nivelOrdem: number;
};

function fmtNum(n: number): string {
  return n.toLocaleString("pt-BR");
}

export function emailInatividade(dias: 7 | 21, d: DadosInatividade): { assunto: string; html: string } {
  if (dias === 7) {
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sua jornada está esperando</title>
</head>
<body style="margin:0;padding:0;">
<div style="background:#eef0f4;padding:32px 16px;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 2px 14px rgba(6,30,53,0.10);">

    <div style="background:linear-gradient(150deg,#F5A623 0%,#E8851A 25%,#D96A0B 50%,#0b2a47 78%,#061e35 100%);padding:38px 40px 34px;">
      <p style="margin:0 0 26px;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.5);">FAZ 7 DIAS, ${d.primeiroNome}</p>
      <p style="margin:0 0 22px;font-size:26px;font-weight:800;line-height:36px;color:#ffffff;letter-spacing:-0.5px;">Sua jornada está esperando.<br>E ela não espera pra sempre.</p>
      <div style="width:52px;height:3px;background:linear-gradient(90deg,#F5A623,rgba(245,166,35,0));border-radius:2px;"></div>
    </div>

    <div style="padding:36px 40px 0;text-align:center;">
      <div style="background:#fef4e8;border-radius:12px;padding:24px 20px;">
        <p style="font-size:11px;letter-spacing:3px;color:#D96A0B;font-weight:700;margin:0 0 16px;">O QUE VOCÊ CONSTRUIU ATÉ AQUI</p>
        <p style="margin:0 0 6px;font-size:28px;font-weight:800;color:#083952;">${fmtNum(d.xpTotal)} XP</p>
        <p style="margin:0;font-size:14px;color:#888880;">${d.aulasConcluidas} aulas concluídas · Nível ${d.nivelOrdem} de 10</p>
      </div>
    </div>

    <div style="padding:34px 40px 16px;">

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">${d.primeiroNome}, faz uma semana que você não aparece na plataforma.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Olha os números ali em cima. Isso tudo é seu. Você construiu com estudo real, dia após dia. Seria uma pena deixar esse progresso parado, esperando um "amanhã" que nunca chega.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">A verdade é que ninguém perde XP por ficar longe. Seus pontos, seu nível, suas insígnias continuam lá. Mas o ritmo, a confiança e o hábito de estudar todo dia? Esses sim se perdem. E são os mais difíceis de reconstruir.</p>

      <div style="margin:30px 0;background:#fef4e8;border-left:4px solid #F5A623;border-radius:0 12px 12px 0;padding:20px 24px;">
        <p style="margin:0;font-size:17px;line-height:30px;color:#083952;font-style:italic;font-weight:700;">O difícil não é recomeçar. É só abrir a próxima aula. Uma. Só uma.</p>
      </div>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Você não precisa de uma hora. Não precisa de um plano novo. Precisa de 15 minutos e uma aula. A próxima da sua fila já está lá, salva exatamente onde você parou.</p>

      <div style="margin:8px 0 36px;text-align:center;">
        <a href="https://peritos-academy.vercel.app" style="display:inline-block;padding:16px 32px;background:#F5A623;border-radius:10px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:.01em;">Retomar de onde parei</a>
      </div>

      <div style="margin-bottom:36px;border-left:3px solid #F5A623;padding-left:16px;">
        <p style="margin:0 0 2px;font-size:15px;line-height:22px;color:#888880;">Esperando você voltar,</p>
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
    return { assunto: `Faz 7 dias, ${d.primeiroNome}. Volta?`, html };
  }

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sentimos sua falta</title>
</head>
<body style="margin:0;padding:0;">
<div style="background:#eef0f4;padding:32px 16px;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 2px 14px rgba(6,30,53,0.10);">

    <div style="background:linear-gradient(150deg,#F03434 0%,#C71F2B 25%,#A31220 50%,#0b2a47 78%,#061e35 100%);padding:38px 40px 34px;">
      <p style="margin:0 0 26px;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.5);">FAZ 21 DIAS, ${d.primeiroNome}</p>
      <p style="margin:0 0 22px;font-size:26px;font-weight:800;line-height:36px;color:#ffffff;letter-spacing:-0.5px;">Você não voltou.<br>Mas tudo que é seu ainda está lá.</p>
      <div style="width:52px;height:3px;background:linear-gradient(90deg,#F03434,rgba(240,52,52,0));border-radius:2px;"></div>
    </div>

    <div style="padding:36px 40px 0;text-align:center;">
      <div style="background:#fdeeee;border-radius:12px;padding:24px 20px;border:1px solid #F03434;">
        <p style="font-size:11px;letter-spacing:3px;color:#A31220;font-weight:700;margin:0 0 16px;">TUDO ISSO AINDA É SEU</p>
        <p style="margin:0 0 6px;font-size:28px;font-weight:800;color:#083952;">${fmtNum(d.xpTotal)} XP</p>
        <p style="margin:0;font-size:14px;color:#888880;">${d.aulasConcluidas} aulas concluídas · Nível ${d.nivelOrdem} de 10</p>
      </div>
    </div>

    <div style="padding:34px 40px 16px;">

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">${d.primeiroNome}, esse é o email mais importante que eu já te mandei.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Não porque algo deu errado. Mas porque 21 dias longe é onde a maioria das pessoas abandona de vez. Não por preguiça. Não por falta de vontade. Mas porque cada dia que passa, voltar parece mais difícil do que realmente é.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Eu vou ser direto: <strong>não é difícil</strong>. Seu progresso está intacto. Suas aulas estão salvas. Seu nível, suas insígnias, seu XP: nada se perde. A plataforma está exatamente como você deixou, esperando você abrir a próxima aula.</p>

      <div style="margin:30px 0;background:#fdeeee;border-left:4px solid #F03434;border-radius:0 12px 12px 0;padding:20px 24px;">
        <p style="margin:0;font-size:17px;line-height:30px;color:#083952;font-style:italic;font-weight:700;">A diferença entre quem desiste e quem conclui é uma única decisão: voltar. Hoje.</p>
      </div>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Lembra do dia em que você criou sua conta? Você tinha um objetivo. Tinha uma razão. Talvez fosse construir uma nova carreira. Talvez fosse sair do lugar. Talvez fosse provar pra si mesmo que consegue. Essa razão não mudou. A vida só ficou no caminho.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">Eu não vou te prometer que é fácil. Vou te prometer que funciona. Cada aluno que hoje está nos níveis altos da plataforma teve pelo menos um momento em que quase parou. A diferença foi voltar.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;"><strong>15 minutos. Uma aula. Hoje.</strong> É só isso que separa "eu parei" de "eu voltei".</p>

      <div style="margin:8px 0 36px;text-align:center;">
        <a href="https://peritos-academy.vercel.app" style="display:inline-block;padding:18px 36px;background:#F03434;border-radius:10px;font-size:16px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:.01em;">Voltar agora</a>
      </div>

      <div style="margin-bottom:36px;border-left:3px solid #F03434;padding-left:16px;">
        <p style="margin:0 0 2px;font-size:15px;line-height:22px;color:#888880;">Ainda acreditando em você,</p>
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
  return { assunto: `${d.primeiroNome}, precisamos conversar`, html };
}

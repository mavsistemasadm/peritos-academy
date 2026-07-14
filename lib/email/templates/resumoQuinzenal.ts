// lib/email/templates/resumoQuinzenal.ts
// HTML copiado literalmente de docs/email-templates/email_resumo_quinzenal.html.
// {TITULO_VARIAVEL}/{PARAGRAFO_CONTEXTO}/{FRASE_DESTAQUE}/{PARAGRAFO_PROXIMO}
// variam por tom (Parte 3H da missão): >=10 aulas / >=3 / <3, com override
// de celebração se o aluno subiu de nível no período.
export type DadosResumoQuinzenal = {
  primeiroNome: string;
  xpPeriodo: number;
  aulasPeriodo: number;
  streakDias: number;
  nivelNome: string;
  xpTotal: number;
  subiuDeNivelNoPeriodo?: boolean;
  novoNivelNome?: string;
};

function fmtNum(n: number): string {
  return n.toLocaleString("pt-BR");
}

const ASSUNTOS = ["Que quinzena, {NOME}!", "Seu resumo chegou", "Olha o que você construiu"];

function montarTextosVariaveis(d: DadosResumoQuinzenal) {
  if (d.subiuDeNivelNoPeriodo && d.novoNivelNome) {
    return {
      titulo: `Você subiu de nível, ${d.primeiroNome}!`,
      contexto: `Nessas duas semanas você não só avançou: você virou ${d.novoNivelNome}. Isso não acontece por acaso, acontece por escolha repetida todo dia.`,
      frase: "Cada nível é a prova de que constância vence talento.",
      proximo: "Continue nesse ritmo e o próximo nível já está mais perto do que parece.",
    };
  }
  if (d.aulasPeriodo >= 10) {
    return {
      titulo: `Que quinzena de peso, ${d.primeiroNome}!`,
      contexto: `Foram ${d.aulasPeriodo} aulas concluídas em 15 dias. Isso não é sorte, é ritmo de quem leva a jornada a sério.`,
      frase: "Constância é o que separa quem estuda de quem se transforma.",
      proximo: "Mantém esse ritmo e os próximos níveis vêm mais rápido do que você imagina.",
    };
  }
  if (d.aulasPeriodo >= 3) {
    return {
      titulo: `Ritmo firme, ${d.primeiroNome}`,
      contexto: `Você concluiu ${d.aulasPeriodo} aulas nessas duas semanas. Sem pressa, sem parar.`,
      frase: "Cada aula é um tijolo. E você está construindo algo sólido.",
      proximo: "Continue no seu ritmo — é ele que leva até o fim.",
    };
  }
  return {
    titulo: "Toda constância conta",
    contexto: "Essas duas semanas foram mais tranquilas em número de aulas, e tudo bem. O que importa é não deixar a chama apagar de vez.",
    frase: "Até os dias leves somam. O importante é não parar de vez.",
    proximo: "Que tal retomar hoje mesmo, nem que seja com uma aula só?",
  };
}

export function emailResumoQuinzenal(d: DadosResumoQuinzenal): { assunto: string; html: string } {
  const { titulo, contexto, frase, proximo } = montarTextosVariaveis(d);
  const assuntoBase = ASSUNTOS[Math.floor(Math.random() * ASSUNTOS.length)];
  const assunto = assuntoBase.replace("{NOME}", d.primeiroNome);

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Suas últimas duas semanas</title>
</head>
<body style="margin:0;padding:0;">
<div style="background:#eef0f4;padding:32px 16px;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 2px 14px rgba(6,30,53,0.10);">

    <div style="background:linear-gradient(150deg,#0a6e6a 0%,#083d5a 35%,#061e35 70%,#040f1e 100%);padding:38px 40px 34px;">
      <p style="margin:0 0 26px;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.45);">RESUMO QUINZENAL</p>
      <p style="margin:0 0 22px;font-size:26px;font-weight:800;line-height:36px;color:#ffffff;letter-spacing:-0.5px;">${titulo}</p>
      <div style="width:52px;height:3px;background:linear-gradient(90deg,#1DC8A0,rgba(29,200,160,0));border-radius:2px;"></div>
    </div>

    <div style="padding:36px 40px 0;text-align:center;">
      <div style="background:#edf9f6;border-radius:12px;padding:24px 20px;">
        <p style="font-size:11px;letter-spacing:3px;color:#0e9e82;font-weight:700;margin:0 0 16px;">ÚLTIMOS 15 DIAS</p>
        <p style="margin:0 0 6px;font-size:28px;font-weight:800;color:#083952;">+${fmtNum(d.xpPeriodo)} XP</p>
        <p style="margin:0 0 12px;font-size:14px;color:#888880;">${d.aulasPeriodo} aulas concluídas · Sequência de ${d.streakDias} dias</p>
        <div style="border-top:1px solid #d4ede7;margin:0;padding-top:12px;">
          <p style="margin:0;font-size:14px;color:#083952;"><strong>${d.nivelNome}</strong> · ${fmtNum(d.xpTotal)} XP total</p>
        </div>
      </div>
    </div>

    <div style="padding:34px 40px 16px;">

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">${d.primeiroNome}, aqui está o retrato das suas últimas duas semanas na Peritos Academy.</p>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">${contexto}</p>

      <div style="margin:30px 0;background:#edf9f6;border-left:4px solid #1DC8A0;border-radius:0 12px 12px 0;padding:20px 24px;">
        <p style="margin:0;font-size:17px;line-height:30px;color:#083952;font-style:italic;font-weight:700;">${frase}</p>
      </div>

      <p style="margin:0 0 22px;font-size:16px;line-height:30px;color:#2a2a27;">${proximo}</p>

      <div style="margin:8px 0 36px;text-align:center;">
        <a href="https://peritos-academy.vercel.app" style="display:inline-block;padding:16px 32px;background:#1DC8A0;border-radius:10px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:.01em;">Continuar a jornada</a>
      </div>

      <div style="margin-bottom:36px;border-left:3px solid #1DC8A0;padding-left:16px;">
        <p style="margin:0 0 2px;font-size:15px;line-height:22px;color:#888880;">Acompanhando sua evolução,</p>
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

  return { assunto, html };
}

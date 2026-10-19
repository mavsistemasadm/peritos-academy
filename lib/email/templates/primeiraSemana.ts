// lib/email/templates/primeiraSemana.ts
// Texto aprovado em docs/email-templates/email_primeira_semana.html; o
// envelope é o de lib/email/marca.ts desde 19/10/2026.
import { SITE_URL } from "@/lib/site";
import { COR, abertura, assinatura, botao, casca, destaque, numeros, p } from "@/lib/email/marca";

export type DadosPrimeiraSemana = {
  primeiroNome: string;
  xpTotal: number;
  aulasConcluidas: number;
  diasAtivos: number;
};

function fmtNum(n: number): string {
  return n.toLocaleString("pt-BR");
}

const ROTULO_NUMEROS = `text-align:center;margin:0 0 2px;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${COR.verde};`;

export function emailPrimeiraSemana(d: DadosPrimeiraSemana): { assunto: string; html: string } {
  const corpo = [
    abertura("Sua primeira semana", "7 dias. E você já não é<br>o mesmo de antes."),
    p("Seus primeiros 7 dias", ROTULO_NUMEROS),
    numeros([
      [fmtNum(d.xpTotal), "XP"],
      [String(d.aulasConcluidas), "aulas concluídas"],
      [String(d.diasAtivos), "dias ativos"],
    ]),
    p(`${d.primeiroNome}, uma semana atrás você criou sua conta na Peritos Academy. Sete dias. E olha o que já aconteceu.`),
    p(`Esses ${fmtNum(d.xpTotal)} XP não são números soltos. Cada ponto é uma aula que você assistiu, uma decisão que você tomou, um pedaço de conhecimento que agora faz parte de quem você é como profissional.`),
    p("Sabe o que a primeira semana prova? Que você não é turista. Turista cria a conta e some. Você criou a conta e <strong>estudou</strong>."),
    destaque("A primeira semana é onde se separa quem veio ficar de quem só veio olhar. Você ficou."),
    p("E agora vem a parte boa: a segunda semana. O conhecimento começa a se acumular, as peças começam a se encaixar, e aquele conteúdo que parecia denso vai ficando cada vez mais natural."),
    p("Mantém o ritmo. Uma aula por dia já muda tudo. E a comunidade inteira está caminhando junto com você."),
    botao("Continuar estudando", SITE_URL),
    assinatura("Marlos Henrique", "Feliz com sua primeira semana,"),
  ].join("\n");

  const html = casca({
    titulo: "Sua primeira semana",
    preheader: "7 dias. E você já não é o mesmo de antes.",
    corpo,
    motivo: "Você recebeu este email porque faz parte da Peritos Academy.",
  });

  return { assunto: `Sua primeira semana, ${d.primeiroNome}`, html };
}

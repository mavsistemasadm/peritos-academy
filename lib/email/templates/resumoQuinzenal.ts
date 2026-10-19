// lib/email/templates/resumoQuinzenal.ts
// Texto aprovado em docs/email-templates/email_resumo_quinzenal.html; o
// envelope é o de lib/email/marca.ts desde 19/10/2026.
// {TITULO_VARIAVEL}/{PARAGRAFO_CONTEXTO}/{FRASE_DESTAQUE}/{PARAGRAFO_PROXIMO}
// variam por tom (Parte 3H da missão): >=10 aulas / >=3 / <3, com override
// de celebração se o aluno subiu de nível no período.
import { SITE_URL } from "@/lib/site";
import { COR, abertura, assinatura, botao, casca, destaque, numeros, p } from "@/lib/email/marca";

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
      proximo: "Continue no seu ritmo. É ele que leva até o fim.",
    };
  }
  return {
    titulo: "Toda constância conta",
    contexto: "Essas duas semanas foram mais tranquilas em número de aulas, e tudo bem. O que importa é não deixar a chama apagar de vez.",
    frase: "Até os dias leves somam. O importante é não parar de vez.",
    proximo: "Que tal retomar hoje mesmo, nem que seja com uma aula só?",
  };
}

const ROTULO_NUMEROS = `text-align:center;margin:0 0 2px;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${COR.verde};`;

export function emailResumoQuinzenal(d: DadosResumoQuinzenal): { assunto: string; html: string } {
  const { titulo, contexto, frase, proximo } = montarTextosVariaveis(d);
  const assuntoBase = ASSUNTOS[Math.floor(Math.random() * ASSUNTOS.length)];
  const assunto = assuntoBase.replace("{NOME}", d.primeiroNome);

  const corpo = [
    abertura("Resumo quinzenal", titulo),
    p("Últimos 15 dias", ROTULO_NUMEROS),
    numeros([
      [`+${fmtNum(d.xpPeriodo)}`, "XP"],
      [String(d.aulasPeriodo), "aulas concluídas"],
    ]),
    p(`Sequência de ${d.streakDias} dias<br><strong>${d.nivelNome}</strong> · ${fmtNum(d.xpTotal)} XP total`, `text-align:center;margin:0 0 28px;font-size:14px;color:${COR.marinho};`),
    p(`${d.primeiroNome}, aqui está o retrato das suas últimas duas semanas na Peritos Academy.`),
    p(contexto),
    destaque(frase),
    p(proximo),
    botao("Continuar a jornada", SITE_URL),
    assinatura("Marlos Henrique", "Acompanhando sua evolução,"),
  ].join("\n");

  const html = casca({
    titulo: "Suas últimas duas semanas",
    preheader: titulo.replace(/<br>/g, " "),
    corpo,
    motivo: "Você recebeu este email porque faz parte da Peritos Academy.",
  });

  return { assunto, html };
}

// lib/email/templates/inatividade.ts
// Texto aprovado em email_inatividade_07_dias.html e
// email_inatividade_21_dias.html; o envelope é o de lib/email/marca.ts desde
// 19/10/2026. Uma função parametrizada por dias (7|21), porque os dois têm a
// mesma estrutura e só o texto muda.
import { SITE_URL } from "@/lib/site";
import { COR, abertura, assinatura, botao, casca, destaque, numeros, p } from "@/lib/email/marca";

export type DadosInatividade = {
  primeiroNome: string;
  xpTotal: number;
  aulasConcluidas: number;
  nivelOrdem: number;
};

function fmtNum(n: number): string {
  return n.toLocaleString("pt-BR");
}

const ROTULO_NUMEROS = `text-align:center;margin:0 0 2px;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${COR.verde};`;

function blocoNumeros(rotulo: string, d: DadosInatividade): string {
  return [
    p(rotulo, ROTULO_NUMEROS),
    numeros([
      [fmtNum(d.xpTotal), "XP"],
      [String(d.aulasConcluidas), "aulas concluídas"],
      [`Nível ${d.nivelOrdem}`, "de 10"],
    ]),
  ].join("\n");
}

const MOTIVO = "Você recebeu este email porque faz parte da Peritos Academy.";

export function emailInatividade(dias: 7 | 21, d: DadosInatividade): { assunto: string; html: string } {
  if (dias === 7) {
    const corpo = [
      abertura(`Faz 7 dias, ${d.primeiroNome}`, "Sua jornada está esperando.<br>E ela não espera pra sempre."),
      blocoNumeros("O que você construiu até aqui", d),
      p(`${d.primeiroNome}, faz uma semana que você não aparece na plataforma.`),
      p(`Olha os números ali em cima. Isso tudo é seu. Você construiu com estudo real, dia após dia. Seria uma pena deixar esse progresso parado, esperando um "amanhã" que nunca chega.`),
      p("A verdade é que ninguém perde XP por ficar longe. Seus pontos, seu nível, suas insígnias continuam lá. Mas o ritmo, a confiança e o hábito de estudar todo dia? Esses sim se perdem. E são os mais difíceis de reconstruir."),
      destaque("O difícil não é recomeçar. É só abrir a próxima aula. Uma. Só uma."),
      p("Você não precisa de uma hora. Não precisa de um plano novo. Precisa de 15 minutos e uma aula. A próxima da sua fila já está lá, salva exatamente onde você parou."),
      botao("Retomar de onde parei", SITE_URL),
      assinatura("Marlos Henrique", "Esperando você voltar,"),
    ].join("\n");

    const html = casca({
      titulo: "Sua jornada está esperando",
      preheader: "Sua jornada está esperando. E ela não espera pra sempre.",
      corpo,
      motivo: MOTIVO,
    });
    return { assunto: `Faz 7 dias, ${d.primeiroNome}. Volta?`, html };
  }

  const corpo = [
    abertura(`Faz 21 dias, ${d.primeiroNome}`, "Você não voltou.<br>Mas tudo que é seu ainda está lá."),
    blocoNumeros("Tudo isso ainda é seu", d),
    p(`${d.primeiroNome}, esse é o email mais importante que eu já te mandei.`),
    p("Não porque algo deu errado. Mas porque 21 dias longe é onde a maioria das pessoas abandona de vez. Não por preguiça. Não por falta de vontade. Mas porque cada dia que passa, voltar parece mais difícil do que realmente é."),
    p("Eu vou ser direto: <strong>não é difícil</strong>. Seu progresso está intacto. Suas aulas estão salvas. Seu nível, suas insígnias, seu XP: nada se perde. A plataforma está exatamente como você deixou, esperando você abrir a próxima aula."),
    destaque("A diferença entre quem desiste e quem conclui é uma única decisão: voltar. Hoje."),
    p("Lembra do dia em que você criou sua conta? Você tinha um objetivo. Tinha uma razão. Talvez fosse construir uma nova carreira. Talvez fosse sair do lugar. Talvez fosse provar pra si mesmo que consegue. Essa razão não mudou. A vida só ficou no caminho."),
    p("Eu não vou te prometer que é fácil. Vou te prometer que funciona. Cada aluno que hoje está nos níveis altos da plataforma teve pelo menos um momento em que quase parou. A diferença foi voltar."),
    p(`<strong>15 minutos. Uma aula. Hoje.</strong> É só isso que separa "eu parei" de "eu voltei".`),
    botao("Voltar agora", SITE_URL),
    assinatura("Marlos Henrique", "Ainda acreditando em você,"),
  ].join("\n");

  const html = casca({
    titulo: "Sentimos sua falta",
    preheader: "Você não voltou. Mas tudo que é seu ainda está lá.",
    corpo,
    motivo: MOTIVO,
  });
  return { assunto: `${d.primeiroNome}, precisamos conversar`, html };
}

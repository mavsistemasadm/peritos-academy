// lib/email/templates/cursoConcluido.ts
// Sem mockup em docs/email-templates: o texto é o aprovado em julho, e o
// envelope é o de lib/email/marca.ts desde 19/10/2026.
// É o "renascimento" da recomendação de curso. Decisão de produto: sugestão
// vive na conclusão, não durante o estudo (por isso não há link nenhum pra
// próximo curso em nenhuma outra tela do app).
import { SITE_URL } from "@/lib/site";
import { abertura, assinatura, botao, casca, destaque, p } from "@/lib/email/marca";

export type DadosCursoConcluido = {
  primeiroNome: string;
  cursoNome: string;
  proximoCurso: { titulo: string; slug: string; mesmaTrilha: boolean } | null;
};

export function emailCursoConcluido(d: DadosCursoConcluido): { assunto: string; html: string } {
  const blocoProximo = d.proximoCurso
    ? [
        p(
          d.proximoCurso.mesmaTrilha
            ? `E a sua trilha continua. O próximo passo já está esperando por você: <strong>${d.proximoCurso.titulo}</strong>.`
            : `E aqui termina essa trilha, mas a jornada não para. Uma nova te espera, começando por <strong>${d.proximoCurso.titulo}</strong>.`,
        ),
        botao(`Começar ${d.proximoCurso.titulo}`, `${SITE_URL}/curso/${d.proximoCurso.slug}`),
      ]
    : [
        p("Você chegou numa fronteira: os cursos que já mapeamos aqui acabaram. Estamos preparando o que vem a seguir, e você vai ser avisado assim que sair do forno."),
        botao("Explorar outros cursos", `${SITE_URL}/cursos`),
      ];

  const corpo = [
    abertura(`Curso concluído, ${d.primeiroNome}`, "Mais um capítulo<br>fechado com chave de ouro."),
    p(`${d.primeiroNome}, você concluiu <strong>${d.cursoNome}</strong>. Do começo ao fim, sem pular etapa.`),
    destaque("Curso concluído não é o fim de uma aula. É mais uma ferramenta que você carrega pro resto da carreira."),
    p("Seu certificado já está disponível no seu perfil, pronto pra comprovar essa capacitação em qualquer processo, proposta ou nomeação. E o XP dessa conquista já está somado na sua jornada rumo ao próximo nível."),
    ...blocoProximo,
    assinatura("Marlos Henrique", "Na torcida pelo próximo capítulo,"),
  ].join("\n");

  const html = casca({
    titulo: "Curso concluído",
    preheader: "Mais um capítulo fechado com chave de ouro.",
    corpo,
    motivo: "Você recebeu este email porque faz parte da Peritos Academy.",
  });

  return { assunto: `Curso concluído: ${d.cursoNome}`.slice(0, 60), html };
}

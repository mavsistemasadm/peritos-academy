// lib/email/templates/boasVindas.ts
// Texto aprovado em docs/email-templates/email_nivel_01_boas_vindas.html; o
// envelope é o de lib/email/marca.ts desde 19/10/2026.
import { SITE_URL } from "@/lib/site";
import { abertura, assinatura, botao, casca, destaque, insignia, p } from "@/lib/email/marca";

export type DadosBoasVindas = { primeiroNome: string };

export function emailBoasVindas(d: DadosBoasVindas): { assunto: string; html: string } {
  const corpo = [
    abertura(`Bem-vindo, ${d.primeiroNome}`, "Hoje você deu o passo<br>que muda tudo."),
    insignia({
      img: `${SITE_URL}/niveis/nivel-01-explorador-novato.png`,
      rotulo: "Sua primeira insígnia",
      nome: "Explorador Novato",
      linha: "Todos os grandes começaram exatamente daqui.",
    }),
    p("Existe um momento na vida de todo profissional que decide crescer de verdade."),
    p("Para alguns, é o dia em que decidem entrar no mundo da perícia judicial e construir uma nova carreira. Para outros, é o dia em que decidem parar de aprender sozinhos, aos pedaços, e entrar num caminho com direção."),
    p("Para você, esse dia é hoje."),
    destaque("A Peritos Academy não é um lugar onde você assiste aulas. É o lugar onde você se torna outro profissional."),
    p("Aqui dentro, cada aula concluída deixa uma marca. Cada avaliação vencida prova algo que ninguém pode tirar de você. Cada dia de constância constrói o profissional que os tribunais procuram e que os clientes disputam."),
    p("E você não vai caminhar sozinho. Vai caminhar ao lado de pessoas do Brasil inteiro na mesma jornada que a sua: gente dando o primeiro passo na perícia e gente experiente subindo de patamar, dentro de uma comunidade que celebra cada conquista."),
    destaque("Todo Explorador Novato de hoje carrega uma Lenda esperando o próximo passo."),
    p("Sua jornada começa com uma única aula. A primeira. E ela está te esperando agora."),
    botao("Dar meu primeiro passo", SITE_URL),
    assinatura("Marlos Henrique", "Nos vemos lá dentro,"),
  ].join("\n");

  const html = casca({
    titulo: "Bem-vindo à Peritos Academy",
    preheader: "Hoje você deu o passo que muda tudo.",
    corpo,
    motivo: "Você recebeu este email porque criou sua conta na Peritos Academy.",
  });

  return { assunto: `Bem-vindo à Peritos Academy, ${d.primeiroNome}`, html };
}

// lib/email/templates/cartaPessoal.ts
// Texto aprovado em docs/email-templates/email_carta_pessoal_marlos.html; o
// envelope é o de lib/email/marca.ts desde 19/10/2026.
import { SITE_URL } from "@/lib/site";
import { abertura, assinatura, botao, casca, destaque, p } from "@/lib/email/marca";

export type DadosCartaPessoal = { primeiroNome: string };

export function emailCartaPessoal(d: DadosCartaPessoal): { assunto: string; html: string } {
  const corpo = [
    abertura("Uma mensagem pessoal", `${d.primeiroNome}, preciso te<br>dizer uma coisa.`),
    p(`Você não fez apenas uma compra. Você tomou uma decisão de futuro, daquelas que a gente olha pra trás e diz: <em>"ainda bem que eu não deixei passar"</em>.`),
    p("Eu sei porque estou te escrevendo isso. Porque eu já estive exatamente onde você está agora. No começo de uma jornada que parecia grande demais, sem saber se ia dar conta, sem saber se era o momento certo. E eu te digo com todas as letras: <strong>era o momento certo</strong>. E você vai dar conta."),
    p("A partir de agora, não existe mais teto pra sua evolução como perito. Você tem nas mãos o caminho que pode mudar completamente o seu destino profissional. E tudo depende de uma única pessoa: você."),
    destaque("Essa decisão já te coloca anos à frente da maioria dos peritos do país. Não é exagero. É matemática."),
    p("Nós vamos te dar tudo o que for preciso: as aulas, os casos, as ferramentas, a comunidade, o suporte. Mas o seu crescimento vai ser construído no dia a dia, no seu comprometimento com a sua própria história."),
    p("Você escolheu estar entre os que não aceitam o comum. Entre aqueles que querem crescer, faturar, ser referência, liderar o mercado. E isso, por si só, já diz muito sobre quem você é."),
    p("Eu quero que você saiba de algo que eu não digo em público: eu acompanho de perto quem está na plataforma. Vejo quem estuda todo dia. Vejo quem resolve os casos. Vejo quem participa da comunidade. E essas pessoas me dão orgulho de ter construído isso."),
    p("Agora começa uma nova fase. Uma fase de transformação real."),
    p("E eu, pessoalmente, vou estar contigo nessa jornada. Não só como educador. Mas como alguém que acredita profundamente no seu potencial."),
    destaque("Parabéns pela coragem. Parabéns pela visão. Parabéns por escolher o extraordinário."),
    p("Sua próxima aula está te esperando. E cada uma delas te leva mais perto do profissional que você decidiu se tornar."),
    botao("Continuar minha jornada", SITE_URL),
    assinatura("Marlos Henrique", "Do fundo do coração,", "Fundador da Peritos Academy"),
  ].join("\n");

  const html = casca({
    titulo: "Uma mensagem pessoal do Marlos",
    preheader: `${d.primeiroNome}, preciso te dizer uma coisa.`,
    corpo,
    motivo: "Você recebeu este email porque faz parte da Peritos Academy.",
  });

  return { assunto: `${d.primeiroNome}, preciso te dizer uma coisa`, html };
}

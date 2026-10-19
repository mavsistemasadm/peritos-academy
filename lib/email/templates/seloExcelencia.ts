// lib/email/templates/seloExcelencia.ts
// O e-mail do marco mais importante da plataforma: a Formação Pericial de Alta
// Performance concluída. Sai junto da comemoração de tela cheia, assinado pelo
// Marlos. Texto aprovado pelo dono em 19/10/2026; envelope de lib/email/marca.ts.
import { SITE_URL } from "@/lib/site";
import { abertura, assinatura, botao, casca, destaque, insignia, numeros, p } from "@/lib/email/marca";

export type DadosSeloExcelencia = {
  primeiroNome: string;
  cursos: number;
  aulas: number;
  horas: number;
  /** Link do perfil público, onde o selo aparece. Sem ele, vai para /perfil. */
  perfilPublicoUrl: string | null;
};

export function emailSeloExcelencia(d: DadosSeloExcelencia): { assunto: string; html: string } {
  const destino = d.perfilPublicoUrl || `${SITE_URL}/perfil`;
  const corpo = [
    abertura(`Parabéns, ${d.primeiroNome}`, "Você conquistou o<br>Selo de Excelência."),
    insignia({
      img: `${SITE_URL}/selo/selo-excelencia.png`,
      rotulo: "Formação concluída",
      nome: "Selo de Excelência",
      linha: "Formação Pericial de Alta Performance",
      tamanho: 150,
    }),
    p(`${d.primeiroNome}, você acabou de fazer algo que <strong>pouquíssimos peritos fazem</strong>: concluiu a Formação Pericial de Alta Performance inteira, da decisão de ser perito até a entrada no mercado.`),
    numeros([
      [String(d.cursos), "cursos"],
      [String(d.aulas), "aulas"],
      [`${d.horas}h`, "de estudo"],
    ]),
    p(`Isso agora tem nome: <strong>Selo de Excelência</strong>. Ele está no seu perfil público, e quem visitar vai ver que você não pulou etapa.`),
    destaque("A base está feita. Agora é escolher onde a sua autoridade vai crescer."),
    p(`Bancário, trabalhista, previdenciário: os territórios de especialização estão abertos para você na sua Jornada.`),
    botao("Ver meu Selo", destino),
    p(`Estou orgulhoso do caminho que você fez. <strong>Parabéns, de verdade.</strong>`),
    assinatura("Marlos Henrique", "", "Fundador da Peritos Academy"),
  ].join("\n");

  const html = casca({
    titulo: "Selo de Excelência",
    preheader: "Formação Pericial de Alta Performance concluída. O selo é seu.",
    corpo,
    motivo: "Você recebeu este email porque faz parte da Peritos Academy.",
  });

  return { assunto: `${d.primeiroNome}, você conquistou o Selo de Excelência`.slice(0, 70), html };
}

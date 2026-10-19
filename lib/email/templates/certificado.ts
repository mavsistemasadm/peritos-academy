// lib/email/templates/certificado.ts
// Texto aprovado em docs/email-templates/email_certificado_emitido.html; o
// envelope é o de lib/email/marca.ts desde 19/10/2026.
// O parágrafo final do corpo ("Cada uma dessas aulas exigiu tempo...") É o
// slot de {CONTEXTO_CERTIFICADO}: usa cursos.contexto_certificado quando
// preenchido, senão essa frase exata (default do próprio template aprovado).
import { SITE_URL } from "@/lib/site";
import { COR, FONTE, abertura, assinatura, botao, casca, destaque, p } from "@/lib/email/marca";

export type DadosCertificado = {
  primeiroNome: string;
  nomeCompleto: string;
  cursoNome: string;
  totalAulas: number;
  totalHoras: number;
  totalAvaliacoes: number;
  dataConclusao: string; // já formatada dd/mm/aaaa
  contextoCertificado: string | null;
};

const CONTEXTO_PADRAO =
  "Cada uma dessas aulas exigiu tempo, atenção e a decisão de continuar quando dava vontade de parar. Você continuou. Até o fim.";

function truncar(texto: string, max: number): string {
  return texto.length <= max ? texto : texto.slice(0, max - 1).trimEnd() + "…";
}

/** O cartão do certificado: não tem imagem, então não usa insignia(). Mesma caixa clara do envelope. */
function cartaoCertificado(d: DadosCertificado): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 30px;background:${COR.caixa};border-radius:12px;"><tr><td align="center" style="padding:22px 24px;">
<p style="margin:0 0 6px;font-family:${FONTE};font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${COR.verde};">Certificado de conclusão</p>
<p style="margin:0 0 8px;font-family:${FONTE};font-size:19px;line-height:1.35;font-weight:800;color:${COR.marinho};">${d.cursoNome}</p>
<p style="margin:0 0 4px;font-family:${FONTE};font-size:14px;color:${COR.suave};">Conferido a <strong style="color:${COR.marinho};">${d.nomeCompleto}</strong></p>
<p style="margin:0;font-family:${FONTE};font-size:12px;color:${COR.apagado};">Peritos Academy · ${d.dataConclusao}</p>
</td></tr></table>`;
}

export function emailCertificado(d: DadosCertificado): { assunto: string; html: string } {
  const contexto = d.contextoCertificado?.trim() || CONTEXTO_PADRAO;

  const corpo = [
    abertura("Certificado emitido", "Isso agora é seu.<br>E ninguém tira."),
    cartaoCertificado(d),
    p(`${d.primeiroNome}, para e sente o peso do que você acabou de fazer.`),
    p(`Você concluiu o curso <strong>${d.cursoNome}</strong>. Foram <strong>${d.totalAulas} aulas</strong>, <strong>${d.totalHoras}h de conteúdo</strong> e <strong>${d.totalAvaliacoes} avaliações aprovadas</strong>. ${contexto}`),
    p("Esse certificado não é um PDF bonito. É a prova documentada de tudo isso. Ele fica disponível no seu perfil pra sempre, pronto pra usar quando você precisar."),
    destaque("Certificado não anda pra trás. O que você conquistou, conquistou."),
    p("Onde usar? Em processos judiciais como prova de capacitação técnica. Com clientes como diferencial de confiança. No seu currículo de nomeações como assistente técnico ou perito judicial. Ele abre portas que ficam abertas."),
    p("E amanhã é dia de abrir o próximo capítulo. Tem mais cursos esperando, mais certificados pra conquistar, e mais um degrau na jornada que só depende de você."),
    botao("Ver meu certificado no perfil", `${SITE_URL}/perfil`),
    assinatura("Marlos Henrique", "Orgulhoso dessa conquista,"),
  ].join("\n");

  const html = casca({
    titulo: "Certificado emitido",
    preheader: "Isso agora é seu. E ninguém tira.",
    corpo,
    motivo: "Você recebeu este email porque faz parte da Peritos Academy.",
  });

  return { assunto: truncar(`Certificado pronto: ${d.cursoNome}`, 50), html };
}

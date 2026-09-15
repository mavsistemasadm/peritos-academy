// ══════════════════════════════════════════════════════════════════
// lib/email/templates/desafioConvite.ts — CONVITE PARA DESAFIO RESTRITO
//
// Sai só pelo botão "Enviar convite por email" em /admin/desafios/[id], nunca
// ao liberar alguém na lista: o operador confere a lista antes, e o botão só
// existe com o desafio publicado, então o link do email sempre abre.
//
// Esqueleto idêntico ao de evento.ts (tabelas, preheader, cor sólida por baixo
// do degradê, estilo em cada tag). O porquê de cada um está no comentário longo
// de lá.
//
// ⚠️ A frase "Preferências de email · Cancelar inscrição" no rodapé é trocada
// por links reais em enviarEmail(). Mexer no texto quebra a troca em silêncio,
// e o email sai com um descadastro que não descadastra.
// ══════════════════════════════════════════════════════════════════
import { SITE_URL, SITE_HOST } from '@/lib/site'

export type DadosEmailConviteDesafio = {
  primeiroNome: string
  titulo: string
  numero: string
  prazoDias: number
  /** Sem perguntas: a entrega é laudo e planilha, com correção do professor. */
  correcaoManual: boolean
  url: string
}

const FONTE = 'Arial,Helvetica,sans-serif'
const VERDE_ESCURO = '#0B5E4E'
const VERDE = '#12A87F'
const TEXTO = '#3F4A46'

function cortar(texto: string, max: number) {
  return texto.length <= max ? texto : texto.slice(0, max - 1).trimEnd() + '…'
}

function escapar(t: string) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function emailConviteDesafio(d: DadosEmailConviteDesafio): { assunto: string; html: string } {
  const prazo = `${d.prazoDias} ${d.prazoDias === 1 ? 'dia' : 'dias'}`
  const assunto = `Você foi convidado: ${cortar(d.titulo, 44)}`
  const preheader = `Um desafio pericial só para convidados. O prazo de ${prazo} começa quando você aceitar.`

  const corpo = [
    'Você foi convidado para um desafio pericial da Peritos Academy. Ele não aparece para os outros alunos: só quem está na lista de convidados consegue abrir.',
    `Na página do desafio estão a intimação e os documentos do processo. O prazo de ${prazo} só começa a contar quando você aceitar a nomeação, então dá para ler tudo com calma antes de decidir.`,
    d.correcaoManual
      ? 'A entrega é um laudo e uma planilha de cálculo, e a correção é feita pelo professor, com nota e parecer.'
      : 'Você responde às perguntas do desafio e recebe a correção assim que protocolar.',
    'Para abrir, entre com o email e a senha que você já usa na Peritos Academy.',
  ]

  const paragrafos = corpo.map(p =>
    `<p style="margin:0 0 16px;font-family:${FONTE};font-size:16px;line-height:1.65;color:${TEXTO};">${escapar(p)}</p>`,
  ).join('\n        ')

  const html = `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${escapar(assunto)}</title>
<!--[if mso]><style>table{border-collapse:collapse}h1,h2,p,a{font-family:Arial,sans-serif!important}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#F4F5F2;">

<!-- PREHEADER: o texto que a caixa de entrada mostra ao lado do assunto -->
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#F4F5F2;">
  ${escapar(preheader)}
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F5F2;">
<tr><td align="center" style="padding:32px 16px;">

  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;">

    <!-- ===== CABEÇALHO ===== -->
    <tr>
      <td style="border-radius:14px 14px 0 0;background-color:${VERDE_ESCURO};background-image:linear-gradient(100deg,#083D33 0%,${VERDE_ESCURO} 45%,#1FA98A 100%);padding:30px 40px;" align="left">
        <span style="font-family:${FONTE};font-size:22px;font-weight:bold;color:#FFFFFF;letter-spacing:.3px;">PERITOS ACADEMY</span>
        <span style="font-family:${FONTE};font-size:12px;color:#C6EFE2;letter-spacing:.14em;text-transform:uppercase;display:block;margin-top:4px;">Convite exclusivo</span>
      </td>
    </tr>

    <!-- ===== CORPO ===== -->
    <tr>
      <td style="background-color:#FFFFFF;padding:40px 40px 12px;" align="left">
        <p style="margin:0 0 16px;font-family:${FONTE};font-size:16px;line-height:1.65;color:${TEXTO};">
          Olá, ${escapar(d.primeiroNome)},
        </p>
        ${paragrafos}

        <!-- O desafio, no bloco de destaque -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
          <tr>
            <td style="background-color:#EAFBF4;border-left:4px solid ${VERDE};border-radius:0 10px 10px 0;padding:18px 22px;">
              <p style="margin:0 0 6px;font-family:${FONTE};font-size:17px;font-weight:bold;line-height:1.4;color:#0B4A3D;">${escapar(d.titulo)}</p>
              <p style="margin:0;font-family:${FONTE};font-size:15px;line-height:1.6;color:#2F6357;">Desafio #${escapar(d.numero)} · ${escapar(prazo)} de prazo depois de aceitar</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ===== BOTÃO ===== -->
    <tr>
      <td style="background-color:#FFFFFF;padding:8px 40px 40px;" align="center">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="border-radius:10px;background-color:${VERDE};background-image:linear-gradient(100deg,#0B6B55 0%,${VERDE} 100%);" align="center">
              <a href="${d.url}" target="_blank" style="display:inline-block;padding:16px 42px;font-family:${FONTE};font-size:16px;font-weight:bold;color:#FFFFFF;text-decoration:none;border-radius:10px;">
                Ver o desafio
              </a>
            </td>
          </tr>
        </table>
        <p style="margin:18px 0 0;font-family:${FONTE};font-size:13px;line-height:1.6;color:#8A938E;">
          Se o botão não abrir, copie este endereço:<br>
          <a href="${d.url}" style="color:#0E8A68;text-decoration:underline;word-break:break-all;">${escapar(d.url)}</a>
        </p>
      </td>
    </tr>

    <!-- ===== RODAPÉ ===== -->
    <tr>
      <td style="border-radius:0 0 14px 14px;background-color:#1B211E;padding:30px 40px;" align="center">
        <p style="margin:0 0 8px;font-family:${FONTE};font-size:14px;font-weight:bold;color:#FFFFFF;">Peritos Academy</p>
        <p style="margin:0 0 14px;font-family:${FONTE};font-size:12px;line-height:1.6;color:#A3ABA6;">
          Do conhecimento à autoridade.<br>
          A plataforma de formação do perito judicial · <a href="${SITE_URL}" style="color:#3FD3AC;text-decoration:none;">${SITE_HOST}</a>
        </p>
        <p style="margin:0;font-family:${FONTE};font-size:11px;line-height:1.6;color:#767E79;">
          Você recebe este e-mail porque foi convidado para este desafio.<br>
          Preferências de email · Cancelar inscrição
        </p>
      </td>
    </tr>

  </table>

</td></tr>
</table>
</body>
</html>`

  return { assunto, html }
}

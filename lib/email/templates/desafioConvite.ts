// ══════════════════════════════════════════════════════════════════
// lib/email/templates/desafioConvite.ts — CONVITE PARA DESAFIO RESTRITO
//
// Sai só pelo botão "Enviar convite por email" em /admin/desafios/[id], nunca
// ao liberar alguém na lista: o operador confere a lista antes, e o botão só
// existe com o desafio publicado, então o link do email sempre abre.
//
// O texto é o aprovado; o envelope é o de lib/email/marca.ts desde 19/10/2026
// (o mesmo dos outros emails da Academy).
//
// ⚠️ A frase "Preferências de email · Cancelar inscrição" no rodapé é trocada
// por links reais em enviarEmail(). Mexer no texto quebra a troca em silêncio,
// e o email sai com um descadastro que não descadastra.
// ══════════════════════════════════════════════════════════════════
import { abertura, botao, casca, destaque, esc as escapar, p } from '@/lib/email/marca'

export type DadosEmailConviteDesafio = {
  primeiroNome: string
  titulo: string
  numero: string
  prazoDias: number
  /** Sem perguntas: a entrega é laudo e planilha, com correção do professor. */
  correcaoManual: boolean
  url: string
}

function cortar(texto: string, max: number) {
  return texto.length <= max ? texto : texto.slice(0, max - 1).trimEnd() + '…'
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

  const conteudo = [
    abertura('Convite exclusivo', escapar(d.titulo)),
    p(`Olá, ${escapar(d.primeiroNome)},`),
    ...corpo.map(t => p(escapar(t))),
    destaque(`Desafio #${escapar(d.numero)} · ${escapar(prazo)} de prazo depois de aceitar`),
    botao('Ver o desafio', d.url),
    p(
      `Se o botão não abrir, copie este endereço:<br><a href="${d.url}" style="color:#083952;text-decoration:underline;word-break:break-all;">${escapar(d.url)}</a>`,
      'text-align:center;font-size:13px;line-height:1.6;color:#9CA3AF;margin:0 0 30px;',
    ),
  ].join('\n')

  const html = casca({
    titulo: assunto,
    preheader,
    corpo: conteudo,
    motivo: 'Você recebe este e-mail porque foi convidado para este desafio.',
  })

  return { assunto, html }
}

// ══════════════════════════════════════════════════════════════════
// lib/email/templates/evento.ts — OS QUATRO EMAILS DE UM ENCONTRO
//
//   0. anuncio      · quando o encontro entra na agenda
//   1. confirmação  · na hora em que a pessoa se inscreve
//   2. vespera      · na manhã do dia anterior
//   3. hoje         · na manhã do dia do evento
//   4. comecando    · uma hora antes
//   5. ao_vivo      · quando entra no ar
//
// Seis momentos, um arquivo, porque são a mesma peça em cinco tempos: você
// está dentro · é amanhã · é hoje · daqui a uma hora · estamos no ar. O que
// muda entre eles é a urgência e o que o botão faz, e ver os cinco lado a lado
// é o que impede o último de nascer com o tom do primeiro.
//
// ⚠️ O da véspera e o da manhã saem com 24 horas de diferença e no mesmo
// horário. Se os dois dissessem a mesma coisa, o segundo viraria ruído e
// ensinaria a pessoa a ignorar os próximos. Por isso o da véspera fala do
// CALENDÁRIO (reserve o horário, avise quem precisa) e o da manhã fala do DIA
// (é hoje, deixa o link à mão).
//
// ── O ENVELOPE ──
//
// O texto é o aprovado; o envelope é o de lib/email/marca.ts desde 19/10/2026,
// o mesmo dos outros emails da Academy (era o esqueleto dos emails do Nexus).
//
// ⚠️ A frase "Não quero mais receber estes e-mails" no rodapé é substituída
// por um link real em enviarEmailConvidado() (é ela que este email passa a
// casca() em `descadastro`, no lugar da frase de enviarEmail()). Mexer no
// texto quebra a substituição em silêncio, e o email sai com um descadastro
// que não descadastra.
// ══════════════════════════════════════════════════════════════════

import { abertura, botao, casca, esc as escapar, p, resumo } from '@/lib/email/marca'

export type DadosEmailEvento = {
  primeiroNome: string
  /** Só o anúncio usa. É o que responde "por que isto está na minha caixa". */
  descricao?: string | null
  /** "Sala de análise", "Aula ao vivo"… Só o anúncio usa. */
  tipoRotulo?: string | null
  titulo: string
  /** "Sábado, 5 de setembro · 20h00, horário de Brasília" */
  quando: string
  /** "Sábado, 5 de setembro" */
  dia: string
  /** "20h00" */
  horario: string
  /** "1h30" */
  duracao: string
  apresentador: string | null
  /** Endereço público do evento, onde se assiste. */
  url: string
  linkCalendario: string | null
  /**
   * Live de tira-dúvidas: o formulário da página (`/evento/{slug}#duvida`).
   * Com ele, o email ganha o bloco "Mande sua dúvida antes", em todo momento
   * menos o "ao vivo" (aí a conversa é no chat).
   */
  duvidasUrl?: string | null
}

export type MomentoEvento = 'anuncio' | 'confirmacao' | 'vespera' | 'hoje' | 'comecando' | 'ao_vivo'

const COPY: Record<MomentoEvento, {
  etiqueta: string
  /** A linha que a caixa de entrada mostra ao lado do assunto. */
  preheader: (d: DadosEmailEvento) => string
  assunto: (d: DadosEmailEvento) => string
  corpo: (d: DadosEmailEvento) => string[]
  botao: string
}> = {
  anuncio: {
    etiqueta: 'Novo na agenda',
    preheader: d => `${d.dia}, às ${d.horario}. Reserve seu lugar.`,
    assunto: d => `${d.tipoRotulo ?? 'Novo encontro'}: ${cortar(d.titulo, 42)}`,
    corpo: d => [
      `Marquei um encontro novo, e queria que você soubesse antes de ver na agenda.`,
      d.descricao?.trim()
        || (d.apresentador ? `Quem conduz é ${d.apresentador}.` : 'Detalhes na página do encontro.'),
      `É ${d.dia.toLowerCase()}, às ${d.horario}, e dura ${d.duracao}. `
      + 'Reservar leva um minuto e garante que eu te lembre na véspera, na manhã do dia e na hora.',
    ],
    botao: 'Reservar meu lugar',
  },
  confirmacao: {
    etiqueta: 'Inscrição confirmada',
    preheader: d => `Seu lugar está garantido. ${d.dia}, às ${d.horario}.`,
    assunto: d => `Inscrição confirmada: ${cortar(d.titulo, 44)}`,
    corpo: d => [
      'Anotei seu nome. Seu lugar está garantido.',
      'No dia e na hora abaixo, é só abrir o link. A transmissão acontece na própria página, '
      + 'você não precisa instalar nada nem criar conta em lugar nenhum.'
      + (d.apresentador ? ` Quem conduz é ${d.apresentador}.` : ''),
      'Vou te lembrar na manhã do dia, uma hora antes e quando estivermos entrando no ar. '
      + 'Você não precisa se preocupar em anotar.',
    ],
    botao: 'Ver a página do encontro',
  },
  vespera: {
    etiqueta: 'É amanhã',
    preheader: d => `Amanhã, ${d.dia.split(',')[0].toLowerCase()}, às ${d.horario}.`,
    assunto: d => `Amanhã às ${d.horario}: ${cortar(d.titulo, 38)}`,
    corpo: d => [
      `É amanhã, ${d.dia.split(',')[0].toLowerCase()}, às ${d.horario}.`,
      `Avisando com um dia para você conseguir segurar o horário. São ${d.duracao}, e vale mais estar `
      + 'inteiro nesse tempo do que dividido com outra coisa.',
      'Se depender de alguém para ficar livre nesse horário, hoje ainda dá tempo de combinar.',
    ],
    botao: 'Ver a página do encontro',
  },
  hoje: {
    etiqueta: 'É hoje',
    preheader: d => `Hoje às ${d.horario}. Deixa separado.`,
    assunto: d => `Hoje às ${d.horario}: ${cortar(d.titulo, 40)}`,
    corpo: d => [
      `É hoje, às ${d.horario}.`,
      'Passando cedo para você conseguir organizar o dia em volta. '
      + `São ${d.duracao} de encontro, e a parte que mais rende costuma ser a primeira meia hora.`,
      'Se puder, deixe o link já salvo agora, enquanto lembra.',
    ],
    botao: 'Abrir a página do encontro',
  },
  comecando: {
    etiqueta: 'Daqui a uma hora',
    preheader: d => `Começamos às ${d.horario}. Deixe a aba aberta.`,
    assunto: d => `Em 1 hora: ${cortar(d.titulo, 48)}`,
    corpo: d => [
      `Começamos daqui a pouco, às ${d.horario}.`,
      'Deixe o link aberto numa aba. Dá para acompanhar e perguntar pelo chat ao lado do vídeo, '
      + 'sem sair da página.',
    ],
    botao: 'Abrir a página do encontro',
  },
  ao_vivo: {
    etiqueta: 'Estamos no ar',
    preheader: () => 'A transmissão começou agora. É só entrar.',
    assunto: d => `Estamos ao vivo: ${cortar(d.titulo, 46)}`,
    // O último empurrão é para quem viu o de uma hora atrás e deixou passar,
    // que é a maioria. Por isso não repete a explicação: diz que já começou e
    // mostra a porta. Quem abre este email decide em dois segundos.
    corpo: () => [
      'Acabamos de começar.',
      'É só clicar. A transmissão está rolando na página do encontro.',
    ],
    botao: 'Assistir agora',
  },
}

function cortar(texto: string, max: number) {
  return texto.length <= max ? texto : texto.slice(0, max - 1).trimEnd() + '…'
}

/** A frase que enviarEmailConvidado() troca pelo link de descadastro. */
const FRASE_DESCADASTRO = 'Não quero mais receber estes e-mails'

/**
 * `convite`: a pessoa recebe a véspera ou o "é hoje" sem ter reservado (a
 * audiência inteira, quando o anúncio liga `eventos.lembrar_audiencia`). O
 * texto é o mesmo, com um parágrafo a mais e o botão que reserva: o link leva
 * `?reservar=1`, que a página usa para reservar sozinha depois do login.
 */
/**
 * `tema`: o parágrafo escrito para o assunto desta live (lib/evento/textos-ia.ts).
 * Entra como segundo parágrafo; no anúncio, no lugar da descrição genérica. A
 * estrutura do email não muda: abertura, tema, o resto, botão.
 */
export function emailEvento(
  momento: MomentoEvento,
  d: DadosEmailEvento,
  opcoes: { convite?: boolean; tema?: string | null; gancho?: string | null } = {},
): { assunto: string; html: string } {
  const fixo = COPY[momento]
  const tema = opcoes.tema?.trim()
  const gancho = opcoes.gancho?.trim()
  const comTema = momento !== 'confirmacao'
  const base = {
    ...fixo,
    // O convite com tema abre PELO PORQUÊ (o parágrafo do tema), e a data vem
    // depois: "Marquei um encontro novo" não convence ninguém a ir.
    corpo: (x: DadosEmailEvento) => {
      const ps = fixo.corpo(x)
      if (!tema || !comTema) return ps
      return momento === 'anuncio' ? [tema, ...ps.slice(2)] : [ps[0], tema, ...ps.slice(1)]
    },
    // O gancho entra no assunto; dia e hora quem põe é o template, nunca a IA.
    assunto: (x: DadosEmailEvento) => {
      if (!gancho || !comTema) return fixo.assunto(x)
      const diaCurto = x.dia.split(',')[0].toLowerCase().replace('-feira', '')
      switch (momento) {
        case 'anuncio': return `${gancho} · ${diaCurto}, ${x.horario}, ao vivo`
        case 'vespera': return `Amanhã às ${x.horario}: ${gancho}`
        case 'hoje': return `Hoje às ${x.horario}: ${gancho}`
        case 'comecando': return `Em 1 hora: ${gancho}`
        case 'ao_vivo': return `Ao vivo agora: ${gancho}`
        default: return fixo.assunto(x)
      }
    },
  }
  const convite = !!opcoes.convite && (momento === 'vespera' || momento === 'hoje')
  const c = convite
    ? {
        ...base,
        corpo: (x: DadosEmailEvento) => [
          ...base.corpo(x),
          'Você ainda não reservou o seu lugar. Leva um minuto, e garante o aviso de uma hora antes e o de quando entrarmos no ar.',
        ],
        botao: 'Reservar meu lugar',
      }
    : base
  if (convite) d = { ...d, url: `${d.url}?reservar=1` }
  const assunto = c.assunto(d)

  const conteudo = [
    abertura(escapar(c.etiqueta), escapar(d.titulo)),
    p(`Olá, ${escapar(d.primeiroNome)},`),
    ...c.corpo(d).map(t => p(t)),
    // O encontro: quando é e quanto dura, o que a pessoa precisa reler.
    resumo([
      ['Quando', escapar(d.quando)],
      ['Duração', escapar(d.duracao)],
    ]),
    blocoDuvidas(d, momento),
    botao(c.botao, d.url),
    d.linkCalendario && momento === 'confirmacao'
      ? p(
          `<a href="${d.linkCalendario}" style="color:#083952;text-decoration:underline;">Adicionar ao meu calendário</a>`,
          'text-align:center;font-size:14px;margin:0 0 30px;',
        )
      : '',
  ].filter(Boolean).join('\n')

  const html = casca({
    titulo: assunto,
    preheader: c.preheader(d),
    corpo: conteudo,
    motivo: 'Você recebe este e-mail porque se inscreveu neste encontro.',
    descadastro: FRASE_DESCADASTRO,
  })

  return { assunto, html }
}

/**
 * O convite para mandar a dúvida antes, na live de tira-dúvidas. Link em texto
 * dentro de um bloco, e não um segundo botão: dois botões iguais no mesmo
 * email dividem o clique, e o principal (reservar, abrir a página) continua
 * sendo o que leva a pessoa à live.
 */
function blocoDuvidas(d: DadosEmailEvento, momento: MomentoEvento) {
  if (!d.duvidasUrl || momento === 'ao_vivo') return ''
  return p(
    '<b>Tem uma dúvida? Mande antes.</b><br>'
    + 'Escreva a sua pergunta e, se ajudar, anexe o documento ou um print (até 20 MB). Eu leio antes e <b>respondo ao vivo</b>.<br>'
    + `<a href="${d.duvidasUrl}" target="_blank" style="color:#083952;text-decoration:underline;font-weight:700;">Mandar minha dúvida</a>`,
  )
}

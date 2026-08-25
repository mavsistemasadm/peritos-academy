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
// ── O ESQUELETO É O DOS EMAILS DO NEXUS ──
//
// Copiado de `docs/template-email-mh.html` e `template-email-acheumperito.html`
// do projeto nexus-peritosacademy, que são a mesma estrutura em duas marcas.
// O que muda por marca é só o degradê do cabeçalho, o nome, a assinatura e a
// cor do destaque; aqui a marca é a Peritos Academy.
//
// O que vem de lá e NÃO é enfeite:
//
//  · **Tabelas, não divs.** Outlook renderiza com o motor do Word e ignora
//    flex e grid. Layout em `<table role="presentation">` é o que faz o email
//    chegar inteiro em quem lê no Outlook do escritório, que é metade dos
//    peritos.
//  · **Preheader.** A linha escondida no topo é o texto que a caixa de entrada
//    mostra ao lado do assunto. Sem ela, o Gmail exibe o começo do HTML ou o
//    "Olá, Fulano" — desperdiçando a segunda coisa mais lida do email.
//  · **`background-color` junto do `background-image`.** Gradiente em email é
//    ignorado por vários clientes; sem a cor sólida por baixo, o cabeçalho e o
//    botão chegam transparentes, e o botão vira texto branco sobre branco.
//  · **Estilo em cada tag.** Não existe `<style>` confiável em email; regra
//    fora do atributo `style` é descartada por boa parte dos clientes.
//
// ⚠️ A frase "Não quero mais receber estes e-mails" no rodapé é substituída
// por um link real em enviarEmailConvidado(). Mexer no texto quebra a
// substituição em silêncio, e o email sai com um descadastro que não
// descadastra.
// ══════════════════════════════════════════════════════════════════

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

function escapar(t: string) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ── A marca, nas cores da Academy ───────────────────────────────
const FONTE = 'Arial,Helvetica,sans-serif'
const VERDE_ESCURO = '#0B5E4E'
const VERDE = '#12A87F'
const TEXTO = '#3F4A46'

export function emailEvento(momento: MomentoEvento, d: DadosEmailEvento): { assunto: string; html: string } {
  const c = COPY[momento]
  const assunto = c.assunto(d)

  const paragrafos = c.corpo(d).map(p =>
    `<p style="margin:0 0 16px;font-family:${FONTE};font-size:16px;line-height:1.65;color:${TEXTO};">${p}</p>`,
  ).join('\n          ')

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
  ${escapar(c.preheader(d))}
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F5F2;">
<tr><td align="center" style="padding:32px 16px;">

  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;">

    <!-- ===== CABEÇALHO: DEGRADÊ DA MARCA (escuro → claro) ===== -->
    <tr>
      <td style="border-radius:14px 14px 0 0;background-color:${VERDE_ESCURO};background-image:linear-gradient(100deg,#083D33 0%,${VERDE_ESCURO} 45%,#1FA98A 100%);padding:30px 40px;" align="left">
        <span style="font-family:${FONTE};font-size:22px;font-weight:bold;color:#FFFFFF;letter-spacing:.3px;">PERITOS ACADEMY</span>
        <span style="font-family:${FONTE};font-size:12px;color:#C6EFE2;letter-spacing:.14em;text-transform:uppercase;display:block;margin-top:4px;">${escapar(c.etiqueta)}</span>
      </td>
    </tr>

    <!-- ===== CORPO ===== -->
    <tr>
      <td style="background-color:#FFFFFF;padding:40px 40px 12px;" align="left">
        <p style="margin:0 0 16px;font-family:${FONTE};font-size:16px;line-height:1.65;color:${TEXTO};">
          Olá, ${escapar(d.primeiroNome)},
        </p>
        ${paragrafos}

        <!-- O encontro, no bloco de destaque -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
          <tr>
            <td style="background-color:#EAFBF4;border-left:4px solid ${VERDE};border-radius:0 10px 10px 0;padding:18px 22px;">
              <p style="margin:0 0 6px;font-family:${FONTE};font-size:17px;font-weight:bold;line-height:1.4;color:#0B4A3D;">${escapar(d.titulo)}</p>
              <p style="margin:0;font-family:${FONTE};font-size:15px;line-height:1.6;color:#2F6357;">${escapar(d.quando)}</p>
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
                ${escapar(c.botao)}
              </a>
            </td>
          </tr>
        </table>
        ${d.linkCalendario && momento === 'confirmacao'
          ? `<p style="margin:18px 0 0;font-family:${FONTE};font-size:13px;color:#8A938E;"><a href="${d.linkCalendario}" style="color:#0E8A68;text-decoration:underline;">Adicionar ao meu calendário</a></p>`
          : ''}
      </td>
    </tr>

    <!-- ===== FAIXA DO ENCONTRO =====
         No template do Nexus esta faixa traz os números de autoridade. Num
         email de evento, o que a pessoa precisa reler é quando é e quanto
         dura, então a faixa carrega isso. -->
    <tr>
      <td style="background-color:#FAFAF8;border-top:1px solid #E4E6E1;padding:22px 40px;" align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="40%" align="center" style="font-family:${FONTE};">
              <span style="font-size:11px;color:#8A938E;letter-spacing:.1em;text-transform:uppercase;">Dia</span><br>
              <span style="font-size:15px;font-weight:bold;color:#2F3D38;">${escapar(d.dia)}</span>
            </td>
            <td width="30%" align="center" style="font-family:${FONTE};border-left:1px solid #E4E6E1;border-right:1px solid #E4E6E1;">
              <span style="font-size:11px;color:#8A938E;letter-spacing:.1em;text-transform:uppercase;">Horário</span><br>
              <span style="font-size:15px;font-weight:bold;color:#2F3D38;">${escapar(d.horario)}</span>
            </td>
            <td width="30%" align="center" style="font-family:${FONTE};">
              <span style="font-size:11px;color:#8A938E;letter-spacing:.1em;text-transform:uppercase;">Duração</span><br>
              <span style="font-size:15px;font-weight:bold;color:#2F3D38;">${escapar(d.duracao)}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ===== RODAPÉ ===== -->
    <tr>
      <td style="border-radius:0 0 14px 14px;background-color:#1B211E;padding:30px 40px;" align="center">
        <p style="margin:0 0 8px;font-family:${FONTE};font-size:14px;font-weight:bold;color:#FFFFFF;">Peritos Academy</p>
        <p style="margin:0 0 14px;font-family:${FONTE};font-size:12px;line-height:1.6;color:#A3ABA6;">
          Do conhecimento à autoridade.<br>
          A plataforma de formação do perito judicial · <a href="https://evolua.peritosacademy.com.br" style="color:#3FD3AC;text-decoration:none;">evolua.peritosacademy.com.br</a>
        </p>
        <p style="margin:0;font-family:${FONTE};font-size:11px;line-height:1.6;color:#767E79;">
          Você recebe este e-mail porque se inscreveu neste encontro.<br>
          Não quero mais receber estes e-mails
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

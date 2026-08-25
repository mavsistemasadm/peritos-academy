// ══════════════════════════════════════════════════════════════════
// lib/email/templates/evento.ts — CONFIRMAÇÃO E LEMBRETES DE UM ENCONTRO
//
// Três emails, um arquivo, porque são a mesma peça em três momentos: você
// está dentro · é amanhã · está começando. O que muda entre eles é a urgência
// e o que o botão faz, e ver os três lado a lado é o que impede o terceiro de
// nascer com o tom do primeiro.
//
// Mesma gramática visual dos 16 templates aprovados (cabeçalho em degradê da
// marca, cartão branco, botão único) — não é um HTML novo inventado, é o
// mesmo esqueleto com o conteúdo deste caso.
//
// ⚠️ A frase "Cancelar inscrição" no rodapé é substituída por um link real em
// enviarEmailConvidado(); mexer no texto dela quebra a substituição em
// silêncio, e o email sai com um descadastro que não descadastra.
// ══════════════════════════════════════════════════════════════════

export type DadosEmailEvento = {
  primeiroNome: string
  titulo: string
  /** "Sábado, 5 de setembro · 20h00, horário de Brasília" */
  quando: string
  apresentador: string | null
  /** Endereço público do evento — onde se assiste. */
  url: string
  linkCalendario: string | null
}

type Momento = 'confirmacao' | 'vespera' | 'comecando' | 'ao_vivo'

const COPY: Record<Momento, {
  etiqueta: string
  chamada: string
  assunto: (d: DadosEmailEvento) => string
  corpo: (d: DadosEmailEvento) => string
  botao: string
}> = {
  confirmacao: {
    etiqueta: 'INSCRIÇÃO CONFIRMADA',
    chamada: 'Seu lugar<br>está garantido.',
    assunto: d => `Inscrição confirmada: ${cortar(d.titulo, 44)}`,
    corpo: d =>
      `Anotei seu nome. No dia e na hora abaixo, é só abrir o link. A transmissão acontece na própria página, você não precisa instalar nada nem criar conta em lugar nenhum.`
      + (d.apresentador ? ` Quem conduz é ${d.apresentador}.` : ''),
    botao: 'Ver a página do encontro',
  },
  vespera: {
    etiqueta: 'É AMANHÃ',
    chamada: 'É amanhã.<br>Deixa separado.',
    assunto: d => `Amanhã: ${cortar(d.titulo, 50)}`,
    corpo: () =>
      `Só passando para lembrar. Se puder, deixe o link já aberto numa aba antes de começar. A parte que mais rende costuma ser a primeira meia hora, e ela não volta.`,
    botao: 'Abrir a página do encontro',
  },
  ao_vivo: {
    etiqueta: 'ESTAMOS AO VIVO',
    chamada: 'Estamos<br>no ar.',
    assunto: d => `Estamos ao vivo: ${cortar(d.titulo, 46)}`,
    // O último empurrão é para quem viu o de uma hora atrás e deixou passar.
    // Por isso ele não repete a explicação: ele diz que já começou e mostra a
    // porta. Quem abre este email está decidindo em dois segundos.
    corpo: () => `Acabamos de começar. É só entrar. A transmissão está rolando na página do encontro.`,
    botao: 'Assistir agora',
  },
  comecando: {
    etiqueta: 'COMEÇA EM UMA HORA',
    chamada: 'Daqui a<br>uma hora.',
    assunto: d => `Em 1 hora: ${cortar(d.titulo, 48)}`,
    corpo: () =>
      `Começamos daqui a pouco. Deixe o link aberto numa aba. Dá para acompanhar e perguntar pelo chat ao lado do vídeo, sem sair da página.`,
    botao: 'Abrir a página do encontro',
  },
}

function cortar(texto: string, max: number) {
  return texto.length <= max ? texto : texto.slice(0, max - 1).trimEnd() + '…'
}

function escapar(t: string) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function emailEvento(momento: Momento, d: DadosEmailEvento): { assunto: string; html: string } {
  const c = COPY[momento]
  const titulo = escapar(d.titulo)
  const quando = escapar(d.quando)

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapar(c.assunto(d))}</title>
</head>
<body style="margin:0;padding:0;">
<div style="background:#eef0f4;padding:32px 16px;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 2px 14px rgba(6,30,53,0.10);">

    <div style="background:linear-gradient(150deg,#1DC8A0 0%,#0e9e82 20%,#083d5a 50%,#061e35 80%,#040f1e 100%);padding:38px 40px 34px;">
      <p style="margin:0 0 26px;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.45);">${c.etiqueta}</p>
      <p style="margin:0 0 22px;font-size:26px;font-weight:800;line-height:36px;color:#ffffff;letter-spacing:-0.5px;">${c.chamada}</p>
      <div style="width:52px;height:3px;background:linear-gradient(90deg,#1DC8A0,rgba(29,200,160,0));border-radius:2px;"></div>
    </div>

    <div style="padding:36px 40px 0;">
      <p style="margin:0 0 20px;font-size:16px;line-height:26px;color:#083952;">${escapar(d.primeiroNome)},</p>
      <p style="margin:0 0 26px;font-size:15px;line-height:26px;color:#4a5560;">${c.corpo(d)}</p>

      <div style="border:1px solid #e3e6ea;border-radius:14px;padding:20px 22px;margin:0 0 28px;background:#f8fafb;">
        <p style="margin:0 0 8px;font-size:11px;letter-spacing:2px;color:#8a949e;font-weight:700;">O ENCONTRO</p>
        <p style="margin:0 0 10px;font-size:17px;font-weight:800;color:#083952;line-height:24px;letter-spacing:-0.3px;">${titulo}</p>
        <p style="margin:0;font-size:14px;color:#4a5560;line-height:22px;">${quando}</p>
      </div>

      <div style="text-align:center;padding:0 0 6px;">
        <a href="${d.url}" style="display:inline-block;background:#1DC8A0;color:#04231c;text-decoration:none;font-size:15px;font-weight:800;padding:14px 30px;border-radius:999px;">${c.botao}</a>
      </div>
      ${d.linkCalendario && momento === 'confirmacao'
        ? `<p style="margin:16px 0 0;text-align:center;font-size:13px;color:#8a949e;"><a href="${d.linkCalendario}" style="color:#0e9e82;text-decoration:underline;">Adicionar ao meu calendário</a></p>`
        : ''}
    </div>

    <div style="padding:32px 40px 34px;">
      <p style="margin:0;font-size:12px;line-height:20px;color:#b4bac6;text-align:center;">
        Peritos Academy<br>Cancelar inscrição
      </p>
    </div>

  </div>
</div>
</body>
</html>`

  return { assunto: c.assunto(d), html }
}

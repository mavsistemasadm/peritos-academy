// ══════════════════════════════════════════════════════
// O PARÁGRAFO DE CADA EMAIL, ESCRITO PARA O ASSUNTO DA LIVE (18/10/2026)
//
// Pedido do dono: "uma estrutura de escrita lógica, mas que possa variar com o
// assunto". A estrutura continua em lib/email/templates/evento.ts (abertura,
// data, botão); aqui nasce UM parágrafo por momento, sobre o tema daquela
// live, e ele entra no lugar marcado do template.
//
// Escrito uma vez por live e guardado em `eventos.textos_email`, com o título
// para o qual foi escrito: renomear a live faz escrever de novo. O cron e o
// anúncio só leem. Sem a IA (chave ausente, erro, JSON torto), o email sai com
// o texto fixo de sempre: um email genérico é melhor que email nenhum.
// ══════════════════════════════════════════════════════
export type MomentoComTexto = 'anuncio' | 'vespera' | 'hoje' | 'comecando' | 'ao_vivo'
export type TextosEmail = Partial<Record<MomentoComTexto, string>> & {
  titulo?: string
  /** O gancho do assunto de cada email, sem data: o template põe dia e hora. */
  assuntos?: Partial<Record<MomentoComTexto, string>>
}

const MOMENTOS: MomentoComTexto[] = ['anuncio', 'vespera', 'hoje', 'comecando', 'ao_vivo']

export type EventoParaTexto = {
  id: string
  titulo: string
  descricao?: string | null
  tipo?: string | null
  apresentador_nome?: string | null
  textos_email?: TextosEmail | null
}

// ⚠️ O OBJETIVO É PRESENÇA (18/10/2026). Pedido do dono: o email tem de dizer
// por que vale participar, para trazer o maior número de pessoas. A ordem do
// convite é fixa (dor, o que leva, por que ao vivo); o conteúdo é do tema.
const SISTEMA = `Você escreve, na voz do Marlos Henrique (perito judicial e professor da Peritos Academy), os textos dos emails de uma live. O objetivo de todos é UM: trazer o maior número de peritos para a live ao vivo. A pessoa lê no celular, com pressa, e decide em segundos.

Para cada momento você escreve um PARÁGRAFO (o único do email que fala do tema; o resto, data e botão, já está pronto) e um GANCHO para o assunto do email.

Parágrafos, cada um com sua função:
- anuncio (o convite, o mais importante): 3 a 4 frases, nesta ordem. 1) Uma ABERTURA QUE PRENDE: uma constatação incômoda, um contraste ou uma pergunta que o perito nunca se fez sobre o tema, e que mostra o custo real de não dominá-lo (honorário cortado, laudo impugnado, nomeação perdida, horas jogadas fora); nunca comece por "marquei uma live", por "você sabia" ou por uma definição. 2) O que a pessoa sai sabendo ou fazendo, concreto. 3) Por que vale estar AO VIVO: tirar a própria dúvida e ver o caso ou o cálculo na tela; a gravação fica, mas não responde a pergunta de ninguém. Até 480 caracteres.
- vespera: por que vale separar esse horário amanhã, ligado ao problema dela. 1 a 2 frases, até 230.
- hoje: o que ela pode trazer ou preparar (uma dúvida, um caso, um número) para sair com a resposta. 1 a 2 frases, até 230.
- comecando: o primeiro ponto que vamos abrir, de um jeito que dê curiosidade. 1 a 2 frases, até 230.
- ao_vivo: uma frase curta de agora: o que já está acontecendo na tela. Até 120.

Ganchos do assunto (assuntos.*): sem data nem hora (o sistema acrescenta), sem ponto final, diferentes em cada momento.
- assuntos.anuncio é o que decide se o convite é aberto: tem de ser INTRIGANTE. Abra uma curiosidade que só o email fecha: um erro que a pessoa provavelmente comete sem saber, um contraste ("o laudo certo que o juiz não aceita"), uma pergunta incômoda, uma afirmação que contraria o senso comum do perito. Específico do tema, nunca genérico ("live sobre honorários") e nunca clickbait mentiroso: o email precisa cumprir o que o assunto promete. Até 50 caracteres.
- Os outros, até 45 caracteres: pergunta ou afirmação que toque o problema ou a promessa. Exemplos de tom: "Seu honorário está sendo cortado?", "Quanto cobrar numa perícia".

Regras: primeira pessoa, mentor que conversa, português do Brasil. Concreto e do tema. Proibido: urgência falsa (vagas, "últimas chances"), número, nome ou caso inventado, promessa de resultado garantido, travessão, emoji, markdown, aspas, citar data ou hora, repetir o título palavra por palavra.

Responda APENAS com JSON: {"anuncio":"","vespera":"","hoje":"","comecando":"","ao_vivo":"","assuntos":{"anuncio":"","vespera":"","hoje":"","comecando":"","ao_vivo":""}}`

const LIMITE: Record<MomentoComTexto, number> = { anuncio: 480, vespera: 230, hoje: 230, comecando: 230, ao_vivo: 120 }

function limpar(t: unknown, max: number): string | null {
  if (typeof t !== 'string') return null
  const s = t.replace(/[—–]/g, ',').replace(/[*#`"]/g, '').replace(/\s+/g, ' ').trim()
  return s.length >= 8 && s.length <= max + 40 ? s : null
}

export async function escreverTextosEmail(ev: EventoParaTexto): Promise<TextosEmail | null> {
  const chave = process.env.ANTHROPIC_API_KEY
  if (!chave) return null
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': chave, 'anthropic-version': '2023-06-01' },
      signal: AbortSignal.timeout(40_000),
      body: JSON.stringify({
        model: 'claude-opus-5-5',
        max_tokens: 2500,
        system: SISTEMA,
        messages: [{
          role: 'user',
          content: `Assunto da live: ${ev.titulo}\n`
            + (ev.descricao ? `Descrição: ${ev.descricao}\n` : '')
            + (ev.tipo ? `Formato: ${ev.tipo}\n` : '')
            + (ev.apresentador_nome ? `Quem conduz: ${ev.apresentador_nome}\n` : ''),
        }],
      }),
    })
    const d = await r.json()
    const texto = (d.content ?? []).map((c: { text?: string }) => c.text ?? '').join('')
    const json = JSON.parse(texto.slice(texto.indexOf('{'), texto.lastIndexOf('}') + 1))
    const out: TextosEmail = { titulo: ev.titulo }
    out.assuntos = {}
    for (const m of MOMENTOS) {
      const t = limpar(json[m], LIMITE[m])
      if (t) out[m] = t
      const g = limpar(json.assuntos?.[m], m === 'anuncio' ? 50 : 45)
      if (g) out.assuntos[m] = g.replace(/[.]+$/, '')
    }
    return Object.keys(out).length > 1 ? out : null
  } catch (e) {
    console.error('[evento/textos] não escrevi os textos:', (e as Error).message)
    return null
  }
}

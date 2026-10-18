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
export type TextosEmail = Partial<Record<MomentoComTexto, string>> & { titulo?: string }

const MOMENTOS: MomentoComTexto[] = ['anuncio', 'vespera', 'hoje', 'comecando', 'ao_vivo']

export type EventoParaTexto = {
  id: string
  titulo: string
  descricao?: string | null
  tipo?: string | null
  apresentador_nome?: string | null
  textos_email?: TextosEmail | null
}

const SISTEMA = `Você escreve, na voz do Marlos Henrique (perito judicial e professor da Peritos Academy), um parágrafo para cada email de uma live. O resto de cada email já está escrito; o seu parágrafo é o único que fala do ASSUNTO da live.

Um parágrafo por momento, cada um com um ângulo diferente:
- anuncio: o que a pessoa vai sair sabendo ou conseguindo fazer depois desta live.
- vespera: por que vale segurar esse horário, ligado ao tema.
- hoje: o que ela pode preparar ou trazer (uma dúvida, um caso, um número) para aproveitar mais.
- comecando: o primeiro ponto que vamos abrir na live.
- ao_vivo: uma frase curta, ligada ao tema, que dá vontade de entrar agora.

Regras: primeira pessoa, tom de mentor que conversa, português do Brasil. Concreto e específico do tema, sem promessa exagerada e sem inventar números, nomes ou casos. De 1 a 2 frases, até 230 caracteres (ao_vivo até 120). Sem travessão, sem emoji, sem markdown, sem aspas, sem repetir o título palavra por palavra e sem citar data ou hora.

Responda APENAS com um objeto JSON com as chaves anuncio, vespera, hoje, comecando, ao_vivo.`

function limpar(t: unknown, max: number): string | null {
  if (typeof t !== 'string') return null
  const s = t.replace(/[—–]/g, ',').replace(/[*#`"]/g, '').replace(/\s+/g, ' ').trim()
  return s.length >= 20 && s.length <= max + 40 ? s : null
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
        max_tokens: 1500,
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
    for (const m of MOMENTOS) {
      const t = limpar(json[m], m === 'ao_vivo' ? 120 : 230)
      if (t) out[m] = t
    }
    return Object.keys(out).length > 1 ? out : null
  } catch (e) {
    console.error('[evento/textos] não escrevi os textos:', (e as Error).message)
    return null
  }
}

// ══════════════════════════════════════════════════════
// AS LIVES NOS GRUPOS DE WHATSAPP (18/10/2026)
//
// O mesmo esquema dos emails, nos grupos da Peritos Academy: o convite quando
// o dono pede (pelo Jarvis, com teste no WhatsApp dele antes), e sozinhos o
// "é hoje" de manhã e o "estamos ao vivo" na hora, com o link da live.
//
// Publica pela Evolution, como a régua de A Última Chamada no Nexus
// (app/api/cron/ultima-chamada-grupo). O número precisa ser ADMINISTRADOR do
// grupo quando ele só aceita mensagem de admin.
//
// ⚠️ DESLIGADO ATÉ `WHATSAPP_GRUPOS_ATIVO=1`. Quem confere que o número é
// admin é o dono, não o código. Desligado, nada sai: cada envio volta como
// simulação, com o texto que sairia.
//
// ⚠️ RESERVAR, MANDAR, CONFIRMAR: a linha de evento_whatsapp_envios entra
// antes do envio. Quem colide na chave sai calado; a mensagem não cai duas
// vezes no mesmo grupo.
// ══════════════════════════════════════════════════════
import { criarClienteServico } from '@/lib/supabase/servico'
import { SITE_URL } from '@/lib/site'
import { garantirTextosEmail } from '@/lib/evento/textos'

export type MomentoGrupo = 'anuncio' | 'hoje' | 'ao_vivo'

/** O número que publica: o "Suporte do Nexus Pericial" (final 5528), admin
 *  dos grupos da Academy desde 19/10/2026. O "Nexus Pericial" (o da Última
 *  Chamada) não está nesses grupos. WHATSAPP_GRUPOS_INSTANCIA troca sem deploy. */
const INSTANCIA_PADRAO = 'opera_b52f881e38bc_suporte'

function evolution() {
  const base = process.env.EVOLUTION_API_URL?.replace(/\/+$/, '')
  const apikey = process.env.EVOLUTION_API_KEY
  const instancia = process.env.WHATSAPP_GRUPOS_INSTANCIA?.trim() || INSTANCIA_PADRAO
  return base && apikey ? { base, apikey, instancia } : null
}

export const gruposLigados = () => process.env.WHATSAPP_GRUPOS_ATIVO === '1'

async function chamar(caminho: string, corpo?: unknown): Promise<any> {
  const ev = evolution()
  if (!ev) throw new Error('Evolution não configurada (EVOLUTION_API_URL, EVOLUTION_API_KEY)')
  const res = await fetch(`${ev.base}${caminho.replace('{i}', ev.instancia)}`, {
    method: corpo ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', apikey: ev.apikey },
    body: corpo ? JSON.stringify(corpo) : undefined,
    signal: AbortSignal.timeout(60_000),
  })
  const txt = await res.text()
  if (!res.ok) throw new Error(`Evolution ${res.status}: ${txt.slice(0, 200)}`)
  try { return JSON.parse(txt) } catch { return txt }
}

type GrupoDescoberto = { jid: string; nome: string; membros: number | null; soAdmins: boolean; souAdmin: boolean | null }

/**
 * Os grupos em que o número está, e se ele é admin em cada um. Com
 * participantes, porque "só admins enviam" + número sem admin = mensagem que
 * não sai, e isso tem de aparecer ANTES de ligar.
 */
export async function descobrirGrupos(): Promise<GrupoDescoberto[]> {
  const grupos: any[] = await chamar('/group/fetchAllGroups/{i}?getParticipants=true')
  const eu = String((await chamar('/instance/fetchInstances?instanceName={i}'))?.[0]?.ownerJid ?? '').split('@')[0]
  return (Array.isArray(grupos) ? grupos : [])
    .filter(g => !g.isCommunity)
    .map(g => {
      const p = (g.participants ?? []).find((x: any) => String(x.id ?? '').split('@')[0] === eu)
      return {
        jid: g.id,
        nome: g.subject ?? '(sem nome)',
        membros: g.size ?? (g.participants?.length ?? null),
        soAdmins: !!g.announce,
        souAdmin: eu && g.participants ? !!(p && p.admin) : null,
      }
    })
    .sort((a, b) => (b.membros ?? 0) - (a.membros ?? 0))
    .slice(0, 80)
}

type EventoGrupo = {
  id: string; slug: string; titulo: string; inicia_em: string
  descricao?: string | null; tipo?: string | null; apresentador_nome?: string | null
  textos_email?: Record<string, unknown> | null
  recebe_duvidas?: boolean | null
}

function quando(iso: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso)).map(x => [x.type, x.value]))
  return { dia: `${String(p.weekday).replace('-feira', '')}, ${p.day}/${p.month}`, hora: `${Number(p.hour)}h${p.minute === '00' ? '' : p.minute}` }
}

/** O texto de cada momento, no WhatsApp: curto, *negrito* do WhatsApp, link no fim. */
export async function textoDoGrupo(ev: EventoGrupo, momento: MomentoGrupo): Promise<string> {
  const t = (await garantirTextosEmail(ev as never)) as (Record<string, string> & { assuntos?: Record<string, string> }) | null
  const { dia, hora } = quando(ev.inicia_em)
  const link = `${SITE_URL}/evento/${ev.slug}`
  const gancho = t?.assuntos?.[momento]
  // Live de tira-dúvidas: o convite e o "é hoje" chamam para mandar a dúvida
  // antes, com anexo, pelo formulário da página.
  const duvida = ev.recebe_duvidas
    ? `❓ *Tem uma dúvida?* Mande antes, com documento ou print se precisar, e eu respondo ao vivo: ${link}#duvida`
    : null
  // A primeira linha diz o que a mensagem É: sem ela, o gancho chegava solto
  // no grupo e ninguém sabia que era um convite (o dono, 19/10/2026).
  const convite = ev.recebe_duvidas || ev.tipo === 'plantao'
    ? '🎥 *Convite: plantão de tira-dúvidas ao vivo na Peritos Academy*'
    : '🎥 *Convite: aula ao vivo na Peritos Academy*'
  if (momento === 'anuncio') {
    return [
      convite,
      `*${gancho ?? ev.titulo}*`,
      t?.anuncio ?? `Live nova: ${ev.titulo}.`,
      `📅 *${dia}, às ${hora}*, ao vivo na Peritos Academy.`,
      `Reserve o seu lugar: ${link}`,
      duvida,
    ].filter(Boolean).join('\n\n')
  }
  if (momento === 'hoje') {
    return [
      `🎥 *Hoje tem ${ev.recebe_duvidas || ev.tipo === 'plantao' ? 'plantão de tira-dúvidas' : 'aula'} ao vivo, às ${hora}*`,
      `*${gancho ?? ev.titulo}*`,
      t?.hoje ?? 'É hoje. Separe o horário e traga a sua dúvida.',
      `Entre por aqui: ${link}`,
      duvida,
    ].filter(Boolean).join('\n\n')
  }
  return [`🔴 *Estamos ao vivo:* ${ev.titulo}`, t?.ao_vivo ?? 'Já começou.', link].join('\n\n')
}

type Resultado = { grupo: string; enviado: boolean; simulado?: boolean; erro?: string }

/** Publica um momento de uma live em todos os grupos ativos. Nunca lança. */
export async function publicarNosGrupos(ev: EventoGrupo, momento: MomentoGrupo): Promise<{ texto: string; resultados: Resultado[] }> {
  const sb = criarClienteServico()
  const texto = await textoDoGrupo(ev, momento)
  const { data: grupos } = await sb.from('whatsapp_grupos').select('jid, nome').eq('ativo', true)
  const resultados: Resultado[] = []
  for (const g of grupos ?? []) {
    if (!gruposLigados()) { resultados.push({ grupo: g.nome, enviado: false, simulado: true }); continue }
    const { error: colidiu } = await sb.from('evento_whatsapp_envios').insert({ evento_id: ev.id, grupo_jid: g.jid, momento })
    if (colidiu) { resultados.push({ grupo: g.nome, enviado: false, erro: 'já enviado' }); continue }
    try {
      await chamar('/message/sendText/{i}', { number: g.jid, text: texto, linkPreview: true })
      await sb.from('evento_whatsapp_envios').update({ enviado_em: new Date().toISOString() })
        .match({ evento_id: ev.id, grupo_jid: g.jid, momento })
      resultados.push({ grupo: g.nome, enviado: true })
    } catch (e) {
      const erro = (e as Error).message
      await sb.from('evento_whatsapp_envios').update({ erro }).match({ evento_id: ev.id, grupo_jid: g.jid, momento })
      resultados.push({ grupo: g.nome, enviado: false, erro })
    }
    // Uma pausa entre grupos: rajada de mensagens iguais é o que o WhatsApp pune.
    await new Promise(r => setTimeout(r, 4000))
  }
  return { texto, resultados }
}

/** O texto do convite só para um número (o do dono), como teste. Funciona desligado. */
export async function testeNoWhatsapp(ev: EventoGrupo, numero: string, momento: MomentoGrupo = 'anuncio') {
  const texto = await textoDoGrupo(ev, momento)
  await chamar('/message/sendText/{i}', { number: numero.replace(/\D/g, ''), text: `[TESTE do grupo]\n\n${texto}`, linkPreview: true })
  return { ok: true, texto }
}

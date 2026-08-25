// ══════════════════════════════════════════════════════════════════
// lib/evento/email.ts — OS DADOS DE UM EVENTO, DO JEITO QUE O EMAIL PRECISA
//
// Mora fora de actions.ts por uma regra do Next, e a regra tem razão: um
// arquivo 'use server' só pode exportar função async, porque tudo que ele
// exporta vira endpoint chamável pelo navegador. Formatar uma data não é
// endpoint.
//
// É lido tanto pela inscrição (confirmação na hora) quanto pelo cron dos
// lembretes. Uma cópia só: a data que a pessoa leu na confirmação precisa ser
// exatamente a que ela lê no lembrete da manhã.
//
// ⚠️ Tudo aqui é no relógio de Brasília, sempre, e nunca no fuso de quem
// executa. O cron roda em UTC num servidor da Vercel; sem `timeZone` fixo,
// uma live das 20h viraria "23h" no email.
// ══════════════════════════════════════════════════════════════════
import { SITE_URL } from '@/lib/site'
import type { DadosEmailEvento } from '@/lib/email/templates/evento'

const TZ = 'America/Sao_Paulo'

export type EventoParaEmail = {
  id: string; slug: string; titulo: string
  inicia_em: string | null; duracao_seg: number
  descricao: string | null; apresentador_nome: string | null
  tipo?: string | null
}

/** Os mesmos rótulos da tela. Um evento não pode se chamar "sala_analise" no
 *  assunto de um email. */
const TIPO_ROTULO: Record<string, string> = {
  sala_analise: 'Sala de análise',
  aula_ao_vivo: 'Aula ao vivo',
  plantao: 'Plantão de dúvidas',
  mentoria: 'Mentoria de turma',
  lancamento: 'Lançamento',
}

export function dadosDoEmail(ev: EventoParaEmail, nome: string): DadosEmailEvento {
  return {
    primeiroNome: primeiroNome(nome),
    titulo: ev.titulo,
    quando: quandoPorExtenso(ev.inicia_em),
    dia: diaPorExtenso(ev.inicia_em),
    horario: horario(ev.inicia_em),
    duracao: duracaoCurta(ev.duracao_seg),
    apresentador: ev.apresentador_nome,
    descricao: ev.descricao,
    tipoRotulo: ev.tipo ? TIPO_ROTULO[ev.tipo] ?? null : null,
    url: `${SITE_URL}/evento/${ev.slug}`,
    linkCalendario: linkCalendario(ev),
  }
}

/** "Fulano de Tal" vira "Fulano". Email que chama a pessoa pelo nome inteiro
 *  soa como cobrança de banco, não como recado de professor. */
function primeiroNome(nome: string) {
  return nome.trim().split(/\s+/)[0] || nome.trim() || 'Olá'
}

export function quandoPorExtenso(iso: string | null) {
  if (!iso) return 'Data a confirmar'
  return `${diaPorExtenso(iso)}, às ${horario(iso)}, horário de Brasília`
}

export function diaPorExtenso(iso: string | null) {
  if (!iso) return 'A confirmar'
  const t = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date(iso))
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function horario(iso: string | null) {
  if (!iso) return '--'
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso)).replace(':', 'h')
}

export function duracaoCurta(seg: number) {
  const h = Math.floor(seg / 3600)
  const m = Math.round((seg % 3600) / 60)
  if (h && m) return `${h}h${String(m).padStart(2, '0')}`
  if (h) return `${h}h`
  return `${m}min`
}

function linkCalendario(ev: EventoParaEmail) {
  if (!ev.inicia_em) return null
  const ini = new Date(ev.inicia_em)
  const fim = new Date(+ini + ev.duracao_seg * 1000)
  const z = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, '')
  const p = new URLSearchParams({
    action: 'TEMPLATE', text: ev.titulo,
    dates: `${z(ini)}/${z(fim)}`, details: ev.descricao ?? '',
  })
  return `https://calendar.google.com/calendar/render?${p}`
}

// ══════════════════════════════════════════════════════════════════
// lib/evento/email.ts — OS DADOS DE UM EVENTO, DO JEITO QUE O EMAIL PRECISA
//
// Mora fora de actions.ts por uma regra do Next, e a regra tem razão: um
// arquivo 'use server' só pode exportar função async, porque tudo que ele
// exporta vira endpoint chamável pelo navegador. Formatar uma data não é
// endpoint.
//
// São lidos tanto pela inscrição (confirmação na hora) quanto pelo cron dos
// lembretes. Uma cópia só: a data que a pessoa leu na confirmação precisa ser
// exatamente a que ela lê no lembrete da véspera.
// ══════════════════════════════════════════════════════════════════
import { SITE_URL } from '@/lib/site'

export type EventoParaEmail = {
  id: string; slug: string; titulo: string
  inicia_em: string | null; duracao_seg: number
  descricao: string | null; apresentador_nome: string | null
}

export function dadosDoEmail(ev: EventoParaEmail, nome: string) {
  return {
    primeiroNome: nome.split(' ')[0],
    titulo: ev.titulo,
    quando: quandoPorExtenso(ev.inicia_em),
    apresentador: ev.apresentador_nome,
    url: `${SITE_URL}/evento/${ev.slug}`,
    linkCalendario: linkCalendario(ev),
  }
}

export function quandoPorExtenso(iso: string | null) {
  if (!iso) return 'Data a confirmar'
  const t = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
  return t.charAt(0).toUpperCase() + t.slice(1) + ', horário de Brasília'
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

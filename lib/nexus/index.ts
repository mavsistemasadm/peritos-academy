// lib/nexus/index.ts
// Tipos e regras de contexto das sugestões do MH Nexus.
// Sem acesso a banco aqui — só a lógica pura de "que app faz sentido neste
// ponto da jornada". Assim dá pra raciocinar (e testar) a escolha do app sem
// subir nada.

export type AppNexus =
  | 'financeiro'
  | 'opera'
  | 'galacticos'
  | 'ponto'
  | 'ache_um_perito'
  | 'biblioteca'

export type PlacementNexus = 'aula' | 'conquista' | 'sino' | 'perfil' | 'bloqueio'

export type AcaoNexus = 'exibida' | 'clicada' | 'dispensada' | 'assinou'

export type SugestaoNexus = {
  app: AppNexus
  chave: string
  titulo: string
  corpo: string
  link: string
}

export type BloqueioNexus = {
  corpo: string
  link: string
}

export const NOME_APP: Record<AppNexus, string> = {
  financeiro: 'Financeiro MH',
  opera: 'Opera CRM',
  galacticos: 'Galácticos IA',
  ponto: 'MH Ponto',
  ache_um_perito: 'Ache um Perito',
  biblioteca: 'Biblioteca de Planilhas',
}

/**
 * Ordem de preferência de app por contexto. O contexto é o slug do curso ou
 * da trilha em que o aluno está; a primeira regra que casar define a fila de
 * candidatos, e a seleção desce a fila até achar um app que não esteja pausado
 * por dispensas nem seja o último que já foi mostrado.
 *
 * A fila importa mais que o acerto exato: se o app preferido estiver
 * indisponível, o segundo ainda é relevante pro mesmo contexto.
 */
const REGRAS_CONTEXTO: { padrao: RegExp; apps: AppNexus[] }[] = [
  // trabalhista: cartão ponto é a dor mais concreta
  { padrao: /trabalhist|jornada|ponto|rescis|verbas|expert-em-calculos-trabalhistas/,
    apps: ['ponto', 'galacticos', 'biblioteca'] },
  // bancário / revisional
  { padrao: /banc|revisional|cheque|financiamento|consorcio|cartao-de-credito|juros|iof|sfh|fies|price/,
    apps: ['galacticos', 'biblioteca', 'opera'] },
  // previdenciário e fundos de pensão
  { padrao: /previden|aposentad|pasep|previ|petros|funcef|inss|beneficio|vida-toda|urv/,
    apps: ['galacticos', 'biblioteca', 'ache_um_perito'] },
  // planilhas, excel, automação
  { padrao: /planilha|excel|automac|automat|tabela|dados/,
    apps: ['biblioteca', 'galacticos', 'ponto'] },
  // negócio, carreira, marketing, precificação
  { padrao: /comercial|marketing|ads|nomeac|honorari|carreira|negocio|mapa-da-mina|precificacao|e-mails|decisao|impossivel|perito-e/,
    apps: ['opera', 'financeiro', 'ache_um_perito'] },
  // laudos, quesitos, processo
  { padrao: /laudo|quesito|processo|judicial|pje|execuc|liquidacao/,
    apps: ['galacticos', 'opera', 'biblioteca'] },
  // tributário
  { padrao: /tribut|icms|imposto|pis|cofins|precatorio|fazenda|municipa/,
    apps: ['galacticos', 'biblioteca', 'financeiro'] },
]

/** Fila usada quando não há contexto ou nenhuma regra casa. */
const FILA_PADRAO: AppNexus[] = [
  'galacticos', 'biblioteca', 'opera', 'financeiro', 'ponto', 'ache_um_perito',
]

/**
 * Fila de apps candidatos para um contexto, sempre completa: começa pelos
 * relevantes e completa com o resto, pra nunca ficar sem opção quando os
 * preferidos estiverem pausados por dispensas.
 */
export function filaDeApps(contexto?: string | null): AppNexus[] {
  const alvo = (contexto ?? '').toLowerCase()
  const regra = alvo ? REGRAS_CONTEXTO.find((r) => r.padrao.test(alvo)) : undefined
  const inicio = regra?.apps ?? FILA_PADRAO
  const resto = FILA_PADRAO.filter((a) => !inicio.includes(a))
  return [...inicio, ...resto]
}

// lib/selo/index.ts
// O Selo de Excelência: arte, som e links, num lugar só. Puro (sem servidor),
// para a comemoração (client), o perfil, a Jornada e o email lerem igual.
// Regras em "O Selo de Excelência — 2026-10-19" no CLAUDE.md.
import { SITE_URL } from '@/lib/site'

/** Arte do selo recortada em círculo, fundo transparente (600px). */
export const SELO_IMG = '/selo/selo-excelencia.png'
/** Versão pequena (200px), para perfil, Jornada e perfil público. */
export const SELO_IMG_P = '/selo/selo-excelencia-200.png'
/** Arte inteira (1200px), para a comemoração de tela cheia. */
export const SELO_HERO = '/selo/selo-hero.jpg'
/**
 * Fanfarra da comemoração: "Grand brass fanfare", Mixkit (sfx 631).
 * Licença Mixkit Free Sound Effects: uso comercial liberado, sem atribuição.
 */
export const SELO_SOM = '/sons/selo-excelencia.mp3'

export function perfilPublicoUrl(slug: string | null | undefined, publico: boolean | null | undefined): string | null {
  return slug && publico ? `${SITE_URL}/perito/${slug}` : null
}

/** Compartilhar no LinkedIn: só faz sentido com o perfil público, que é onde o selo aparece. */
export function linkedinCompartilharUrl(url: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
}

export function formatarDataSelo(iso: string | null | undefined): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' })
}

export type NumerosFormacao = { cursos: number; aulas: number; horas: number }

/**
 * Primeiro nome para a frase da comemoração e do email. Pula prefixo com ponto
 * ("ADM.", "Dr.") e desfaz o tudo-maiúsculo: o cadastro "ADM. CRISTIAN LEAL
 * VIEIRA" vira "Cristian", e não "ADM.".
 */
export function primeiroNomeDe(nome: string | null | undefined): string {
  const partes = (nome ?? '').trim().split(/\s+/).filter(Boolean)
  const p = partes.find(x => !x.endsWith('.')) ?? partes[0] ?? ''
  if (!p) return 'Perito'
  const ehCaixaAlta = p === p.toUpperCase()
  return ehCaixaAlta ? p.charAt(0) + p.slice(1).toLowerCase() : p
}

// lib/queries/guia.ts
// Dados dinâmicos da página /guia — o texto dos capítulos é estático
// (lib/guia/conteudo.ts); aqui só o que vem do banco (contato de suporte,
// lista real dos 10 níveis com os selos reais de public/niveis/).
import { criarClienteServidor } from '@/lib/supabase/server'
import { carregarConfigPlataforma } from '@/lib/queries/config-plataforma'

export type NivelGuia = { ordem: number; nome: string; imgUrl: string }

export type DadosGuia = {
  emailSuporte: string
  whatsappSuporte: string | null
  niveis: NivelGuia[]
}

// mesmo mapa usado em ConquistaToast.tsx pro toast de subida de nível
export const NIVEL_IMG: Record<number, string> = {
  1: '/niveis/nivel-01-explorador-novato.png',
  2: '/niveis/nivel-02-conhecedor-de-logicas.png',
  3: '/niveis/nivel-03-aspirante-a-perito.png',
  4: '/niveis/nivel-04-decifrador-de-calculos.png',
  5: '/niveis/nivel-05-profissao-perito.png',
  6: '/niveis/nivel-06-autoridade-pericial.png',
  7: '/niveis/nivel-07-desenvolvedor-de-teses.png',
  8: '/niveis/nivel-08-estrategista-expert.png',
  9: '/niveis/nivel-09-mestre-supremo.png',
  10: '/niveis/nivel-10-eu-sou-a-lenda.png',
}

export async function carregarGuia(): Promise<DadosGuia> {
  const supabase = await criarClienteServidor()
  const [{ data: niveisRaw }, config] = await Promise.all([
    supabase.from('gamificacao_niveis').select('nome, ordem').order('ordem', { ascending: true }),
    carregarConfigPlataforma(),
  ])

  return {
    emailSuporte: config.emailSuporte ?? 'marlos@peritosacademy.com.br',
    whatsappSuporte: config.whatsappSuporte,
    niveis: (niveisRaw ?? []).map(n => ({
      ordem: n.ordem, nome: n.nome,
      imgUrl: NIVEL_IMG[n.ordem] ?? '/niveis/nivel-01-explorador-novato.png',
    })),
  }
}

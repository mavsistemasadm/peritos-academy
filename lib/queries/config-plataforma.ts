// lib/queries/config-plataforma.ts
// Leitura pública do registro único config_plataforma — usado pelo layout
// root (metadata), NavPlataforma/login (logo, redirect pós-login), páginas
// /termos e /privacidade, middleware (modo manutenção) e módulos com toggle
// (comunidade/desafios/agenda). Escrita fica em app/admin/configuracoes/actions.ts.
import { criarClienteServidor } from '@/lib/supabase/server'

export type ConfigPlataforma = {
  nomePlataforma: string
  slogan: string | null
  logoUrl: string | null
  faviconUrl: string | null
  emailSuporte: string | null
  whatsappSuporte: string | null
  instagramUrl: string | null
  youtubeUrl: string | null
  linkedinUrl: string | null
  termosUso: string | null
  politicaPrivacidade: string | null
  textoRodape: string | null
  paginaInicialPosLogin: string
  modoManutencao: boolean
  mensagemManutencao: string | null
  comunidadeAtiva: boolean
  desafiosAtivos: boolean
  agendaAtiva: boolean
  metaTitulo: string | null
  metaDescricao: string | null
  ogImageUrl: string | null
}

const PADRAO: ConfigPlataforma = {
  nomePlataforma: 'Peritos Academy', slogan: null, logoUrl: null, faviconUrl: null,
  emailSuporte: null, whatsappSuporte: null, instagramUrl: null, youtubeUrl: null, linkedinUrl: null,
  termosUso: null, politicaPrivacidade: null, textoRodape: null,
  paginaInicialPosLogin: '/', modoManutencao: false, mensagemManutencao: null,
  comunidadeAtiva: true, desafiosAtivos: true, agendaAtiva: true,
  metaTitulo: null, metaDescricao: null, ogImageUrl: null,
}

export async function carregarConfigPlataforma(): Promise<ConfigPlataforma> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('config_plataforma').select('*').eq('id', 1).maybeSingle()
  if (!data) return PADRAO

  return {
    nomePlataforma: data.nome_plataforma ?? PADRAO.nomePlataforma,
    slogan: data.slogan, logoUrl: data.logo_url, faviconUrl: data.favicon_url,
    emailSuporte: data.email_suporte, whatsappSuporte: data.whatsapp_suporte,
    instagramUrl: data.instagram_url, youtubeUrl: data.youtube_url, linkedinUrl: data.linkedin_url,
    termosUso: data.termos_uso, politicaPrivacidade: data.politica_privacidade, textoRodape: data.texto_rodape,
    paginaInicialPosLogin: data.pagina_inicial_pos_login ?? '/',
    modoManutencao: data.modo_manutencao ?? false, mensagemManutencao: data.mensagem_manutencao,
    comunidadeAtiva: data.comunidade_ativa ?? true, desafiosAtivos: data.desafios_ativos ?? true, agendaAtiva: data.agenda_ativa ?? true,
    metaTitulo: data.meta_titulo, metaDescricao: data.meta_descricao, ogImageUrl: data.og_image_url,
  }
}

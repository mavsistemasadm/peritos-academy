'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'

type Resultado = { ok: true } | { ok: false; erro: string }

async function checarPermissao() {
  const admin = await obterAdminAtual()
  if (!temPermissao(admin, 'configuracoes')) return null
  return admin
}

function revalidar() {
  revalidatePath('/admin/configuracoes')
  // config_plataforma afeta praticamente todo o app (nav, login, metadata).
  revalidatePath('/', 'layout')
}

export async function atualizarIdentidade(formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const nome = (formData.get('nome_plataforma') as string)?.trim()
  if (!nome) return { ok: false, erro: 'Nome da plataforma é obrigatório.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('config_plataforma').update({
    nome_plataforma: nome,
    slogan: (formData.get('slogan') as string)?.trim() || null,
    email_suporte: (formData.get('email_suporte') as string)?.trim() || null,
    whatsapp_suporte: (formData.get('whatsapp_suporte') as string)?.trim() || null,
    instagram_url: (formData.get('instagram_url') as string)?.trim() || null,
    youtube_url: (formData.get('youtube_url') as string)?.trim() || null,
    linkedin_url: (formData.get('linkedin_url') as string)?.trim() || null,
  }).eq('id', 1)

  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true }
}

async function uploadImagemConfig(campo: 'logo_url' | 'favicon_url' | 'og_image_url', arquivo: File | null): Promise<Resultado & { url?: string }> {
  if (!arquivo || arquivo.size === 0) return { ok: false, erro: 'Selecione uma imagem.' }
  const ext = arquivo.name.split('.').pop()?.toLowerCase() ?? 'png'
  if (!['jpg', 'jpeg', 'png', 'webp', 'ico', 'svg'].includes(ext)) return { ok: false, erro: 'Formato não aceito. Use JPG, PNG, WebP, ICO ou SVG.' }
  if (arquivo.size > 2 * 1024 * 1024) return { ok: false, erro: 'Imagem muito grande. Máximo 2 MB.' }

  const supabase = await criarClienteServidor()
  const path = `config-plataforma/${campo}.${ext}`
  const buffer = Buffer.from(await arquivo.arrayBuffer())
  const { error: upErr } = await supabase.storage.from('capas').upload(path, buffer, { contentType: arquivo.type, upsert: true })
  if (upErr) return { ok: false, erro: upErr.message }

  const { data: urlData } = supabase.storage.from('capas').getPublicUrl(path)
  const url = urlData.publicUrl + '?t=' + Date.now()

  const { error } = await supabase.from('config_plataforma').update({ [campo]: url }).eq('id', 1)
  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true, url }
}

export async function uploadLogo(formData: FormData): Promise<Resultado & { url?: string }> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  return uploadImagemConfig('logo_url', formData.get('arquivo') as File | null)
}

export async function uploadFavicon(formData: FormData): Promise<Resultado & { url?: string }> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  return uploadImagemConfig('favicon_url', formData.get('arquivo') as File | null)
}

export async function uploadOgImage(formData: FormData): Promise<Resultado & { url?: string }> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  return uploadImagemConfig('og_image_url', formData.get('arquivo') as File | null)
}

export async function atualizarComportamento(formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const pagina = (formData.get('pagina_inicial_pos_login') as string)?.trim() || '/'
  if (!pagina.startsWith('/')) return { ok: false, erro: 'A página pós-login precisa começar com "/".' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('config_plataforma').update({
    pagina_inicial_pos_login: pagina,
    modo_manutencao: formData.get('modo_manutencao') === 'on',
    mensagem_manutencao: (formData.get('mensagem_manutencao') as string)?.trim() || null,
    comunidade_ativa: formData.get('comunidade_ativa') === 'on',
    desafios_ativos: formData.get('desafios_ativos') === 'on',
    agenda_ativa: formData.get('agenda_ativa') === 'on',
  }).eq('id', 1)

  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true }
}

export async function atualizarTextos(formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('config_plataforma').update({
    termos_uso: (formData.get('termos_uso') as string)?.trim() || null,
    politica_privacidade: (formData.get('politica_privacidade') as string)?.trim() || null,
    texto_rodape: (formData.get('texto_rodape') as string)?.trim() || null,
  }).eq('id', 1)

  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true }
}

export async function atualizarSEO(formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('config_plataforma').update({
    meta_titulo: (formData.get('meta_titulo') as string)?.trim() || null,
    meta_descricao: (formData.get('meta_descricao') as string)?.trim() || null,
  }).eq('id', 1)

  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true }
}

// ============================================================
// Sugestões do Nexus
// ============================================================
export async function atualizarNexus(formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const linkGlobal = (formData.get('link_global') as string)?.trim()
  if (!linkGlobal) return { ok: false, erro: 'O link global é obrigatório.' }
  if (!/^https?:\/\//i.test(linkGlobal)) {
    return { ok: false, erro: 'O link global precisa começar com http:// ou https://' }
  }

  // Overrides por app: vazio significa "usa o global", então grava null em vez
  // de string vazia (o resolvedor de link testa por conteúdo).
  const opcional = (campo: string) => {
    const v = (formData.get(campo) as string)?.trim()
    if (!v) return null
    return /^https?:\/\//i.test(v) ? v : undefined // undefined = inválido
  }
  const apps = ['financeiro', 'opera', 'galacticos', 'ponto', 'ache_um_perito', 'biblioteca']
  const links: Record<string, string | null> = {}
  for (const app of apps) {
    const v = opcional(`link_${app}`)
    if (v === undefined) return { ok: false, erro: `O link de ${app} precisa começar com http:// ou https://` }
    links[`link_${app}`] = v
  }

  const inteiro = (campo: string, minimo: number, padrao: number) => {
    const n = Number(formData.get(campo))
    return Number.isFinite(n) && n >= minimo ? Math.floor(n) : padrao
  }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('nexus_cta_config').update({
    link_global: linkGlobal,
    ...links,
    ativo: formData.get('ativo') === 'on',
    ativo_aula: formData.get('ativo_aula') === 'on',
    ativo_conquista: formData.get('ativo_conquista') === 'on',
    ativo_sino: formData.get('ativo_sino') === 'on',
    ativo_perfil: formData.get('ativo_perfil') === 'on',
    ativo_bloqueio: formData.get('ativo_bloqueio') === 'on',
    max_sino_por_semana: inteiro('max_sino_por_semana', 0, 1),
    dias_pausa_dismissal: inteiro('dias_pausa_dismissal', 0, 30),
    dispensas_para_pausar: inteiro('dispensas_para_pausar', 1, 3),
    atualizado_em: new Date().toISOString(),
  }).eq('id', 1)

  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true }
}

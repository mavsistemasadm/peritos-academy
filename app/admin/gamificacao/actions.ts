'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'

type Resultado = { ok: true; id?: string } | { ok: false; erro: string }

async function checarPermissao() {
  const admin = await obterAdminAtual()
  if (!temPermissao(admin, 'gamificacao')) return null
  return admin
}

function revalidar() {
  revalidatePath('/admin/gamificacao')
}

// ---------- Definições ----------

export async function atualizarConfigGamificacao(formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('config_gamificacao').update({
    gamificacao_ativa: formData.get('gamificacao_ativa') === 'on',
    gatilhos_ativos: formData.get('gatilhos_ativos') === 'on',
    ranking_ativo: formData.get('ranking_ativo') === 'on',
    loja_ativa: formData.get('loja_ativa') === 'on',
    niveis_ativos: formData.get('niveis_ativos') === 'on',
    exibir_pontuacao_perfil: formData.get('exibir_pontuacao_perfil') === 'on',
    exibir_nivel_previa_perfil: formData.get('exibir_nivel_previa_perfil') === 'on',
    xp_singular: (formData.get('xp_singular') as string)?.trim() || 'Ponto de Experiência',
    xp_plural: (formData.get('xp_plural') as string)?.trim() || 'Pontos de Experiência',
    xp_abreviacao: (formData.get('xp_abreviacao') as string)?.trim() || 'XP',
    moeda_singular: (formData.get('moeda_singular') as string)?.trim() || 'Moeda',
    moeda_plural: (formData.get('moeda_plural') as string)?.trim() || 'Moedas',
    moeda_abreviacao: (formData.get('moeda_abreviacao') as string)?.trim() || 'moedas',
    moeda_cor: (formData.get('moeda_cor') as string)?.trim() || null,
    moeda_icone: (formData.get('moeda_icone') as string)?.trim() || null,
    texto_como_acumular: (formData.get('texto_como_acumular') as string)?.trim() || null,
    avaliacao_xp_base: Number((formData.get('avaliacao_xp_base') as string) || 200),
    bonus_curso_concluido: Number((formData.get('bonus_curso_concluido') as string) || 100),
    teto_engajamento_diario: Number((formData.get('teto_engajamento_diario') as string) || 60),
    moeda_a_cada_xp: (() => {
      const raw = (formData.get('moeda_a_cada_xp') as string)?.trim()
      return raw ? Number(raw) : null
    })(),
    gatilhos_pendentes_agendamento: (formData.get('gatilhos_pendentes_agendamento') as string)
      ?.split(',').map(c => c.trim()).filter(Boolean) ?? [],
  }).eq('id', 1)

  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true }
}

// ---------- Gatilhos ----------

export async function atualizarGatilho(codigo: string, formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const limiteRaw = (formData.get('limite_diario') as string)?.trim()

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('gamificacao_gatilhos').update({
    pontos: Number((formData.get('pontos') as string) || 0),
    moedas: Number((formData.get('moedas') as string) || 0),
    limite_diario: limiteRaw ? Number(limiteRaw) : null,
    ativo: formData.get('ativo') === 'on',
    conta_teto_engajamento: formData.get('conta_teto_engajamento') === 'on',
    atualizado_em: new Date().toISOString(),
  }).eq('codigo', codigo)

  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true }
}

// ---------- Níveis ----------

function requisitoComposto(formData: FormData, campo: string): number | null {
  const raw = (formData.get(campo) as string)?.trim()
  return raw ? Number(raw) : null
}

function requisitosCompostos(formData: FormData) {
  return {
    aulas_concluidas: requisitoComposto(formData, 'aulas_concluidas'),
    cursos_completos: requisitoComposto(formData, 'cursos_completos'),
    avaliacoes_aprovadas: requisitoComposto(formData, 'avaliacoes_aprovadas'),
    desafios_completos: requisitoComposto(formData, 'desafios_completos'),
    streak_marco_dias: requisitoComposto(formData, 'streak_marco_dias'),
    participacoes_comunidade: requisitoComposto(formData, 'participacoes_comunidade'),
  }
}

export async function criarNivel(formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const nome = (formData.get('nome') as string)?.trim()
  const pontosMinimos = Number((formData.get('pontos_minimos') as string) || 0)
  if (!nome) return { ok: false, erro: 'Nome é obrigatório.' }

  const supabase = await criarClienteServidor()
  const { data: ultimo } = await supabase.from('gamificacao_niveis').select('ordem').order('ordem', { ascending: false }).limit(1).maybeSingle()
  const ordem = (ultimo?.ordem ?? 0) + 1

  const { error } = await supabase.from('gamificacao_niveis').insert({
    nome, pontos_minimos: pontosMinimos, ordem, ...requisitosCompostos(formData),
  })
  if (error) return { ok: false, erro: error.message.includes('duplicate') ? 'Já existe um nível com esse XP mínimo.' : error.message }
  revalidar()
  return { ok: true }
}

export async function atualizarNivel(id: string, formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const nome = (formData.get('nome') as string)?.trim()
  const pontosMinimos = Number((formData.get('pontos_minimos') as string) || 0)
  if (!nome) return { ok: false, erro: 'Nome é obrigatório.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('gamificacao_niveis').update({
    nome, pontos_minimos: pontosMinimos, ...requisitosCompostos(formData),
  }).eq('id', id)
  if (error) return { ok: false, erro: error.message.includes('duplicate') ? 'Já existe um nível com esse XP mínimo.' : error.message }
  revalidar()
  return { ok: true }
}

// ---------- Curva de níveis ----------

export async function recalcularCurvaNiveis(): Promise<Resultado & { teto?: number; componentes?: Record<string, number> }> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.rpc('gam_recalcular_curva_niveis')
  if (error) return { ok: false, erro: error.message }

  revalidar()
  return { ok: true, teto: data?.teto, componentes: data?.componentes }
}

export async function excluirNivel(id: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('gamificacao_niveis').delete().eq('id', id)
  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true }
}

export async function moverNivel(id: string, direcao: 'up' | 'down'): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const supabase = await criarClienteServidor()
  const { data: niveis } = await supabase.from('gamificacao_niveis').select('id, ordem').order('ordem', { ascending: true })
  if (!niveis) return { ok: false, erro: 'Níveis não encontrados.' }

  const idx = niveis.findIndex(n => n.id === id)
  const alvo = direcao === 'up' ? idx - 1 : idx + 1
  if (idx < 0 || alvo < 0 || alvo >= niveis.length) return { ok: true }

  const a = niveis[idx]
  const b = niveis[alvo]
  await Promise.all([
    supabase.from('gamificacao_niveis').update({ ordem: b.ordem }).eq('id', a.id),
    supabase.from('gamificacao_niveis').update({ ordem: a.ordem }).eq('id', b.id),
  ])

  revalidar()
  return { ok: true }
}

export async function uploadSeloNivel(id: string, formData: FormData): Promise<Resultado & { seloUrl?: string }> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const arquivo = formData.get('selo') as File | null
  if (!arquivo || arquivo.size === 0) return { ok: false, erro: 'Selecione uma imagem.' }
  const ext = arquivo.name.split('.').pop()?.toLowerCase() ?? 'png'
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return { ok: false, erro: 'Formato não aceito. Use JPG, PNG ou WebP.' }
  if (arquivo.size > 2 * 1024 * 1024) return { ok: false, erro: 'Imagem muito grande. Máximo 2 MB.' }

  const supabase = await criarClienteServidor()
  const path = `niveis/${id}/selo.${ext}`
  const buffer = Buffer.from(await arquivo.arrayBuffer())
  const { error: upErr } = await supabase.storage.from('capas').upload(path, buffer, { contentType: arquivo.type, upsert: true })
  if (upErr) return { ok: false, erro: upErr.message }

  const { data: urlData } = supabase.storage.from('capas').getPublicUrl(path)
  const seloUrl = urlData.publicUrl + '?t=' + Date.now()

  const { error } = await supabase.from('gamificacao_niveis').update({ selo_url: seloUrl }).eq('id', id)
  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true, seloUrl }
}

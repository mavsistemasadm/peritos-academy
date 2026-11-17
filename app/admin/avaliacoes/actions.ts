'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'
import { trocarOrdem } from '@/lib/admin/trocarOrdem'

type Resultado = { ok: true; id?: string } | { ok: false; erro: string }

async function checarPermissao() {
  const admin = await obterAdminAtual()
  if (!temPermissao(admin, 'avaliacoes')) return null
  return admin
}

async function revalidarAvaliacao(id: string | undefined, cursoId: string) {
  revalidatePath('/admin/avaliacoes')
  if (id) revalidatePath(`/admin/avaliacoes/${id}`)

  const supabase = await criarClienteServidor()
  const { data: curso } = await supabase.from('cursos').select('slug').eq('id', cursoId).maybeSingle()
  if (curso?.slug) {
    revalidatePath(`/curso/${curso.slug}`)
    if (id) revalidatePath(`/curso/${curso.slug}/avaliacao/${id}`)
  }
}

// ---------- Avaliação ----------

// posicao = quantas aulas do módulo vêm antes da avaliação. Campo vazio no form
// significa "fim do módulo" (null), que é o default de avaliação nova.
function lerPosicao(formData: FormData): number | null {
  const bruto = (formData.get('posicao') as string)?.trim()
  if (!bruto) return null
  const n = Number(bruto)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null
}

export async function criarAvaliacao(formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const cursoId = (formData.get('curso_id') as string)?.trim()
  const titulo = (formData.get('titulo') as string)?.trim()
  const tipo = (formData.get('tipo') as string)?.trim()
  if (!cursoId) return { ok: false, erro: 'Selecione um curso.' }
  if (!titulo || titulo.length < 3) return { ok: false, erro: 'Título precisa ter pelo menos 3 caracteres.' }
  if (!['avaliacao', 'prova'].includes(tipo)) return { ok: false, erro: 'Tipo inválido.' }

  const moduloId = (formData.get('modulo_id') as string)?.trim() || null

  const supabase = await criarClienteServidor()
  const { data, error } = await supabase
    .from('avaliacoes')
    .insert({
      curso_id: cursoId,
      modulo_id: tipo === 'prova' ? null : moduloId,
      titulo,
      tipo,
      briefing: (formData.get('briefing') as string)?.trim() || null,
      nota_minima: Number((formData.get('nota_minima') as string) || 7),
      peso: Number((formData.get('peso') as string) || 1),
      posicao: lerPosicao(formData),
      publicado: false,
    })
    .select('id')
    .single()

  if (error) return { ok: false, erro: error.message }

  await revalidarAvaliacao(data.id, cursoId)
  return { ok: true, id: data.id }
}

export async function atualizarAvaliacao(id: string, cursoId: string, formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const titulo = (formData.get('titulo') as string)?.trim()
  const tipo = (formData.get('tipo') as string)?.trim()
  if (!titulo || titulo.length < 3) return { ok: false, erro: 'Título precisa ter pelo menos 3 caracteres.' }
  if (!['avaliacao', 'prova'].includes(tipo)) return { ok: false, erro: 'Tipo inválido.' }

  const moduloId = (formData.get('modulo_id') as string)?.trim() || null

  // vídeo de instruções: embed (Panda, YouTube). Só https.
  const videoBruto = (formData.get('video_url') as string)?.trim() || ''
  let videoUrl: string | null = null
  if (videoBruto) {
    try {
      const u = new URL(videoBruto)
      if (u.protocol !== 'https:') return { ok: false, erro: 'O link do vídeo precisa começar com https://' }
      videoUrl = u.toString()
    } catch { return { ok: false, erro: 'Link do vídeo inválido. Cole o endereço completo do player.' } }
  }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('avaliacoes').update({
    titulo,
    tipo,
    modulo_id: tipo === 'prova' ? null : moduloId,
    briefing: (formData.get('briefing') as string)?.trim() || null,
    nota_minima: Number((formData.get('nota_minima') as string) || 7),
    // era `xp`, coluna que não existe desde que virou `peso` (multiplicador das
    // faixas de acerto) — o update falhava inteiro e nada era salvo aqui.
    peso: Number((formData.get('peso') as string) || 1),
    posicao: lerPosicao(formData),
    instrucoes: (formData.get('instrucoes') as string)?.trim() || null,
    video_url: videoUrl,
  }).eq('id', id)

  if (error) return { ok: false, erro: error.message }

  await revalidarAvaliacao(id, cursoId)
  return { ok: true }
}

export async function alternarPublicacaoAvaliacao(id: string, cursoId: string, publicado: boolean): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('avaliacoes').update({ publicado }).eq('id', id)
  if (error) return { ok: false, erro: error.message }

  await revalidarAvaliacao(id, cursoId)
  return { ok: true }
}

export async function excluirAvaliacao(id: string, cursoId: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('avaliacoes').delete().eq('id', id)
  if (error) return { ok: false, erro: error.message }

  await revalidarAvaliacao(undefined, cursoId)
  return { ok: true }
}

export async function uploadCapaAvaliacao(id: string, cursoId: string, formData: FormData): Promise<Resultado & { capaUrl?: string }> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const arquivo = formData.get('capa') as File | null
  if (!arquivo || arquivo.size === 0) return { ok: false, erro: 'Selecione uma imagem.' }
  const ext = arquivo.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return { ok: false, erro: 'Formato não aceito. Use JPG, PNG ou WebP.' }
  if (arquivo.size > 5 * 1024 * 1024) return { ok: false, erro: 'Imagem muito grande. Máximo 5 MB.' }

  const supabase = await criarClienteServidor()
  const path = `avaliacoes/${id}/capa.${ext}`
  const buffer = Buffer.from(await arquivo.arrayBuffer())

  const { error: upErr } = await supabase.storage.from('capas').upload(path, buffer, { contentType: arquivo.type, upsert: true })
  if (upErr) return { ok: false, erro: upErr.message }

  const { data: urlData } = supabase.storage.from('capas').getPublicUrl(path)
  const capaUrl = urlData.publicUrl + '?t=' + Date.now()

  const { error } = await supabase.from('avaliacoes').update({ capa_url: capaUrl }).eq('id', id)
  if (error) return { ok: false, erro: error.message }

  await revalidarAvaliacao(id, cursoId)
  return { ok: true, capaUrl }
}

// ---------- Questões ----------

export async function criarQuestao(avaliacaoId: string, cursoId: string, formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const tipo = (formData.get('tipo') as string)?.trim()
  const enunciado = (formData.get('enunciado') as string)?.trim()
  if (!['multipla_escolha', 'valor'].includes(tipo)) return { ok: false, erro: 'Tipo inválido.' }
  if (!enunciado) return { ok: false, erro: 'Enunciado é obrigatório.' }

  const respostaValorRaw = (formData.get('resposta_valor') as string)?.trim()
  if (tipo === 'valor' && !respostaValorRaw) return { ok: false, erro: 'Informe a resposta numérica (gabarito).' }

  const supabase = await criarClienteServidor()
  const { data: ultima } = await supabase
    .from('avaliacao_questoes').select('ordem').eq('avaliacao_id', avaliacaoId).order('ordem', { ascending: false }).limit(1).maybeSingle()
  const ordem = (ultima?.ordem ?? 0) + 1

  const { error } = await supabase.from('avaliacao_questoes').insert({
    avaliacao_id: avaliacaoId,
    tipo,
    enunciado,
    parecer: (formData.get('parecer') as string)?.trim() || null,
    resposta_valor: tipo === 'valor' ? Number(respostaValorRaw) : null,
    tolerancia: Number((formData.get('tolerancia') as string) || 0),
    prefixo: (formData.get('prefixo') as string)?.trim() || null,
    sufixo: (formData.get('sufixo') as string)?.trim() || null,
    ordem,
  })
  if (error) return { ok: false, erro: error.message }

  await revalidarAvaliacao(avaliacaoId, cursoId)
  return { ok: true }
}

export async function atualizarQuestao(id: string, avaliacaoId: string, cursoId: string, formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const tipo = (formData.get('tipo') as string)?.trim()
  const enunciado = (formData.get('enunciado') as string)?.trim()
  if (!['multipla_escolha', 'valor'].includes(tipo)) return { ok: false, erro: 'Tipo inválido.' }
  if (!enunciado) return { ok: false, erro: 'Enunciado é obrigatório.' }

  const respostaValorRaw = (formData.get('resposta_valor') as string)?.trim()
  if (tipo === 'valor' && !respostaValorRaw) return { ok: false, erro: 'Informe a resposta numérica (gabarito).' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('avaliacao_questoes').update({
    tipo,
    enunciado,
    parecer: (formData.get('parecer') as string)?.trim() || null,
    resposta_valor: tipo === 'valor' ? Number(respostaValorRaw) : null,
    tolerancia: Number((formData.get('tolerancia') as string) || 0),
    prefixo: (formData.get('prefixo') as string)?.trim() || null,
    sufixo: (formData.get('sufixo') as string)?.trim() || null,
  }).eq('id', id)
  if (error) return { ok: false, erro: error.message }

  await revalidarAvaliacao(avaliacaoId, cursoId)
  return { ok: true }
}

export async function excluirQuestao(id: string, avaliacaoId: string, cursoId: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('avaliacao_questoes').delete().eq('id', id)
  if (error) return { ok: false, erro: error.message }

  await revalidarAvaliacao(avaliacaoId, cursoId)
  return { ok: true }
}

export async function moverQuestao(avaliacaoId: string, cursoId: string, id: string, direcao: 'up' | 'down'): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const supabase = await criarClienteServidor()
  const { data: questoes } = await supabase.from('avaliacao_questoes').select('id, ordem').eq('avaliacao_id', avaliacaoId).order('ordem', { ascending: true })
  if (!questoes) return { ok: false, erro: 'Questões não encontradas.' }

  const idx = questoes.findIndex(q => q.id === id)
  const alvo = direcao === 'up' ? idx - 1 : idx + 1
  if (idx < 0 || alvo < 0 || alvo >= questoes.length) return { ok: true }

  const erro = await trocarOrdem(supabase, 'avaliacao_questoes', questoes[idx], questoes[alvo])
  if (erro) return { ok: false, erro }

  await revalidarAvaliacao(avaliacaoId, cursoId)
  return { ok: true }
}

// ---------- Opções (só para questões multipla_escolha) ----------

export async function criarOpcao(questaoId: string, avaliacaoId: string, cursoId: string, formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const texto = (formData.get('texto') as string)?.trim()
  if (!texto) return { ok: false, erro: 'Texto da opção é obrigatório.' }

  const supabase = await criarClienteServidor()
  const { data: ultima } = await supabase
    .from('avaliacao_opcoes').select('ordem').eq('questao_id', questaoId).order('ordem', { ascending: false }).limit(1).maybeSingle()
  const ordem = (ultima?.ordem ?? 0) + 1

  const { error } = await supabase.from('avaliacao_opcoes').insert({
    questao_id: questaoId, texto, ordem,
    correta: formData.get('correta') === 'on',
  })
  if (error) return { ok: false, erro: error.message }

  await revalidarAvaliacao(avaliacaoId, cursoId)
  return { ok: true }
}

export async function atualizarOpcao(id: string, avaliacaoId: string, cursoId: string, formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const texto = (formData.get('texto') as string)?.trim()
  if (!texto) return { ok: false, erro: 'Texto da opção é obrigatório.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('avaliacao_opcoes').update({ texto }).eq('id', id)
  if (error) return { ok: false, erro: error.message }

  await revalidarAvaliacao(avaliacaoId, cursoId)
  return { ok: true }
}

// Marca uma opção como a correta e desmarca as demais da mesma questão
// (as questões de múltipla escolha do admin são de resposta única).
export async function marcarOpcaoCorreta(opcaoId: string, questaoId: string, avaliacaoId: string, cursoId: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const supabase = await criarClienteServidor()
  const { error: e1 } = await supabase.from('avaliacao_opcoes').update({ correta: false }).eq('questao_id', questaoId)
  if (e1) return { ok: false, erro: e1.message }
  const { error: e2 } = await supabase.from('avaliacao_opcoes').update({ correta: true }).eq('id', opcaoId)
  if (e2) return { ok: false, erro: e2.message }

  await revalidarAvaliacao(avaliacaoId, cursoId)
  return { ok: true }
}

export async function excluirOpcao(id: string, avaliacaoId: string, cursoId: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('avaliacao_opcoes').delete().eq('id', id)
  if (error) return { ok: false, erro: error.message }

  await revalidarAvaliacao(avaliacaoId, cursoId)
  return { ok: true }
}


// ---------- Arquivos da avaliação ("autos do caso") ----------
// O arquivo NUNCA atravessa a server action (a Vercel recusa corpo acima de
// 4,5 MB e a página cai em "Application error"): a action gera a URL assinada,
// o navegador sobe direto (lib/storage/enviarDireto.ts) e a confirmação grava
// a linha, aceitando só o path que a primeira etapa gerou.

const BUCKET_MATERIAIS = 'materiais-aulas'
const LIMITE_MATERIAL = 60 * 1024 * 1024 // file_size_limit do bucket
const EXT_TIPO: Record<string, string> = { pdf: 'pdf', xlsx: 'xlsx', xls: 'xlsx', xlsm: 'xlsx', docx: 'docx', doc: 'docx', zip: 'zip' }

function nomeSeguro(nome: string) {
  return nome.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/_+/g, '_').slice(-120)
}

export async function criarUploadMaterialAvaliacao(avaliacaoId: string, nome: string, tamanho: number):
  Promise<{ ok: true; path: string; token: string } | { ok: false; erro: string }> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  if (!nome) return { ok: false, erro: 'Arquivo sem nome.' }
  if (tamanho > LIMITE_MATERIAL) return { ok: false, erro: `"${nome}" passa de 60 MB. Divida em partes ou use um link.` }

  const path = `avaliacoes/${avaliacaoId}/${crypto.randomUUID()}-${nomeSeguro(nome)}`
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.storage.from(BUCKET_MATERIAIS).createSignedUploadUrl(path)
  if (error || !data) return { ok: false, erro: error?.message ?? 'Não foi possível preparar o envio.' }
  return { ok: true, path: data.path, token: data.token }
}

export async function confirmarMaterialAvaliacao(avaliacaoId: string, cursoId: string, path: string, nome: string, tamanho: number): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  if (!path.startsWith(`avaliacoes/${avaliacaoId}/`)) return { ok: false, erro: 'Envio inválido.' }

  const supabase = await criarClienteServidor()
  const pasta = path.slice(0, path.lastIndexOf('/'))
  const arquivo = path.slice(path.lastIndexOf('/') + 1)
  const { data: lista } = await supabase.storage.from(BUCKET_MATERIAIS).list(pasta, { search: arquivo })
  if (!lista?.some(o => o.name === arquivo)) return { ok: false, erro: 'O arquivo não chegou ao servidor. Tente de novo.' }

  const { data: ultimo } = await supabase
    .from('avaliacao_materiais').select('ordem').eq('avaliacao_id', avaliacaoId).order('ordem', { ascending: false }).limit(1).maybeSingle()
  const ext = nome.split('.').pop()?.toLowerCase() ?? ''
  const { error } = await supabase.from('avaliacao_materiais').insert({
    avaliacao_id: avaliacaoId, nome, tipo: EXT_TIPO[ext] ?? 'outro', arquivo_url: path, tamanho_bytes: tamanho, ordem: (ultimo?.ordem ?? 0) + 1,
  })
  if (error) return { ok: false, erro: error.message }

  await revalidarAvaliacao(avaliacaoId, cursoId)
  return { ok: true }
}

export async function adicionarLinkMaterialAvaliacao(avaliacaoId: string, cursoId: string, nome: string, url: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const titulo = nome.trim()
  if (!titulo) return { ok: false, erro: 'Dê um nome ao link.' }
  let endereco: URL
  try { endereco = new URL(url.trim()) } catch { return { ok: false, erro: 'Endereço inválido. Cole o link completo, começando com https://' } }
  if (endereco.protocol !== 'https:') return { ok: false, erro: 'O link precisa começar com https://' }

  const supabase = await criarClienteServidor()
  const { data: ultimo } = await supabase
    .from('avaliacao_materiais').select('ordem').eq('avaliacao_id', avaliacaoId).order('ordem', { ascending: false }).limit(1).maybeSingle()
  const { error } = await supabase.from('avaliacao_materiais').insert({
    avaliacao_id: avaliacaoId, nome: titulo, tipo: 'link', link_url: endereco.toString(), ordem: (ultimo?.ordem ?? 0) + 1,
  })
  if (error) return { ok: false, erro: error.message }

  await revalidarAvaliacao(avaliacaoId, cursoId)
  return { ok: true }
}

export async function excluirMaterialAvaliacao(id: string, avaliacaoId: string, cursoId: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const supabase = await criarClienteServidor()
  const { data: mat } = await supabase.from('avaliacao_materiais').select('arquivo_url').eq('id', id).maybeSingle()
  const { error } = await supabase.from('avaliacao_materiais').delete().eq('id', id)
  if (error) return { ok: false, erro: error.message }
  if (mat?.arquivo_url) await supabase.storage.from(BUCKET_MATERIAIS).remove([mat.arquivo_url])

  await revalidarAvaliacao(avaliacaoId, cursoId)
  return { ok: true }
}

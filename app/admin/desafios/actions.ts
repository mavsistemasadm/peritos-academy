'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'
import { gerarSlug } from '@/lib/slug'
import type { Documento, Quesito } from '@/lib/queries/admin-desafios'

type Resultado = { ok: true; id?: string } | { ok: false; erro: string }

async function checarPermissao() {
  const admin = await obterAdminAtual()
  if (!temPermissao(admin, 'desafios')) return null
  return admin
}

function revalidarDesafios(id?: string) {
  revalidatePath('/admin/desafios')
  if (id) revalidatePath(`/admin/desafios/${id}`)
  revalidatePath('/desafios')
}

// ---------- Categorias ----------

export async function criarCategoria(formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const nome = (formData.get('nome') as string)?.trim()
  if (!nome) return { ok: false, erro: 'Nome é obrigatório.' }

  const supabase = await criarClienteServidor()
  const { data: ultima } = await supabase.from('desafio_categorias').select('ordem').order('ordem', { ascending: false }).limit(1).maybeSingle()
  const ordem = (ultima?.ordem ?? 0) + 1

  const { error } = await supabase.from('desafio_categorias').insert({ nome, slug: gerarSlug(nome), ordem })
  if (error) return { ok: false, erro: error.message }
  revalidarDesafios()
  return { ok: true }
}

export async function atualizarCategoria(id: string, formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const nome = (formData.get('nome') as string)?.trim()
  if (!nome) return { ok: false, erro: 'Nome é obrigatório.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('desafio_categorias').update({ nome }).eq('id', id)
  if (error) return { ok: false, erro: error.message }
  revalidarDesafios()
  return { ok: true }
}

export async function excluirCategoria(id: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('desafio_categorias').delete().eq('id', id)
  if (error) return { ok: false, erro: error.message }
  revalidarDesafios()
  return { ok: true }
}

// ---------- Desafio ----------

export async function criarDesafio(formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const titulo = (formData.get('titulo') as string)?.trim()
  if (!titulo || titulo.length < 3) return { ok: false, erro: 'Título precisa ter pelo menos 3 caracteres.' }

  const categoriaId = (formData.get('categoria_id') as string)?.trim() || null

  const supabase = await criarClienteServidor()
  const { data, error } = await supabase
    .from('desafios')
    .insert({ titulo, slug: gerarSlug(titulo), categoria_id: categoriaId, publicado: false })
    .select('id')
    .single()

  if (error) return { ok: false, erro: error.message }
  revalidarDesafios(data.id)
  return { ok: true, id: data.id }
}

export async function atualizarDesafio(id: string, formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const titulo = (formData.get('titulo') as string)?.trim()
  if (!titulo || titulo.length < 3) return { ok: false, erro: 'Título precisa ter pelo menos 3 caracteres.' }

  const instrucoesRaw = (formData.get('instrucoes') as string) ?? ''
  const instrucoes = instrucoesRaw.split('\n').map(l => l.trim()).filter(Boolean)

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('desafios').update({
    titulo,
    categoria_id: (formData.get('categoria_id') as string)?.trim() || null,
    intimacao_texto: (formData.get('intimacao_texto') as string)?.trim() || null,
    mensageiro_nome: (formData.get('mensageiro_nome') as string)?.trim() || null,
    mensageiro_cargo: (formData.get('mensageiro_cargo') as string)?.trim() || null,
    mensagem_texto: (formData.get('mensagem_texto') as string)?.trim() || null,
    instrucoes,
    prazo_dias: Number((formData.get('prazo_dias') as string) || 3),
    xp: Number((formData.get('xp') as string) || 500),
    moedas: Number((formData.get('moedas') as string) || 200),
    plano: (formData.get('plano') as string)?.trim() || 'free',
    nota_minima: Number((formData.get('nota_minima') as string) || 6),
  }).eq('id', id)

  if (error) return { ok: false, erro: error.message }
  revalidarDesafios(id)
  return { ok: true }
}

export async function alternarPublicacaoDesafio(id: string, publicado: boolean): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('desafios').update({ publicado }).eq('id', id)
  if (error) return { ok: false, erro: error.message }
  revalidarDesafios(id)
  return { ok: true }
}

export async function excluirDesafio(id: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('desafios').delete().eq('id', id)
  if (error) return { ok: false, erro: error.message }
  revalidarDesafios()
  return { ok: true }
}

export async function uploadCapaDesafio(id: string, formData: FormData): Promise<Resultado & { capaUrl?: string }> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const arquivo = formData.get('capa') as File | null
  if (!arquivo || arquivo.size === 0) return { ok: false, erro: 'Selecione uma imagem.' }
  const ext = arquivo.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return { ok: false, erro: 'Formato não aceito. Use JPG, PNG ou WebP.' }
  if (arquivo.size > 5 * 1024 * 1024) return { ok: false, erro: 'Imagem muito grande. Máximo 5 MB.' }

  const supabase = await criarClienteServidor()
  const path = `desafios/${id}/capa.${ext}`
  const buffer = Buffer.from(await arquivo.arrayBuffer())
  const { error: upErr } = await supabase.storage.from('capas').upload(path, buffer, { contentType: arquivo.type, upsert: true })
  if (upErr) return { ok: false, erro: upErr.message }

  const { data: urlData } = supabase.storage.from('capas').getPublicUrl(path)
  const capaUrl = urlData.publicUrl + '?t=' + Date.now()

  const { error } = await supabase.from('desafios').update({ capa_url: capaUrl }).eq('id', id)
  if (error) return { ok: false, erro: error.message }
  revalidarDesafios(id)
  return { ok: true, capaUrl }
}

// ---------- Quesitos (array jsonb dentro de desafios.quesitos) ----------

async function salvarQuesitos(supabase: Awaited<ReturnType<typeof criarClienteServidor>>, desafioId: string, quesitos: Quesito[]) {
  const renumerados = quesitos.map((q, i) => ({ ...q, ordem: i + 1 }))
  return supabase.from('desafios').update({ quesitos: renumerados }).eq('id', desafioId)
}

export async function adicionarQuesito(desafioId: string, formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const enunciado = (formData.get('enunciado') as string)?.trim()
  const tipo = (formData.get('tipo') as string) as Quesito['tipo']
  if (!enunciado) return { ok: false, erro: 'Enunciado é obrigatório.' }
  if (!['valor', 'texto', 'multipla'].includes(tipo)) return { ok: false, erro: 'Tipo inválido.' }

  const opcoesRaw = (formData.get('opcoes') as string) ?? ''
  const opcoes = tipo === 'multipla' ? opcoesRaw.split('\n').map(l => l.trim()).filter(Boolean) : null

  const supabase = await criarClienteServidor()
  const { data: d } = await supabase.from('desafios').select('quesitos').eq('id', desafioId).single()
  if (!d) return { ok: false, erro: 'Desafio não encontrado.' }

  const quesitos: Quesito[] = Array.isArray(d.quesitos) ? d.quesitos : []
  quesitos.push({
    ordem: quesitos.length + 1, enunciado, tipo,
    prefixo: (formData.get('prefixo') as string)?.trim() || null,
    sufixo: (formData.get('sufixo') as string)?.trim() || null,
    tolerancia: tipo === 'valor' ? Number((formData.get('tolerancia') as string) || 0) : null,
    resposta_modelo: (formData.get('resposta_modelo') as string)?.trim() || null,
    opcoes,
  })

  const { error } = await salvarQuesitos(supabase, desafioId, quesitos)
  if (error) return { ok: false, erro: error.message }
  revalidarDesafios(desafioId)
  return { ok: true }
}

export async function atualizarQuesito(desafioId: string, indice: number, formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const enunciado = (formData.get('enunciado') as string)?.trim()
  const tipo = (formData.get('tipo') as string) as Quesito['tipo']
  if (!enunciado) return { ok: false, erro: 'Enunciado é obrigatório.' }
  if (!['valor', 'texto', 'multipla'].includes(tipo)) return { ok: false, erro: 'Tipo inválido.' }

  const opcoesRaw = (formData.get('opcoes') as string) ?? ''
  const opcoes = tipo === 'multipla' ? opcoesRaw.split('\n').map(l => l.trim()).filter(Boolean) : null

  const supabase = await criarClienteServidor()
  const { data: d } = await supabase.from('desafios').select('quesitos').eq('id', desafioId).single()
  if (!d) return { ok: false, erro: 'Desafio não encontrado.' }

  const quesitos: Quesito[] = Array.isArray(d.quesitos) ? d.quesitos : []
  if (indice < 0 || indice >= quesitos.length) return { ok: false, erro: 'Questão não encontrada.' }

  quesitos[indice] = {
    ordem: indice + 1, enunciado, tipo,
    prefixo: (formData.get('prefixo') as string)?.trim() || null,
    sufixo: (formData.get('sufixo') as string)?.trim() || null,
    tolerancia: tipo === 'valor' ? Number((formData.get('tolerancia') as string) || 0) : null,
    resposta_modelo: (formData.get('resposta_modelo') as string)?.trim() || null,
    opcoes,
  }

  const { error } = await salvarQuesitos(supabase, desafioId, quesitos)
  if (error) return { ok: false, erro: error.message }
  revalidarDesafios(desafioId)
  return { ok: true }
}

export async function excluirQuesito(desafioId: string, indice: number): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const supabase = await criarClienteServidor()
  const { data: d } = await supabase.from('desafios').select('quesitos').eq('id', desafioId).single()
  if (!d) return { ok: false, erro: 'Desafio não encontrado.' }

  const quesitos: Quesito[] = Array.isArray(d.quesitos) ? d.quesitos : []
  quesitos.splice(indice, 1)

  const { error } = await salvarQuesitos(supabase, desafioId, quesitos)
  if (error) return { ok: false, erro: error.message }
  revalidarDesafios(desafioId)
  return { ok: true }
}

export async function moverQuesito(desafioId: string, indice: number, direcao: 'up' | 'down'): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const supabase = await criarClienteServidor()
  const { data: d } = await supabase.from('desafios').select('quesitos').eq('id', desafioId).single()
  if (!d) return { ok: false, erro: 'Desafio não encontrado.' }

  const quesitos: Quesito[] = Array.isArray(d.quesitos) ? d.quesitos : []
  const alvo = direcao === 'up' ? indice - 1 : indice + 1
  if (alvo < 0 || alvo >= quesitos.length) return { ok: true }
  ;[quesitos[indice], quesitos[alvo]] = [quesitos[alvo], quesitos[indice]]

  const { error } = await salvarQuesitos(supabase, desafioId, quesitos)
  if (error) return { ok: false, erro: error.message }
  revalidarDesafios(desafioId)
  return { ok: true }
}

// ---------- Documentos do processo (upload em 'planilhas') ----------

export async function uploadDocumento(desafioId: string, formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const arquivo = formData.get('arquivo') as File | null
  const nome = (formData.get('nome') as string)?.trim()
  if (!arquivo || arquivo.size === 0) return { ok: false, erro: 'Selecione um arquivo.' }
  if (!nome) return { ok: false, erro: 'Nome do documento é obrigatório.' }
  if (arquivo.size > 10 * 1024 * 1024) return { ok: false, erro: 'Arquivo muito grande. Máximo 10 MB.' }

  const supabase = await criarClienteServidor()
  const { data: d } = await supabase.from('desafios').select('numero, documentos').eq('id', desafioId).single()
  if (!d) return { ok: false, erro: 'Desafio não encontrado.' }

  const ext = arquivo.name.split('.').pop()?.toLowerCase() ?? 'pdf'
  const path = `desafios/${d.numero ?? desafioId}/documentos/documento-${Date.now()}.${ext}`
  const buffer = Buffer.from(await arquivo.arrayBuffer())
  const { error: upErr } = await supabase.storage.from('planilhas').upload(path, buffer, { contentType: arquivo.type, upsert: true })
  if (upErr) return { ok: false, erro: upErr.message }

  const documentos: Documento[] = Array.isArray(d.documentos) ? d.documentos : []
  documentos.push({ nome, path, formato: ext, tamanho_kb: Math.round(arquivo.size / 1024) })

  const { error } = await supabase.from('desafios').update({ documentos }).eq('id', desafioId)
  if (error) return { ok: false, erro: error.message }
  revalidarDesafios(desafioId)
  return { ok: true }
}

export async function excluirDocumento(desafioId: string, indice: number): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const supabase = await criarClienteServidor()
  const { data: d } = await supabase.from('desafios').select('documentos').eq('id', desafioId).single()
  if (!d) return { ok: false, erro: 'Desafio não encontrado.' }

  const documentos: Documento[] = Array.isArray(d.documentos) ? d.documentos : []
  const [removido] = documentos.splice(indice, 1)
  if (removido?.path) await supabase.storage.from('planilhas').remove([removido.path])

  const { error } = await supabase.from('desafios').update({ documentos }).eq('id', desafioId)
  if (error) return { ok: false, erro: error.message }
  revalidarDesafios(desafioId)
  return { ok: true }
}

// ---------- Gabarito (upload em 'planilhas') ----------

export async function uploadGabarito(desafioId: string, formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  const arquivo = formData.get('arquivo') as File | null
  if (!arquivo || arquivo.size === 0) return { ok: false, erro: 'Selecione um arquivo.' }
  if (arquivo.size > 10 * 1024 * 1024) return { ok: false, erro: 'Arquivo muito grande. Máximo 10 MB.' }

  const supabase = await criarClienteServidor()
  const { data: d } = await supabase.from('desafios').select('numero').eq('id', desafioId).single()
  if (!d) return { ok: false, erro: 'Desafio não encontrado.' }

  const ext = arquivo.name.split('.').pop()?.toLowerCase() ?? 'pdf'
  const path = `desafios/${d.numero ?? desafioId}/gabarito.${ext}`
  const buffer = Buffer.from(await arquivo.arrayBuffer())
  const { error: upErr } = await supabase.storage.from('planilhas').upload(path, buffer, { contentType: arquivo.type, upsert: true })
  if (upErr) return { ok: false, erro: upErr.message }

  const { error } = await supabase.from('desafios').update({ gabarito_path: path }).eq('id', desafioId)
  if (error) return { ok: false, erro: error.message }
  revalidarDesafios(desafioId)
  return { ok: true }
}

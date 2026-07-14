'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'
import { gerarSlug } from '@/lib/slug'

type Resultado = { ok: true; id?: string } | { ok: false; erro: string }

async function checarPermissao() {
  const admin = await obterAdminAtual()
  if (!temPermissao(admin, 'cursos')) return null
  return admin
}

function revalidarCurso(id: string, slug?: string | null) {
  revalidatePath('/admin/cursos')
  revalidatePath(`/admin/cursos/${id}`)
  revalidatePath('/biblioteca')
  revalidatePath('/cursos')
  if (slug) revalidatePath(`/curso/${slug}`)
}

// ---------- Curso ----------

export async function criarCurso(formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const titulo = (formData.get('titulo') as string)?.trim()
  if (!titulo || titulo.length < 3) return { ok: false, erro: 'Título precisa ter pelo menos 3 caracteres.' }

  const supabase = await criarClienteServidor()
  const slug = gerarSlug(titulo)

  const { data, error } = await supabase
    .from('cursos')
    .insert({
      titulo,
      slug,
      subtitulo: (formData.get('subtitulo') as string)?.trim() || null,
      nivel: (formData.get('nivel') as string)?.trim() || null,
      publicado: false,
    })
    .select('id')
    .single()

  if (error) return { ok: false, erro: error.message }

  revalidarCurso(data.id, slug)
  return { ok: true, id: data.id }
}

export async function atualizarCurso(id: string, formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const titulo = (formData.get('titulo') as string)?.trim()
  if (!titulo || titulo.length < 3) return { ok: false, erro: 'Título precisa ter pelo menos 3 caracteres.' }

  const objetivosRaw = (formData.get('objetivos') as string) ?? ''
  const objetivos = objetivosRaw.split('\n').map(l => l.trim()).filter(Boolean)

  const cargaHorasRaw = (formData.get('carga_horas') as string)?.trim()
  const cargaHoras = cargaHorasRaw ? Number(cargaHorasRaw) : null

  const supabase = await criarClienteServidor()
  const { data, error } = await supabase
    .from('cursos')
    .update({
      titulo,
      subtitulo: (formData.get('subtitulo') as string)?.trim() || null,
      nivel: (formData.get('nivel') as string)?.trim() || null,
      instrutor_nome: (formData.get('instrutor_nome') as string)?.trim() || null,
      instrutor_titulo: (formData.get('instrutor_titulo') as string)?.trim() || null,
      instrutor_iniciais: (formData.get('instrutor_iniciais') as string)?.trim() || null,
      citacao: (formData.get('citacao') as string)?.trim() || null,
      objetivos,
      emite_certificado: formData.get('emite_certificado') === 'on',
      contexto_certificado: (formData.get('contexto_certificado') as string)?.trim() || null,
      carga_horas: cargaHoras,
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, slug')
    .single()

  if (error) return { ok: false, erro: error.message }

  revalidarCurso(id, data.slug)
  return { ok: true }
}

export async function alternarPublicacaoCurso(id: string, publicado: boolean): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const supabase = await criarClienteServidor()
  const { data, error } = await supabase
    .from('cursos')
    .update({ publicado, atualizado_em: new Date().toISOString() })
    .eq('id', id)
    .select('slug')
    .single()

  if (error) return { ok: false, erro: error.message }

  revalidarCurso(id, data.slug)
  return { ok: true }
}

export async function excluirCurso(id: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('cursos').delete().eq('id', id)
  if (error) return { ok: false, erro: error.message }

  revalidarCurso(id)
  return { ok: true }
}

// Upload de capa em duas etapas (signed upload URL) — os bytes do arquivo vão
// direto do navegador pro Storage do Supabase, sem passar pela function
// serverless da Vercel. Necessário porque a Vercel tem um teto FIXO de 4.5MB
// pro corpo de qualquer requisição de function (independente do
// bodySizeLimit do Next.js, que só controla o limite interno do Next — acima
// de ~4.5MB a própria Vercel rejeita com 413 FUNCTION_PAYLOAD_TOO_LARGE antes
// do Next processar, e essa resposta não vem no formato que o client de
// Server Actions espera, o que quebra a página inteira com um erro genérico
// em vez de mostrar um toast de erro normal.
export async function criarUploadCapaCurso(id: string, nomeArquivo: string): Promise<Resultado & { path?: string; token?: string }> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const ext = nomeArquivo.split('.').pop()?.toLowerCase() ?? 'jpg'
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return { ok: false, erro: 'Formato não aceito. Use JPG, PNG ou WebP.' }

  const supabase = await criarClienteServidor()
  const path = `cursos/${id}/capa.${ext}`
  const { data, error } = await supabase.storage.from('capas').createSignedUploadUrl(path, { upsert: true })
  if (error) return { ok: false, erro: error.message }

  return { ok: true, path: data.path, token: data.token }
}

export async function confirmarCapaCurso(id: string, path: string): Promise<Resultado & { capaUrl?: string }> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const supabase = await criarClienteServidor()
  const { data: urlData } = supabase.storage.from('capas').getPublicUrl(path)
  const capaUrl = urlData.publicUrl + '?t=' + Date.now()

  const { data, error } = await supabase.from('cursos').update({ capa_url: capaUrl }).eq('id', id).select('slug').single()
  if (error) return { ok: false, erro: error.message }

  revalidarCurso(id, data.slug)
  return { ok: true, capaUrl }
}

// ---------- Módulo ----------

export async function criarModulo(cursoId: string, formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const titulo = (formData.get('titulo') as string)?.trim()
  if (!titulo) return { ok: false, erro: 'Título do módulo é obrigatório.' }

  const supabase = await criarClienteServidor()
  const { data: ultimo } = await supabase
    .from('modulos').select('ordem').eq('curso_id', cursoId).order('ordem', { ascending: false }).limit(1).maybeSingle()
  const ordem = (ultimo?.ordem ?? 0) + 1

  const { error } = await supabase.from('modulos').insert({ curso_id: cursoId, titulo, ordem })
  if (error) return { ok: false, erro: error.message }

  revalidarCurso(cursoId)
  return { ok: true }
}

export async function atualizarModulo(id: string, cursoId: string, formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const titulo = (formData.get('titulo') as string)?.trim()
  if (!titulo) return { ok: false, erro: 'Título do módulo é obrigatório.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('modulos').update({ titulo }).eq('id', id)
  if (error) return { ok: false, erro: error.message }

  revalidarCurso(cursoId)
  return { ok: true }
}

export async function excluirModulo(id: string, cursoId: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('modulos').delete().eq('id', id)
  if (error) return { ok: false, erro: error.message }

  revalidarCurso(cursoId)
  return { ok: true }
}

export async function moverModulo(cursoId: string, id: string, direcao: 'up' | 'down'): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const supabase = await criarClienteServidor()
  const { data: modulos } = await supabase.from('modulos').select('id, ordem').eq('curso_id', cursoId).order('ordem', { ascending: true })
  if (!modulos) return { ok: false, erro: 'Módulos não encontrados.' }

  const idx = modulos.findIndex(m => m.id === id)
  const alvo = direcao === 'up' ? idx - 1 : idx + 1
  if (idx < 0 || alvo < 0 || alvo >= modulos.length) return { ok: true }

  const a = modulos[idx]
  const b = modulos[alvo]
  await Promise.all([
    supabase.from('modulos').update({ ordem: b.ordem }).eq('id', a.id),
    supabase.from('modulos').update({ ordem: a.ordem }).eq('id', b.id),
  ])

  revalidarCurso(cursoId)
  return { ok: true }
}

// ---------- Aula ----------

export async function criarAula(moduloId: string, cursoId: string, formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const titulo = (formData.get('titulo') as string)?.trim()
  if (!titulo) return { ok: false, erro: 'Título da aula é obrigatório.' }

  const sobreRaw = (formData.get('sobre') as string) ?? ''
  const sobre = sobreRaw.split('\n').map(l => l.trim()).filter(Boolean)

  const supabase = await criarClienteServidor()
  const { data: ultima } = await supabase
    .from('aulas').select('ordem').eq('modulo_id', moduloId).order('ordem', { ascending: false }).limit(1).maybeSingle()
  const ordem = (ultima?.ordem ?? 0) + 1

  const { error } = await supabase.from('aulas').insert({
    modulo_id: moduloId,
    titulo,
    descricao: (formData.get('descricao') as string)?.trim() || null,
    video_url: (formData.get('video_url') as string)?.trim() || null,
    duracao_seg: Number((formData.get('duracao_seg') as string) || 0),
    xp: Number((formData.get('xp') as string) || 40),
    tipo: (formData.get('tipo') as string)?.trim() || 'aula',
    sobre,
    ordem,
  })
  if (error) return { ok: false, erro: error.message }

  revalidarCurso(cursoId)
  return { ok: true }
}

export async function atualizarAula(id: string, cursoId: string, formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const titulo = (formData.get('titulo') as string)?.trim()
  if (!titulo) return { ok: false, erro: 'Título da aula é obrigatório.' }

  const sobreRaw = (formData.get('sobre') as string) ?? ''
  const sobre = sobreRaw.split('\n').map(l => l.trim()).filter(Boolean)

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('aulas').update({
    titulo,
    descricao: (formData.get('descricao') as string)?.trim() || null,
    video_url: (formData.get('video_url') as string)?.trim() || null,
    duracao_seg: Number((formData.get('duracao_seg') as string) || 0),
    xp: Number((formData.get('xp') as string) || 40),
    tipo: (formData.get('tipo') as string)?.trim() || 'aula',
    sobre,
  }).eq('id', id)
  if (error) return { ok: false, erro: error.message }

  revalidarCurso(cursoId)
  return { ok: true }
}

export async function excluirAula(id: string, cursoId: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('aulas').delete().eq('id', id)
  if (error) return { ok: false, erro: error.message }

  revalidarCurso(cursoId)
  return { ok: true }
}

export async function moverAula(moduloId: string, cursoId: string, id: string, direcao: 'up' | 'down'): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const supabase = await criarClienteServidor()
  const { data: aulas } = await supabase.from('aulas').select('id, ordem').eq('modulo_id', moduloId).order('ordem', { ascending: true })
  if (!aulas) return { ok: false, erro: 'Aulas não encontradas.' }

  const idx = aulas.findIndex(a => a.id === id)
  const alvo = direcao === 'up' ? idx - 1 : idx + 1
  if (idx < 0 || alvo < 0 || alvo >= aulas.length) return { ok: true }

  const a = aulas[idx]
  const b = aulas[alvo]
  await Promise.all([
    supabase.from('aulas').update({ ordem: b.ordem }).eq('id', a.id),
    supabase.from('aulas').update({ ordem: a.ordem }).eq('id', b.id),
  ])

  revalidarCurso(cursoId)
  return { ok: true }
}

// Mesmo padrão de signed upload URL de criarUploadCapaCurso/confirmarCapaCurso
// — ver comentário lá em cima pra explicação completa do porquê.
export async function criarUploadCapaAula(id: string, nomeArquivo: string): Promise<Resultado & { path?: string; token?: string }> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const ext = nomeArquivo.split('.').pop()?.toLowerCase() ?? 'jpg'
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return { ok: false, erro: 'Formato não aceito. Use JPG, PNG ou WebP.' }

  const supabase = await criarClienteServidor()
  const path = `aulas/${id}/capa.${ext}`
  const { data, error } = await supabase.storage.from('capas').createSignedUploadUrl(path, { upsert: true })
  if (error) return { ok: false, erro: error.message }

  return { ok: true, path: data.path, token: data.token }
}

export async function confirmarCapaAula(id: string, cursoId: string, path: string): Promise<Resultado & { capaUrl?: string }> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const supabase = await criarClienteServidor()
  const { data: urlData } = supabase.storage.from('capas').getPublicUrl(path)
  const capaUrl = urlData.publicUrl + '?t=' + Date.now()

  const { error } = await supabase.from('aulas').update({ capa_url: capaUrl }).eq('id', id)
  if (error) return { ok: false, erro: error.message }

  revalidarCurso(cursoId)
  return { ok: true, capaUrl }
}

// ---------- Capítulos ----------

export async function criarCapitulo(aulaId: string, cursoId: string, formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const titulo = (formData.get('titulo') as string)?.trim()
  const tempoSeg = Number((formData.get('tempo_seg') as string) || 0)
  if (!titulo) return { ok: false, erro: 'Título do capítulo é obrigatório.' }

  const supabase = await criarClienteServidor()
  const { data: ultimo } = await supabase
    .from('aula_capitulos').select('ordem').eq('aula_id', aulaId).order('ordem', { ascending: false }).limit(1).maybeSingle()
  const ordem = (ultimo?.ordem ?? 0) + 1

  const { error } = await supabase.from('aula_capitulos').insert({ aula_id: aulaId, titulo, tempo_seg: tempoSeg, ordem })
  if (error) return { ok: false, erro: error.message }

  revalidarCurso(cursoId)
  return { ok: true }
}

export async function excluirCapitulo(id: string, cursoId: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('aula_capitulos').delete().eq('id', id)
  if (error) return { ok: false, erro: error.message }

  revalidarCurso(cursoId)
  return { ok: true }
}

// ---------- Materiais ----------

const EXT_PARA_TIPO: Record<string, 'pdf' | 'xlsx' | 'docx' | 'zip'> = {
  pdf: 'pdf', xlsx: 'xlsx', xls: 'xlsx', docx: 'docx', doc: 'docx', zip: 'zip',
}

// Upload real (múltiplos arquivos) pro bucket privado 'materiais-aulas' —
// substitui o antigo fluxo de colar um link à mão. path = aula_id/uuid-nome,
// pra nunca colidir entre aulas nem entre arquivos com o mesmo nome.
export async function uploadMateriais(aulaId: string, cursoId: string, formData: FormData): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const arquivos = (formData.getAll('arquivos') as File[]).filter(a => a && a.size > 0)
  if (arquivos.length === 0) return { ok: false, erro: 'Selecione ao menos um arquivo.' }

  const supabase = await criarClienteServidor()
  const { data: ultimo } = await supabase
    .from('aula_materiais').select('ordem').eq('aula_id', aulaId).order('ordem', { ascending: false }).limit(1).maybeSingle()
  let ordem = ultimo?.ordem ?? 0

  for (const arquivo of arquivos) {
    if (arquivo.size > 20 * 1024 * 1024) return { ok: false, erro: `"${arquivo.name}" é muito grande. Máximo 20MB.` }

    const ext = arquivo.name.split('.').pop()?.toLowerCase() ?? ''
    const tipo = EXT_PARA_TIPO[ext] ?? 'outro'
    const path = `${aulaId}/${crypto.randomUUID()}-${arquivo.name}`
    const buffer = Buffer.from(await arquivo.arrayBuffer())

    const { error: upErr } = await supabase.storage
      .from('materiais-aulas')
      .upload(path, buffer, { contentType: arquivo.type || undefined })
    if (upErr) return { ok: false, erro: upErr.message }

    ordem += 1
    const { error } = await supabase.from('aula_materiais').insert({
      aula_id: aulaId, nome: arquivo.name, tipo, arquivo_url: path, tamanho_bytes: arquivo.size, ordem,
    })
    if (error) return { ok: false, erro: error.message }
  }

  revalidarCurso(cursoId)
  return { ok: true }
}

export async function renomearMaterial(id: string, cursoId: string, nome: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }
  if (!nome.trim()) return { ok: false, erro: 'Nome é obrigatório.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('aula_materiais').update({ nome: nome.trim() }).eq('id', id)
  if (error) return { ok: false, erro: error.message }

  revalidarCurso(cursoId)
  return { ok: true }
}

export async function moverMaterial(aulaId: string, cursoId: string, id: string, direcao: 'up' | 'down'): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const supabase = await criarClienteServidor()
  const { data: materiais } = await supabase.from('aula_materiais').select('id, ordem').eq('aula_id', aulaId).order('ordem', { ascending: true })
  if (!materiais) return { ok: false, erro: 'Materiais não encontrados.' }

  const idx = materiais.findIndex(m => m.id === id)
  const alvo = direcao === 'up' ? idx - 1 : idx + 1
  if (idx < 0 || alvo < 0 || alvo >= materiais.length) return { ok: true }

  const a = materiais[idx]
  const b = materiais[alvo]
  await Promise.all([
    supabase.from('aula_materiais').update({ ordem: b.ordem }).eq('id', a.id),
    supabase.from('aula_materiais').update({ ordem: a.ordem }).eq('id', b.id),
  ])

  revalidarCurso(cursoId)
  return { ok: true }
}

export async function excluirMaterial(id: string, cursoId: string): Promise<Resultado> {
  if (!(await checarPermissao())) return { ok: false, erro: 'Sem permissão.' }

  const supabase = await criarClienteServidor()
  const { data: material } = await supabase.from('aula_materiais').select('arquivo_url').eq('id', id).maybeSingle()

  const { error } = await supabase.from('aula_materiais').delete().eq('id', id)
  if (error) return { ok: false, erro: error.message }

  if (material?.arquivo_url) {
    await supabase.storage.from('materiais-aulas').remove([material.arquivo_url])
  }

  revalidarCurso(cursoId)
  return { ok: true }
}

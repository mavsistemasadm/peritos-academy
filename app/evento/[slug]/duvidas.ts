// ══════════════════════════════════════════════════════════════════
// app/evento/[slug]/duvidas.ts — A DÚVIDA QUE CHEGA ANTES DA LIVE (18/10/2026)
//
// Live de tira-dúvidas (`eventos.recebe_duvidas`): a pessoa manda a pergunta
// pela página do evento, com um documento ou imagem de até 20 MB, e o
// apresentador responde ao vivo, dando baixa em /admin/agenda/{id}/duvidas.
//
// Único caminho de escrita em `evento_duvidas`, que não tem policy nenhuma: a
// service role grava daqui, depois de validar. Mesmo motivo da inscrição.
//
// ⚠️ O ARQUIVO NUNCA ATRAVESSA ESTA ACTION. A Vercel recusa corpo acima de
// 4,5 MB antes do Next, e a página cai em "Application error" sem aviso (ver
// "Desafio sem perguntas" no CLAUDE.md). Aqui sai só a URL assinada; o
// navegador sobe direto (lib/storage/enviarDireto.ts), e a confirmação só
// aceita um caminho dentro da pasta deste evento que exista de fato no bucket.
// ══════════════════════════════════════════════════════════════════
'use server'

import { randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import { criarClienteServico } from '@/lib/supabase/servico'
import { criarClienteServidor } from '@/lib/supabase/server'
import { verificarTokenEmail } from '@/lib/email/token'
import { nomeDoCookieDeInscricao, duvidasAbertas } from '@/lib/queries/evento-publico'

const BUCKET = 'evento-duvidas'
const MAX_BYTES = 20 * 1024 * 1024
const MAX_POR_PESSOA = 5
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// Os mesmos do bucket (a migração). O bucket é quem recusa de verdade; esta
// lista existe para a pessoa ouvir "esse tipo não dá" antes de esperar 20 MB
// subirem para nada.
const TIPOS_ACEITOS = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
])

type Evento = { id: string; publicado: boolean; recebe_duvidas: boolean; aberto_ao_publico: boolean; inicia_em: string | null; duracao_seg: number }

async function eventoQueRecebe(eventoId: string): Promise<Evento | null> {
  const { data } = await criarClienteServico().from('eventos')
    .select('id, publicado, recebe_duvidas, aberto_ao_publico, inicia_em, duracao_seg')
    .eq('id', eventoId).maybeSingle()
  if (!data || !data.publicado || !data.recebe_duvidas) return null
  if (!duvidasAbertas(data.inicia_em, data.duracao_seg)) return null
  return data as Evento
}

/** Quem está mandando: aluno com sessão, ou convidado que diz nome e email. */
async function autor(ev: Evento, nomeInformado?: string, emailInformado?: string):
  Promise<{ ok: true; usuarioId: string | null; nome: string; email: string } | { ok: false; erro: string }> {
  const servidor = await criarClienteServidor()
  const { data: auth } = await servidor.auth.getUser()
  if (auth?.user) {
    const { data: perfil } = await criarClienteServico().from('perfis').select('nome').eq('id', auth.user.id).maybeSingle()
    return { ok: true, usuarioId: auth.user.id, nome: perfil?.nome?.trim() || 'Aluno', email: (auth.user.email || '').toLowerCase() }
  }

  // Sem sessão: o email do convidado já inscrito vem do cookie assinado, que
  // vale mais que o digitado (não dá para mandar dúvida no nome de outro).
  const jar = await cookies()
  const token = jar.get(nomeDoCookieDeInscricao(ev.id))?.value
  const emailDoCookie = token ? verificarTokenEmail(token) : null

  // Live só para alunos: quem não tem conta não manda dúvida, e a tela já
  // pede para entrar. A conferência é aqui também, porque a tela é do cliente.
  if (!ev.aberto_ao_publico && !emailDoCookie) {
    return { ok: false, erro: 'Entre na sua conta da Peritos Academy para mandar a dúvida.' }
  }
  const nome = (nomeInformado || '').trim().replace(/\s+/g, ' ')
  const email = (emailDoCookie || emailInformado || '').trim().toLowerCase()
  if (nome.length < 2) return { ok: false, erro: 'Escreva seu nome.' }
  if (!EMAIL_VALIDO.test(email)) return { ok: false, erro: 'Confira o email: parece incompleto.' }
  return { ok: true, usuarioId: null, nome, email }
}

/** Primeiro passo do anexo: a URL assinada para o navegador subir direto. */
export async function prepararAnexoDuvida(eventoId: string, arquivo: { nome: string; tipo: string; bytes: number }):
  Promise<{ ok: true; path: string; token: string } | { ok: false; erro: string }> {
  const ev = await eventoQueRecebe(eventoId)
  if (!ev) return { ok: false, erro: 'Esta live não está recebendo dúvidas agora.' }
  if (!(arquivo.bytes > 0)) return { ok: false, erro: 'O arquivo está vazio.' }
  if (arquivo.bytes > MAX_BYTES) return { ok: false, erro: 'O arquivo passa de 20 MB. Mande uma versão menor ou um print do trecho.' }
  if (!TIPOS_ACEITOS.has(arquivo.tipo)) return { ok: false, erro: 'Esse tipo de arquivo não dá. Use imagem, PDF, Word, Excel ou texto.' }

  // Nome limpo: acento e espaço em path de Storage viram dor de cabeça na hora
  // de baixar. O nome original fica guardado na linha, para a tela.
  const limpo = arquivo.nome.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').slice(-80) || 'anexo'
  const path = `${ev.id}/${randomUUID()}-${limpo}`
  const { data, error } = await criarClienteServico().storage.from(BUCKET).createSignedUploadUrl(path)
  if (error || !data) return { ok: false, erro: 'Não consegui preparar o envio do arquivo. Tente de novo.' }
  return { ok: true, path, token: data.token }
}

export type ResultadoDuvida = { ok: true } | { ok: false; erro: string }

export async function enviarDuvida(entrada: {
  eventoId: string
  texto: string
  nome?: string
  email?: string
  anexo?: { path: string; nome: string; tipo: string; bytes: number } | null
}): Promise<ResultadoDuvida> {
  const ev = await eventoQueRecebe(entrada.eventoId)
  if (!ev) return { ok: false, erro: 'Esta live não está recebendo dúvidas agora.' }

  const texto = (entrada.texto || '').trim()
  if (texto.length < 3) return { ok: false, erro: 'Escreva a sua dúvida.' }
  if (texto.length > 4000) return { ok: false, erro: 'A dúvida passou de 4.000 caracteres. Resuma o essencial.' }

  const quem = await autor(ev, entrada.nome, entrada.email)
  if (!quem.ok) return quem

  const sb = criarClienteServico()

  // Teto por pessoa: segura o formulário usado como caixa de spam sem atrapalhar
  // quem tem três ou quatro perguntas de verdade.
  const { count } = await sb.from('evento_duvidas').select('id', { count: 'exact', head: true })
    .eq('evento_id', ev.id).eq('email', quem.email)
  if ((count ?? 0) >= MAX_POR_PESSOA) {
    return { ok: false, erro: `Você já mandou ${MAX_POR_PESSOA} dúvidas para esta live. Traga as outras no chat, ao vivo.` }
  }

  let anexo: { anexo_path: string; anexo_nome: string; anexo_tipo: string; anexo_bytes: number } | null = null
  if (entrada.anexo) {
    const a = entrada.anexo
    // Só um caminho que ESTA live emitiu, e que de fato subiu. Sem isso, a
    // linha poderia apontar para o anexo de outra pessoa ou de outra live.
    if (!a.path.startsWith(`${ev.id}/`) || a.path.includes('..')) return { ok: false, erro: 'Anexo inválido. Escolha o arquivo de novo.' }
    const pasta = a.path.slice(0, a.path.lastIndexOf('/'))
    const arquivo = a.path.slice(a.path.lastIndexOf('/') + 1)
    const { data: achados } = await sb.storage.from(BUCKET).list(pasta, { search: arquivo, limit: 1 })
    if (!achados?.some(o => o.name === arquivo)) return { ok: false, erro: 'O arquivo não terminou de subir. Escolha de novo.' }
    anexo = { anexo_path: a.path, anexo_nome: a.nome.slice(0, 200), anexo_tipo: a.tipo, anexo_bytes: Math.min(a.bytes, MAX_BYTES) }
  }

  const { error } = await sb.from('evento_duvidas').insert({
    evento_id: ev.id, usuario_id: quem.usuarioId, nome: quem.nome, email: quem.email, texto, ...(anexo || {}),
  })
  if (error) {
    console.error('[dúvida evento] falhou:', error)
    return { ok: false, erro: 'Não consegui enviar agora. Tente de novo.' }
  }
  return { ok: true }
}

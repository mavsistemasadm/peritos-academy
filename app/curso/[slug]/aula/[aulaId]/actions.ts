// app/curso/[slug]/aula/[aulaId]/actions.ts
'use server'

import { criarClienteServidor } from '@/lib/supabase/server'
import { verificarEEmitirCertificado, type CertificadoGerado } from '@/lib/certificados/gerar'

export async function verificarCertificado(cursoId: string): Promise<CertificadoGerado> {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return { gerado: false }

  return verificarEEmitirCertificado(supabase, auth.user.id, cursoId)
}

// baixarMaterialAula: gera link assinado (60s) do bucket privado
// 'materiais-aulas'. Não precisa checar tem_acesso_ativo manualmente aqui —
// tanto a leitura da linha em aula_materiais quanto o createSignedUrl no
// storage já são gateados pela RLS (tem_acesso_ativo ou admin de conteúdo),
// mesmo padrão de app/biblioteca/actions.ts com o bucket 'planilhas'.
// Também registra o download em material_downloads — condição de conclusão
// da aula (ver concluirAula) exige todos os materiais baixados.
export async function baixarMaterialAula(materialId: string): Promise<
  { ok: true; url: string } | { ok: false; erro: string }
> {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return { ok: false, erro: 'Faça login para baixar.' }

  const { data: material } = await supabase
    .from('aula_materiais')
    .select('id, nome, arquivo_url')
    .eq('id', materialId)
    .maybeSingle()
  if (!material?.arquivo_url) {
    return { ok: false, erro: 'Arquivo indisponível.' }
  }

  const { data: assinado, error } = await supabase.storage
    .from('materiais-aulas')
    .createSignedUrl(material.arquivo_url, 60, { download: material.nome })
  if (error || !assinado?.signedUrl) {
    return { ok: false, erro: 'Não foi possível gerar o link. Tente de novo.' }
  }

  await supabase
    .from('material_downloads')
    .upsert({ usuario_id: auth.user.id, material_id: materialId }, { onConflict: 'usuario_id,material_id', ignoreDuplicates: true })

  return { ok: true, url: assinado.signedUrl }
}

// concluirAula: chokepoint único de conclusão — a RPC concluir_aula() valida
// server-side os 70% de vídeo assistido e os materiais baixados (bypass total
// pra admin) antes de gravar aula_progresso.concluida=true. Client nunca
// escreve concluida diretamente (bloqueado por trigger de proteção no banco).
export type ConcluirAulaResultado =
  | { ok: true }
  | { ok: false; erro?: string; video_ok?: boolean; video_pct?: number; materiais_pendentes?: { id: string; nome: string }[] }

export async function concluirAula(aulaId: string): Promise<ConcluirAulaResultado> {
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.rpc('concluir_aula', { p_aula_id: aulaId })
  if (error) return { ok: false, erro: 'Não foi possível concluir a aula. Tente de novo.' }
  return data as ConcluirAulaResultado
}
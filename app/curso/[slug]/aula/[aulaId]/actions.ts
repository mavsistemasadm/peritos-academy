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

  return { ok: true, url: assinado.signedUrl }
}
// lib/storage/enviarDireto.ts
// Envia um arquivo direto do navegador pro Storage, usando a URL assinada que
// uma server action gerou (createSignedUploadUrl). Os bytes não passam pela
// function da Vercel, que recusa corpo acima de 4.5MB com uma resposta que o
// client de Server Actions não entende, e aí a página inteira cai em
// "Application error" em vez de mostrar um aviso.
import { criarClienteBrowser } from '@/lib/supabase/client'

export async function enviarParaSignedUrl(
  bucket: string,
  path: string,
  token: string,
  file: File,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  try {
    const supabase = criarClienteBrowser()
    const { error } = await supabase.storage
      .from(bucket)
      .uploadToSignedUrl(path, token, file, { contentType: file.type || undefined })
    if (error) return { ok: false, erro: `Falha no envio: ${error.message}` }
    return { ok: true }
  } catch {
    return { ok: false, erro: 'Falha no envio. Confira a conexão e tente de novo.' }
  }
}

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
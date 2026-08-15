'use server'

// ══════════════════════════════════════════════════════
// SAIR — e para onde devolver a pessoa
//
// Quem entrou pelo SSO do Nexus não veio do login desta plataforma: veio do
// painel, e é lá que ela mora. Devolvê-la ao login da Academy a deixa numa tela
// que ela nunca usou, pedindo uma senha que ela talvez nem tenha definido — a
// senha dela é a do Nexus.
//
// Quem decide é o cookie `nexus_origem`, gravado por /api/nexus-sso na entrada.
// É a ORIGEM DA VISITA, e não o tier: os 336 migrados e o comprador de curso
// entram os dois pelo painel, mas um aluno que faça login direto aqui continua
// saindo para o login daqui.
//
// O cookie é apagado junto: se não fosse, a pessoa que um dia entrasse pelo
// SSO seria mandada ao Nexus para sempre, inclusive depois de passar a entrar
// pelo login daqui.
// ══════════════════════════════════════════════════════
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { criarClienteServidor } from '@/lib/supabase/server'

/** O painel do Nexus. Endereço próprio para não arrastar dependência nova. */
const PAINEL_NEXUS = 'https://www.nexuspericial.com.br/dashboard'

export async function sair() {
  const supabase = await criarClienteServidor()
  await supabase.auth.signOut()

  const jar = await cookies()
  const veioDoNexus = jar.get('nexus_origem')?.value === '1'
  if (veioDoNexus) jar.delete('nexus_origem')

  redirect(veioDoNexus ? PAINEL_NEXUS : '/login')
}

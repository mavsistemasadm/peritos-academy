// lib/acesso/verificar.ts
import { criarClienteServidor } from '@/lib/supabase/server'

export type StatusAcesso = { logado: boolean; permitido: boolean }

/**
 * Acesso a uma seção paga que não é por curso (Comunidade, Agenda, Desafios).
 *
 * Passa quem tem assinatura Asaas vigente OU qualquer concessão de acesso
 * vigente (ver acessos_conteudo — alunos migrados da Ensinio não têm linha em
 * `assinaturas`, então checar só a assinatura os deixaria de fora destas
 * seções mesmo tendo comprado acesso).
 */
export async function verificarAcessoConteudo(): Promise<StatusAcesso> {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return { logado: false, permitido: false }

  const { data } = await supabase.rpc('tem_acesso_plataforma', { p_usuario_id: auth.user.id })
  return { logado: true, permitido: data === true }
}

/**
 * Acesso a UM curso específico — usar em toda página de conteúdo de curso
 * (curso, aula, avaliação).
 *
 * Diferente de verificarAcessoConteudo: um aluno pode ter acesso à plataforma
 * e ainda assim não poder abrir este curso (comprou só o PASEP, ou tem acesso
 * total com este curso na lista de exceções).
 */
export async function verificarAcessoCurso(slugCurso: string): Promise<StatusAcesso> {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return { logado: false, permitido: false }

  const { data } = await supabase.rpc('tem_acesso_curso', {
    p_usuario_id: auth.user.id,
    p_curso_slug: slugCurso,
  })
  return { logado: true, permitido: data === true }
}

/** Acesso à Biblioteca de Planilhas (flag do perfil ou concessão vigente). */
export async function verificarAcessoBiblioteca(): Promise<StatusAcesso> {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return { logado: false, permitido: false }

  const { data } = await supabase.rpc('tem_acesso_biblioteca', { p_usuario_id: auth.user.id })
  return { logado: true, permitido: data === true }
}

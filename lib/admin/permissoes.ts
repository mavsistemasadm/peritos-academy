// lib/admin/permissoes.ts
// Mapa estático de seções do admin -> papéis que podem acessá-las.
// Só 'administradores' tem página implementada nesta etapa; as demais
// existem pra sidebar já ter os placeholders certos quando cada seção
// for construída (mapeamento provisório, ajustável por quem implementar).

export type PapelAdmin = 'super_admin' | 'conteudo' | 'financeiro' | 'moderador'

export type SecaoAdmin =
  | 'administradores' | 'configuracoes' | 'cursos' | 'financeiro'
  | 'desafios' | 'avaliacoes' | 'trilhas' | 'certificados'
  | 'usuarios' | 'comunidade' | 'agenda' | 'avisos' | 'gamificacao' | 'relatorios'

export const PERMISSOES_SECAO: Record<SecaoAdmin, PapelAdmin[]> = {
  administradores: ['super_admin'],
  configuracoes:   ['super_admin'],
  cursos:          ['super_admin', 'conteudo'],
  desafios:        ['super_admin', 'conteudo'],
  avaliacoes:      ['super_admin', 'conteudo'],
  trilhas:         ['super_admin', 'conteudo'],
  certificados:    ['super_admin', 'conteudo'],
  financeiro:      ['super_admin', 'financeiro'],
  usuarios:        ['super_admin', 'moderador'],
  comunidade:      ['super_admin', 'moderador'],
  agenda:          ['super_admin', 'moderador', 'conteudo'],
  avisos:          ['super_admin', 'moderador'],
  gamificacao:     ['super_admin', 'conteudo'],
  relatorios:      ['super_admin', 'financeiro'],
}

export const NOME_SECAO: Record<SecaoAdmin, string> = {
  administradores: 'Administradores',
  configuracoes: 'Configurações',
  cursos: 'Cursos',
  desafios: 'Desafios',
  avaliacoes: 'Avaliações',
  trilhas: 'Trilhas',
  certificados: 'Certificados',
  financeiro: 'Financeiro',
  usuarios: 'Usuários',
  comunidade: 'Comunidade',
  agenda: 'Agenda',
  avisos: 'Avisos',
  gamificacao: 'Gamificação',
  relatorios: 'Relatórios',
}

export const NOME_PAPEL: Record<PapelAdmin, string> = {
  super_admin: 'Super Admin',
  conteudo: 'Conteúdo',
  financeiro: 'Financeiro',
  moderador: 'Moderador',
}

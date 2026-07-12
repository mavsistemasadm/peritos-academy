// lib/queries/perito-publico.ts
// Perfil público do perito — acessível sem login.
import { createClient } from '@supabase/supabase-js'

const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export type CertificadoPublico = {
  numero: string
  curso_titulo: string
  nota: number | null
  carga_horas: number | null
  emitido_em: string
  emitido_rotulo: string | null
}

export type DesafioPublico = {
  numero: string
  titulo: string
  categoria_nome: string
  nota: number | null
  tempo_seg: number | null
  entregue_em: string
}

export type DadosPeritoPublico = {
  encontrado: boolean
  perito: {
    nome: string
    iniciais: string
    slug: string
    cidade: string | null
    estado: string | null
    bio: string | null
    email_publico: string | null
    telefone: string | null
    mostrar_email: boolean
    mostrar_tel: boolean
    xp: number
    nivel: number
    moedas: number
    streak_dias: number
    membro_desde: string
  }
  stats: {
    cursos_concluidos: number
    certificados: number
    desafios_completos: number
    provas_aprovadas: number
    media_notas: number | null
    planilhas_entregues: number
  }
  score: number
  nivel_label: string
  competencias: { nome: string; valor: number }[]
  certificados: CertificadoPublico[]
  desafios: DesafioPublico[]
  resumo: string
}

export async function carregarPeritoPublico(slug: string): Promise<DadosPeritoPublico | null> {
  // busca o perfil público
  const { data: perfil } = await supabasePublic
    .from('perfis')
    .select('*')
    .eq('slug', slug)
    .eq('perfil_publico', true)
    .single()

  if (!perfil) return null

  const uid = perfil.id
  const nome = perfil.nome ?? 'Perito'
  const iniciais = nome.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()

  // certificados emitidos
  const { data: certsRaw } = await supabasePublic
    .from('certificados')
    .select('numero, curso_titulo, nota, carga_horas, emitido_em, emitido_rotulo')
    .eq('usuario_id', uid)
    .not('numero', 'is', null)
    .not('emitido_em', 'is', null)
    .order('emitido_em', { ascending: false })

  const certificados: CertificadoPublico[] = (certsRaw ?? []).map(c => ({
    numero: c.numero,
    curso_titulo: c.curso_titulo ?? 'Curso',
    nota: c.nota,
    carga_horas: c.carga_horas,
    emitido_em: c.emitido_em,
    emitido_rotulo: c.emitido_rotulo,
  }))

  // desafios completados
  const { data: entregasRaw } = await supabasePublic
    .from('desafio_entregas')
    .select('nota, tempo_seg, entregue_em, desafio_id')
    .eq('usuario_id', uid)
    .not('entregue_em', 'is', null)
    .order('entregue_em', { ascending: false })

  // busca dados dos desafios
  const desafioIds = [...new Set((entregasRaw ?? []).map(e => e.desafio_id))]
  let desafiosMap = new Map<string, { numero: string; titulo: string; categoria_nome: string }>()
  if (desafioIds.length > 0) {
    const { data: desafiosRaw } = await supabasePublic
      .from('desafios')
      .select('id, numero, titulo, desafio_categorias(nome)')
      .in('id', desafioIds)
    for (const d of desafiosRaw ?? []) {
      desafiosMap.set(d.id, {
        numero: d.numero ?? '000',
        titulo: d.titulo,
        categoria_nome: (d as any).desafio_categorias?.nome ?? 'Geral',
      })
    }
  }

  const desafios: DesafioPublico[] = (entregasRaw ?? []).map(e => {
    const d = desafiosMap.get(e.desafio_id) ?? { numero: '000', titulo: 'Desafio', categoria_nome: 'Geral' }
    return {
      numero: d.numero,
      titulo: d.titulo,
      categoria_nome: d.categoria_nome,
      nota: e.nota,
      tempo_seg: e.tempo_seg,
      entregue_em: e.entregue_em,
    }
  })

  // stats
  const cursos_concluidos = certificados.length
  const certificadosCount = certificados.length
  const desafios_completos = desafios.length
  const planilhas_entregues = (entregasRaw ?? []).length

  // média de notas (certificados + desafios)
  const todasNotas = [
    ...certificados.filter(c => c.nota !== null).map(c => c.nota!),
    ...desafios.filter(d => d.nota !== null).map(d => d.nota!),
  ]
  const media_notas = todasNotas.length > 0
    ? Math.round((todasNotas.reduce((s, n) => s + n, 0) / todasNotas.length) * 10) / 10
    : null

  // provas aprovadas (nota >= 6)
  const provas_aprovadas = todasNotas.filter(n => n >= 6).length

  // competências por categoria de desafio
  const compMap = new Map<string, number[]>()
  for (const d of desafios) {
    if (d.nota !== null) {
      const arr = compMap.get(d.categoria_nome) ?? []
      arr.push(d.nota)
      compMap.set(d.categoria_nome, arr)
    }
  }
  // adiciona categorias dos certificados (cursos bancários = Bancária, etc.)
  for (const c of certificados) {
    const cat = c.curso_titulo.toLowerCase().includes('bancár') ? 'Bancária'
      : c.curso_titulo.toLowerCase().includes('previd') ? 'Previdenciária'
      : c.curso_titulo.toLowerCase().includes('trabalhist') ? 'Trabalhista'
      : c.curso_titulo.toLowerCase().includes('tributár') ? 'Tributária'
      : 'Cível'
    const arr = compMap.get(cat) ?? []
    arr.push(c.nota ?? 8)
    compMap.set(cat, arr)
  }

  const categoriasBase = ['Bancária', 'Cível', 'Previdenciária', 'Trabalhista', 'Tributária']
  const competencias = categoriasBase.map(cat => {
    const notas = compMap.get(cat) ?? []
    const valor = notas.length > 0
      ? Math.round(notas.reduce((s, n) => s + n, 0) / notas.length * 10)
      : 0
    return { nome: cat, valor }
  })

  // score pericial (0-100)
  const xp = perfil.xp ?? 0
  const scoreCursos = Math.min(cursos_concluidos * 8, 25)
  const scoreDesafios = Math.min(desafios_completos * 10, 25)
  const scoreNotas = media_notas ? Math.min(Math.round(media_notas * 2.5), 25) : 0
  const scoreXp = Math.min(Math.round(xp / 200), 15)
  const scoreCerts = Math.min(certificadosCount * 5, 10)
  const score = Math.min(scoreCursos + scoreDesafios + scoreNotas + scoreXp + scoreCerts, 100)

  const nivel_label = score >= 80 ? 'Perito de Elite'
    : score >= 50 ? 'Perito Qualificado'
    : score >= 20 ? 'Perito em Formação'
    : 'Perito Iniciante'

  // membro desde
  const membro_desde = perfil.criado_em ?? perfil.created_at ?? new Date().toISOString()

  // resumo auto-gerado
  const partes = []
  partes.push(`${nome}`)
  if (cursos_concluidos > 0) partes.push(`tem ${cursos_concluidos} curso${cursos_concluidos > 1 ? 's' : ''} concluído${cursos_concluidos > 1 ? 's' : ''}`)
  if (desafios_completos > 0) partes.push(`${desafios_completos} desafio${desafios_completos > 1 ? 's' : ''} pericia${desafios_completos > 1 ? 'is' : 'l'} completado${desafios_completos > 1 ? 's' : ''}`)
  if (certificadosCount > 0) partes.push(`${certificadosCount} certificado${certificadosCount > 1 ? 's' : ''} verificáve${certificadosCount > 1 ? 'is' : 'l'}`)
  if (media_notas) partes.push(`Média geral de ${media_notas.toFixed(1).replace('.', ',')}`)
  partes.push(`Nível: ${nivel_label}`)
  const resumo = partes.join('. ') + '.'

  return {
    encontrado: true,
    perito: {
      nome,
      iniciais,
      slug: perfil.slug,
      cidade: perfil.cidade,
      estado: perfil.estado,
      bio: perfil.bio,
      email_publico: perfil.mostrar_email ? perfil.email_publico : null,
      telefone: perfil.mostrar_tel ? perfil.telefone : null,
      mostrar_email: perfil.mostrar_email,
      mostrar_tel: perfil.mostrar_tel,
      xp,
      nivel: Math.floor(xp / 100) + 1,
      moedas: perfil.moedas ?? 0,
      streak_dias: perfil.streak_dias ?? 0,
      membro_desde,
    },
    stats: {
      cursos_concluidos,
      certificados: certificadosCount,
      desafios_completos,
      provas_aprovadas,
      media_notas,
      planilhas_entregues,
    },
    score,
    nivel_label,
    competencias,
    certificados,
    desafios,
    resumo,
  }
}
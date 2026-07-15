// app/cursos/page.tsx
import { redirect } from 'next/navigation'
import { carregarBibliotecaCursos } from '@/lib/queries/cursos-biblioteca'
import { carregarNav } from '@/lib/queries/nav'
import CursosBibliotecaContent from '@/components/CursosBibliotecaContent'

export const dynamic = 'force-dynamic'

export default async function PaginaCursos() {
  const nav = await carregarNav()
  if (!nav) redirect('/login')

  const dados = await carregarBibliotecaCursos()

  return <CursosBibliotecaContent dados={dados} nav={nav} />
}

export const metadata = {
  title: 'Biblioteca de Cursos · Peritos Academy',
  description: 'Todos os cursos organizados por trilha e etapa de desenvolvimento.',
}
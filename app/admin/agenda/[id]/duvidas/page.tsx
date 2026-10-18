// app/admin/agenda/[id]/duvidas/page.tsx — AS DÚVIDAS DA LIVE (18/10/2026)
//
// O que chegou pela página do evento antes da live de tira-dúvidas: quem
// mandou, o texto e o anexo. Durante a live é esta a tela aberta: responde,
// dá baixa, e a dúvida desce para "respondidas". As abertas ficam até serem
// respondidas, inclusive de uma live para a outra, se a mesma live for
// reaberta.
import type { Metadata } from 'next'
import { redirect, notFound } from 'next/navigation'
import { obterAdminAtual, temPermissao } from '@/lib/admin/auth'
import { criarClienteServico } from '@/lib/supabase/servico'
import { formatarEmBrasilia } from '@/lib/evento/relogio'
import AdminDuvidasContent, { type DuvidaAdmin } from '@/components/AdminDuvidasContent'

export const metadata: Metadata = { title: 'Dúvidas da live · Admin Peritos Academy' }
export const dynamic = 'force-dynamic'

export default async function PaginaDuvidasDaLive({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = await obterAdminAtual()
  if (!temPermissao(admin, 'agenda')) redirect('/acesso-negado')

  const sb = criarClienteServico()
  const { data: ev } = await sb.from('eventos').select('id, titulo, slug, inicia_em, recebe_duvidas').eq('id', id).maybeSingle()
  if (!ev) notFound()

  const { data } = await sb.from('evento_duvidas')
    .select('id, usuario_id, nome, email, texto, anexo_path, anexo_nome, anexo_tipo, anexo_bytes, status, respondida_em, criado_em')
    .eq('evento_id', id).order('criado_em', { ascending: true })

  const duvidas: DuvidaAdmin[] = (data ?? []).map(d => ({
    id: d.id, ehAluno: !!d.usuario_id, nome: d.nome, email: d.email, texto: d.texto,
    anexo: d.anexo_path ? { nome: d.anexo_nome || 'anexo', tipo: d.anexo_tipo || '', bytes: d.anexo_bytes || 0 } : null,
    respondida: d.status === 'respondida', respondidaEm: d.respondida_em, criadaEm: d.criado_em,
  }))

  return (
    <AdminDuvidasContent
      evento={{ id: ev.id, titulo: ev.titulo, slug: ev.slug, quando: formatarEmBrasilia(ev.inicia_em), recebeDuvidas: !!ev.recebe_duvidas }}
      duvidas={duvidas}
    />
  )
}

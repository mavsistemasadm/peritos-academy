// app/certificado/[numero]/page.tsx — VERIFICAÇÃO PÚBLICA DO CERTIFICADO
//
// Sem login: é o link que o botão "Copiar link de verificação" do perfil
// copia, e o que vai impresso no rodapé do PDF. Quem abre é um juiz, um
// cliente, um recrutador, e precisa ver em dois segundos que o certificado
// existe, de quem é e de qual curso. Até 17/11/2026 esta rota não existia e o
// link dava 404.
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { carregarCertificadoPublico } from '@/lib/queries/certificado-publico'
import { IconeCheck, IconeDownload } from '@/components/Icones'
import { SITE_URL } from '@/lib/site'

export const dynamic = 'force-dynamic'

export default async function PaginaCertificado({ params }: { params: Promise<{ numero: string }> }) {
  const { numero } = await params
  const c = await carregarCertificadoPublico(numero)
  if (!c) notFound()

  return (
    <main className="pagina-certificado">
      <div className="pc-cartao">
        <span className="pc-valido"><IconeCheck size={14} strokeWidth={2.4} /> Certificado válido</span>

        <p className="pc-eyebrow">Certificado de conclusão · Peritos Academy</p>
        <p className="pc-rotulo">Certificamos que</p>
        <h1 className="pc-nome">{c.nome}</h1>
        <p className="pc-rotulo">concluiu com aproveitamento o curso</p>
        <h2 className="pc-curso">{c.cursoTitulo}</h2>

        <dl className="pc-dados">
          <div><dt>Número</dt><dd className="num">{c.numero}</dd></div>
          <div><dt>Concluído em</dt><dd>{c.emitidoRotulo}</dd></div>
          {c.cargaHoras && <div><dt>Carga horária</dt><dd className="num">{c.cargaHoras}h</dd></div>}
          {c.nota != null && (
            <div><dt>Nota final</dt><dd className="num">{c.nota.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</dd></div>
          )}
        </dl>

        <div className="pc-acoes">
          <a className="pc-btn" href={`/certificado/${c.numero}/pdf`} download>
            <IconeDownload size={15} strokeWidth={2.2} /> Baixar PDF
          </a>
          {c.peritoSlug && (
            <Link className="pc-link" href={`/perito/${c.peritoSlug}`}>Ver perfil do perito</Link>
          )}
        </div>
      </div>
    </main>
  )
}

export async function generateMetadata({ params }: { params: Promise<{ numero: string }> }): Promise<Metadata> {
  const { numero } = await params
  const c = await carregarCertificadoPublico(numero)
  if (!c) return { title: 'Certificado não encontrado · Peritos Academy' }
  const titulo = `Certificado de ${c.nome} · Peritos Academy`
  const descricao = `${c.cursoTitulo}. Concluído em ${c.emitidoRotulo}. Certificado nº ${c.numero}.`
  return {
    title: titulo,
    description: descricao,
    openGraph: { title: titulo, description: descricao, url: `${SITE_URL}/certificado/${c.numero}` },
  }
}

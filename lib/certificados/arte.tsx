// lib/certificados/arte.tsx
// A arte do certificado, como imagem (PNG). É a mesma imagem que vai dentro do
// PDF e que aparece na página de verificação, então as duas nunca divergem.
//
// Modelo "Onda" escolhido pelo dono em 17/11/2026: fundo escuro com luz verde
// no alto, a onda de linhas finas no rodapé (gerada no Higgsfield, sem texto,
// em public/certificado/onda.jpg) e uma linha fina em degradê marcando o
// limite da página. O texto entra por aqui, nunca pela imagem de fundo.
//
// Desenhado em A4 deitado (1123 × 794) e renderizado em dobro para a
// impressão não sair borrada.
import { ImageResponse } from 'next/og'
import type { CertificadoPublico } from '@/lib/queries/certificado-publico'

export const ARTE_LARGURA = 1123
export const ARTE_ALTURA = 794
const S = 2 // escala de renderização

const CREME = '#F1F2DF'
const VERDE = '#20D9A6'
const CINZA = '#989E99'
const CINZA_CLARO = '#B9BFB8'

const px = (n: number) => n * S

const INTER = 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.18/files/inter-latin-'
const MONO = 'https://cdn.jsdelivr.net/npm/@fontsource/jetbrains-mono@5.0.18/files/jetbrains-mono-latin-500-normal.woff'

async function baixar(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url, { cache: 'force-cache' })
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.arrayBuffer()
}

async function fontes() {
  const pesos = [400, 600, 700] as const
  const [inter, mono] = await Promise.all([
    Promise.all(pesos.map(w => baixar(`${INTER}${w}-normal.woff`))),
    baixar(MONO),
  ])
  return [
    ...pesos.map((weight, i) => ({ name: 'Inter', data: inter[i], weight, style: 'normal' as const })),
    { name: 'Mono', data: mono, weight: 500 as const, style: 'normal' as const },
  ]
}

function dataUri(buf: ArrayBuffer, tipo: string) {
  return `data:${tipo};base64,${Buffer.from(buf).toString('base64')}`
}

/** A linha fina em degradê em volta da página. SVG porque o gerador não faz borda em degradê. */
function moldura() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${px(ARTE_LARGURA)}" height="${px(ARTE_ALTURA)}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#20D9A6"/>
    <stop offset="0.35" stop-color="#36DCD1" stop-opacity="0.4"/>
    <stop offset="0.6" stop-color="#F1F2DF" stop-opacity="0.14"/>
    <stop offset="1" stop-color="#DDF784"/>
  </linearGradient></defs>
  <rect x="${px(28)}" y="${px(28)}" width="${px(ARTE_LARGURA - 56)}" height="${px(ARTE_ALTURA - 56)}" rx="${px(20)}"
    fill="none" stroke="url(#g)" stroke-width="${px(1.3)}"/>
</svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

/** Nome longo encolhe para caber numa linha; muito longo, quebra em duas. */
function tamanhoDoNome(nome: string) {
  const largura = 915
  const porLetra = 0.56
  return Math.max(46, Math.min(74, Math.floor(largura / (nome.length * porLetra))))
}

function formatarNota(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function dataCurta(iso: string) {
  const d = new Date(iso)
  const dia = d.toLocaleDateString('pt-BR', { day: 'numeric', timeZone: 'America/Sao_Paulo' })
  const mes = d.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'America/Sao_Paulo' }).replace('.', '')
  const ano = d.toLocaleDateString('pt-BR', { year: 'numeric', timeZone: 'America/Sao_Paulo' })
  return `${dia} ${mes} ${ano}`
}

/**
 * Gera o PNG do certificado. `origem` é o endereço da própria aplicação, de
 * onde vêm a onda e a logo (a mesma pasta `public/` que o site serve).
 */
export async function gerarArteCertificado(c: CertificadoPublico, origem: string): Promise<ArrayBuffer> {
  const [fonts, onda, logo] = await Promise.all([
    fontes(),
    baixar(new URL('/certificado/onda.jpg', origem).toString()),
    baixar(new URL('/img/logo.png', origem).toString()),
  ])

  const dados: { rotulo: string; valor: string }[] = [
    { rotulo: 'CONCLUÍDO EM', valor: dataCurta(c.emitidoEm) },
    ...(c.cargaHoras ? [{ rotulo: 'CARGA HORÁRIA', valor: `${c.cargaHoras} ${c.cargaHoras === 1 ? 'hora' : 'horas'}` }] : []),
    ...(c.nota != null ? [{ rotulo: 'NOTA FINAL', valor: formatarNota(c.nota) }] : []),
    { rotulo: 'ASSINADO POR', valor: 'Marlos Henrique' },
  ]

  // Onda: a imagem é 3:2 e a página é A4; cobre a altura e alinha pelo rodapé.
  const ondaAlt = ARTE_ALTURA
  const ondaLarg = Math.round(ondaAlt * (2048 / 1360))
  const ondaX = Math.round((ARTE_LARGURA - ondaLarg) / 2)

  const resposta = new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', position: 'relative',
        background: '#070908', fontFamily: 'Inter', color: CREME,
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUri(onda, 'image/jpeg')} width={px(ondaLarg)} height={px(ondaAlt)}
          style={{ position: 'absolute', left: px(ondaX), top: 0 }} />

        {/* A luz: tira o preto chapado do alto da página */}
        <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '60%', display: 'flex',
          backgroundImage: 'linear-gradient(180deg, rgba(14,24,21,0.95) 0%, rgba(7,9,8,0) 100%)' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', display: 'flex',
          backgroundImage: 'radial-gradient(65% 60% at 12% 0%, rgba(32,217,166,0.17) 0%, rgba(32,217,166,0) 70%)' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', display: 'flex',
          backgroundImage: 'radial-gradient(55% 50% at 100% 18%, rgba(54,220,209,0.08) 0%, rgba(54,220,209,0) 70%)' }} />

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={moldura()} width={px(ARTE_LARGURA)} height={px(ARTE_ALTURA)}
          style={{ position: 'absolute', left: 0, top: 0 }} />

        <div style={{ position: 'absolute', left: px(104), top: px(84), right: px(104), display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: px(12) }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={dataUri(logo, 'image/png')} width={px(34)} height={px(34 * 220 / 216)} />
              <div style={{ display: 'flex', fontSize: px(12), fontWeight: 600, letterSpacing: px(4.8) }}>PERITOS ACADEMY</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: px(6) }}>
              <div style={{ display: 'flex', fontFamily: 'Mono', fontSize: px(13), color: CINZA_CLARO, letterSpacing: px(0.8) }}>
                {`Nº ${c.numero}`}
              </div>
              <div style={{ display: 'flex', fontSize: px(10), color: CINZA }}>
                {`verifique em evolua.peritosacademy.com.br/certificado/${c.numero}`}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', marginTop: px(58), fontSize: px(13), fontWeight: 600, letterSpacing: px(5.4), color: VERDE }}>
            CERTIFICADO DE CONCLUSÃO
          </div>

          <div style={{ display: 'flex', marginTop: px(18), fontSize: px(tamanhoDoNome(c.nome)), fontWeight: 700,
            letterSpacing: px(-0.04 * tamanhoDoNome(c.nome)), lineHeight: 1.02, maxWidth: px(915) }}>
            {c.nome}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: px(22), fontSize: px(26), lineHeight: 1.3, maxWidth: px(840), color: CINZA_CLARO }}>
            <span>concluiu com aproveitamento o curso&nbsp;</span>
            <span style={{ color: CREME, fontWeight: 600 }}>{c.cursoTitulo}</span>
          </div>

          <div style={{ display: 'flex', gap: px(52), marginTop: px(40) }}>
            {dados.map(d => (
              <div key={d.rotulo} style={{ display: 'flex', flexDirection: 'column', gap: px(6) }}>
                <div style={{ display: 'flex', fontSize: px(11), letterSpacing: px(2.4), color: CINZA }}>{d.rotulo}</div>
                <div style={{ display: 'flex', fontSize: px(17), fontWeight: 600 }}>{d.valor}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { width: px(ARTE_LARGURA), height: px(ARTE_ALTURA), fonts },
  )
  return resposta.arrayBuffer()
}

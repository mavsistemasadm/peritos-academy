// ══════════════════════════════════════════════════════════════════
// app/evento/[slug]/opengraph-image.tsx — O CARTÃO DO CONVITE (19/10/2026)
//
// A figura que o WhatsApp (e qualquer rede) mostra quando o link da live é
// colado. Sem imagem própria, a live caía na imagem padrão da plataforma, que
// não diz nada sobre o convite: o dono viu o cartão no grupo e disse "sai com
// uma imagem que não fica legal, ficou sem contexto". Esta diz de relance o
// que é (aula ao vivo, ou plantão de tira-dúvidas), sobre o quê, e quando.
//
// Live com imagem própria continua usando a dela (ver generateMetadata em
// page.tsx); esta é a de toda live sem imagem.
// ══════════════════════════════════════════════════════════════════
import { ImageResponse } from 'next/og'
import { criarClienteServico } from '@/lib/supabase/servico'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Convite para a aula ao vivo na Peritos Academy'

const TZ = 'America/Sao_Paulo'

// A Inter, fonte da Academy, nos pesos usados. A fonte padrão do gerador só tem
// o regular, e o título sem peso parecia um texto qualquer. Se o download
// falhar, o cartão sai com a padrão em vez de não sair.
const FONTE = 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.18/files/inter-latin-'
async function fontes() {
  try {
    const pesos = [400, 700, 800] as const
    const dados = await Promise.all(pesos.map(w => fetch(`${FONTE}${w}-normal.woff`).then(r => {
      if (!r.ok) throw new Error(String(r.status))
      return r.arrayBuffer()
    })))
    return pesos.map((weight, i) => ({ name: 'Inter', data: dados[i], weight, style: 'normal' as const }))
  } catch {
    return undefined
  }
}

function quando(iso: string | null) {
  if (!iso) return { dia: 'Data a confirmar', hora: '' }
  const d = new Date(iso)
  const dia = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(d)
  const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(d).replace(':', 'h')
  return { dia: dia.charAt(0).toUpperCase() + dia.slice(1), hora: hora.replace(/h00$/, 'h') }
}

export default async function Imagem({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { data: ev } = await criarClienteServico().from('eventos')
    .select('titulo, inicia_em, tipo, recebe_duvidas, apresentador_nome')
    .eq('slug', slug).eq('publicado', true).maybeSingle()

  const titulo = ev?.titulo ?? 'Aula ao vivo'
  const { dia, hora } = quando(ev?.inicia_em ?? null)
  const etiqueta = ev?.recebe_duvidas || ev?.tipo === 'plantao' ? 'PLANTÃO DE TIRA-DÚVIDAS · AO VIVO' : 'AULA AO VIVO'
  // Título longo diminui, em vez de estourar o cartão.
  const corpo = titulo.length > 70 ? 54 : titulo.length > 45 ? 64 : 76

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '64px 72px', fontFamily: 'Inter', background: 'radial-gradient(90% 120% at 100% 0%, #0E3B30 0%, #070908 60%)', color: '#F1F2DF',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', width: 18, height: 18, borderRadius: 9, background: '#FF4D4D' }} />
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, letterSpacing: 4, color: '#20D9A6' }}>{etiqueta}</div>
        </div>

        <div style={{ display: 'flex', fontSize: corpo, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1.5, maxWidth: 1040 }}>
          {titulo}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', fontSize: 40, fontWeight: 700 }}>{dia}{hora ? ` · ${hora}` : ''}</div>
            <div style={{ display: 'flex', fontSize: 26, color: '#989E99' }}>
              Horário de Brasília{ev?.apresentador_nome ? ` · com ${ev.apresentador_nome}` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', fontSize: 34, fontWeight: 800, letterSpacing: -0.5 }}>peritos academy</div>
            <div style={{ display: 'flex', fontSize: 22, color: '#20D9A6' }}>reserve o seu lugar</div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: await fontes() },
  )
}

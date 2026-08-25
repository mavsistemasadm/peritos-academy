// ══════════════════════════════════════════════════════════════════
// lib/queries/evento-publico.ts — UM EVENTO, PARA QUEM AINDA NÃO ENTROU
//
// Esta é a única query da plataforma que carrega conteúdo de agenda para
// visitante deslogado, e a razão é o WhatsApp: o convite de um evento ao vivo
// circula em grupo de perito, e boa parte de quem recebe ainda não é aluno.
// Página que exige login antes de dizer o que é não convence ninguém a entrar
// — é a mesma decisão que mantém `/cursos` aberto a quem só fez login e a home
// do acesso parcial vendendo a plataforma inteira: ver o que existe é o que dá
// vontade de comprar.
//
// ⚠️ **O QUE NÃO É PÚBLICO: O LINK DA SALA.**
//
// `linkTransmissao` só é preenchido para quem tem sessão. A página é o
// convite; a sala é o produto. Um link de Zoom/Meet renderizado para anônimo
// vaza de graça, some do controle no primeiro print e não há como retomá-lo
// depois. Como quem monta a resposta é o servidor, para o visitante deslogado
// o campo chega `null` de verdade — não existe no HTML, não existe no payload,
// não adianta abrir o inspetor.
//
// A RLS de `eventos` já era `select using (publicado = true)` para o papel
// `public` desde sempre, então nada foi afrouxado aqui: o que mudou é que
// agora existe uma tela lendo o que o banco sempre deixou ler.
// ══════════════════════════════════════════════════════════════════
import { cookies } from 'next/headers'
import { criarClienteServidor } from '@/lib/supabase/server'
import { idDoYoutube } from '@/lib/video/youtube'
import { verificarTokenEmail } from '@/lib/email/token'
import { carregarChatEvento, type MensagemEvento } from '@/lib/queries/evento-chat'

/**
 * Onde o convite ao Nexus desta página aterrissa.
 *
 * ⚠️ NÃO é o mesmo `nexus_cta_config.link_global` que as sugestões dentro da
 * plataforma usam (hoje `nexusperitosacademy.com.br`), e a diferença é
 * deliberada: lá quem clica é aluno, e o destino é a oferta para aluno; aqui
 * quem clica é alguém que talvez nunca tenha ouvido falar do ecossistema, e o
 * destino é a página de entrada.
 *
 * Se um dia os dois tiverem que ser o mesmo, o lugar de decidir isso é o
 * admin (`/admin/configuracoes` → Sugestões do Nexus) — e então esta
 * constante some e volta a ler a config. Enquanto forem dois, ficam os dois
 * escritos, cada um com o motivo ao lado.
 */
const LINK_NEXUS = 'https://www.nexuspericial.com.br/inicio'

export type EstadoEvento = 'agendado' | 'ao_vivo' | 'gravado' | 'encerrado'

export type EventoPublico = {
  id: string
  slug: string
  titulo: string
  descricao: string | null
  tipo: 'sala_analise' | 'aula_ao_vivo' | 'plantao' | 'mentoria' | 'lancamento'
  iniciaEm: string | null
  duracaoSeg: number
  apresentadorNome: string | null
  apresentadorCargo: string | null
  metaExtra: string | null
  alvoRotulo: string | null
  /** Imagem do evento. Vira a figura do cartão do WhatsApp — ver imagemDaPrevia(). */
  imagemUrl: string | null
  /** Imagem padrão da plataforma, para o cartão não ficar sem figura. */
  imagemPadraoUrl: string | null
  estado: EstadoEvento
  confirmados: number
  /** Só para quem tem sessão. Anônimo recebe null — ver cabeçalho. */
  linkTransmissao: string | null
  /** Idem. */
  gravacaoUrl: string | null
  /** Id do vídeo quando a transmissão (ou a gravação) é do YouTube — vira o
   *  player embutido na própria página. Null para Zoom, Meet e afins. */
  youtubeId: string | null
  /** 'nenhum' · 'youtube' (exige conta do Google) · 'proprio' (qualquer participante fala). */
  chatModo: 'nenhum' | 'youtube' | 'proprio'
  /** O que já foi dito. Vazio quando o chat não é o nosso. */
  chat: MensagemEvento[]
  /** Live aberta: quem não tem conta pode se inscrever e assistir. */
  abertoAoPublico: boolean
  reservado: boolean
  /** Convidado sem conta que já se inscreveu nesta live (cookie assinado). */
  inscritoComoConvidado: boolean
  logado: boolean
  nomePlataforma: string
  logoUrl: string | null
  /** Para onde o convite ao Nexus aponta nesta tela — ver LINK_NEXUS. */
  nexusLink: string
}

export async function carregarEventoPublico(slug: string): Promise<EventoPublico | null> {
  const supabase = await criarClienteServidor()

  const [{ data: ev }, { data: auth }, { data: config }] = await Promise.all([
    supabase.from('eventos').select('*').eq('slug', slug).eq('publicado', true).maybeSingle(),
    supabase.auth.getUser(),
    supabase.from('config_plataforma').select('nome_plataforma, logo_url, og_image_url').eq('id', 1).maybeSingle(),
  ])



  // Rascunho e slug inexistente caem no mesmo lugar: 404. Um evento ainda não
  // publicado não deve nem confirmar que existe — o link de divulgação é
  // copiado no admin antes da hora com frequência.
  if (!ev) return null

  const logado = !!auth?.user
  const abertoAoPublico = !!ev.aberto_ao_publico

  // ── QUEM VÊ A TRANSMISSÃO ──
  //
  // Numa live aberta, a transmissão É o produto que se está dando: esconder o
  // player de quem não tem conta é esconder exatamente da pessoa que a live
  // existe para convencer. Num evento normal continua valendo a regra de
  // sempre — só quem tem sessão.
  const podeVerTransmissao = logado || abertoAoPublico

  const [{ data: contagem }, reserva] = await Promise.all([
    supabase.rpc('contar_confirmados', { p_evento: ev.id }),
    logado
      // RLS de evento_reservas devolve só as próprias linhas, então este
      // select não precisa (nem deve) filtrar por usuário na mão.
      ? supabase.from('evento_reservas').select('evento_id').eq('evento_id', ev.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return {
    id: ev.id,
    slug: ev.slug,
    titulo: ev.titulo,
    descricao: ev.descricao,
    tipo: ev.tipo,
    iniciaEm: ev.inicia_em,
    duracaoSeg: ev.duracao_seg,
    apresentadorNome: ev.apresentador_nome,
    apresentadorCargo: ev.apresentador_cargo,
    metaExtra: ev.meta_extra,
    alvoRotulo: ev.alvo_rotulo,
    imagemUrl: ev.gravacao_thumb_url,
    imagemPadraoUrl: config?.og_image_url ?? null,
    estado: estadoDoEvento(ev.inicia_em, ev.duracao_seg, ev.gravacao_url),
    confirmados: typeof contagem === 'number' ? contagem : 0,
    linkTransmissao: podeVerTransmissao ? ev.link_transmissao : null,
    gravacaoUrl: podeVerTransmissao ? ev.gravacao_url : null,
    youtubeId: podeVerTransmissao ? idDoYoutube(ev.gravacao_url ?? ev.link_transmissao) : null,
    chatModo: (ev.chat_modo ?? 'proprio') as EventoPublico['chatModo'],
    chat: ev.chat_modo === 'proprio' ? await carregarChatEvento(ev.id) : [],
    abertoAoPublico,
    reservado: !!reserva?.data,
    inscritoComoConvidado: await jaInscritoComoConvidado(ev.id),
    logado,
    nomePlataforma: config?.nome_plataforma ?? 'Peritos Academy',
    logoUrl: config?.logo_url ?? null,
    nexusLink: LINK_NEXUS,
  }
}

/**
 * Mesma leitura de tempo que a agenda faz para separar as três listas, escrita
 * uma vez só porque aqui ela decide o texto inteiro da página: o que se
 * promete a quem chega ("reserve", "entre agora", "assista a gravação") não
 * pode divergir do que a agenda mostra para o mesmo evento no mesmo segundo.
 */
function estadoDoEvento(iniciaEm: string | null, duracaoSeg: number, gravacaoUrl: string | null): EstadoEvento {
  if (gravacaoUrl) return 'gravado'
  if (!iniciaEm) return 'agendado'
  const inicio = +new Date(iniciaEm)
  const fim = inicio + duracaoSeg * 1000
  const agora = Date.now()
  if (agora < inicio) return 'agendado'
  if (agora < fim) return 'ao_vivo'
  return 'encerrado'
}


/**
 * O convidado que já deixou o email volta e a página o reconhece.
 *
 * Ele não tem sessão — não existe conta para ter. O que existe é um cookie
 * assinado, gravado no ato da inscrição, com o próprio endereço dentro. Ele
 * não dá acesso a nada: serve só para a página parar de pedir os dados de
 * novo e dizer "você está inscrito". Perder esse cookie (outro aparelho,
 * navegador limpo) não perde a inscrição — ela vive no banco, e o lembrete
 * chega por email de qualquer forma. É conveniência, não credencial, e por
 * isso não precisa (nem deve) ser mais forte que isso.
 */
async function jaInscritoComoConvidado(eventoId: string): Promise<boolean> {
  const jar = await cookies()
  const token = jar.get(nomeDoCookieDeInscricao(eventoId))?.value
  return !!token && !!verificarTokenEmail(token)
}

export function nomeDoCookieDeInscricao(eventoId: string) {
  return `evt_${eventoId}`
}

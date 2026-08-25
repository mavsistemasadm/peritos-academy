/**
 * O ID DE UM VÍDEO DO YOUTUBE, VENHA ELE COMO VIER.
 *
 * Quem monta a live no YouTube Studio e transmite pelo OBS copia o endereço
 * de onde estiver com a mão naquele momento — a barra do navegador, o botão
 * de compartilhar, o painel da transmissão. São formatos diferentes para o
 * mesmo vídeo, e um campo que só aceitasse um deles falharia justamente na
 * pressa de minutos antes de entrar no ar, quando ninguém tem tempo de
 * descobrir que colou "a URL errada".
 *
 * Reconhece: youtube.com/watch?v=ID · youtu.be/ID · youtube.com/live/ID ·
 * youtube.com/embed/ID · youtube.com/shorts/ID · e o ID cru.
 *
 * Devolve null para qualquer outra coisa (Zoom, Meet, um link quebrado), e é
 * assim que a página decide entre embutir o player e mostrar um botão: nada
 * fora do YouTube pode ser posto dentro de um iframe — Zoom e Meet recusam
 * enquadramento, e o que apareceria é um retângulo branco.
 */
export function idDoYoutube(url: string | null | undefined): string | null {
  if (!url) return null
  const bruto = url.trim()
  if (!bruto) return null

  // ID cru: 11 caracteres do alfabeto do YouTube.
  if (/^[A-Za-z0-9_-]{11}$/.test(bruto)) return bruto

  let u: URL
  try {
    u = new URL(bruto.startsWith('http') ? bruto : `https://${bruto}`)
  } catch {
    return null
  }

  const host = u.hostname.replace(/^www\./, '')
  const ehYoutube = host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com'
    || host === 'youtu.be' || host === 'youtube-nocookie.com'
  if (!ehYoutube) return null

  const candidato = host === 'youtu.be'
    ? u.pathname.slice(1)
    : u.searchParams.get('v') ?? u.pathname.replace(/^\/(live|embed|shorts|v)\//, '')

  const id = (candidato ?? '').split('/')[0]
  return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
}

/**
 * O endereço do player embutido.
 *
 * `youtube-nocookie.com` de propósito: a página do evento é aberta por gente
 * que ainda não é aluna e chegou por um link de WhatsApp — instalar cookie de
 * publicidade de terceiro em quem só veio ver um convite é o tipo de coisa que
 * não se faz sem perguntar, e aqui não há nada a ganhar com isso.
 *
 * `autoplay` só quando a transmissão já começou: um player que dispara som
 * sozinho numa página aberta às escondidas no trabalho é motivo para fechar a
 * aba, não para assistir.
 */
export function urlEmbedYoutube(id: string, opcoes?: { autoplay?: boolean }): string {
  const p = new URLSearchParams({ rel: '0', modestbranding: '1', playsinline: '1' })
  if (opcoes?.autoplay) p.set('autoplay', '1')
  return `https://www.youtube-nocookie.com/embed/${id}?${p}`
}

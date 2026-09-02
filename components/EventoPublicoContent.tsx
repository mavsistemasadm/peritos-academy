// ══════════════════════════════════════════════════════════════════
// components/EventoPublicoContent.tsx — O CONVITE
//
// Esta tela é feita para ser aberta a partir de uma mensagem de WhatsApp, por
// alguém que só viu o título e não sabe onde caiu. Daí a ordem do que ela
// mostra: o que é, quando é, com quem é, e só então o que fazer. E daí ela
// funcionar deslogada.
//
// ⚠️ O botão principal muda com o estado do evento, e não é enfeite: prometer
// "reserve seu lugar" para uma sessão que começou há vinte minutos manda a
// pessoa para o lugar errado no único momento em que ela precisava do lugar
// certo.
// ══════════════════════════════════════════════════════════════════
'use client'

import { useEffect, useState, useTransition } from 'react'
import { reservarLugar } from '@/app/agenda/actions'
import type { EventoPublico } from '@/lib/queries/evento-publico'
import { inscreverNoEvento } from '@/app/evento/[slug]/actions'
import { urlEmbedYoutube } from '@/lib/video/youtube'
import ChatDoEvento from '@/components/ChatDoEvento'
import { IconeCalendarPlus, IconeCheck, IconePlay, IconeStar, IconeChevronRight, IconeLock, IconeMessageCircle } from '@/components/Icones'
import { AoVivo } from '@/components/Emblemas'

const TZ = 'America/Sao_Paulo'

const TIPO_ROTULO: Record<EventoPublico['tipo'], string> = {
  sala_analise: 'Sala de análise',
  aula_ao_vivo: 'Aula ao vivo',
  plantao: 'Plantão de dúvidas',
  mentoria: 'Mentoria de turma',
  lancamento: 'Lançamento',
}

const fmtHora = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
const fmtDataLonga = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' })
const hora = (iso: string) => fmtHora.format(new Date(iso)).replace(':', 'h')

function duracaoCurta(seg: number) {
  const h = Math.floor(seg / 3600), m = Math.round((seg % 3600) / 60)
  if (h && m) return `${h}h${String(m).padStart(2, '0')}`
  if (h) return `${h}h`
  return `${m}min`
}

function dataPorExtenso(iso: string) {
  const t = fmtDataLonga.format(new Date(iso))
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function linkCalendario(ev: EventoPublico) {
  if (!ev.iniciaEm) return '#'
  const ini = new Date(ev.iniciaEm)
  const fim = new Date(+ini + ev.duracaoSeg * 1000)
  const z = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, '')
  const p = new URLSearchParams({
    action: 'TEMPLATE', text: ev.titulo,
    dates: `${z(ini)}/${z(fim)}`, details: ev.descricao ?? '',
  })
  return `https://calendar.google.com/calendar/render?${p}`
}

/** Endereço do login que devolve a pessoa para cá — ver lib/destino.ts. */
function urlLogin(slug: string, reservando: boolean) {
  const volta = `/evento/${slug}${reservando ? '?reservar=1' : ''}`
  return `/login?next=${encodeURIComponent(volta)}`
}

// ---------- contagem regressiva ----------
function Contagem({ alvoIso }: { alvoIso: string }) {
  const [t, setT] = useState<{ d: string; h: string; m: string; s: string } | null>(null)
  useEffect(() => {
    const alvo = +new Date(alvoIso)
    const tick = () => {
      const total = Math.max(0, Math.floor((alvo - Date.now()) / 1000))
      setT({
        d: String(Math.floor(total / 86400)),
        h: String(Math.floor((total % 86400) / 3600)).padStart(2, '0'),
        m: String(Math.floor((total % 3600) / 60)).padStart(2, '0'),
        s: String(total % 60).padStart(2, '0'),
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [alvoIso])

  // Só depois de montar: o servidor e o navegador nunca leem o mesmo segundo,
  // e renderizar o relógio no HTML daria erro de hidratação toda vez.
  if (!t) return <div className="ev-conta" aria-hidden="true" />

  const mostraDias = t.d !== '0'
  return (
    <div className="ev-conta num" aria-live="off">
      {mostraDias && <div className="ev-conta-b"><span className="v">{t.d}</span><span className="r">{t.d === '1' ? 'dia' : 'dias'}</span></div>}
      <div className="ev-conta-b"><span className="v">{t.h}</span><span className="r">horas</span></div>
      <div className="ev-conta-b"><span className="v">{t.m}</span><span className="r">min</span></div>
      {!mostraDias && <div className="ev-conta-b"><span className="v">{t.s}</span><span className="r">seg</span></div>}
    </div>
  )
}


// ══════════════════════════════════════════════════════════════════
// A TRANSMISSÃO, DENTRO DA PÁGINA
//
// Quando a transmissão é do YouTube, o vídeo toca aqui — a pessoa não é
// mandada para o YouTube e não volta de lá (não volta mesmo: o YouTube é uma
// máquina de oferecer o próximo vídeo, e o próximo vídeo nunca é o nosso).
//
// A transmissão continua acontecendo no YouTube, via OBS e chave de
// transmissão, como sempre. O que muda é só onde ela é assistida.
//
// ⚠️ Isto só vale para YouTube. Zoom e Meet recusam ser enquadrados e
// renderizariam um retângulo em branco — por isso idDoYoutube() devolve null
// para eles e a página cai no botão "Entrar na sala".
// ══════════════════════════════════════════════════════════════════
function Transmissao({ ev, youtubeId, aoVivo, podeFalarNoChat }: {
  ev: EventoPublico; youtubeId: string; aoVivo: boolean; podeFalarNoChat: boolean
}) {
  const comChat = ev.chatModo !== 'nenhum'
  // O chat do YouTube exige saber em que domínio está sendo embutido, e o
  // domínio precisa bater com o de verdade — daí ser lido do navegador em vez
  // de vir do servidor: assim vale igual em produção, em preview e em
  // qualquer domínio futuro, sem ninguém ter que lembrar de atualizar nada.
  const [dominio, setDominio] = useState<string | null>(null)
  useEffect(() => { setDominio(window.location.hostname) }, [])

  // O chat do YouTube só existe durante a transmissão; o nosso vale também
  // para quem chega na gravação e quer perguntar.
  const mostraChat = comChat && (ev.chatModo === 'proprio' || (aoVivo && !!dominio))

  return (
    <div className={`ev-transmissao${mostraChat ? ' com-chat' : ''}`}>
      <div className="ev-player">
        <iframe
          src={urlEmbedYoutube(youtubeId, { autoplay: aoVivo })}
          title={ev.titulo}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>

      {mostraChat && ev.chatModo === 'proprio' && (
        <ChatDoEvento
          eventoId={ev.id}
          inicial={ev.chat}
          podeFalar={podeFalarNoChat}
          podeModerar={ev.ehDaCasa}
          motivoBloqueio={ev.logado
            ? 'Reserve seu lugar acima para falar no chat.'
            : 'Deixe seu nome e email acima para falar no chat.'}
        />
      )}

      {mostraChat && ev.chatModo === 'youtube' && dominio && (
        <div className="ev-chat">
          <div className="ev-chat-cab"><IconeMessageCircle size={13} strokeWidth={2} /> Chat da transmissão</div>
          <iframe
            src={`https://www.youtube.com/live_chat?v=${youtubeId}&embed_domain=${dominio}`}
            title="Chat da transmissão"
          />
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// INSCRIÇÃO DE QUEM NÃO É ALUNO
//
// Aparece só em live marcada como aberta ao público.
//
// ⚠️ O WHATSAPP É OBRIGATÓRIO NA INSCRIÇÃO ANTECIPADA, e isso mudou em
// 02/09/2026 por decisão do dono. Ele era opcional pelo argumento de que cada
// campo a mais é gente a menos — verdade que continua valendo, e é por isso
// que o custo está escrito aqui: alguma inscrição se perde.
//
// O que ele compra é maior. O telefone é a SEGUNDA CHAVE da porta da aula
// única (ver lib/evento/porta.ts): sem ele sobra só o e-mail, e criar e-mail
// novo é grátis — a regra viraria enfeite na segunda semana. E é o telefone
// que vira `contatos.telefone` na base do Nexus, onde a operação inteira fala
// por WhatsApp.
//
// ⚠️ DURANTE A TRANSMISSÃO ELE CONTINUA FORA DA TELA, e a exceção é
// deliberada: ali a pessoa quer perguntar AGORA, e o terceiro campo é o que a
// faz desistir. Quem entra no meio da live já está dentro — o custo de perdê-la
// na porta é maior que o de ficar sem a segunda chave dela.
// ══════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════
// A SEGUNDA VEZ — a recusa que vende
//
// Quem chega aqui já assistiu um encontro inteiro e voltou para pedir o
// próximo. É o lead mais quente que esta página produz, e por isso a recusa
// nunca é um "não" seco: ela DIZ A VERDADE sobre por que a porta fechou e
// mostra, ali mesmo, como continuar entrando.
//
// ⚠️ A frase não acusa e não insinua abuso. A pessoa fez exatamente o que foi
// convidada a fazer.
// ══════════════════════════════════════════════════════════════════
function PortaFechada({ nome, nexusLink }: { nome: string; nexusLink: string }) {
  const primeiro = nome.trim().split(' ')[0]
  return (
    <div className="ev-porta" role="status">
      <span className="ev-porta-eyebrow">Sua aula aberta já foi usada</span>
      <h3>
        {primeiro ? `${primeiro}, você já esteve ` : 'Você já esteve '}
        <span className="grad-txt">em um destes encontros.</span>
      </h3>
      <p>
        O primeiro é aberto para qualquer pessoa. Os seguintes acontecem toda semana e são
        para quem é aluno da Peritos Academy ou assinante do Nexxus Pericial — junto com os
        cursos, as ferramentas e o acervo inteiro.
      </p>
      <div className="ev-porta-acao">
        <a className="btn btn-primario" href={nexusLink} target="_blank" rel="noreferrer">
          Ver como entrar <IconeChevronRight size={13} strokeWidth={2.4} />
        </a>
        <a className="btn btn-fantasma" href="/login">Já sou aluno, quero entrar</a>
      </div>
      <p className="ev-porta-nota">
        Se você já é aluno ou assinante e caiu aqui, provavelmente usou outro email.
        Entre pela sua conta e o lugar já estará reservado.
      </p>
    </div>
  )
}

function FormaInscricao({ eventoId, aoVivo, aoInscrever, nexusLink }: {
  eventoId: string; aoVivo: boolean; aoInscrever: () => void; nexusLink: string
}) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [erro, setErro] = useState('')
  const [portaFechada, setPortaFechada] = useState(false)
  const [pendente, start] = useTransition()

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    // `required` no input já barra o vazio; esta guarda é para o número curto
    // demais para ser telefone, que o navegador aceita e a base não usa.
    if (!aoVivo && whatsapp.replace(/[^0-9]/g, '').length < 10) {
      setErro('Confira o WhatsApp: faltam dígitos. Use DDD e número.')
      return
    }
    start(async () => {
      const r = await inscreverNoEvento({ eventoId, nome, email, whatsapp })
      if (r.ok) { aoInscrever(); return }
      // ⚠️ "Já usou a aula gratuita" NÃO é erro de formulário. Pintá-lo de
      // vermelho ao lado do botão trata como engano o que é a regra
      // funcionando — e joga fora a melhor conversa de venda deste funil.
      if (r.motivo === 'aula_gratuita_usada') { setPortaFechada(true); return }
      setErro(r.erro)
    })
  }

  if (portaFechada) return <PortaFechada nome={nome} nexusLink={nexusLink} />

  return (
    <form className={`ev-forma${aoVivo ? ' no-ar' : ''}`} onSubmit={enviar}>
      <p className="ev-forma-cab">
        {/* ⚠️ Durante a transmissão, o pedido é UM só e é o que a pessoa quer
            agora: falar. A versão anterior prometia "o material e os próximos
            encontros", que é uma segunda oferta disputando atenção com a única
            que a página deveria estar fazendo no fim, a do ecossistema. Duas
            ofertas na mesma tela não somam: dividem. */}
        {aoVivo
          ? <><b>Quer perguntar?</b> Deixe seu nome e email para falar no chat.</>
          : 'Deixe seu nome e email e eu te aviso na véspera e na hora de começar.'}
      </p>
      <label className="ev-campo">
        <span>Seu nome</span>
        <input value={nome} onChange={e => setNome(e.target.value)} required autoComplete="name" placeholder="Como você quer ser chamado" />
      </label>
      <label className="ev-campo">
        <span>Seu melhor email</span>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" placeholder="voce@email.com" />
      </label>
      {/* Durante a transmissão, o terceiro campo é o que faz a pessoa desistir:
          ela quer perguntar agora, não preencher cadastro. Ver o cabeçalho. */}
      {!aoVivo && (
        <label className="ev-campo">
          <span>Seu WhatsApp</span>
          <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} required autoComplete="tel" placeholder="(00) 00000-0000" inputMode="tel" />
        </label>
      )}
      {erro && <p className="ev-erro" role="alert">{erro}</p>}
      <button type="submit" className="btn btn-primario" disabled={pendente}>
        {pendente ? 'Confirmando…' : aoVivo ? 'Entrar no chat' : 'Quero participar'}
      </button>
      <p className="ev-forma-rodape">
        É de graça e não precisa criar conta. Uso seu email e seu WhatsApp para avisar deste encontro
        e dos próximos, e todo email tem link de descadastro.
      </p>
    </form>
  )
}


// ══════════════════════════════════════════════════════════════════
// O CONVITE AO ECOSSISTEMA
//
// Esta é a única tela da plataforma que uma pessoa de fora abre por vontade
// própria, sabendo o que veio ver e disposta a ficar. Desperdiçar isso com
// um rodapé institucional seria pagar o anúncio e não dizer o que se vende.
//
// ⚠️ Fica DEPOIS do convite do encontro, nunca antes. Quem chegou veio pela
// live; interromper com uma oferta antes de a pessoa conseguir se inscrever é
// o erro que a própria plataforma já documentou ao decidir o que sai da home
// do acesso parcial — o que ele clica fica, o que o interrompe na porta sai.
//
// Some para quem já está logado: aluno não precisa que expliquem a casa.
// ══════════════════════════════════════════════════════════════════
/**
 * Os seis produtos, com o nome, a logo e a cor que cada um já tem na casa.
 *
 * ⚠️ As cores foram tiradas DAS PRÓPRIAS LOGOS, uma a uma, e não da lista de
 * cores que o projeto do Nexus mantém em `app/obrigado/page.tsx`: aquela lista
 * está trocada em pelo menos três produtos (dá azul para o Galácticos, que é
 * rosa; laranja para o Financeiro, que é lilás). Cor de marca é reconhecida
 * antes de o nome ser lido, então errá-la custa mais do que não usar nenhuma.
 *
 * As logos foram copiadas para `public/nexus/` em
 * vez de referenciadas no servidor de imagens do WordPress deles, porque esta
 * página é aberta por gente de fora e uma imagem hospedada noutro domínio que
 * saia do ar deixa o cartão furado sem nada avisando.
 *
 * A frase de cada um é a DOR, não a funcionalidade. Quem lê isto não sabe o
 * que é um CRM; sabe muito bem o que é perder um prazo.
 */
const FERRAMENTAS: { nome: string; dor: string; logo: string; cor: string }[] = [
  { nome: 'Galácticos IA', dor: 'Leem o processo e montam o esqueleto do laudo', logo: '/nexus/logo-galacticos.png', cor: '#C972A5' },
  { nome: 'Opera CRM', dor: 'Cada nomeação e cada prazo num lugar só', logo: '/nexus/logo-opera.png', cor: '#4A0DBF' },
  { nome: 'Financeiro MH', dor: 'Honorário cobrado, recebido e conferido', logo: '/nexus/logo-financeiro.png', cor: '#9A8CFB' },
  { nome: 'MH Ponto', dor: 'Cartão de ponto apurado em minutos', logo: '/nexus/logo-ponto.png', cor: '#12805F' },
  { nome: 'Peritos Academy', dor: 'Onde se aprende a fazer tudo isso', logo: '/nexus/logo-peritos.png', cor: '#7EE3CE' },
  { nome: 'Ache um Perito', dor: 'O juiz encontra você antes do concorrente', logo: '/nexus/logo-ache-um-perito.png', cor: '#8B4BE0' },
]

// ══════════════════════════════════════════════════════════════════
// A OFERTA ENQUANTO A LIVE ACONTECE
//
// O `ConviteNexus` mora no PÉ da página: ele fecha a visita de quem chegou pelo
// convite e ainda não decidiu nada. Durante a transmissão isso não alcança
// ninguém — a pessoa está com o vídeo aberto, olhando para o meio da tela, e
// não vai rolar até o rodapé enquanto você fala.
//
// Esta faixa é a mesma oferta no momento em que ela é dita em voz alta. Fica
// logo abaixo do player, no fio do olho.
//
// ⚠️ SÓ APARECE PARA QUEM JÁ ESTÁ INSCRITO. Quem ainda não entrou está vendo o
// formulário, e formulário e oferta na mesma tela não somam: dividem, e a
// pessoa abre sempre o que pede menos dela — perdendo a inscrição, que é o
// único dado que sobrevive ao fim da live.
//
// ⚠️ E SÓ PARA QUEM NÃO ESTÁ LOGADO, pela mesma regra do ConviteNexus: aluno
// não precisa que expliquem a casa, e assinante vendo a própria compra
// anunciada como condição de entrada é o jeito mais rápido de azedar quem já
// está dentro.
// ══════════════════════════════════════════════════════════════════
function OfertaAoVivo({ link }: { link: string }) {
  return (
    <aside className="ev-oferta-vivo">
      <div>
        <span className="ev-oferta-eyebrow">Enquanto você assiste</span>
        <b>Este encontro é uma hora. O ecossistema é o ano inteiro.</b>
        <span className="ev-oferta-linha">
          Peritos Academy completa, Opera para o comercial, Financeiro, agentes de IA,
          MH Ponto e Ache um Perito — a partir de 12x de R$124,83.
        </span>
      </div>
      <a className="btn btn-primario" href={link} target="_blank" rel="noreferrer">
        Ver a condição de entrada <IconeChevronRight size={13} strokeWidth={2.4} />
      </a>
    </aside>
  )
}

function ConviteNexus({ link, nomePlataforma }: { link: string; nomePlataforma: string }) {
  return (
    <section className="ev-nexus">
      <div className="ev-nexus-cab">
        <span className="ev-nexus-eyebrow">Quem está por trás deste encontro</span>
        <h2>O trabalho do perito não acaba<br /><span className="grad-txt">quando o laudo começa.</span></h2>
        <p>
          Cálculo que não fecha, prazo que aparece do nada, honorário que ninguém cobra, nomeação que não
          chega. O <b>Nexxus Pericial</b> é o conjunto de ferramentas que resolve cada uma dessas partes,
          e a <b>{nomePlataforma}</b> é uma delas.
        </p>
      </div>

      <ul className="ev-nexus-grade">
        {FERRAMENTAS.map(f => (
          // A cor entra por custom property para o CSS usá-la em três lugares
          // (borda, brilho e nome) sem repetir o valor em cada um.
          <li key={f.nome} style={{ '--cor-app': f.cor } as React.CSSProperties}>
            <img src={f.logo} alt="" aria-hidden="true" />
            <div>
              <b>{f.nome}</b>
              <span>{f.dor}</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="ev-nexus-acao">
        <a className="btn btn-primario" href={link} target="_blank" rel="noreferrer">
          Conhecer o Nexxus Pericial <IconeChevronRight size={13} strokeWidth={2.4} />
        </a>
        <a className="btn btn-fantasma" href="/login">Já sou aluno, quero entrar</a>
      </div>
    </section>
  )
}

export default function EventoPublicoContent({ ev }: { ev: EventoPublico }) {
  const [reservado, setReservado] = useState(ev.reservado)
  const [inscrito, setInscrito] = useState(ev.inscritoComoConvidado)
  const [erro, setErro] = useState('')
  const [pendente, start] = useTransition()

  function reservar() {
    start(async () => {
      const r = await reservarLugar(ev.id, ev.slug)
      if (r.ok) { setReservado(true); setErro('') }
      else setErro(r.erro ?? 'Não consegui reservar agora. Tente de novo.')
    })
  }

  // Quem clicou em "Reservar" sem sessão foi ao login e voltou com
  // `?reservar=1`. Reservar aqui fecha o gesto que a pessoa já iniciou —
  // obrigá-la a clicar de novo, depois de digitar e-mail e senha, é onde se
  // perde quem estava disposto a vir. O parâmetro sai da URL logo em seguida
  // (mesmo padrão do `?tour=1`), para um F5 não repetir nada.
  useEffect(() => {
    if (!ev.logado || ev.reservado) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('reservar') !== '1') return
    history.replaceState(null, '', `/evento/${ev.slug}`)
    reservar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const vivo = ev.estado === 'ao_vivo'
  // O player só entra quando há o que tocar. Antes da hora, o que a página
  // precisa mostrar é a contagem e o convite — não um quadro preto.
  const mostraTransmissao = !!ev.youtubeId && (vivo || ev.estado === 'gravado')
  // Quem ainda não é aluno e não deixou o email. É a pessoa que a live aberta
  // existe para alcançar.
  const convidadoPendente = ev.abertoAoPublico && !ev.logado && !inscrito
  // A contagem regressiva só existe antes da hora; sem ela o cartão vira uma
  // coluna só, em vez de deixar um vão de 40% da largura ao lado do texto.
  const temLateral = ev.estado === 'agendado' && !!ev.iniciaEm
  // Falar exige estar dentro: aluno que reservou ou convidado que se inscreveu.
  // Ler é de todos. É a mesma linha que separa quem está na sala de quem passou
  // na porta — e é ela que impede o chat de virar caixa de entrada aberta.
  // Quem conduz nunca precisa se inscrever no próprio encontro para responder.
  const podeFalarNoChat = ev.ehDaCasa || (ev.logado && reservado) || (!ev.logado && inscrito)
  const iniciais = ev.apresentadorNome?.split(' ').map(p => p[0]).join('').slice(0, 2)

  return (
    <div className={`pagina-evento${mostraTransmissao ? " com-transmissao" : ""}`}>
      <div className="grao" aria-hidden="true"></div>

      {/* ============ TOPO MÍNIMO ============ */}
      <header className="ev-topo">
        <div className="ev-wrap ev-topo-inner">
          <a className="ev-marca" href="/" aria-label={ev.nomePlataforma}>
            {ev.logoUrl
              ? <img src={ev.logoUrl} alt={ev.nomePlataforma} />
              : <span>peritos<small>academy</small></span>}
          </a>
          {ev.logado
            ? <a className="ev-topo-link" href="/agenda">Ver a agenda completa <IconeChevronRight size={13} strokeWidth={2.4} /></a>
            : <a className="ev-topo-link" href={urlLogin(ev.slug, false)}>Entrar <IconeChevronRight size={13} strokeWidth={2.4} /></a>}
        </div>
      </header>

      {/* ============ O CONVITE ============ */}
      <main className="ev-corpo">
        <div className="ev-wrap">
          <article className={`ev-cartao${vivo ? ' vivo' : ''}${temLateral ? ' com-lateral' : ''}`}>
            {mostraTransmissao ? (
              <Transmissao ev={ev} youtubeId={ev.youtubeId!} aoVivo={vivo} podeFalarNoChat={podeFalarNoChat} />
            ) : ev.imagemUrl ? (
              <div className="ev-capa" style={{ backgroundImage: `url(${ev.imagemUrl})` }} aria-hidden="true" />
            ) : null}

            <div className="ev-info">
              <div className="ev-selos">
                {vivo && <span className="ev-selo-vivo"><AoVivo size={10} /> Ao vivo agora</span>}
                {ev.estado === 'gravado' && <span className="ev-selo-grav">Gravação disponível</span>}
                <span className="ev-selo-tipo">{TIPO_ROTULO[ev.tipo]}</span>
                {ev.alvoRotulo && (
                  <span className="ev-selo-exc"><IconeStar size={11} strokeWidth={2.5} /> Exclusivo · {ev.alvoRotulo}</span>
                )}
              </div>

              <h1>{ev.titulo}</h1>

              {ev.iniciaEm && (
                <p className="ev-quando num">
                  {dataPorExtenso(ev.iniciaEm)} · {hora(ev.iniciaEm)}
                  {' às '}
                  {hora(new Date(+new Date(ev.iniciaEm) + ev.duracaoSeg * 1000).toISOString())}
                  <span className="ev-fuso"> · horário de Brasília · {duracaoCurta(ev.duracaoSeg)}</span>
                </p>
              )}

              {ev.descricao && <p className="ev-desc">{ev.descricao}</p>}

              {ev.apresentadorNome && (
                <div className="ev-quem">
                  <span className="ev-foto" aria-hidden="true">{iniciais}</span>
                  <span>
                    <b>{ev.apresentadorNome}</b>
                    {ev.apresentadorCargo && <span>{ev.apresentadorCargo}</span>}
                  </span>
                </div>
              )}

              {ev.metaExtra && <p className="ev-extra">{ev.metaExtra}</p>}

              {/* ---------- AÇÃO ----------

                  ⚠️ RESERVAR CONTINUA POSSÍVEL DEPOIS QUE A LIVE COMEÇA.

                  Este bloco inteiro vivia dentro de `estado === 'agendado'`, e
                  o efeito só aparecia na hora do encontro: às 11h05 o botão
                  sumia da tela, para todo mundo. O convidado ainda tinha o
                  formulário (ele fica fora desta fila), mas o ALUNO LOGADO que
                  não reservou antes ficava sem caminho nenhum — enquanto o
                  rodapé do chat continuava dizendo "Reserve seu lugar acima
                  para falar no chat", apontando para um botão que não existia
                  mais. Ele lia, procurava, e não achava.

                  É a hora em que mais gente chega, e falar no chat É o produto
                  desta live: sem pauta fechada, quem não pergunta não participa.

                  O que continua preso a `agendado` é só o "Adicionar ao
                  calendário": marcar na agenda um encontro que já começou não
                  serve para nada. */}
              <div className="ev-acoes">
                {(ev.estado === 'agendado' || vivo) && (
                  <>
                    {/* Aluno logado: reserva com um clique, como na agenda. */}
                    {ev.logado && reservado && (
                      <span className="btn ev-reservado"><IconeCheck size={14} strokeWidth={2.4} /> Seu lugar está reservado</span>
                    )}
                    {ev.logado && !reservado && (
                      <button className="btn btn-primario" onClick={reservar} disabled={pendente}>
                        {pendente ? 'Reservando…' : vivo ? 'Entrar e falar no chat' : 'Reservar meu lugar'}
                      </button>
                    )}

                    {/* Convidado que já deixou o email: nada mais a pedir. */}
                    {!ev.logado && ev.abertoAoPublico && inscrito && (
                      <span className="btn ev-reservado"><IconeCheck size={14} strokeWidth={2.4} /> Você está inscrito</span>
                    )}

                    {/* Encontro fechado e visitante sem conta: o caminho é o login. */}
                    {!ev.logado && !ev.abertoAoPublico && (
                      <a className="btn btn-primario" href={urlLogin(ev.slug, true)}>
                        Reservar meu lugar <IconeChevronRight size={13} strokeWidth={2.4} />
                      </a>
                    )}

                    {!convidadoPendente && ev.estado === 'agendado' && (
                      <a className="btn btn-fantasma" href={linkCalendario(ev)} target="_blank" rel="noreferrer">
                        <IconeCalendarPlus size={14} strokeWidth={2} /> Adicionar ao calendário
                      </a>
                    )}
                  </>
                )}

                {/* Ao vivo fora do YouTube (Zoom, Meet): não dá para embutir,
                    então o que existe é a porta. */}
                {vivo && !mostraTransmissao && (ev.linkTransmissao
                  ? <a className="btn btn-primario" href={ev.linkTransmissao} target="_blank" rel="noreferrer">Entrar na sala agora</a>
                  : <a className="btn btn-primario" href={urlLogin(ev.slug, false)}><IconeLock size={14} strokeWidth={2} /> Entrar para acessar a sala</a>
                )}

                {ev.estado === 'gravado' && !mostraTransmissao && (ev.gravacaoUrl
                  ? <a className="btn btn-primario" href={ev.gravacaoUrl} target="_blank" rel="noreferrer"><IconePlay size={14} strokeWidth={2} /> Assistir à gravação</a>
                  : <a className="btn btn-primario" href={urlLogin(ev.slug, false)}><IconeLock size={14} strokeWidth={2} /> Entrar para assistir</a>
                )}

                {ev.estado === 'encerrado' && (
                  <a className="btn btn-fantasma" href="/agenda">Ver os próximos eventos</a>
                )}
              </div>

              {/* A inscrição do convidado fica FORA da fila de botões: é um
                  formulário, e um formulário espremido entre pílulas some. */}
              {convidadoPendente && ev.estado !== 'encerrado' && (
                <FormaInscricao eventoId={ev.id} aoVivo={vivo} aoInscrever={() => setInscrito(true)} nexusLink={ev.nexusLink} />
              )}

              {/* A oferta no meio da live, para quem já entrou. Ver o cabeçalho
                  de OfertaAoVivo para as duas condições e o porquê de cada uma. */}
              {vivo && !ev.logado && inscrito && <OfertaAoVivo link={ev.nexusLink} />}

              {/* ══════════════════════════════════════════════════
                  O QUE ESPERAR, DITO NA HORA EM QUE A PESSOA SE COMPROMETE

                  Sem isto, o botão vira "Reservado" e o assunto morre ali: a
                  pessoa não sabe se vai ser lembrada, por onde, nem se
                  precisa anotar em algum lugar. O texto é diferente para quem
                  tem conta e para quem não tem porque os canais são
                  diferentes, e prometer o sino a quem não tem login seria
                  prometer uma tela que ela não vai abrir.
                  ══════════════════════════════════════════════════ */}
              {inscrito && !ev.logado && ev.abertoAoPublico && ev.estado === 'agendado' && (
                <p className="ev-nota">
                  <b>Confirmação enviada para o seu email.</b> Fique de olho na caixa de entrada:
                  eu aviso amanhã, na manhã do dia, uma hora antes e quando estivermos entrando no ar.
                  Se não achar, olhe em promoções ou spam e marque como &quot;não é spam&quot;.
                </p>
              )}

              {reservado && ev.logado && ev.estado === 'agendado' && (
                <p className="ev-nota">
                  <b>Seu lugar está guardado.</b> Você recebe os lembretes por email e também aqui na
                  plataforma, no sino: um dia antes, na manhã do dia, uma hora antes e quando a
                  transmissão entrar no ar.
                </p>
              )}

              {erro && <p className="ev-erro" role="alert">{erro}</p>}

              {ev.estado === 'encerrado' && (
                <p className="ev-nota">Este encontro já aconteceu. Se ele for gravado, a gravação aparece aqui e na agenda.</p>
              )}

              {ev.confirmados > 0 && ev.estado === 'agendado' && (
                <p className="ev-confirmados num">
                  <b>{ev.confirmados}</b> {ev.confirmados === 1 ? 'colega já confirmou' : 'colegas já confirmaram'} presença
                  {reservado && ' · você está dentro'}
                </p>
              )}
            </div>

            {temLateral && ev.iniciaEm && (
              <aside className="ev-lateral">
                <span className="ev-rot">Começa em</span>
                <Contagem alvoIso={ev.iniciaEm} />
                {!ev.logado && (
                  <p className="ev-lateral-nota">
                    {ev.abertoAoPublico
                      ? 'Leva um minuto e garante o lembrete na véspera e na hora de começar.'
                      : 'Reservar leva um minuto e garante o lembrete antes de começar.'}
                  </p>
                )}
              </aside>
            )}
          </article>

          {!ev.logado && <ConviteNexus link={ev.nexusLink} nomePlataforma={ev.nomePlataforma} />}
        </div>
      </main>
    </div>
  )
}

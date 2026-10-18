// ══════════════════════════════════════════════════════
// QUAIS AVISOS DO SINO TAMBÉM TOCAM NO CELULAR — 17/10/2026
//
// O celular é do aluno pelo Nexus: a Academy não guarda aparelho nenhum, e
// manda pela central de notificações de lá (`notificarNoNexus`, em
// lib/integracoes/nexus.ts). Quem dispara é o banco: o gatilho
// `trg_push_ao_notificar` chama /api/internal/push a cada linha nova em
// `notificacoes`, e esta lista decide o que segue.
//
// ⚠️ A REGRA: só o que acontece SEM a pessoa estar na tela. Resposta de
// alguém, correção do professor, live começando. Nível, curso concluído,
// certificado e módulo nascem do clique dela, com o toast e o popup na hora:
// no celular seriam a mesma festa repetida, e o celular que vibra à toa é o
// celular que desliga as notificações. `modulo_concluido` sozinho são 535
// linhas.
//
// A lista mora SÓ aqui, e não no WHEN do gatilho: duas cópias divergem no dia
// em que uma ganhar um tipo que a outra não tem.
// ══════════════════════════════════════════════════════

/** O título curto de cada tipo. O corpo é a frase do sino. */
export const TITULO_DO_PUSH: Record<string, string> = {
  duvida_respondida: 'Sua dúvida foi respondida',
  comunidade_resposta: 'Responderam seu post',
  comunidade_melhor_resposta: 'Sua resposta foi a escolhida',
  desafio_corrigido: 'Seu desafio foi corrigido',
  desafio_convite: 'Você foi convidado para um desafio',
  evento_anuncio: 'Nova live na agenda',
  evento_hoje: 'A live é hoje',
  evento_comecando: 'A live começa em uma hora',
  evento_ao_vivo: 'Estamos ao vivo',
  // Para quem conduz: o link da página da live (e das dúvidas) uma hora antes.
  evento_conduzir: 'Sua live começa em uma hora',
}

export function vaiAoCelular(tipo: string | null | undefined): boolean {
  return !!tipo && Object.prototype.hasOwnProperty.call(TITULO_DO_PUSH, tipo)
}

export interface NotificacaoDoSino {
  id: string
  tipo: string
  prefixo: string | null
  destaque: string | null
  sufixo: string | null
  link_url: string | null
  dados: Record<string, unknown> | null
}

/** O que vai ao Nexus. Puro. */
export function avisoDoPush(n: NotificacaoDoSino) {
  const corpo = `${n.prefixo ?? ''}${n.destaque ?? ''}${n.sufixo ?? ''}`.replace(/\s+/g, ' ').trim()
  const eventoId = typeof n.dados?.evento_id === 'string' ? n.dados.evento_id : null
  return {
    titulo: TITULO_DO_PUSH[n.tipo],
    corpo,
    para: n.link_url?.startsWith('/') ? n.link_url : '/',
    // Os lembretes da mesma live se substituem na tela de bloqueio: "é hoje",
    // "começa em uma hora" e "ao vivo" não viram uma pilha de três.
    tag: eventoId ? `evento:${eventoId}` : undefined,
  }
}

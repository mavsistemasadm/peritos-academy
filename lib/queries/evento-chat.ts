// ══════════════════════════════════════════════════════════════════
// lib/queries/evento-chat.ts — O QUE JÁ FOI DITO NA TRANSMISSÃO
//
// O chat é ao vivo, mas não é efêmero: `evento_mensagens` é tabela, a
// moderação OCULTA sem apagar, e o histórico continua aqui depois que a live
// acaba. Duas razões, e a segunda é a que importa mais:
//
//  · Quem chega no meio precisa ver o que já rolou, senão entra numa conversa
//    sem começo.
//  · **As perguntas do chat são o melhor material de conteúdo que existe.** É
//    a lista, escrita pelos próprios alunos, do que eles não entenderam. Jogar
//    isso fora quando a transmissão acaba seria perder de graça a pauta das
//    próximas aulas.
// ══════════════════════════════════════════════════════════════════
import { criarClienteServidor } from '@/lib/supabase/server'

export type MensagemEvento = {
  id: string
  autorNome: string
  ehApresentador: boolean
  texto: string
  criadoEm: string
  /** Marca a própria mensagem, para a tela destacá-la. */
  minha: boolean
}

/** As últimas mensagens de um evento, em ordem de chegada. */
export async function carregarChatEvento(
  eventoId: string,
  limite = 200,
): Promise<MensagemEvento[]> {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()

  // A RLS já limita a eventos publicados; `oculta_em` é filtrado aqui porque
  // moderação some da TELA, não do registro.
  const { data } = await supabase
    .from('evento_mensagens')
    .select('id, autor_nome, eh_apresentador, texto, criado_em, usuario_id')
    .eq('evento_id', eventoId)
    .is('oculta_em', null)
    .order('criado_em', { ascending: false })
    .limit(limite)

  return (data ?? [])
    .reverse()
    .map(m => ({
      id: m.id,
      autorNome: m.autor_nome,
      ehApresentador: m.eh_apresentador,
      texto: m.texto,
      criadoEm: m.criado_em,
      minha: !!auth?.user && m.usuario_id === auth.user.id,
    }))
}

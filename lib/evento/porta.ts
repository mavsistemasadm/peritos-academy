// ══════════════════════════════════════════════════════════════════
// lib/evento/porta.ts — UMA AULA GRÁTIS PARA QUEM NÃO É DA CASA
//
// A aula ao vivo semanal é aberta: qualquer pessoa reserva lugar sem ter
// conta. Só que ela existe para VENDER, e uma sala em que o não-aluno volta
// toda quarta de graça não vende — ela entrega, semana após semana, aquilo que
// a assinatura deveria dar. Então a régua é: quem não é da casa assiste UMA, e
// a segunda inscrição encontra a oferta no lugar do formulário.
//
// ── O QUE CONTA É A INSCRIÇÃO, NUNCA A PRESENÇA ──
//
// Decisão do dono, em 02/09/2026: "se ela se inscreveu e não veio, é problema
// dela, que perdeu a oportunidade."
//
// E é também a única régua que se sustenta. Presença dependeria de saber quem
// entrou na sala — o que a plataforma não sabe, porque a transmissão é do
// YouTube — e criaria a brecha que se descobre em uma semana: reservar, não
// aparecer, e reservar de novo alegando que não gastou nada. Inscrição é um
// fato que este banco tem e que a própria pessoa produziu.
//
// ── AS DUAS CHAVES, E O QUE CADA UMA ALCANÇA ──
//
// E-mail é a primeira. Telefone é a segunda, e ela existe porque criar e-mail
// novo é grátis e trocar de telefone não — mesma régua de
// `lib/sequencias/identidade.ts` do Nexus, e pelo mesmo motivo.
//
// ⚠️ MAS O TELEFONE É OPCIONAL NO FORMULÁRIO, e durante a transmissão nem é
// pedido. Então a porta fecha para quem se cadastrou direito e continua
// contornável por quem digitar um endereço novo. Isso é ACEITO, não esquecido:
// exigir telefone para assistir uma aula gratuita custa inscrições de verdade,
// e a régua existe para preservar o valor da assinatura, não para vencer uma
// disputa com quem está determinado a burlá-la. Quem cria e-mail novo a cada
// semana também não estava perto de comprar.
//
// ⚠️ NOME NUNCA ENTRA. Homônimo é comum, e a consequência de casar errado aqui
// é dizer "você já usou sua aula" para alguém que nunca assistiu a nenhuma —
// uma acusação, na porta, para um lead que acabou de chegar.
// ══════════════════════════════════════════════════════════════════

/**
 * Telefone no formato canônico de comparação: só dígitos, sem DDI, sem o nono.
 *
 * ⚠️ É a MESMA regra de `normalizarTelefone` do Nexus
 * (`lib/sequencias/identidade.ts`), copiada de propósito e não importada: são
 * dois repositórios que não compilam juntos, e o número normalizado aqui é
 * comparado com o de lá quando o contato atravessa a ponte. Duas réguas
 * diferentes fariam a mesma pessoa ter dois telefones canônicos, e a segunda
 * inscrição passaria batido sem nada acusar.
 *
 * O DDI só cai quando sobra número: "5511..." é DDI + DDD 11, mas "5599999999"
 * pode ser o DDD 55 (RS) com um fixo — cortar ali inventaria um telefone.
 */
export function normalizarTelefone(bruto: string | null | undefined): string | null {
  const digitos = String(bruto ?? '').replace(/[^0-9]/g, '')
  if (!digitos) return null

  let n = digitos
  if ((n.length === 12 || n.length === 13) && n.startsWith('55')) n = n.slice(2)
  // Celular com o nono dígito: DDD (2) + 9 + 8 = 11. O canônico tira o 9.
  if (n.length === 11) n = n.slice(0, 2) + n.slice(-8)

  // Menos que DDD + 8 não identifica ninguém: ramal, número truncado, lixo.
  if (n.length < 10) return null
  // Mais que isso depois da limpeza é número que não entendemos. Melhor não
  // afirmar do que afirmar errado.
  if (n.length > 11) return null

  return n
}

/** E-mail no formato em que a coluna guarda e em que a comparação acontece. */
export function normalizarEmail(bruto: string | null | undefined): string | null {
  const email = String(bruto ?? '').trim().toLowerCase()
  return email.includes('@') ? email : null
}

export type MotivoPorta = 'liberado' | 'aula_gratuita_usada'

export interface EntradaPorta {
  /**
   * Tem acesso vigente na Academy OU assinatura ativa do Nexus.
   *
   * ⚠️ EX-ALUNO SEM ACESSO VIGENTE NÃO É DA CASA, e isso é escolha. Ele é
   * justamente quem queremos de volta, e a aula gratuita é a melhor conversa
   * que existe com ele — então ele entra, uma vez, como qualquer outro.
   */
  ehDaCasa: boolean
  /**
   * Já existe inscrição dele em OUTRO encontro, não cancelada.
   *
   * ⚠️ "Outro" é o ponto: reinscrição no MESMO encontro é a pessoa corrigindo
   * o telefone ou clicando duas vezes, e recusá-la transformaria um acerto em
   * porta na cara.
   */
  jaSeInscreveuAntes: boolean
}

export interface Porta {
  liberado: boolean
  motivo: MotivoPorta
}

/**
 * A régua inteira, e ela é pequena de propósito: quem é da casa nunca é
 * barrado, e quem não é passa uma vez.
 */
export function avaliarPorta({ ehDaCasa, jaSeInscreveuAntes }: EntradaPorta): Porta {
  if (ehDaCasa) return { liberado: true, motivo: 'liberado' }
  if (jaSeInscreveuAntes) return { liberado: false, motivo: 'aula_gratuita_usada' }
  return { liberado: true, motivo: 'liberado' }
}

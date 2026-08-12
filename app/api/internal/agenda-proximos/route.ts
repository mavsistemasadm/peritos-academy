// ══════════════════════════════════════════════════════
// /api/internal/agenda-proximos — OS COMPROMISSOS DA SEMANA, PARA O NEXUS
//
// O painel do Nexus mostra um bloco "Esta semana" com os eventos ao vivo da
// Academy: aula, mentoria, plantão, sala de análise, lançamento. Quem responde
// o que entra nesse bloco é esta rota, e não o Nexus lendo a tabela `eventos`.
//
// ── POR QUE UMA ROTA, E NÃO O NEXUS LENDO O BANCO DAQUI ──
//
// O Nexus tem a service key desta base e conseguiria consultar `eventos`
// direto. Não é o caminho, pelo mesmo motivo que faz o Nexus responder
// `/api/acesso/status` para os outros cinco produtos em vez de cada um decidir
// sozinho quem está inadimplente: **quem tem a regra responde a pergunta.**
//
// A regra aqui é `visibilidade` + `alvo_rotulo` — um evento pode ser de
// `todos`, de um `curso`, de uma `assinatura` ou de uma `turma`. Reimplementar
// isso do outro lado significa duas versões da mesma regra em dois
// repositórios que não compilam juntos, e no primeiro ajuste daqui elas
// divergem. O sintoma seria silencioso e dos dois tipos: aluno vendo evento que
// não é dele, ou não vendo o que é.
//
// ── O QUE ESTA ROTA NÃO DECIDE ──
//
// **Quem vê o bloco no painel do Nexus é decisão do Nexus** (lá, é assinante).
// Esta rota responde "quais eventos esta pessoa pode ver", não "esta pessoa
// merece um painel". Mesma separação de `/api/nexus-sso`: porta, não chave.
//
// ── PESSOA SEM PERFIL AQUI ──
//
// Assinante do Nexus que nunca abriu a Academy não tem perfil nesta base — a
// conta só nasce no primeiro clique do SSO (medido em 12/08/2026: 108
// assinantes, zero perfis). Para eles a resposta são os eventos de
// `visibilidade = 'todos'`, que é a verdade: é o que qualquer pessoa que
// entrasse agora veria. Recusar a resposta inteira deixaria o bloco vazio para
// todo o público a que ele se destina.
//
// ── FUSO ──
//
// A rota devolve `inicia_em` em ISO com offset, como está no banco, e NÃO
// formata nada. Quem escreve a data na tela é o Nexus, com os formatadores de
// `lib/periodo.ts`, que resolvem sempre no relógio de Brasília. Formatar dos
// dois lados criaria duas redações da mesma hora.
// ══════════════════════════════════════════════════════

import { NextResponse, type NextRequest } from "next/server";
import { criarClienteServico } from "@/lib/supabase/servico";

/** Sete dias corridos. A janela do bloco no painel do Nexus. */
const JANELA_DIAS = 7;

/** Teto de itens. Um bloco de painel que rola deixou de ser um resumo. */
const MAX_ITENS = 8;

/**
 * Tipos que são COMPROMISSO — coisa com hora marcada, à qual se comparece.
 *
 * `desafio` fica de fora de propósito: ele tem prazo, não tem hora, e listar
 * "entrega até sexta" junto de "mentoria quinta às 20h" mistura duas coisas
 * que a pessoa faz de maneiras diferentes. Decisão de 12/08/2026; se um dia
 * entrar, entra como bloco próprio.
 */
const TIPOS_COMPROMISSO = [
  "aula_ao_vivo",
  "mentoria",
  "plantao",
  "sala_analise",
  "lancamento",
] as const;

export async function GET(request: NextRequest) {
  const esperado = process.env.NEXUS_AGENDA_KEY;
  const recebido =
    request.headers.get("x-agenda-key") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  // Falha FECHADA: env ausente = ninguém lê a agenda por aqui. Ao contrário do
  // `/api/acesso/status` do Nexus, que falha aberto de propósito, aqui não há
  // nada a perder em recusar — o bloco simplesmente não aparece no painel.
  if (!esperado || recebido !== esperado) {
    return NextResponse.json({ erro: "chave inválida" }, { status: 401 });
  }

  const email = (request.nextUrl.searchParams.get("email") || "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ erro: "email é obrigatório" }, { status: 400 });
  }

  const supabase = criarClienteServico();

  const agora = new Date();
  const limite = new Date(agora.getTime() + JANELA_DIAS * 86_400_000);

  // Só o que já foi publicado, começa daqui para a frente e cabe na janela.
  // `inicia_em` no passado sai mesmo que o evento ainda esteja acontecendo: o
  // bloco responde "o que vem", e um ao vivo em andamento tem lugar próprio
  // (o link de transmissão), não uma linha de agenda.
  const { data: eventos, error } = await supabase
    .from("eventos")
    .select(
      "id, titulo, tipo, inicia_em, duracao_seg, link_transmissao, apresentador_nome, apresentador_cargo, visibilidade, alvo_rotulo"
    )
    .eq("publicado", true)
    .in("tipo", TIPOS_COMPROMISSO)
    .gte("inicia_em", agora.toISOString())
    .lte("inicia_em", limite.toISOString())
    .order("inicia_em", { ascending: true })
    .limit(MAX_ITENS * 3); // folga para o filtro de visibilidade abaixo

  if (error) {
    console.error("[AGENDA-NEXUS] erro ao ler eventos:", error.message);
    return NextResponse.json({ erro: "falha ao ler a agenda" }, { status: 500 });
  }

  // ── Quem é essa pessoa aqui dentro ──
  const { data: perfil } = await supabase
    .from("perfis")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  const visiveis = (eventos ?? []).filter((ev) =>
    podeVer(ev.visibilidade, Boolean(perfil))
  );

  return NextResponse.json({
    ok: true,
    // `false` avisa ao Nexus que a pessoa ainda não existe aqui — ela está
    // vendo só o que é público. Serve para diagnóstico, não muda a tela.
    perfilNaAcademy: Boolean(perfil),
    janelaDias: JANELA_DIAS,
    eventos: visiveis.slice(0, MAX_ITENS).map((ev) => ({
      id: ev.id,
      titulo: ev.titulo,
      tipo: ev.tipo,
      iniciaEm: ev.inicia_em,
      duracaoSeg: ev.duracao_seg,
      apresentador: ev.apresentador_nome,
      apresentadorCargo: ev.apresentador_cargo,
      alvoRotulo: ev.alvo_rotulo,
      // ⚠️ O link da transmissão NÃO vai no corpo. Ele é a sala ao vivo, e o
      // painel do Nexus é outra origem: quem quer entrar passa pela Academy,
      // que confere o acesso. Mandar o link daqui seria contornar a própria
      // fechadura desta plataforma por um caminho lateral.
      temTransmissao: Boolean(ev.link_transmissao),
    })),
  });
}

/**
 * Evento de `todos` é de todos. Qualquer outra visibilidade depende de a
 * pessoa existir aqui dentro.
 *
 * ⚠️ Hoje isto é grosso de propósito: `curso`, `turma` e `assinatura` são
 * tratados igual, e basta ter perfil. O casamento fino (a pessoa está NAQUELE
 * curso, NAQUELA turma) exige as tabelas de matrícula, e não há um único
 * evento publicado para modelar em cima — `eventos` tem 0 linhas em
 * 12/08/2026. Refinar sem caso real produziria uma regra inventada.
 *
 * O erro possível aqui é mostrar ao aluno um evento restrito que não é dele.
 * Ele não ganha acesso com isso: o link não vai no corpo, e a sala confere.
 * Quando o primeiro evento restrito for publicado, esta função é o lugar.
 */
function podeVer(visibilidade: string | null, temPerfil: boolean): boolean {
  if (!visibilidade || visibilidade === "todos") return true;
  return temPerfil;
}

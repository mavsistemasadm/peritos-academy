// lib/queries/avaliacao.ts
// Busca tudo que a página da avaliação/prova precisa — SEM gabarito.
// As questões/opções vêm das views *_publicas, que não expõem
// `correta` nem `resposta_valor`. A correção acontece na RPC
// submeter_avaliacao (ver actions na page.tsx).
import { criarClienteServidor } from "@/lib/supabase/server";

export type OpcaoPublica = {
  id: string;
  ordem: number;
  texto: string;
};

export type QuestaoPublica = {
  id: string;
  ordem: number;
  tipo: "multipla_escolha" | "valor";
  enunciado: string;
  prefixo: string | null; // "R$"
  sufixo: string | null;  // "%"
  opcoes: OpcaoPublica[]; // vazio nas questões de valor
};

export type AvaliacaoInfo = {
  id: string;
  tipo: "avaliacao" | "prova";
  titulo: string;
  descricao: string | null;
  caso_numero: string | null;
  capa_url: string | null;
  xp_total: number; // teto de XP (faixa quiz_100 x peso da avaliação) — o efetivo depende do acerto
  nota_minima: number;
  tema: number;
};

export type GabaritoItem = {
  questao_id: string;
  correta: boolean;
  opcao_marcada: string | null;
  opcao_correta_id: string | null;
  opcao_correta_texto: string | null;
  resposta_valor: number | null;
  valor_informado: number | null;
  parecer: string | null;
  aula_id: string | null;
  aula_ref: string | null;
};

export type ResultadoCorrecao = {
  nota: number;
  acertos: number;
  total: number;
  xp: number;
  aprovado: boolean;
  media_curso: number | null;
  gabarito: GabaritoItem[];
};

export type AvaliacaoDados = {
  curso: { slug: string; titulo: string };
  modulo: { titulo: string; ordem: number } | null;
  avaliacao: AvaliacaoInfo;
  questoes: QuestaoPublica[];
};

export async function getAvaliacao(
  slug: string,
  avaliacaoId: string
): Promise<AvaliacaoDados | null> {
  const supabase = await criarClienteServidor();

  const { data: curso } = await supabase
    .from("cursos")
    .select("id, slug, titulo")
    .eq("slug", slug)
    .eq("publicado", true)
    .single();
  if (!curso) return null;

  const { data: av } = await supabase
    .from("avaliacoes")
    .select(
      "id, tipo, titulo, briefing, numero_caso, capa_url, peso, nota_minima, tema, modulo_id"
    )
    .eq("id", avaliacaoId)
    .eq("curso_id", curso.id)
    .eq("publicado", true)
    .single();
  if (!av) return null;

  const { data: faixaMax } = await supabase
    .from("gamificacao_gatilhos")
    .select("pontos")
    .eq("codigo", "quiz_100")
    .maybeSingle();

  let modulo: AvaliacaoDados["modulo"] = null;
  if (av.modulo_id) {
    const { data: mod } = await supabase
      .from("modulos")
      .select("titulo, ordem")
      .eq("id", av.modulo_id)
      .single();
    if (mod) modulo = { titulo: mod.titulo, ordem: mod.ordem };
  }

  const { data: questoes } = await supabase
    .from("avaliacao_questoes_publicas")
    .select("id, ordem, tipo, enunciado, prefixo, sufixo")
    .eq("avaliacao_id", av.id)
    .order("ordem");
  if (!questoes || questoes.length === 0) return null;

  const { data: opcoes } = await supabase
    .from("avaliacao_opcoes_publicas")
    .select("id, questao_id, ordem, texto")
    .in("questao_id", questoes.map((q) => q.id))
    .order("ordem");

  const porQuestao = new Map<string, OpcaoPublica[]>();
  (opcoes ?? []).forEach((o) => {
    const lista = porQuestao.get(o.questao_id) ?? [];
    lista.push({ id: o.id, ordem: o.ordem, texto: o.texto });
    porQuestao.set(o.questao_id, lista);
  });

  return {
    curso: { slug: curso.slug, titulo: curso.titulo },
    modulo,
    avaliacao: {
      id: av.id,
      tipo: av.tipo,
      titulo: av.titulo,
      descricao: av.briefing,           // coluna real: briefing
      caso_numero: av.numero_caso,      // coluna real: numero_caso
      capa_url: av.capa_url,
      xp_total: (faixaMax?.pontos ?? 60) * Math.max(av.peso ?? 1, 1), // teto: faixa quiz_100 x peso
      nota_minima: Number(av.nota_minima ?? 7),
      tema: av.tema ?? 0,
    },
    questoes: questoes.map((q) => ({
      id: q.id,
      ordem: q.ordem,
      tipo: q.tipo,
      enunciado: q.enunciado,
      prefixo: q.prefixo,
      sufixo: q.sufixo,
      opcoes: porQuestao.get(q.id) ?? [],
    })),
  };
}
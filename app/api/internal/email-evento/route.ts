// app/api/internal/email-evento/route.ts
// Ponte entre triggers de banco (via pg_net, ver creditar_gamificacao,
// criar_perfil, gam_trg_certificados) e o envio de email de verdade. Só
// chamável com o segredo guardado no Supabase Vault (EMAIL_INTERNAL_SECRET
// aqui, public.email_internal_secret() no banco) — nunca alcançável por um
// usuário comum. Único lugar que sabe montar os dados dinâmicos de cada
// tipo; os triggers só mandam {tipo, usuario_id, ref_id}.
import { NextResponse, type NextRequest } from "next/server";
import { criarClienteServico } from "@/lib/supabase/servico";
import { enviarEmail, type TipoEmail } from "@/lib/email/enviar";
import { emailBoasVindas } from "@/lib/email/templates/boasVindas";
import { emailNivelUp } from "@/lib/email/templates/nivelUp";
import { emailCertificado } from "@/lib/email/templates/certificado";

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] || nome;
}

function diasDesde(dataIso: string): number {
  const dias = Math.floor((Date.now() - new Date(dataIso).getTime()) / 86_400_000);
  return Math.max(0, dias);
}

function formatarDataBr(data: Date): string {
  return data.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export async function POST(request: NextRequest) {
  const tokenEsperado = process.env.EMAIL_INTERNAL_SECRET;
  const tokenRecebido = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!tokenEsperado || tokenRecebido !== tokenEsperado) {
    return NextResponse.json({ erro: "token inválido" }, { status: 401 });
  }

  let body: { tipo?: string; usuario_id?: string; ref_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erro: "payload inválido" }, { status: 400 });
  }

  const { tipo, usuario_id: usuarioId, ref_id: refId } = body;
  if (!tipo || !usuarioId) {
    return NextResponse.json({ erro: "tipo e usuario_id são obrigatórios" }, { status: 400 });
  }

  const supabase = criarClienteServico();
  const { data: perfil } = await supabase
    .from("perfis")
    .select("nome, xp, criado_em")
    .eq("id", usuarioId)
    .maybeSingle();
  if (!perfil) return NextResponse.json({ ok: false, motivo: "perfil não encontrado" });

  const nomePrimeiro = primeiroNome(perfil.nome);

  try {
    if (tipo === "boas_vindas") {
      const { assunto, html } = emailBoasVindas({ primeiroNome: nomePrimeiro });
      const resultado = await enviarEmail({
        usuarioId,
        tipo: "boas_vindas" as TipoEmail,
        assunto,
        html,
        remetente: "pessoal",
      });
      return NextResponse.json(resultado);
    }

    if (tipo === "nivel_up") {
      const ordem = Number(refId);
      if (!ordem || ordem < 2) return NextResponse.json({ ok: false, motivo: "ordem inválida" });

      const { count: aulasConcluidas } = await supabase
        .from("aula_progresso")
        .select("id", { count: "exact", head: true })
        .eq("usuario_id", usuarioId)
        .eq("concluida", true);

      let avaliacoesAprovadas: number | undefined;
      let desafiosEntregues: number | undefined;
      if (ordem === 10) {
        const { data: tentativas } = await supabase
          .from("avaliacao_tentativas")
          .select("avaliacao_id")
          .eq("usuario_id", usuarioId)
          .eq("aprovado", true);
        avaliacoesAprovadas = new Set((tentativas ?? []).map((t) => t.avaliacao_id)).size;

        const { count: desafios } = await supabase
          .from("desafio_entregas")
          .select("id", { count: "exact", head: true })
          .eq("usuario_id", usuarioId)
          .not("entregue_em", "is", null);
        desafiosEntregues = desafios ?? 0;
      }

      const template = emailNivelUp(ordem, {
        primeiroNome: nomePrimeiro,
        xpTotal: perfil.xp ?? 0,
        diasDeJornada: diasDesde(perfil.criado_em),
        aulasConcluidas: aulasConcluidas ?? 0,
        avaliacoesAprovadas,
        desafiosEntregues,
      });
      if (!template) return NextResponse.json({ ok: false, motivo: "template de nível não encontrado" });

      const resultado = await enviarEmail({
        usuarioId,
        tipo: "nivel_up" as TipoEmail,
        refId: String(ordem),
        assunto: template.assunto,
        html: template.html,
        remetente: "pessoal",
      });
      return NextResponse.json(resultado);
    }

    if (tipo === "certificado") {
      const cursoId = refId;
      if (!cursoId) return NextResponse.json({ ok: false, motivo: "curso_id ausente" });

      const { data: curso } = await supabase
        .from("cursos")
        .select("titulo, contexto_certificado")
        .eq("id", cursoId)
        .maybeSingle();
      if (!curso) return NextResponse.json({ ok: false, motivo: "curso não encontrado" });

      const { data: aulas } = await supabase
        .from("aulas")
        .select("duracao_seg, modulos!inner(curso_id)")
        .eq("modulos.curso_id", cursoId);
      const totalAulas = aulas?.length ?? 0;
      const totalHoras = Math.round((aulas ?? []).reduce((s, a) => s + (a.duracao_seg ?? 0), 0) / 3600);

      const { data: tentativas } = await supabase
        .from("avaliacao_tentativas")
        .select("avaliacao_id, avaliacoes!inner(curso_id)")
        .eq("usuario_id", usuarioId)
        .eq("aprovado", true)
        .eq("avaliacoes.curso_id", cursoId);
      const totalAvaliacoes = new Set((tentativas ?? []).map((t) => t.avaliacao_id)).size;

      const { assunto, html } = emailCertificado({
        primeiroNome: nomePrimeiro,
        nomeCompleto: perfil.nome,
        cursoNome: curso.titulo,
        totalAulas,
        totalHoras,
        totalAvaliacoes,
        dataConclusao: formatarDataBr(new Date()),
        contextoCertificado: curso.contexto_certificado,
      });

      const resultado = await enviarEmail({
        usuarioId,
        tipo: "certificado" as TipoEmail,
        refId: cursoId,
        assunto,
        html,
        remetente: "pessoal",
      });
      return NextResponse.json(resultado);
    }

    return NextResponse.json({ ok: false, motivo: "tipo desconhecido" }, { status: 400 });
  } catch (e) {
    console.error("[email-evento] erro inesperado", tipo, e);
    return NextResponse.json({ ok: false, motivo: "erro_inesperado" }, { status: 500 });
  }
}

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
import { emailCursoConcluido } from "@/lib/email/templates/cursoConcluido";

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
      // Níveis 2-4 celebram só no toast/sino — email de nível é só a partir
      // do 5 (regra de produto: email em todo nível viraria spam). O gate
      // real já está na fonte (creditar_gamificacao só chama esse endpoint
      // para ordem >= 5); esta checagem é defesa em profundidade.
      if (!ordem || ordem < 5) return NextResponse.json({ ok: false, motivo: "nivel abaixo do minimo para email" });

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

      // Dado real do próximo nível (nunca hardcoded) — ausente no nível 10.
      let proximoNivelNome: string | undefined;
      let proximoNivelFaltamXp: number | undefined;
      const { data: status } = await supabase.rpc("gam_status_proximo_nivel", { p_usuario: usuarioId });
      const proximo = (status as { proximo_nivel?: { nome: string; xp_necessario: number; xp_atual: number } } | null)?.proximo_nivel;
      if (proximo) {
        proximoNivelNome = proximo.nome;
        proximoNivelFaltamXp = Math.max(0, proximo.xp_necessario - proximo.xp_atual);
      }

      // Se essa subida de nível veio junto de uma conclusão de curso no
      // mesmo evento (o mesmo creditar_gamificacao('concluir_curso', ...)
      // que dispara isso), menciona no corpo em vez de mandar 2 emails.
      let cursoConcluidoJunto: string | undefined;
      const { data: concluidoRecente } = await supabase
        .from("gamificacao_extrato")
        .select("referencia_id, criado_em")
        .eq("usuario_id", usuarioId)
        .eq("gatilho_codigo", "concluir_curso")
        .gte("criado_em", new Date(Date.now() - 2 * 60_000).toISOString())
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (concluidoRecente?.referencia_id) {
        const { data: cursoRecente } = await supabase
          .from("cursos")
          .select("titulo")
          .eq("id", concluidoRecente.referencia_id)
          .maybeSingle();
        cursoConcluidoJunto = cursoRecente?.titulo;
      }

      const template = emailNivelUp(ordem, {
        primeiroNome: nomePrimeiro,
        xpTotal: perfil.xp ?? 0,
        diasDeJornada: diasDesde(perfil.criado_em),
        aulasConcluidas: aulasConcluidas ?? 0,
        avaliacoesAprovadas,
        desafiosEntregues,
        proximoNivelNome,
        proximoNivelFaltamXp,
        cursoConcluidoJunto,
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

    if (tipo === "curso_concluido") {
      const cursoId = refId;
      if (!cursoId) return NextResponse.json({ ok: false, motivo: "curso_id ausente" });

      const { data: curso } = await supabase.from("cursos").select("titulo").eq("id", cursoId).maybeSingle();
      if (!curso) return NextResponse.json({ ok: false, motivo: "curso não encontrado" });

      const { data: proximoRaw } = await supabase.rpc("gam_proximo_curso_trilha", { p_curso_id: cursoId });
      const proximo = proximoRaw as { titulo: string; slug: string; mesma_trilha: boolean } | null;

      const { assunto, html } = emailCursoConcluido({
        primeiroNome: nomePrimeiro,
        cursoNome: curso.titulo,
        proximoCurso: proximo ? { titulo: proximo.titulo, slug: proximo.slug, mesmaTrilha: proximo.mesma_trilha } : null,
      });

      const resultado = await enviarEmail({
        usuarioId,
        tipo: "curso_concluido" as TipoEmail,
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

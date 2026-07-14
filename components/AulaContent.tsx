"use client";
// components/AulaContent.tsx
// Página da aula — réplica fiel do template aprovado (peritos-academy-aula.html),
// 100% plugada no Supabase.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { AulaCompleta, Anotacao, Duvida, Material } from "@/lib/queries/aula";
import NavPlataforma from '@/components/NavPlataforma'
import type { DadosNav } from '@/lib/queries/nav'
import { verificarCertificado, baixarMaterialAula, concluirAula } from '@/app/curso/[slug]/aula/[aulaId]/actions'
import {
  IconeChevronLeft, IconeChevronRight, IconePlay, IconeCheck, IconeDownload, IconeSend, IconeHeadset, IconeAlertTriangle,
  IconeFileText, IconeBarChart, IconePaperclip, IconeLock,
} from '@/components/Icones'
import { Certificado, XP } from '@/components/Emblemas'


let _sb: SupabaseClient | null = null;
function sb() {
  if (!_sb) {
    _sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _sb;
}

/* ---------- helpers de formatação ---------- */
const fmtSeg = (s: number) => {
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
};
const fmtDurSeg = (seg: number) => {
  const min = Math.round(seg / 60);
  if (min >= 60) {
    const h = Math.floor(min / 60), m = min % 60;
    return `${h}h${m ? ` ${m}min` : ""}`;
  }
  return `${min} min`;
};
const fmtQuando = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return "hoje";
  if (d === 1) return "ontem";
  return `há ${d} dias`;
};

export default function AulaContent({ dados, usuarioId, usuarioNome, nav, avisoBloqueio }: {
  dados: AulaCompleta;
  usuarioId: string | null;
  usuarioNome: string | null;
  nav: DadosNav;
  avisoBloqueio?: boolean;
}) {
  const router = useRouter();
  const { curso, modulo, aula, capitulos, materiais, trilho, anterior, proxima, proximoModulo } = dados;
  const admin = nav.isAdmin;

  /* ---------- estado ---------- */
  const [abaAtiva, setAbaAtiva] = useState("sobre");
  const [teatro, setTeatro] = useState(false);
  const [concluida, setConcluida] = useState(aula.concluida);
  const [concluindo, setConcluindo] = useState(false);
  const [pendenciaMsg, setPendenciaMsg] = useState<string | null>(null);
  const [progresso, setProgresso] = useState(dados.progressoCurso);
  const [toast, setToast] = useState(false);
  const [pulso, setPulso] = useState(false);
  const [proxVisivel, setProxVisivel] = useState(false);
  const [contador, setContador] = useState<number | string>(5);
  const [anotacoes, setAnotacoes] = useState<Anotacao[]>(dados.anotacoes);
  const [duvidas, setDuvidas] = useState<Duvida[]>(dados.duvidas);
  const [certPopup, setCertPopup] = useState<{ numero: string; curso: string; nota?: number } | null>(null)
  const [notaTxt, setNotaTxt] = useState("");
  const [duvidaTxt, setDuvidaTxt] = useState("");
  const [segundosAssistidos, setSegundosAssistidos] = useState(dados.aula.segundosAssistidos);
  const [materiaisBaixados, setMateriaisBaixados] = useState<Set<string>>(new Set(dados.materiaisBaixadosIds));
  const [avisoVisivel, setAvisoVisivel] = useState(!!avisoBloqueio);

  /* ---------- player (Panda Video via iframe) ---------- */
  const playerRef = useRef<HTMLDivElement>(null);
  const notaTaRef = useRef<HTMLTextAreaElement>(null);
  const regressivaRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const segundosRef = useRef(dados.aula.segundosAssistidos);

  const seek = (_s: number) => {
    /* seek no iframe do Panda exige o SDK do player — reativar na próxima fase */
  };

  /* teatro → classe no body */
  useEffect(() => {
    document.body.classList.toggle("teatro", teatro);
    return () => document.body.classList.remove("teatro");
  }, [teatro]);

  /* atalho N abre anotações */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (e.key.toLowerCase() === "n" && !["TEXTAREA", "INPUT"].includes(tag)) {
        e.preventDefault();
        setAbaAtiva("notas");
        setTimeout(() => notaTaRef.current?.focus(), 50);
      }
    };
    addEventListener("keydown", h);
    return () => removeEventListener("keydown", h);
  }, []);

  useEffect(() => () => { if (regressivaRef.current) clearInterval(regressivaRef.current); }, []);

  /* aviso de "aula bloqueada" (veio de um redirect por acesso direto via URL) */
  useEffect(() => {
    if (!avisoBloqueio) return;
    const t = setTimeout(() => setAvisoVisivel(false), 6000);
    return () => clearTimeout(t);
  }, [avisoBloqueio]);

  /* ---------- tracking do Panda Video via postMessage ----------
     O player do Panda envia eventos (panda_timeupdate, panda_pause, panda_ended)
     por postMessage independente de usarmos o SDK deles — só ouvimos o
     window "message". Só contamos incrementos pequenos e positivos entre dois
     timeupdate (< 2s) como "assistido de verdade": isso ignora saltos de seek
     pra frente (não dá pra arrastar a barra até 70% sem assistir) sem penalizar
     replays. Persiste em aula_progresso.segundos_assistidos a cada ~10s, e
     imediatamente em pause/ended/saída da página. É best-effort (cliente),
     mas a validação dos 70% pra CONCLUIR a aula é sempre no servidor (RPC
     concluir_aula) — ver CLAUDE.md, seção Progressão sequencial. */
  useEffect(() => {
    if (!aula.video_url || !usuarioId) return;
    let ultimoTempo = 0;
    let ultimoPersist = 0;

    const persistir = (forcar = false) => {
      const agora = Date.now();
      if (!forcar && agora - ultimoPersist < 10000) return;
      ultimoPersist = agora;
      sb().from("aula_progresso")
        .upsert({ usuario_id: usuarioId, aula_id: aula.id, segundos_assistidos: Math.floor(segundosRef.current) })
        .then(() => {});
    };

    const onMessage = (e: MessageEvent) => {
      const data = e.data;
      if (!data || typeof data !== "object" || typeof data.message !== "string" || !data.message.startsWith("panda_")) return;

      if (data.message === "panda_timeupdate" && typeof data.currentTime === "number") {
        const t = data.currentTime;
        const delta = t - ultimoTempo;
        ultimoTempo = t;
        if (delta > 0 && delta < 2) {
          const novo = aula.duracaoSeg ? Math.min(aula.duracaoSeg, segundosRef.current + delta) : segundosRef.current + delta;
          segundosRef.current = novo;
          setSegundosAssistidos(novo);
          persistir();
        }
      } else if (data.message === "panda_pause") {
        persistir(true);
      } else if (data.message === "panda_ended") {
        const novo = aula.duracaoSeg || segundosRef.current;
        segundosRef.current = novo;
        setSegundosAssistidos(novo);
        persistir(true);
      }
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      persistir(true);
    };
  }, [aula.id, aula.video_url, aula.duracaoSeg, usuarioId]);

  /* ---------- critérios de conclusão ---------- */
  const pctVideo = aula.duracaoSeg > 0 ? Math.min(100, Math.round((segundosAssistidos / aula.duracaoSeg) * 100)) : 100;
  const videoOk = !aula.video_url || aula.duracaoSeg === 0 || pctVideo >= 70;
  const materiaisComArquivo = materiais.filter((m) => m.arquivo_url);
  const materiaisPendentes = materiaisComArquivo.filter((m) => !materiaisBaixados.has(m.id));
  const criteriosOk = videoOk && materiaisPendentes.length === 0;
  const podeConcluir = admin || criteriosOk;
  const mostrarChecklist = !concluida && (!!aula.video_url || materiaisComArquivo.length > 0);

  const tituloPendencia = (() => {
    if (concluida || podeConcluir) return undefined;
    const itens: string[] = [];
    if (!videoOk) itens.push("assista pelo menos 70% da aula");
    materiaisPendentes.forEach((m) => itens.push(`baixe "${m.nome}"`));
    return `Para concluir: ${itens.join(" · ")}`;
  })();

  const marcarMaterialBaixado = (materialId: string) => {
    setMateriaisBaixados((prev) => {
      if (prev.has(materialId)) return prev;
      const novo = new Set(prev);
      novo.add(materialId);
      return novo;
    });
  };

  /* ---------- ações plugadas no banco ---------- */
  const marcarConcluida = async () => {
    if (concluida || concluindo) return;
    if (!usuarioId) { alert("Entre na sua conta para registrar o progresso."); return; }
    if (!podeConcluir) return; // botão já vem desabilitado nesse estado — defesa extra
    setConcluindo(true);
    const r = await concluirAula(aula.id);
    setConcluindo(false);
    if (!r.ok) {
      const itens: string[] = [];
      if (r.video_ok === false) itens.push("assista pelo menos 70% da aula");
      (r.materiais_pendentes ?? []).forEach((m) => itens.push(`baixe "${m.nome}"`));
      setPendenciaMsg(itens.length ? `Ainda falta: ${itens.join(" · ")}` : (r.erro ?? "Ainda não dá pra concluir esta aula."));
      setTimeout(() => setPendenciaMsg(null), 5000);
      return;
    }
    setConcluida(true);
    setProgresso((p) => {
      const c = p.concluidas + 1;
      const xp = p.xpTotal + aula.xp;
      return { ...p, concluidas: c, pct: Math.round((c / p.total) * 100), xpTotal: xp, nivel: Math.floor(xp / 100) + 1 };
    });
    setPulso(true); setTimeout(() => setPulso(false), 700);
    setToast(true); setTimeout(() => setToast(false), 3800);

// verifica se completou o curso e emite certificado
    const cert = await verificarCertificado(curso.id)
    if (cert.gerado) {
      sessionStorage.setItem('cert-popup-aberto', '1')
      setCertPopup({ numero: cert.numero!, curso: cert.curso_titulo!, nota: cert.nota })
    }

    if (proxima) {
      setProxVisivel(true);
      let s = 5; setContador(s);
      regressivaRef.current = setInterval(() => {
        s--;
        if (s <= 0) {
          clearInterval(regressivaRef.current!);
          setContador("→");
          router.push(`/curso/${curso.slug}/aula/${proxima.id}`);
        } else setContador(s);
      }, 1000);
    }
  };
  const fecharCertPopup = () => {
    sessionStorage.removeItem('cert-popup-aberto');
    setCertPopup(null);
  };
  const ficar = () => { if (regressivaRef.current) clearInterval(regressivaRef.current); setProxVisivel(false); };
  const irAgora = () => {
    if (regressivaRef.current) clearInterval(regressivaRef.current);
    if (proxima) router.push(`/curso/${curso.slug}/aula/${proxima.id}`);
  };

  const salvarNota = async () => {
    const texto = notaTxt.trim();
    if (!texto) return;
    if (!usuarioId) { alert("Entre na sua conta para salvar anotações."); return; }
    const tempo_seg = 0;
    const { data, error } = await sb()
      .from("aula_anotacoes")
      .insert({ aula_id: aula.id, usuario_id: usuarioId, tempo_seg, texto })
      .select().single();
    if (error) { console.error(error); return; }
    setAnotacoes((n) => [data as Anotacao, ...n]);
    setNotaTxt("");
  };

  const enviarDuvida = async () => {
    const texto = duvidaTxt.trim();
    if (!texto) return;
    if (!usuarioId) { alert("Entre na sua conta para enviar dúvidas."); return; }
    const nome = usuarioNome ?? "Aluno";
    const iniciais = nome.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
    const { data, error } = await sb()
      .from("aula_duvidas")
      .insert({
        aula_id: aula.id, usuario_id: usuarioId, autor_nome: nome, autor_iniciais: iniciais,
        tempo_seg: 0, texto,
      }).select().single();
    if (error) { console.error(error); return; }
    setDuvidas((d) => [{ ...(data as Duvida), respostas: [] }, ...d]);
    setDuvidaTxt("");
  };

  /* ---------- derivados ---------- */
  const anel = 75.4;
  const mm = String(modulo.ordem).padStart(2, "0");
  const totalDuvidas = duvidas.reduce((s, d) => s + 1 + (d.respostas?.length ?? 0), 0);
  const faltamModulo = modulo.totalAulas - modulo.concluidasNoModulo - (concluida && !aula.concluida ? 1 : 0);
  const momento = "00:00";
  const proximaLiberada = proxima ? (admin || concluida) : false;

  return (
    <div style={{ ["--arte" as string]: aula.capa_url ? `url('${aula.capa_url}')` : "none" }}>
      <div className="grao" aria-hidden="true"></div>

      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <linearGradient id="gradAnel" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#20D9A6" /><stop offset="55%" stopColor="#36DCD1" /><stop offset="100%" stopColor="#DDF784" />
          </linearGradient>
        </defs>
      </svg>

      {/* ============ NAV ============ */}
      <NavPlataforma dados={nav} />

      {/* barra contextual da aula */}
      <div className="nav-aula-ctx">
        <div className="nav-inner">
          <Link className="nav-contexto" href={`/curso/${curso.slug}`} aria-label="Voltar para o curso">
            <IconeChevronLeft size={14} strokeWidth={2.4} style={{ flexShrink: 0, color: "var(--cinza)" }} />
            <span className="curso">{curso.titulo}</span>
            <span className="sep">/</span>
            <span className="aula-atual num">Módulo {mm} · Aula {aula.ordem} de {modulo.totalAulas}</span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)" }}>
            <div className="nav-progresso" title={`Progresso do curso: ${progresso.pct}%`}>
              <svg className="mini-anel" viewBox="0 0 30 30" aria-hidden="true">
                <circle className="t" cx="15" cy="15" r="12" />
                <circle className="f" cx="15" cy="15" r="12" style={{ strokeDashoffset: anel * (1 - progresso.pct / 100) }} />
              </svg>
              <span className="num">{progresso.pct}%</span>
            </div>
          </div>
        </div>
      </div>

      <main className="palco-area">
        <div className="wrap">
          <div className="palco-grid">

            {/* ============ COLUNA PRINCIPAL ============ */}
            <div>
              {/* PLAYER */}
              <div className="palco">
                <div className="luz" aria-hidden="true"></div>
                <div className="player" ref={playerRef} aria-label={`Player de vídeo — ${aula.titulo}`}>
                  {aula.video_url ? (
                    <iframe
                      className="player-el"
                      src={aula.video_url}
                      title={aula.titulo}
                      allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <>
                      <div className="player-video" aria-hidden="true"></div>
                      <div className="player-veu" aria-hidden="true"></div>
                      <span className="cap-atual num">Vídeo em breve</span>
                      <span className="play-grande" aria-hidden="true">
                        <IconePlay size={26} />
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* AVISO: acesso direto a aula bloqueada foi redirecionado pra cá */}
              {avisoBloqueio && (
                <div className={`aviso-bloqueio${avisoVisivel ? " visivel" : ""}`} role="status">
                  <IconeLock size={14} strokeWidth={2.2} />
                  <span>Conclua as aulas anteriores para desbloquear a que você tentou acessar.</span>
                </div>
              )}

              {/* TÍTULO + AÇÕES */}
              <div className="aula-cab">
                <div className="aula-cab-txt">
                  <span className="eyebrow">Módulo {mm} · <b>{modulo.titulo}</b></span>
                  <h1>{aula.titulo}</h1>
                </div>
                <div className="aula-acoes">
                  {anterior ? (
                    <Link className="btn btn-fantasma btn-nav-aula" href={`/curso/${curso.slug}/aula/${anterior.id}`} aria-label="Aula anterior">
                      <IconeChevronLeft size={14} strokeWidth={2.4} />
                    </Link>
                  ) : null}
                  <button
                    className={`btn btn-fantasma btn-concluir${concluida ? " feito" : ""}${!concluida && !podeConcluir ? " aguardando" : ""}`}
                    onClick={marcarConcluida}
                    disabled={!concluida && (!podeConcluir || concluindo)}
                    title={tituloPendencia}
                  >
                    <span className="rotulo-b">
                      <IconeCheck size={14} strokeWidth={2.6} />
                      <span>{concluida ? "Concluída" : concluindo ? "Concluindo…" : `Marcar como concluída · +${aula.xp} XP`}</span>
                    </span>
                  </button>
                  {proxima ? (
                    proximaLiberada ? (
                      <Link className="btn btn-primario btn-nav-aula" href={`/curso/${curso.slug}/aula/${proxima.id}`} aria-label="Próxima aula">
                        Próxima
                        <IconeChevronRight size={14} strokeWidth={2.4} />
                      </Link>
                    ) : (
                      <span className="btn btn-fantasma btn-nav-aula bloqueado" aria-disabled="true" title="Conclua esta aula para desbloquear a próxima">
                        <IconeLock size={13} strokeWidth={2.2} />
                      </span>
                    )
                  ) : null}
                </div>
              </div>

              {/* PENDÊNCIA: mensagem de tom mentor quando o clique não vinga (defesa extra) */}
              {pendenciaMsg && (
                <div className="pendencia-msg" role="status">
                  <IconeAlertTriangle size={14} strokeWidth={2.2} />
                  <span>{pendenciaMsg}</span>
                </div>
              )}

              {/* CHECKLIST: critérios pra concluir a aula, ao vivo */}
              {mostrarChecklist && (
                <div className="checklist-conclusao">
                  <span className="checklist-titulo">Para concluir esta aula</span>
                  <ul>
                    {aula.video_url && (
                      <li className={videoOk ? "feito" : ""}>
                        <span className="checklist-ico" aria-hidden="true">
                          {videoOk ? <IconeCheck size={13} strokeWidth={2.4} /> : <IconePlay size={12} strokeWidth={2.2} />}
                        </span>
                        <span className="checklist-txt">Assistir a aula</span>
                        <span className="checklist-valor num">{videoOk ? "concluído ✓" : `${pctVideo}% de 70%`}</span>
                      </li>
                    )}
                    {materiaisComArquivo.map((m) => {
                      const feito = materiaisBaixados.has(m.id);
                      return (
                        <li key={m.id} className={feito ? "feito" : ""}>
                          <span className="checklist-ico" aria-hidden="true">
                            {feito ? <IconeCheck size={13} strokeWidth={2.4} /> : <IconeDownload size={12} strokeWidth={2.2} />}
                          </span>
                          <span className="checklist-txt">{m.nome}</span>
                          <span className="checklist-valor num">{feito ? "baixado ✓" : "pendente"}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* CELEBRAÇÃO: PRÓXIMA AULA */}
              {proxima && (
                <div className={`prox-aula${proxVisivel ? " visivel" : ""}`} role="status">
                  <div className={`prox-anel${proxVisivel ? " rodando" : ""}`}>
                    <svg viewBox="0 0 52 52" aria-hidden="true"><circle className="t" cx="26" cy="26" r="23" /><circle className="f" cx="26" cy="26" r="23" /></svg>
                    <b className="num">{contador}</b>
                  </div>
                  <div className="prox-txt">
                    <span className="rot">A seguir</span>
                    <b>{proxima.titulo}</b>
                    <span className="num">{fmtDurSeg(proxima.duracaoSeg)}</span>
                  </div>
                  <button className="btn btn-primario" onClick={irAgora}>Ir agora</button>
                  <button className="btn btn-fantasma" onClick={ficar}>Ficar aqui</button>
                </div>
              )}

              {/* ABAS */}
              <div className="abas-area">
                <div className="abas" role="tablist" aria-label="Conteúdo da aula">
                  {[
                    { id: "sobre", label: "Sobre a aula" },
                    { id: "materiais", label: "Materiais", badge: materiais.length },
                    { id: "notas", label: "Minhas anotações", badge: anotacoes.length },
                    { id: "duvidas", label: "Dúvidas", badge: totalDuvidas },
                    { id: "suporte", label: "Suporte" },
                  ].map((a) => (
                    <button key={a.id} className="aba" role="tab" aria-selected={abaAtiva === a.id}
                      aria-controls={`p-${a.id}`} id={`a-${a.id}`} onClick={() => setAbaAtiva(a.id)}>
                      {a.label}{a.badge ? <span className="badge num">{a.badge}</span> : null}
                    </button>
                  ))}
                </div>

                {/* SOBRE */}
                <div className={`painel-aba sobre${abaAtiva === "sobre" ? " ativo" : ""}`} id="p-sobre" role="tabpanel" aria-labelledby="a-sobre">
                  {aula.sobre.map((p, i) => <p key={i}>{p}</p>)}
                  {capitulos.length > 0 && (
                    <ol className="capitulos-lista">
                      {capitulos.map((c) => (
                        <li key={c.id}>
                          <button onClick={() => seek(c.tempo_seg)}>
                            <span className="cap-tempo num">{fmtSeg(c.tempo_seg)}</span><b>{c.titulo}</b>
                          </button>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                {/* MATERIAIS */}
                <div className={`painel-aba${abaAtiva === "materiais" ? " ativo" : ""}`} id="p-materiais" role="tabpanel" aria-labelledby="a-materiais">
                  {materiais.length === 0 ? (
                    <p className="meta">Nenhum material anexado a esta aula ainda.</p>
                  ) : (
                    <ul className="arquivos">
                      {materiais.map((m) => (
                        <MaterialItem key={m.id} material={m} baixado={materiaisBaixados.has(m.id)} onBaixado={marcarMaterialBaixado} />
                      ))}
                    </ul>
                  )}
                </div>

                {/* ANOTAÇÕES */}
                <div className={`painel-aba${abaAtiva === "notas" ? " ativo" : ""}`} id="p-notas" role="tabpanel" aria-labelledby="a-notas">
                  <div className="anotar">
                    <span className="momento num" title="A anotação fica ancorada neste momento do vídeo">{momento}</span>
                    <textarea ref={notaTaRef} value={notaTxt} onChange={(e) => setNotaTxt(e.target.value)}
                      placeholder="Anotar neste momento da aula…" aria-label={`Nova anotação ancorada em ${momento}`} />
                    <button className="enviar" onClick={salvarNota} aria-label="Salvar anotação">
                      <IconeCheck size={15} strokeWidth={2.4} />
                    </button>
                  </div>
                  <p className="dica-tecla">Dica: pressione <kbd>N</kbd> durante o vídeo para anotar sem pausar o raciocínio.</p>
                  <ul className="notas">
                    {anotacoes.map((n) => (
                      <li className="nota" key={n.id}>
                        <button className="nota-tempo num" title={`Ir para ${fmtSeg(n.tempo_seg)}`} onClick={() => seek(n.tempo_seg)}>{fmtSeg(n.tempo_seg)}</button>
                        <p>{n.texto}</p>
                        <span className="quando">{fmtQuando(n.criada_em)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* DÚVIDAS */}
                <div className={`painel-aba${abaAtiva === "duvidas" ? " ativo" : ""}`} id="p-duvidas" role="tabpanel" aria-labelledby="a-duvidas">
                  <div className="anotar" style={{ marginBottom: "var(--s-4)" }}>
                    <span className="momento num">{momento}</span>
                    <textarea value={duvidaTxt} onChange={(e) => setDuvidaTxt(e.target.value)}
                      placeholder="Pergunte sobre este momento da aula…" aria-label={`Nova dúvida ancorada em ${momento}`} />
                    <button className="enviar" onClick={enviarDuvida} aria-label="Enviar dúvida">
                      <IconeSend size={15} strokeWidth={2.2} />
                    </button>
                  </div>

                  {duvidas.map((d) => (
                    <div className="duvida" key={d.id}>
                      <span className="foto-p" aria-hidden="true">{d.autor_iniciais}</span>
                      <div className="duvida-corpo">
                        <div className="quem">
                          <b>{d.autor_nome}</b>
                          {d.tempo_seg != null && (
                            <button className="marca-tempo num" onClick={() => seek(d.tempo_seg!)}>{fmtSeg(d.tempo_seg)}</button>
                          )}
                          <time>{fmtQuando(d.criada_em)}</time>
                        </div>
                        <p>{d.texto}</p>
                        <div className="duvida-acoes"><button>Responder</button><button>Útil · {d.uteis}</button></div>
                        {(d.respostas ?? []).map((r) => (
                          <div className="resposta" style={{ marginTop: 14 }} key={r.id}>
                            <span className="foto-p" aria-hidden="true">{r.autor_iniciais}</span>
                            <div className="duvida-corpo">
                              <div className="quem">
                                <b>{r.autor_nome}</b>
                                {r.e_especialista && <span className="selo-esp">Especialista</span>}
                                <time>{fmtQuando(r.criada_em)}</time>
                              </div>
                              <p>{r.texto}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* SUPORTE */}
                <div className={`painel-aba${abaAtiva === "suporte" ? " ativo" : ""}`} id="p-suporte" role="tabpanel" aria-labelledby="a-suporte">
                  <div className="suporte-grid">
                    <button className="suporte-opcao">
                      <span className="sup-ico" aria-hidden="true">
                        <IconeHeadset size={19} strokeWidth={2} />
                      </span>
                      <b>Falar com o suporte</b>
                      <span>Dúvida técnica ou de acesso. Resposta média em 2h úteis.</span>
                    </button>
                    <button className="suporte-opcao">
                      <span className="sup-ico" aria-hidden="true">
                        <IconeAlertTriangle size={19} strokeWidth={2} />
                      </span>
                      <b>Reportar um problema</b>
                      <span>Vídeo, áudio ou material com erro nesta aula.</span>
                    </button>
                  </div>
                  <p className="contexto-nota">
                    <IconeCheck size={14} strokeWidth={2} style={{ color: "var(--verde)" }} />
                    Seu chamado já vai com o contexto anexado:
                    <span className="chip-ctx">Aula · {aula.titulo}</span>
                    <span className="chip-ctx num">Momento · {momento}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* ============ TRILHO DO MÓDULO ============ */}
            <aside className="trilho-aulas" aria-label="Aulas deste módulo">
              <div className="trilho-cab">
                <span className="eyebrow">Módulo {mm} · <b>Você está aqui</b></span>
                <h2>{modulo.titulo}</h2>
                <p className="meta num">{modulo.concluidasNoModulo + (concluida && !aula.concluida ? 1 : 0)} de {modulo.totalAulas} concluídas · {fmtDurSeg(modulo.duracaoModuloSeg)}</p>
              </div>
              <ul className="trilho-lista">
                {trilho.map((t) => {
                  const feita = t.concluida || (t.atual && concluida);
                  const efetivamenteBloqueada = t.bloqueada && !t.atual && !feita && !admin;
                  const cls = `t-aula${feita ? " feita" : ""}${t.atual ? " atual" : ""}${efetivamenteBloqueada ? " bloqueada" : ""}`;
                  return (
                    <li className={cls} key={t.id}>
                      <Link
                        href={`/curso/${curso.slug}/aula/${t.id}`}
                        aria-current={t.atual || undefined}
                        aria-disabled={efetivamenteBloqueada || undefined}
                        title={efetivamenteBloqueada ? "Conclua a aula anterior para desbloquear" : undefined}
                        onClick={(e) => { if (efetivamenteBloqueada) e.preventDefault(); }}
                      >
                        <span className={`t-estado${!feita && !t.atual ? " num" : ""}`} aria-hidden="true">
                          {efetivamenteBloqueada ? <IconeLock size={11} strokeWidth={2.2} />
                            : t.atual && !feita ? <span className="eq"><i></i><i></i><i></i></span>
                            : feita ? <IconeCheck size={12} /> : t.ordem}
                        </span>
                        <span className="t-txt">
                          <b>{t.titulo}</b>
                          <span>{t.atual ? "Assistindo agora" : feita ? "Assistida" : efetivamenteBloqueada ? "Bloqueada" : t.tipo === "quiz" ? "Quiz do módulo" : fmtDurSeg(t.duracaoSeg)}</span>
                        </span>
                        <span className="t-dur num">{fmtDurSeg(t.duracaoSeg)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {proximoModulo && (
                <>
                  <div className="trilho-divisor"><span>A seguir</span></div>
                  <Link className="prox-mod" href={`/curso/${curso.slug}`}>
                    <span className="num-mod num" aria-hidden="true">{String(proximoModulo.ordem).padStart(2, "0")}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <b>{proximoModulo.titulo}</b>
                      <span className="num">{proximoModulo.totalAulas} aulas · {fmtDurSeg(proximoModulo.duracaoModuloSeg)}</span>
                    </span>
                    <IconeChevronRight size={14} strokeWidth={2.2} style={{ color: "var(--cinza)", flexShrink: 0 }} />
                  </Link>
                </>
              )}
            </aside>

          </div>
        </div>
      </main>

{/* toast de XP */}
      <div className={`toast-xp${toast ? " visivel" : ""}`} role="status">
        <span className="xp num"><XP size={14} /> +{aula.xp} XP</span>
        <span>Aula concluída{faltamModulo > 0 ? ` · faltam ${faltamModulo} para o módulo` : " · módulo completo!"}</span>
      </div>

      {/* popup de certificado */}
      {certPopup && (
        <div className="cert-popup-overlay" onClick={fecharCertPopup}>
          <div className="cert-popup" onClick={e => e.stopPropagation()}>
            <div className="cert-popup-confete" aria-hidden="true">
              {Array.from({ length: 40 }).map((_, i) => (
                <span key={i} className="confete" style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 0.8}s`,
                  animationDuration: `${1.5 + Math.random() * 1.5}s`,
                  background: ['#20D9A6','#36DCD1','#DDF784','#F1F2DF','#E0776B'][Math.floor(Math.random() * 5)],
                  width: `${4 + Math.random() * 6}px`,
                  height: `${4 + Math.random() * 6}px`,
                }} />
              ))}
            </div>
            <div className="cert-popup-body">
              <div className="cert-popup-selo">
                <Certificado size={48} />
              </div>
              <h2>Certificado emitido!</h2>
              <p className="cert-popup-curso">{certPopup.curso}</p>
              {certPopup.nota && <p className="cert-popup-nota num">Nota final: <b>{certPopup.nota.toFixed(1).replace('.', ',')}</b></p>}
              <p className="cert-popup-num num">Nº {certPopup.numero}</p>
              <p className="cert-popup-desc">Seu certificado já está disponível no seu perfil e pode ser verificado publicamente.</p>
              <div className="cert-popup-acoes">
                <a className="btn btn-primario" href="/perfil#certificados">Ver meus certificados</a>
                <button className="btn btn-fantasma" onClick={fecharCertPopup}>Continuar estudando</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ICONE_POR_TIPO: Record<string, typeof IconeFileText> = {
  pdf: IconeFileText,
  xlsx: IconeBarChart,
  docx: IconeFileText,
  zip: IconePaperclip,
  outro: IconePaperclip,
};

function MaterialItem({ material, baixado, onBaixado }: { material: Material; baixado: boolean; onBaixado: (materialId: string) => void }) {
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const Icone = ICONE_POR_TIPO[material.tipo] ?? IconePaperclip;

  async function onBaixar(e: React.MouseEvent) {
    e.preventDefault();
    setErro(null);
    setBaixando(true);
    const r = await baixarMaterialAula(material.id);
    setBaixando(false);
    if (!r.ok) { setErro(r.erro); return; }
    onBaixado(material.id);
    window.open(r.url, "_blank");
  }

  return (
    <li className="arquivo">
      <a href="#" onClick={onBaixar} aria-disabled={baixando}>
        <span className={`arq-ico ${material.tipo}`} aria-hidden="true">
          <Icone size={20} strokeWidth={1.6} />
        </span>
        <span className="arq-txt"><b>{material.nome}</b><span>{erro ?? material.descricao}</span></span>
        <span className={`arq-baixar${baixado ? " feito" : ""}`}>
          {baixado ? <IconeCheck size={13} strokeWidth={2.4} /> : <IconeDownload size={13} strokeWidth={2.2} />}
          {baixando ? "Gerando link..." : baixado ? "Baixado" : "Baixar"}
        </span>
      </a>
    </li>
  );
}

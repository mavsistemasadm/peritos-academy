"use client";

import { useEffect, useRef, useState } from "react";
import NavPlataforma from '@/components/NavPlataforma'
import type { DadosNav } from '@/lib/queries/nav'
import { IconeChevronLeft, IconePlay, IconePlus, IconeCheck, IconeLock, IconeAlertTriangle, IconeClipboard } from '@/components/Icones'
import { Certificado } from '@/components/Emblemas'

type Aula = {
  id: string;
  titulo: string;
  descricao: string | null;
  duracao_seg: number;
  ordem: number;
  xp: number;
  tipo?: string | null;
  concluida: boolean;
  atual: boolean;
  bloqueada: boolean;
  motivoBloqueio: string | null;
};

type Avaliacao = {
  id: string;
  numeroCaso: string | null;
  titulo: string;
  nQuestoes: number;
  notaMinima: number;
  estado: "aprovada" | "disponivel" | "bloqueada";
  nota: number | null;
};

type Modulo = {
  id: string;
  titulo: string;
  ordem: number;
  aulas: Aula[];
  avaliacoes: Avaliacao[];
  totalAulas: number;
  concluidasNoModulo: number;
  duracaoModuloSeg: number;
  xpModulo: number;
  bloqueado: boolean;
  estado: "concluido" | "bloqueado" | "andamento" | "nao_iniciado";
  ehAtual: boolean;
  motivoBloqueio: string | null;
};

type ProximoPasso =
  | { tipo: "aula"; aulaId: string; titulo: string }
  | { tipo: "avaliacao"; avaliacaoId: string; numeroCaso: string | null; titulo: string }
  | { tipo: "nenhum" };

type Curso = {
  id: string;
  slug: string;
  titulo: string;
  subtitulo: string | null;
  capa_url: string | null;
  capa_horizontal_url: string | null;
  nivel: string | null;
  trilha_nome?: string | null;
  etapa_nome?: string | null;
  instrutor_nome?: string | null;
  instrutor_titulo?: string | null;
  instrutor_iniciais?: string | null;
  citacao?: string | null;
  objetivos?: string[] | null;
};

type Conquista = {
  id: string;
  slug: string;
  nome: string;
  descricao: string;
  xp: number;
  icone: string | null;
  ordem: number;
};

type Progresso = {
  concluidas: number;
  total: number;
  pct: number;
  duracaoTotalSeg: number;
  xpTotal: number;
  xpTotalAvaliacoes: number;
  totalAvaliacoes: number;
  avaliacoesAprovadas: number;
  cursoCompleto: boolean;
  aulaAtualId: string | null;
  aulaAtualTitulo: string | null;
  aulaAtualBloqueada: boolean;
  moduloAtualOrdem: number | null;
  aulaAtualDetalhe: { segundosAssistidos: number; duracaoSeg: number; materiaisTotal: number; materiaisBaixados: number } | null;
};

type Props = {
  curso: Curso;
  modulos: Modulo[];
  conquistas: Conquista[];
  progresso: Progresso;
  proximoPasso: ProximoPasso;
  nav: DadosNav;
};

function fmtDur(seg: number) {
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}min` : `${h}h`;
  return `${m}min`;
}

function fmtMin(seg: number) {
  const m = Math.round(seg / 60);
  return `${m} min`;
}

// dado real ou nada — nunca "0min"/"0" fabricado (regra da casa)
function durOuNull(seg: number) {
  return seg > 0 ? fmtDur(seg) : null;
}

export function CursoContent({ curso, modulos, conquistas, progresso, proximoPasso, nav }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const moduloAtualId = modulos.find((m) => m.ehAtual)?.id ?? modulos[0]?.id ?? null;
  const [abertos, setAbertos] = useState<Record<string, boolean>>(
    () => (moduloAtualId ? { [moduloAtualId]: true } : {})
  );
  const [aviso, setAviso] = useState<string | null>(null);
  const avisoTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalAulas = progresso.total;

  function toggle(id: string) {
    setAbertos((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function avisarBloqueio(motivo: string | null) {
    if (avisoTimeout.current) clearTimeout(avisoTimeout.current);
    setAviso(motivo ?? "Conclua a aula anterior para desbloquear.");
    avisoTimeout.current = setTimeout(() => setAviso(null), 4200);
  }

  useEffect(() => () => { if (avisoTimeout.current) clearTimeout(avisoTimeout.current); }, []);

  useEffect(() => {
    const rm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = rootRef.current;
    if (!root) return;

    if (rm) {
      root.querySelectorAll(".reveal").forEach((el) => el.classList.add("visivel"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visivel");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    root.querySelectorAll(".reveal").forEach((el) => io.observe(el));

    return () => io.disconnect();
  }, []);

  const primeiraAulaId = modulos[0]?.aulas[0]?.id ?? null;
  const primeiraAulaHref = primeiraAulaId ? `/curso/${curso.slug}/aula/${primeiraAulaId}` : "#modulos";

  let cta: { texto: string; href: string; sub: string | null };
  if (progresso.cursoCompleto) {
    cta = { texto: "Rever curso", href: primeiraAulaHref, sub: null };
  } else if (progresso.concluidas === 0 && progresso.avaliacoesAprovadas === 0) {
    cta = { texto: "Começar agora", href: primeiraAulaHref, sub: null };
  } else if (proximoPasso.tipo === "avaliacao") {
    // beco invisível fechado: quando as aulas do módulo acabaram e falta a
    // avaliação, o "Continuar" leva direto pro Caso pendente, não pra uma
    // aula travada que só devolveria o aluno pro mesmo lugar.
    cta = {
      texto: "Continuar",
      href: `/curso/${curso.slug}/avaliacao/${proximoPasso.avaliacaoId}`,
      sub: `Você parou em: ${proximoPasso.numeroCaso ? `Caso ${proximoPasso.numeroCaso} · ` : ""}${proximoPasso.titulo}`,
    };
  } else if (proximoPasso.tipo === "aula") {
    cta = { texto: "Continuar", href: `/curso/${curso.slug}/aula/${proximoPasso.aulaId}`, sub: `Você parou em: ${proximoPasso.titulo}` };
  } else {
    cta = { texto: "Continuar", href: "#modulos", sub: null };
  }
  const ctaHref = cta.href;

  const det = progresso.aulaAtualDetalhe;
  const pctVideoAtual = det && det.duracaoSeg > 0 ? Math.min(100, Math.round((det.segundosAssistidos / det.duracaoSeg) * 100)) : null;

  return (
    <div ref={rootRef}>
      <div className="grao" aria-hidden="true"></div>
      <div className="fio" aria-hidden="true"></div>

      <NavPlataforma dados={nav} />

      {/* ============ HERO ============ */}
      <section className="hero" aria-label="Sobre o curso">
        <div className="hero-bg" aria-hidden="true">
          <img src={curso.capa_horizontal_url || curso.capa_url || "/img/card-segredos-hero.jpg"} alt="" />
        </div>
        <div className="wrap">
          <div className="hero-conteudo">
            <a className="volta" href="/">
              <IconeChevronLeft size={13} strokeWidth={2.4} />
              Biblioteca
            </a>
            <div className="hero-chips">
              {curso.etapa_nome && <span className="chip trilha">Trilha · {curso.etapa_nome}</span>}
              {curso.nivel && <span className="chip">{curso.nivel}</span>}
            </div>
            <h1>{curso.titulo}</h1>
            {curso.subtitulo && <p className="sub">{curso.subtitulo}</p>}
            <div className="hero-ctas">
              <a className="btn btn-primario" href={ctaHref}>
                <IconePlay size={13} />
                {cta.texto}
              </a>
              <a className="btn btn-fantasma" href="#modulos">Ver conteúdo</a>
            </div>
            {cta.sub && <p className="sub" style={{ marginTop: -8, marginBottom: 0, fontSize: 13 }}>{cta.sub}</p>}
            <div className="stats">
              <div className="stat destaque">
                <span className="grande num">{modulos.length}</span>
                <span className="rot">módulos</span>
              </div>
              <div className="stat">
                <span className="grande num">{totalAulas}</span>
                <span className="rot">aulas</span>
              </div>
              {durOuNull(progresso.duracaoTotalSeg) && (
                <div className="stat">
                  <span className="grande num">{durOuNull(progresso.duracaoTotalSeg)}</span>
                  <span className="rot">de conteúdo</span>
                </div>
              )}
              {progresso.totalAvaliacoes > 0 && (
                <div className="stat">
                  <span className="grande num">{progresso.totalAvaliacoes}</span>
                  <span className="rot">{progresso.totalAvaliacoes === 1 ? "avaliação" : "avaliações"}</span>
                </div>
              )}
              {progresso.xpTotal > 0 && (
                <div className="stat">
                  <span className="grande num">{progresso.xpTotal}</span>
                  <span className="rot">XP disponível</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============ CORPO ============ */}
      <section className="corpo" id="modulos">
        <div className="aurora" aria-hidden="true" style={{ top: 520, left: -160 }}></div>
        <div className="wrap">
          <div className="corpo-grid">

            {/* MÓDULOS */}
            <div>
              <div className="conteudo-cab reveal">
                <span className="eyebrow">Conteúdo do curso</span>
                <h2>O que você<br />vai dominar.</h2>
                <p className="meta num">
                  <b>{totalAulas} aulas</b>
                  {durOuNull(progresso.duracaoTotalSeg) && <> · {durOuNull(progresso.duracaoTotalSeg)}</>}
                  {" · certificado ao final"}
                </p>
              </div>

              <p className="trava-aviso reveal">
                <IconeAlertTriangle size={15} strokeWidth={2} />
                <span>As aulas são liberadas em sequência: para concluir uma aula, assista pelo menos 70% do vídeo, baixe os materiais e seja aprovado nas avaliações do módulo.</span>
              </p>

              <div className="modulos">
                <div className="espinha" aria-hidden="true"><div className="espinha-fio"></div></div>

                {modulos.map((modulo) => {
                  const aberto = !!abertos[modulo.id];
                  const classeMod = modulo.estado === "concluido" ? "feito"
                    : modulo.estado === "bloqueado" ? "bloqueado"
                    : modulo.estado === "andamento" ? "atual"
                    : "atual nao-iniciado";
                  const modClass = ["mod", "reveal", classeMod].filter(Boolean).join(" ");
                  const numMod = String(modulo.ordem).padStart(2, "0");

                  return (
                    <div className={modClass} key={modulo.id}>
                      <div className="mod-no" aria-hidden="true">
                        {modulo.estado === "concluido" ? <IconeCheck size={16} strokeWidth={2.4} />
                          : modulo.estado === "bloqueado" ? <IconeLock size={15} strokeWidth={2.2} />
                          : numMod}
                      </div>
                      <div className="mod-corpo">
                        <span className="fantasma num" aria-hidden="true">{numMod}</span>
                        <button
                          className="mod-cab"
                          aria-expanded={aberto}
                          title={modulo.bloqueado ? modulo.motivoBloqueio ?? undefined : undefined}
                          onClick={() => {
                            if (modulo.bloqueado && modulo.motivoBloqueio) avisarBloqueio(modulo.motivoBloqueio);
                            toggle(modulo.id);
                          }}
                        >
                          <span className="mod-cab-txt">
                            <span className="rotulo-mod">
                              Módulo {numMod}
                              {modulo.ehAtual ? " · Você está aqui" : modulo.estado === "bloqueado" ? " · Bloqueado" : modulo.estado === "concluido" ? " · Concluído" : ""}
                            </span>
                            <h3>{modulo.titulo}</h3>
                            <span className="meta num">
                              {modulo.totalAulas} {modulo.totalAulas === 1 ? "aula" : "aulas"}
                              {durOuNull(modulo.duracaoModuloSeg) && <> · {durOuNull(modulo.duracaoModuloSeg)}</>}
                              {" · "}{modulo.concluidasNoModulo} de {modulo.totalAulas} concluídas
                              {modulo.avaliacoes.length > 0 && <> · {modulo.avaliacoes.length} {modulo.avaliacoes.length === 1 ? "avaliação" : "avaliações"}</>}
                            </span>
                          </span>
                          <span className="mod-toggle" aria-hidden="true" style={aberto ? { transform: "rotate(45deg)" } : undefined}>
                            <IconePlus size={15} strokeWidth={2.2} />
                          </span>
                        </button>
                        <div className={`mod-painel${aberto ? " aberto" : ""}`} role="region" aria-label={`Aulas do módulo ${modulo.ordem}`}>
                          <div className="mod-painel-inner">
                            <ol className="aulas">
                              {modulo.aulas.map((aula) => {
                                const quiz = aula.tipo === "quiz" || aula.tipo === "prova";
                                const classeAula = aula.bloqueada ? "bloqueada" : aula.concluida ? "feita" : "atual";
                                const dur = durOuNull(aula.duracao_seg);
                                const conteudo = (
                                  <>
                                    <span className={`aula-estado${!aula.concluida && !aula.bloqueada ? " num" : ""}`} aria-hidden="true">
                                      {aula.bloqueada ? <IconeLock size={11} strokeWidth={2.2} />
                                        : aula.concluida ? <IconeCheck size={12} />
                                        : <IconePlay size={11} strokeWidth={2.2} />}
                                    </span>
                                    <span className="aula-txt">
                                      <b>{aula.titulo}</b>
                                      {aula.atual && det ? (
                                        <span className="aula-progresso-parcial num">
                                          {pctVideoAtual != null && `${pctVideoAtual}% assistido`}
                                          {pctVideoAtual != null && det.materiaisTotal > 0 && " · "}
                                          {det.materiaisTotal > 0 && `${det.materiaisBaixados} de ${det.materiaisTotal} materiais`}
                                        </span>
                                      ) : aula.descricao ? (
                                        <span>{aula.descricao}</span>
                                      ) : null}
                                    </span>
                                    {quiz && <span className="aula-tipo">{aula.tipo === "prova" ? "Prova" : "Quiz"}</span>}
                                    {dur && <span className="aula-dur num">{dur}</span>}
                                  </>
                                );
                                return (
                                  <li className={quiz ? `aula quiz ${classeAula}` : `aula ${classeAula}`} key={aula.id}>
                                    {aula.bloqueada ? (
                                      <button
                                        type="button"
                                        aria-disabled="true"
                                        title={aula.motivoBloqueio ?? "Conclua a aula anterior para desbloquear."}
                                        onClick={() => avisarBloqueio(aula.motivoBloqueio)}
                                        style={{ width: "100%", background: "none", border: "none", textAlign: "left", cursor: "not-allowed" }}
                                      >
                                        {conteudo}
                                      </button>
                                    ) : (
                                      <a href={`/curso/${curso.slug}/aula/${aula.id}`}>{conteudo}</a>
                                    )}
                                  </li>
                                );
                              })}
                            </ol>

                            {modulo.avaliacoes.length > 0 && (
                              <ol className="avaliacoes-modulo">
                                {modulo.avaliacoes.map((av) => {
                                  const aulasProntas = modulo.totalAulas === 0 || modulo.concluidasNoModulo === modulo.totalAulas;
                                  const motivoAval = !aulasProntas
                                    ? "Conclua as aulas deste módulo para desbloquear esta avaliação."
                                    : "Aprovação na avaliação anterior deste módulo é necessária antes desta.";
                                  const etiqueta = av.numeroCaso ? `Caso ${av.numeroCaso}` : "Avaliação";
                                  const conteudo = (
                                    <>
                                      <span className={`aval-estado${av.estado === "disponivel" ? " num" : ""}`} aria-hidden="true">
                                        {av.estado === "aprovada" ? <IconeCheck size={12} />
                                          : av.estado === "bloqueada" ? <IconeLock size={11} strokeWidth={2.2} />
                                          : <IconeClipboard size={13} strokeWidth={1.8} />}
                                      </span>
                                      <span className="aval-txt">
                                        <span className="aval-etiqueta num">{etiqueta.toUpperCase()}</span>
                                        <b>{av.titulo}</b>
                                        <span className="aval-meta num">
                                          {av.estado === "aprovada"
                                            ? <>Aprovado{av.nota != null && <> · {av.nota.toFixed(1).replace(".", ",")}</>}</>
                                            : `${av.nQuestoes} ${av.nQuestoes === 1 ? "quesito" : "quesitos"}`}
                                        </span>
                                      </span>
                                    </>
                                  );
                                  return (
                                    <li className={`avaliacao ${av.estado}`} key={av.id}>
                                      {av.estado === "bloqueada" ? (
                                        <button
                                          type="button"
                                          aria-disabled="true"
                                          title={motivoAval}
                                          onClick={() => avisarBloqueio(motivoAval)}
                                          style={{ width: "100%", background: "none", border: "none", textAlign: "left", cursor: "not-allowed" }}
                                        >
                                          {conteudo}
                                        </button>
                                      ) : (
                                        <a href={`/curso/${curso.slug}/avaliacao/${av.id}`}>{conteudo}</a>
                                      )}
                                    </li>
                                  );
                                })}
                              </ol>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

              </div>
            </div>

            {/* ASIDE */}
            <aside className="aside">
              {progresso.total > 0 && (
                <div className="bloco progresso-lateral reveal">
                  <span className="eyebrow">Seu progresso</span>
                  <p className="txt num">
                    <b>{progresso.concluidas} de {progresso.total}</b> aulas
                    {progresso.totalAvaliacoes > 0 && <> · <b>{progresso.avaliacoesAprovadas} de {progresso.totalAvaliacoes}</b> avaliações</>}
                    {" · "}<b>{progresso.pct}%</b>
                  </p>
                  <div className="barra"><i style={{ width: `${progresso.pct}%` }}></i></div>
                </div>
              )}

              {curso.citacao && (
                <div className="bloco citacao reveal">
                  <span className="aspas" aria-hidden="true">"</span>
                  <blockquote>{curso.citacao}</blockquote>
                  {curso.instrutor_nome && (
                    <div className="instrutor">
                      <span className="foto" aria-hidden="true">{curso.instrutor_iniciais || curso.instrutor_nome.slice(0, 2).toUpperCase()}</span>
                      <span className="quem">
                        <b>{curso.instrutor_nome}</b>
                        {curso.instrutor_titulo && <span>{curso.instrutor_titulo}</span>}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {curso.objetivos && curso.objetivos.length > 0 && (
                <div className="bloco reveal">
                  <span className="eyebrow">O que você vai dominar</span>
                  <ul className="objetivos">
                    {curso.objetivos.map((obj, i) => (
                      <li key={i} style={{ ["--i" as string]: i } as Record<string, number>}>
                        <span className="check" aria-hidden="true">
                          <IconeCheck size={10} />
                        </span>
                        {obj}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="bloco reveal">
                <span className="eyebrow">Ao concluir</span>
                <div className="dados num">
                  {progresso.xpTotal > 0 && (
                    <div className="dado"><span className="valor grad-txt">+{progresso.xpTotal} <small>XP</small></span><span className="rot">neste curso</span></div>
                  )}
                  <div className="dado"><span className="valor">{totalAulas} <small>aulas</small></span><span className="rot">para dominar</span></div>
                </div>
                <div className={`cert${progresso.cursoCompleto ? " destaque" : ""}`}>
                  <span className="cert-selo" aria-hidden="true">
                    <Certificado size={18} />
                  </span>
                  <div>
                    <b>Certificado verificável</b>
                    <span>{progresso.cursoCompleto ? "Disponível no seu perfil" : "Emitido no seu nome após concluir o curso"}</span>
                  </div>
                </div>
              </div>

              {conquistas.length > 0 && (
                <div className="bloco reveal">
                  <span className="eyebrow">Conquistas deste curso</span>
                  <ul className="conquistas">
                    {conquistas.map((cq) => (
                      <li className="bloqueada" key={cq.id}>
                        <span className="cq-badge" aria-hidden="true">
                          <IconeLock size={15} strokeWidth={2} />
                        </span>
                        <span className="cq-txt">
                          <b>{cq.nome}</b>
                          <span>{cq.descricao} <b style={{ color: "var(--cinza-claro)" }}>+{cq.xp} XP</b></span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="bloco reveal">
                <a className="btn btn-primario" href={ctaHref} style={{ width: "100%", justifyContent: "center" }}>
                  <IconePlay size={13} />
                  {cta.texto}
                </a>
              </div>
            </aside>

          </div>
        </div>
      </section>

      {/* seção de sugestões ("Continue explorando" / "Você também vai gostar")
          removida por decisão de produto — dentro do curso o foco é o curso,
          sem vitrine de outros cursos competindo pela atenção (jornada
          sequencial de propósito). Recomendação de próximo curso deve viver
          na biblioteca e na tela de conclusão do curso, não durante o estudo. */}

      {/* FOOTER: removido — era um resto órfão copiado do footer real de
          HomeContent.tsx (que só funciona lá porque está dentro do wrapper
          .pagina-home; aqui nunca teve CSS de verdade, daí a logo gigante e
          os links sem espaçamento). O rodapé institucional já aparece
          estilizado em toda página via app/layout.tsx (.rodape-global). */}

      {/* toast de aula/módulo bloqueado */}
      <div className={`toast-bloqueio${aviso ? " visivel" : ""}`} role="status">
        <IconeLock size={15} strokeWidth={2.2} />
        <span>{aviso}</span>
      </div>
    </div>
  );
}

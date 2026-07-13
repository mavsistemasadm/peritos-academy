"use client";

import { useEffect, useRef, useState } from "react";
import NavPlataforma from '@/components/NavPlataforma'
import type { DadosNav } from '@/lib/queries/nav'
import { IconeChevronLeft, IconePlay, IconePlus, IconeCheck, IconeLock } from '@/components/Icones'
import { Certificado } from '@/components/Emblemas'

type Aula = {
  id: string;
  titulo: string;
  descricao: string | null;
  duracao_seg: number;
  ordem: number;
  xp: number;
  tipo?: string | null;
};

type Modulo = {
  id: string;
  titulo: string;
  ordem: number;
  aulas: Aula[];
};

type Curso = {
  id: string;
  slug: string;
  titulo: string;
  subtitulo: string | null;
  capa_url: string | null;
  nivel: string | null;
  duracao_seg: number;
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

type Props = {
  curso: Curso;
  modulos: Modulo[];
  conquistas: Conquista[];
  relacionados: { id: string; slug: string; titulo: string; capa_url: string | null }[];
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

export function CursoContent({ curso, modulos, conquistas, relacionados, nav }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [abertos, setAbertos] = useState<Record<string, boolean>>(
    () => (modulos[0] ? { [modulos[0].id]: true } : {})
  );

  const totalAulas = modulos.reduce((a, m) => a + (m.aulas?.length || 0), 0);
  const xpTotal = totalAulas * 40;

  function toggle(id: string) {
    setAbertos((prev) => ({ ...prev, [id]: !prev[id] }));
  }

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

  return (
    <>
      <div className="grao" aria-hidden="true"></div>
      <div className="fio" aria-hidden="true"></div>

      <NavPlataforma dados={nav} />

      {/* ============ HERO ============ */}
      <section className="hero" aria-label="Sobre o curso">
        <div className="hero-bg" aria-hidden="true">
          <img src={curso.capa_url || "/img/card-segredos-hero.jpg"} alt="" />
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
              <a className="btn btn-primario" href="#modulos">
<IconePlay size={13} />
                Começar curso
              </a>
              <a className="btn btn-fantasma" href="#modulos">Ver conteúdo</a>
            </div>
            <div className="stats">
              <div className="stat destaque">
                <span className="grande num">{modulos.length}</span>
                <span className="rot">módulos</span>
              </div>
              <div className="stat">
                <span className="grande num">{totalAulas}</span>
                <span className="rot">aulas</span>
              </div>
              <div className="stat">
                <span className="grande num">{fmtDur(curso.duracao_seg)}</span>
                <span className="rot">de conteúdo</span>
              </div>
              <div className="stat">
                <span className="grande num">{xpTotal}</span>
                <span className="rot">XP disponível</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ CORPO ============ */}
      <section className="corpo" id="modulos" ref={rootRef}>
        <div className="aurora" aria-hidden="true" style={{ top: 520, left: -160 }}></div>
        <div className="wrap">
          <div className="corpo-grid">

            {/* MÓDULOS */}
            <div>
              <div className="conteudo-cab reveal">
                <span className="eyebrow">Conteúdo do curso</span>
                <h2>O que você<br />vai dominar.</h2>
                <p className="meta num"><b>{totalAulas} aulas</b> · {fmtDur(curso.duracao_seg)} · certificado ao final</p>
              </div>

              <div className="modulos">
                <div className="espinha" aria-hidden="true"><div className="espinha-fio"></div></div>

                {modulos.map((modulo, i) => {
                  const aberto = !!abertos[modulo.id];
                  const atual = i === 0;
                  const marco = i === modulos.length - 1 && modulos.length > 1;
                  const modClass = ["mod", "reveal", atual ? "atual" : "", marco ? "marco" : ""].filter(Boolean).join(" ");
                  const numMod = String(modulo.ordem).padStart(2, "0");
                  const totMin = (modulo.aulas || []).reduce((a, x) => a + x.duracao_seg, 0);

                  return (
                    <div className={modClass} key={modulo.id}>
                      <div className={atual ? "mod-no num" : "mod-no"} aria-hidden="true">{atual ? numMod : numMod}</div>
                      <div className="mod-corpo">
                        <span className="fantasma num" aria-hidden="true">{numMod}</span>
                        <button
                          className="mod-cab"
                          aria-expanded={aberto}
                          onClick={() => toggle(modulo.id)}
                        >
                          <span className="mod-cab-txt">
                            <span className="rotulo-mod">
                              Módulo {numMod}{atual ? " · Você está aqui" : marco ? " · Marco final" : ""}
                            </span>
                            <h3>{modulo.titulo}</h3>
                            <span className="meta num">{modulo.aulas?.length || 0} aulas · {fmtDur(totMin)}</span>
                          </span>
                          <span className="mod-toggle" aria-hidden="true" style={aberto ? { transform: "rotate(45deg)" } : undefined}>
<IconePlus size={15} strokeWidth={2.2} />
                          </span>
                        </button>
                        {aberto && (
                          <div className="mod-painel" role="region" aria-label={`Aulas do módulo ${modulo.ordem}`}>
                            <ol className="aulas">
                              {(modulo.aulas || []).map((aula) => {
                                const quiz = aula.tipo === "quiz" || aula.tipo === "prova";
                                return (
                                  <li className={quiz ? "aula quiz" : "aula"} key={aula.id}>
                                    <a href={`/curso/${curso.slug}/aula/${aula.id}`}>
                                      <span className="aula-estado num" aria-hidden="true">{aula.ordem}</span>
                                      <span className="aula-txt">
                                        <b>{aula.titulo}</b>
                                        {aula.descricao && <span>{aula.descricao}</span>}
                                      </span>
                                      {quiz && <span className="aula-tipo">{aula.tipo === "prova" ? "Prova" : "Quiz"}</span>}
                                      <span className="aula-dur num">{fmtMin(aula.duracao_seg)}</span>
                                    </a>
                                  </li>
                                );
                              })}
                            </ol>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

              </div>
            </div>

            {/* ASIDE */}
            <aside className="aside">
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
                  <div className="dado"><span className="valor grad-txt">+{xpTotal} <small>XP</small></span><span className="rot">neste curso</span></div>
                  <div className="dado"><span className="valor">{totalAulas} <small>aulas</small></span><span className="rot">para dominar</span></div>
                </div>
                <div className="cert">
                  <span className="cert-selo" aria-hidden="true">
                    <Certificado size={18} />
                  </span>
                  <div>
                    <b>Certificado verificável</b>
                    <span>Emitido no seu nome após concluir o curso</span>
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
                <a className="btn btn-primario" href="#modulos" style={{ width: "100%", justifyContent: "center" }}>
  <IconePlay size={13} />
                  Começar agora
                </a>
              </div>
            </aside>

          </div>
        </div>
      </section>

      {/* RELACIONADOS */}
      {relacionados.length > 0 && (
        <section className="vitrine">
          <div className="wrap">
            <div className="secao-cab reveal">
              <div>
                <span className="eyebrow">Continue explorando</span>
                <h2 className="h2">Você também vai gostar.</h2>
              </div>
            </div>
            <div className="carrossel reveal" role="list">
              {relacionados.map((rel) => (
                <a className="card-curso" href={`/curso/${rel.slug}`} key={rel.id} role="listitem">
                  <div className="card-capa">
                    <img src={rel.capa_url || "/img/card-segredos.jpg"} alt={`Capa do curso ${rel.titulo}`} loading="lazy" />
                    <span className="acao btn-quieto">Ver curso</span>
                  </div>
                  <div className="card-info">
                    <span className="titulo">{rel.titulo}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer className="footer">
        <div className="wrap">
          <div className="footer-baixo">
            <div className="footer-logo">
              <img src="/img/logo.png" alt="" />
              <span>peritos academy</span>
            </div>
            <nav className="footer-links" aria-label="Links do rodapé">
              <a href="#">Suporte</a>
              <a href="#">Privacidade</a>
              <a href="#">Certificados</a>
            </nav>
            <span className="footer-copy">© 2026 Peritos Academy</span>
          </div>
        </div>
      </footer>
    </>
  );
}
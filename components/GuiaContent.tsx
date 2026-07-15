"use client";
// components/GuiaContent.tsx
// Página /guia: hero + busca em tempo real + sidebar sticky + accordions.
import { useEffect, useMemo, useRef, useState } from "react";
import NavPlataforma from "@/components/NavPlataforma";
import type { DadosNav } from "@/lib/queries/nav";
import type { DadosGuia } from "@/lib/queries/guia";
import { CAPITULOS, type CapituloGuia } from "@/lib/guia/conteudo";
import { IconeSearch, IconeCompass, IconeHeadset, IconeChevronDown } from "@/components/Icones";

function normaliza(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function filtrarCapitulos(termo: string): CapituloGuia[] {
  const t = normaliza(termo.trim());
  if (!t) return CAPITULOS;
  return CAPITULOS.map((cap) => {
    const tituloBate = normaliza(cap.titulo).includes(t);
    if (tituloBate) return cap;
    const secoes = cap.secoes.filter(
      (s) => normaliza(s.titulo).includes(t) || s.paragrafos.some((p) => normaliza(p).includes(t))
    );
    return secoes.length ? { ...cap, secoes } : null;
  }).filter((c): c is CapituloGuia => !!c);
}

export default function GuiaContent({ dados, nav }: { dados: DadosGuia; nav: DadosNav }) {
  const [busca, setBusca] = useState("");
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [ativoId, setAtivoId] = useState<string>(CAPITULOS[0]?.id ?? "");
  const conteudoRef = useRef<HTMLDivElement>(null);
  const buscaAtiva = busca.trim().length > 0;
  const capitulos = useMemo(() => filtrarCapitulos(busca), [busca]);

  // deep-link por hash: abre e rola até o capítulo pedido
  useEffect(() => {
    const hash = location.hash.replace("#", "");
    if (!hash) return;
    setAbertos((prev) => new Set(prev).add(hash));
    const t = setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
    return () => clearTimeout(t);
  }, []);

  // destaca no sidebar o capítulo mais visível durante o scroll
  useEffect(() => {
    const els = CAPITULOS.map((c) => document.getElementById(c.id)).filter((e): e is HTMLElement => !!e);
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visivel = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visivel) setAtivoId(visivel.target.id);
      },
      { rootMargin: "-15% 0px -70% 0px" }
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [capitulos.length]);

  function onToggleCap(id: string, aberto: boolean) {
    if (buscaAtiva) return; // controlado pela busca enquanto ela estiver ativa
    setAbertos((prev) => {
      const n = new Set(prev);
      if (aberto) n.add(id); else n.delete(id);
      return n;
    });
  }

  return (
    <div className="pagina-guia">
      <NavPlataforma dados={nav} />

      <header className="guia-hero">
        <div className="wrap">
          <span className="eyebrow">Central de ajuda</span>
          <h1>Guia da plataforma.</h1>
          <p className="sub">Tudo o que você precisa saber para tirar o máximo da Peritos Academy.</p>
          <div className="guia-hero-acoes">
            <a className="btn btn-fantasma" href="/?tour=1">
              <IconeCompass size={15} strokeWidth={1.8} /> Refazer o tour guiado
            </a>
            <a className="btn btn-fantasma" href={`mailto:${dados.emailSuporte}`}>
              <IconeHeadset size={15} strokeWidth={1.8} /> Falar com o suporte
            </a>
          </div>
          <div className="guia-busca">
            <IconeSearch size={16} strokeWidth={2} />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar no guia, ex.: certificado, XP, materiais..."
              aria-label="Buscar no guia"
            />
          </div>
        </div>
      </header>

      <main className="guia-main wrap">
        <nav className="guia-sidebar" aria-label="Capítulos do guia">
          <ul>
            {CAPITULOS.map((c) => (
              <li key={c.id}>
                <a href={`#${c.id}`} className={ativoId === c.id ? "ativo" : undefined} onClick={() => setAbertos((prev) => new Set(prev).add(c.id))}>
                  <span className="num">{String(c.numero).padStart(2, "0")}</span>
                  {c.titulo}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="guia-conteudo" ref={conteudoRef}>
          {capitulos.length === 0 && <p className="guia-vazio">Nada encontrado para &ldquo;{busca}&rdquo;.</p>}
          {capitulos.map((cap) => (
            <details
              key={cap.id}
              id={cap.id}
              className="guia-cap"
              open={buscaAtiva || abertos.has(cap.id)}
              onToggle={(e) => onToggleCap(cap.id, e.currentTarget.open)}
            >
              <summary>
                <span className="guia-cap-num num">{String(cap.numero).padStart(2, "0")}</span>
                <span className="guia-cap-titulo">{cap.titulo}</span>
                <IconeChevronDown size={14} strokeWidth={2.2} className="guia-cap-seta" />
              </summary>
              <div className="guia-cap-corpo">
                {cap.secoes.map((sec) => (
                  <div className={`guia-secao${sec.titulo === "Dica" ? " guia-callout" : ""}`} key={sec.titulo}>
                    <h3>{sec.titulo}</h3>
                    {sec.titulo === "Os 10 níveis" ? (
                      <NiveisChips niveis={dados.niveis} />
                    ) : (
                      sec.paragrafos.map((p, i) => <p key={i}>{p}</p>)
                    )}
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      </main>
    </div>
  );
}

function NiveisChips({ niveis }: { niveis: DadosGuia["niveis"] }) {
  if (niveis.length === 0) return <p>Lista de níveis ainda não configurada.</p>;
  return (
    <ul className="guia-niveis">
      {niveis.map((n) => (
        <li key={n.ordem} className="guia-nivel-chip">
          <img src={n.imgUrl} alt="" width={32} height={32} />
          <span>
            <span className="num">Nível {n.ordem}</span>
            <b>{n.nome}</b>
          </span>
        </li>
      ))}
    </ul>
  );
}

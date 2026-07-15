"use client";
// components/TourGuiado.tsx
// Tour de boas-vindas com spotlight — implementação própria, sem lib externa.
// Overlay/spotlight vivem só aqui; os alvos são achados via seletor CSS
// (atributo data-tour ou id já existente) em qualquer componente da página —
// isso deixa o motor do tour desacoplado da árvore React de NavPlataforma/
// AvisosGlobais (que moram em componentes separados, um deles até fora da
// página — AvisosGlobais é montado no layout raiz).

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { marcarTourVisto } from "@/app/actions";
import { IconeClose } from "@/components/Icones";

type PassoModal = { tipo: "modal"; titulo: string; texto: string };
type PassoSpot = { tipo: "spot"; seletores: string[]; titulo: string; texto: string };
type Passo = PassoModal | PassoSpot;

const PASSOS: Passo[] = [
  {
    tipo: "modal",
    titulo: "Bem-vindo à Peritos Academy.",
    texto: "Aqui, conhecimento vira autoridade. Preparamos um tour de 1 minuto para você conhecer sua nova central de evolução profissional.",
  },
  {
    tipo: "spot",
    seletores: ['[data-tour="hero-cta"]'],
    titulo: "Sua central de comando.",
    texto: "Você sempre retoma exatamente de onde parou. O botão principal leva direto para a próxima aula do seu caminho, sem perder tempo procurando.",
  },
  {
    tipo: "spot",
    seletores: ['[data-tour="nav-gamificacao"]'],
    titulo: "Sua evolução em números.",
    texto: "XP, nível e sua sequência de dias de estudo. Cada aula concluída te leva mais longe, e a constância é recompensada.",
  },
  {
    tipo: "spot",
    seletores: ["#jornada"],
    titulo: "O seu mapa.",
    texto: "A Formação Pericial de Alta Performance é o caminho obrigatório que dá o Selo de Excelência. Depois, os territórios de especialização definem onde a sua autoridade vai crescer.",
  },
  {
    tipo: "spot",
    seletores: ["#vitrine"],
    titulo: "O próximo passo certo.",
    texto: "Sem paralisia de escolha: a plataforma analisa o seu progresso e sugere exatamente o que assistir agora.",
  },
  {
    tipo: "spot",
    seletores: ['[data-tour="nav-comunidade"]', '[data-tour="nav-agenda"]'],
    titulo: "Você não caminha só.",
    texto: "Dúvidas reais, casos compartilhados e encontros ao vivo com quem vive a perícia todos os dias.",
  },
  {
    tipo: "spot",
    seletores: ['[data-tour="sino-notificacoes"]'],
    titulo: "Suas conquistas chegam aqui.",
    texto: "Insígnias, subidas de nível e novidades importantes. Quando algo bom acontecer, você fica sabendo.",
  },
  {
    tipo: "modal",
    titulo: "Agora é com você.",
    texto: "O caminho está desenhado. Comece pela primeira aula da sua Formação e dê o primeiro passo rumo à autoridade.",
  },
];

type Rect = { top: number; left: number; width: number; height: number };
type BalaoPos = { left: number; top: number; posicao: "baixo" | "cima" };

const MARGEM = 10;
const ALTURA_BALAO_ESTIMADA = 210;

export default function TourGuiado({ mostrarInicial, primeiraAulaHref }: {
  mostrarInicial: boolean;
  primeiraAulaHref: string;
}) {
  const [ativo, setAtivo] = useState(false);
  const [passo, setPasso] = useState(0);
  const [primeiraVisita, setPrimeiraVisita] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const [balao, setBalao] = useState<BalaoPos | null>(null);
  const [reduzido, setReduzido] = useState(false);
  const passoRef = useRef(passo);
  passoRef.current = passo;

  useEffect(() => {
    setReduzido(matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  // disparo: ?tour=1 (refazer, vindo da /guia) tem prioridade sobre a checagem inicial
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("tour") === "1") {
      const url = new URL(location.href);
      url.searchParams.delete("tour");
      history.replaceState({}, "", url);
      setPrimeiraVisita(false);
      setPasso(0);
      setAtivo(true);
      return;
    }
    if (mostrarInicial) {
      const t = setTimeout(() => {
        setPrimeiraVisita(true);
        setPasso(0);
        setAtivo(true);
      }, 1000);
      return () => clearTimeout(t);
    }
  }, [mostrarInicial]);

  const medir = useCallback(() => {
    const p = PASSOS[passoRef.current];
    if (p.tipo !== "spot") { setRect(null); setBalao(null); return; }
    const els = p.seletores
      .map((s) => document.querySelector<HTMLElement>(s))
      .filter((e): e is HTMLElement => !!e);
    if (els.length === 0) return false;

    const rects = els.map((e) => e.getBoundingClientRect());
    const top = Math.min(...rects.map((r) => r.top)) - MARGEM;
    const left = Math.min(...rects.map((r) => r.left)) - MARGEM;
    const right = Math.max(...rects.map((r) => r.right)) + MARGEM;
    const bottom = Math.max(...rects.map((r) => r.bottom)) + MARGEM;
    setRect({ top, left, width: right - left, height: bottom - top });

    const larguraBalao = 340;
    const espacoAbaixo = innerHeight - bottom;
    const espacoAcima = top;
    const posicao: BalaoPos["posicao"] = espacoAbaixo >= espacoAcima ? "baixo" : "cima";
    let balaoLeft = left;
    if (balaoLeft + larguraBalao > innerWidth - 16) balaoLeft = innerWidth - larguraBalao - 16;
    if (balaoLeft < 16) balaoLeft = 16;

    // posição inicial por estimativa — corrigida com a altura real pós-render
    // pelo layout effect abaixo (seções muito altas podem deixar pouco espaço
    // dos dois lados do spotlight).
    let balaoTop = posicao === "baixo" ? bottom + 16 : top - 16 - ALTURA_BALAO_ESTIMADA;
    balaoTop = Math.max(16, Math.min(balaoTop, innerHeight - 16 - ALTURA_BALAO_ESTIMADA));
    setBalao({ left: balaoLeft, top: balaoTop, posicao });
    return true;
  }, []);

  // corrige a posição vertical com a altura REAL do balão (o texto varia de
  // tamanho por passo) — evita cortar conteúdo no topo/rodapé da viewport e
  // evita sobrepor o próprio spotlight quando a estimativa de altura erra.
  const balaoRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!balao || !balaoRef.current) return;
    const altura = balaoRef.current.offsetHeight;
    let corrigido = balao.top;
    if (balao.posicao === "cima" && rect) corrigido = Math.min(corrigido, rect.top - 16 - altura);
    if (balao.posicao === "baixo" && rect) corrigido = Math.max(corrigido, rect.top + rect.height + 16);
    corrigido = Math.max(16, Math.min(corrigido, innerHeight - 16 - altura));
    if (Math.abs(corrigido - balao.top) > 1) {
      setBalao((b) => (b ? { ...b, top: corrigido } : b));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balao?.left, balao?.top, balao?.posicao, passo]);

  // ao trocar de passo: rola até o elemento (se preciso) e mede; pula
  // graciosamente se o alvo não existir (ex: seção oculta por config)
  useEffect(() => {
    if (!ativo) return;
    const p = PASSOS[passo];
    if (p.tipo === "modal") { setRect(null); setBalao(null); return; }

    let cancelado = false;
    const els = p.seletores
      .map((s) => document.querySelector<HTMLElement>(s))
      .filter((e): e is HTMLElement => !!e);

    if (els.length === 0) {
      if (passo < PASSOS.length - 1) setPasso((v) => v + 1);
      else finalizar(false);
      return;
    }

    const alvo = els[0];
    const fixo = getComputedStyle(alvo).position === "fixed";
    const r0 = alvo.getBoundingClientRect();
    const dentro = fixo || (r0.top >= 80 && r0.bottom <= innerHeight - 80);

    if (!dentro) {
      alvo.scrollIntoView({ behavior: reduzido ? "auto" : "smooth", block: "center" });
      // espera o scroll (que pode ser longo) realmente parar antes de medir —
      // um timeout fixo não é confiável pra distâncias grandes de rolagem.
      let raf = 0;
      const inicial = r0.top;
      let ultimo = inicial;
      let paradas = 0;
      let comecouAMover = reduzido; // sem animação (reduced motion) já nasce "movido"
      const checar = () => {
        if (cancelado) return;
        const atual = alvo.getBoundingClientRect().top;
        if (!comecouAMover && Math.abs(atual - inicial) > 1) comecouAMover = true;
        if (comecouAMover && Math.abs(atual - ultimo) < 0.5) {
          paradas++;
          if (paradas >= 3) { medir(); return; }
        } else {
          paradas = 0;
        }
        ultimo = atual;
        raf = requestAnimationFrame(checar);
      };
      raf = requestAnimationFrame(checar);
      const tetoSeguranca = setTimeout(() => { if (!cancelado) medir(); }, 1500);
      return () => { cancelado = true; cancelAnimationFrame(raf); clearTimeout(tetoSeguranca); };
    }
    medir();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, passo]);

  useEffect(() => {
    if (!ativo || PASSOS[passo].tipo !== "spot") return;
    const onResize = () => medir();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [ativo, passo, medir]);

  const finalizar = useCallback((concluiu: boolean) => {
    setAtivo(false);
    if (primeiraVisita) marcarTourVisto().catch(() => {});
    void concluiu;
  }, [primeiraVisita]);

  const avancar = useCallback(() => {
    setPasso((v) => {
      if (v >= PASSOS.length - 1) { finalizar(true); return v; }
      return v + 1;
    });
  }, [finalizar]);

  const voltar = useCallback(() => {
    setPasso((v) => Math.max(0, v - 1));
  }, []);

  // teclado: ESC pula, setas navegam
  useEffect(() => {
    if (!ativo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); finalizar(false); }
      else if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); avancar(); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); voltar(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ativo, avancar, voltar, finalizar]);

  if (!ativo) return null;

  const p = PASSOS[passo];
  const primeiroPasso = passo === 0;
  const ultimoPasso = passo === PASSOS.length - 1;

  return (
    <div className={`tour-raiz${reduzido ? " reduzido" : ""}`} role="dialog" aria-modal="true" aria-label="Tour guiado da plataforma">
      {p.tipo === "modal" ? (
        <div className="tour-modal-overlay">
          <div className="tour-modal">
            <button className="tour-fechar" aria-label="Pular tour" onClick={() => finalizar(false)}>
              <IconeClose size={14} />
            </button>
            <span className="tour-rotulo grad-txt">TOUR · PASSO {passo + 1} DE {PASSOS.length}</span>
            <h2>{p.titulo}</h2>
            <p>{p.texto}</p>
            {primeiroPasso ? (
              <div className="tour-modal-acoes">
                <button className="btn btn-primario" onClick={avancar}>Começar tour</button>
                <button className="btn btn-fantasma" onClick={() => finalizar(false)}>Explorar por conta própria</button>
              </div>
            ) : (
              <div className="tour-modal-acoes">
                <a className="btn btn-primario" href={primeiraAulaHref} onClick={() => finalizar(true)}>Começar minha primeira aula</a>
                <a className="tour-link-discreto" href="/guia" onClick={() => finalizar(true)}>Ver o guia completo</a>
              </div>
            )}
            <TourDots passo={passo} total={PASSOS.length} />
          </div>
        </div>
      ) : (
        <>
          {rect && <div className="tour-spot" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} aria-hidden="true" />}
          {balao && rect && (
            <div
              ref={balaoRef}
              className={`tour-balao pos-${balao.posicao}`}
              style={{ left: balao.left, top: balao.top }}
            >
              <button className="tour-fechar" aria-label="Pular tour" onClick={() => finalizar(false)}>
                <IconeClose size={13} />
              </button>
              <span className="tour-rotulo grad-txt">TOUR · PASSO {passo + 1} DE {PASSOS.length}</span>
              <h3>{p.titulo}</h3>
              <p>{p.texto}</p>
              <div className="tour-balao-rodape">
                <TourDots passo={passo} total={PASSOS.length} />
                <div className="tour-balao-nav">
                  <button className="tour-pular" onClick={() => finalizar(false)}>Pular tour</button>
                  <button className="tour-proximo grad-txt" onClick={avancar}>Próximo →</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TourDots({ passo, total }: { passo: number; total: number }) {
  return (
    <div className="tour-dots" aria-hidden="true">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={`tour-dot${i === passo ? " ativo" : ""}`} />
      ))}
    </div>
  );
}

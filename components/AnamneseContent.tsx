"use client";
// components/AnamneseContent.tsx
// Cerimônia do Mapa da Rota do Perito — fluxo completo (cenas 0 a 6).
// Dados exclusivamente do motor (migration 20260720_anamnese_motor_rota_perito.sql
// + correções de âncora/expansão) e dos textos aprovados (anamnese_territorios/
// anamnese_frases_espelho/anamnese_textos_gerais). Aqui só a coreografia visual.
//
// Decisões de execução não especificadas no pacote de textos aprovado
// (documentadas para revisão): palavra-chave em degradê por frase de
// espelho, posição do marcador "você está aqui", flexão do tesouro por
// objetivo lido da Q1 (opções 4/5), e o mecanismo de câmera/pan mobile
// (formula reaproveitada do zoom desktop).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  responderQuestao,
  concluirAnamnese,
  buscarFraseEspelho,
  buscarComecarMinhaRota,
  type ResultadoConclusao,
  type Estacao,
} from "@/app/anamnese/actions";
import type { AnamneseQuestao, AnamneseProgresso, Territorio } from "@/lib/queries/anamnese";
import { IconeChevronLeft, IconeChevronRight, IconeVolume, IconeVolumeMudo } from "@/components/Icones";
import { tocarSom } from "@/lib/sons";
import { cerimoniaMusica } from "@/lib/sons/cerimoniaMusica";
import { caminhoCurvo } from "@/lib/rota/caminhoCurvo";

const CHAVE_MUDO_SESSAO = "an-audio-mudo";

type Props = {
  questoes: AnamneseQuestao[];
  progressoInicial: AnamneseProgresso;
  textos: Record<string, string>;
  territorios: Territorio[];
  sonsConquista: boolean;
};

type Cena =
  | "convite"
  | "mergulho"
  | "perguntas"
  | "processando"
  | "dossie"
  | "carimbo"
  | "mesa"
  | "rota"
  | "tesouro"
  | "mapa-final";

const ATOS = [
  { label: "Seu momento", numeral: "I", ordens: [0, 1, 2, 3, 4] },
  { label: "Suas armas", numeral: "II", ordens: [5, 6, 7, 8, 9] },
  { label: "Sua verdade", numeral: "III", ordens: [10, 11, 12, 13, 14, 15] },
];

// Palavra-chave por frase de espelho (decisão de execução, ver nota acima).
const PALAVRA_CHAVE: Record<string, string> = {
  pode_mais: "nome",
  transicao: "profissão",
  urgencia_financeira: "retorno",
  reconhecimento: "lugar",
  cansaco_emprego: "traçado",
  ja_atua_evoluir: "caminho",
  medo: "honestidade",
  fallback: "mapa",
};

// Ponto de partida fixo no mapa (não é um envelope — representa "você").
const ENTRADA_X = 50;
const ENTRADA_Y = 95;

function interpolar(tpl: string, valores: Record<string, string | number>) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(valores[k] ?? ""));
}

function renderFrasePalavraAPalavra(frase: string, chave: string) {
  const palavraChave = PALAVRA_CHAVE[chave];
  const palavras = frase.split(" ");
  // O espaço precisa ser um nó de texto IRMÃO fora do <span> (que é
  // inline-block, necessário pro slide-up da animação) — um espaço
  // colado dentro do próprio span inline-block é engolido pelo
  // colapso de whitespace do CSS, colando as palavras visualmente.
  return palavras.flatMap((p, i) => {
    const limpa = p.replace(/[.,]/g, "");
    const ehChave = palavraChave && limpa.toLowerCase() === palavraChave.toLowerCase();
    const span = (
      <span
        key={`p-${i}`}
        className={`an-palavra${ehChave ? " an-palavra-chave" : ""}`}
        style={{ animationDelay: `${1600 + i * 110}ms` }}
      >
        {p}
      </span>
    );
    return i < palavras.length - 1 ? [span, " "] : [span];
  });
}

function renderStatusAceso(linha: string) {
  const marcador = "[ROTA TRACADA]";
  const idx = linha.indexOf(marcador);
  if (idx === -1) return linha;
  return (
    <>
      {linha.slice(0, idx)}
      <span className="an-status-aceso">{marcador}</span>
    </>
  );
}

export default function AnamneseContent({ questoes, progressoInicial, textos, territorios, sonsConquista }: Props) {
  const router = useRouter();
  const reduzido = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    setMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const idxInicial = useMemo(() => {
    if (progressoInicial.questoesRespondidas === 0) return 0;
    if (progressoInicial.proximaQuestaoOrdem === null) return questoes.length - 1;
    const i = questoes.findIndex((q) => q.ordem === progressoInicial.proximaQuestaoOrdem);
    return i >= 0 ? i : 0;
  }, [progressoInicial, questoes]);

  const [cena, setCena] = useState<Cena>(progressoInicial.questoesRespondidas > 0 ? "perguntas" : "convite");
  const [saindo, setSaindo] = useState(false);
  const [idxAtual, setIdxAtual] = useState(idxInicial);
  const [respostasMap, setRespostasMap] = useState<Record<number, number>>(() => {
    const m: Record<number, number> = {};
    for (const r of progressoInicial.respostas) m[r.questao_ordem] = r.opcao_ordem;
    return m;
  });
  const [enviandoResposta, setEnviandoResposta] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoConclusao | null>(null);

  /* ---------- áudio da cerimônia ---------- */
  const [audioMudo, setAudioMudo] = useState(false);
  useEffect(() => {
    let salvo: string | null = null;
    try { salvo = sessionStorage.getItem(CHAVE_MUDO_SESSAO); } catch { /* sessionStorage indisponível */ }
    if (salvo === "1") { setAudioMudo(true); cerimoniaMusica.mudo(true); }
    return () => cerimoniaMusica.sair();
  }, []);
  function alternarMudo() {
    setAudioMudo((prev) => {
      const novo = !prev;
      cerimoniaMusica.mudo(novo);
      try { sessionStorage.setItem(CHAVE_MUDO_SESSAO, novo ? "1" : "0"); } catch { /* sessionStorage indisponível */ }
      return novo;
    });
  }

  const trocarCena = useCallback(
    (proxima: Cena, atraso = 0) => {
      const ir = () => {
        if (reduzido) { setCena(proxima); return; }
        setSaindo(true);
        setTimeout(() => { setCena(proxima); setSaindo(false); }, 340);
      };
      if (atraso > 0 && !reduzido) setTimeout(ir, atraso);
      else ir();
    },
    [reduzido]
  );

  /* ---------- CENA 0 · CONVITE ---------- */
  function iniciarMergulho() {
    cerimoniaMusica.iniciar(sonsConquista); // gesto do clique libera autoplay
    setCena("mergulho");
  }
  useEffect(() => {
    if (cena !== "mergulho") return;
    const t = setTimeout(() => setCena("perguntas"), reduzido ? 0 : 1600);
    return () => clearTimeout(t);
  }, [cena, reduzido]);

  /* ---------- PERGUNTAS ---------- */
  const q = questoes[idxAtual];
  const ato = ATOS.find((a) => a.ordens.includes(q?.ordem ?? 0)) ?? ATOS[0];
  const emAtoIII = ato.numeral === "III";

  useEffect(() => {
    if (cena === "perguntas" && emAtoIII) cerimoniaMusica.entrarAtoIII();
  }, [cena, emAtoIII]);

  async function handleResponder(opcaoOrdem: number) {
    if (enviandoResposta) return;
    if (!cerimoniaMusica.estaAtiva()) {
      // cena "convite" foi pulada (retomando uma anamnese parcial) — este
      // clique é o primeiro gesto do usuário na página, então é aqui que
      // o áudio pode iniciar de fato.
      cerimoniaMusica.iniciar(sonsConquista);
      if (emAtoIII) cerimoniaMusica.entrarAtoIII();
    }
    setRespostasMap((prev) => ({ ...prev, [q.ordem]: opcaoOrdem }));
    setEnviandoResposta(true);
    const r = await responderQuestao(q.ordem, opcaoOrdem);
    setEnviandoResposta(false);
    if (!("ok" in r) || !r.ok) { setErro("Não foi possível salvar sua resposta. Tente novamente."); return; }
    setErro(null);

    if (idxAtual === questoes.length - 1) {
      setCena("processando");
      const res = await concluirAnamnese();
      setResultado(res);
      if (res.ok) setCena("dossie");
      else { setErro(res.motivo); setCena("perguntas"); }
    } else {
      setTimeout(() => setIdxAtual((i) => i + 1), 260);
    }
  }
  function handleVoltar() {
    if (idxAtual > 0) setIdxAtual((i) => i - 1);
  }

  /* ---------- CENA 1 · DOSSIÊ (datilografia) ---------- */
  const linhasDossie = useMemo(() => {
    if (!resultado?.ok) return [];
    const avatarLabel = resultado.avatar === "iniciante_transicao" ? "TRANSICAO DE CARREIRA" : "PERITO EM EVOLUCAO";
    return [
      "PERITOS ACADEMY . DEPTO DE FORMACAO",
      `ABERTURA DE CASO ................ ${resultado.numeroCaso}`,
      "OBJETO ........... ROTA PROFISSIONAL",
      "RESPOSTAS ANALISADAS ........ 16 DE 16",
      `PERFIL ........ ${avatarLabel}`,
      "STATUS ............... [ROTA TRACADA]",
    ];
  }, [resultado]);
  const [charsPorLinha, setCharsPorLinha] = useState<number[]>([]);
  const [dossieCompleto, setDossieCompleto] = useState(false);
  const linhaAtualIdx = charsPorLinha.findIndex((c, i) => c < (linhasDossie[i]?.length ?? 0));

  useEffect(() => {
    if (cena !== "dossie") return;
    cerimoniaMusica.entrarDossie();
  }, [cena]);

  useEffect(() => {
    if (cena !== "dossie" || linhasDossie.length === 0) return;
    if (reduzido) {
      setCharsPorLinha(linhasDossie.map((l) => l.length));
      setDossieCompleto(true);
      return;
    }
    let cancelado = false;
    const contagem = new Array(linhasDossie.length).fill(0);
    setCharsPorLinha([...contagem]);
    setDossieCompleto(false);

    (async () => {
      for (let li = 0; li < linhasDossie.length && !cancelado; li++) {
        const linha = linhasDossie[li];
        for (let ci = 1; ci <= linha.length && !cancelado; ci++) {
          const atraso = linha[ci - 1] === "." ? 12 : 18 + Math.random() * 26;
          await new Promise((r) => setTimeout(r, atraso));
          contagem[li] = ci;
          setCharsPorLinha([...contagem]);
          cerimoniaMusica.tocarTecla();
        }
        await new Promise((r) => setTimeout(r, 190));
      }
      if (!cancelado) setDossieCompleto(true);
    })();
    return () => { cancelado = true; };
  }, [cena, linhasDossie, reduzido]);

  useEffect(() => {
    if (!dossieCompleto) return;
    const t = setTimeout(() => setCena("carimbo"), reduzido ? 0 : 500);
    return () => clearTimeout(t);
  }, [dossieCompleto, reduzido]);

  /* ---------- CENA 2 · CARIMBO ---------- */
  const [dossieRompendo, setDossieRompendo] = useState(false);
  useEffect(() => {
    if (cena !== "carimbo") return;
    if (sonsConquista) tocarSom("carimbo");
    cerimoniaMusica.entrarCarimbo();
    if (reduzido) { setCena("mesa"); return; }
    const t1 = setTimeout(() => setDossieRompendo(true), 1800);
    const t2 = setTimeout(() => setCena("mesa"), 2700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [cena, sonsConquista, reduzido]);

  /* ---------- CENA 3 · MESA SE DESDOBRA ---------- */
  useEffect(() => {
    if (cena !== "mesa") return;
    cerimoniaMusica.entrarMesa();
  }, [cena]);

  const chaveFrase = resultado?.ok ? resultado.fraseEspelho : "";
  const [textoFrase, setTextoFrase] = useState("");
  useEffect(() => {
    if (cena !== "mesa" || !chaveFrase) return;
    let cancelado = false;
    buscarFraseEspelho(chaveFrase).then((t) => { if (!cancelado) setTextoFrase(t); });
    return () => { cancelado = true; };
  }, [cena, chaveFrase]);

  useEffect(() => {
    if (cena !== "mesa" || !textoFrase) return;
    const duracaoTotal = reduzido ? 0 : 1600 + textoFrase.split(" ").length * 110 + 380 + 900;
    const t = setTimeout(() => setCena("rota"), duracaoTotal);
    return () => clearTimeout(t);
  }, [cena, textoFrase, reduzido]);

  /* ---------- CENA 4 · ROTA VIVA (multi-estação) ---------- */
  const estacoes = resultado?.ok ? resultado.estacoes : [];
  const [segAtivo, setSegAtivo] = useState(0);
  const [linhaDesenhada, setLinhaDesenhada] = useState(false);
  const [estacaoChegou, setEstacaoChegou] = useState(false);
  const [cartaoVisivel, setCartaoVisivel] = useState(false);
  const [sheetColapsado, setSheetColapsado] = useState(false);
  const [dragY, setDragY] = useState(0);
  const dragRef = useRef<{ startY: number; ativo: boolean } | null>(null);

  useEffect(() => {
    if (cena !== "rota") return;
    setLinhaDesenhada(false); setEstacaoChegou(false); setCartaoVisivel(false);
    setSheetColapsado(false); setDragY(0);
    if (reduzido) {
      setLinhaDesenhada(true); setEstacaoChegou(true); setCartaoVisivel(true);
      cerimoniaMusica.pingEstacao();
      return;
    }
    const t1 = setTimeout(() => setLinhaDesenhada(true), 50);
    const t2 = setTimeout(() => { setEstacaoChegou(true); cerimoniaMusica.pingEstacao(); }, 50 + 1400);
    const t3 = setTimeout(() => setCartaoVisivel(true), 50 + 1400 + 300 + 900);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [cena, segAtivo, reduzido]);

  function avancarEstacao() {
    if (segAtivo + 1 < estacoes.length) {
      setSegAtivo((i) => i + 1);
    } else {
      trocarCena("tesouro");
    }
  }

  const estacaoAtual: Estacao | null = estacoes[segAtivo] ?? null;
  const pontoAtual = estacaoAtual ? { x: estacaoAtual.xPct, y: estacaoAtual.yPct } : { x: ENTRADA_X, y: ENTRADA_Y };

  // Cartão adjacente ao envelope ativo (mapa nunca mais encolhe): envelope
  // na metade direita do mapa -> cartão nasce à esquerda dele, e vice-versa.
  // clamp() garante que nunca estoura a viewport nem cobre o envelope.
  const CARTAO_LARGURA = 380;
  const CARTAO_GAP = 32;
  const cartaoEstiloDesktop: React.CSSProperties | undefined = estacaoAtual
    ? {
        left: estacaoAtual.xPct > 50
          ? `clamp(16px, calc(${estacaoAtual.xPct}% - ${CARTAO_LARGURA + CARTAO_GAP}px), calc(100% - ${CARTAO_LARGURA + 16}px))`
          : `clamp(16px, calc(${estacaoAtual.xPct}% + ${CARTAO_GAP}px), calc(100% - ${CARTAO_LARGURA + 16}px))`,
        top: `clamp(40px, ${estacaoAtual.yPct}%, calc(100% - 40px))`,
        transform: "translateY(-50%)",
      }
    : undefined;

  /* ---------- câmera mobile (pan sobre o mapa grande) ---------- */
  const mapaMobileRef = useRef<HTMLDivElement>(null);
  const [camMobile, setCamMobile] = useState({ tx: 0, ty: 0 });
  useEffect(() => {
    if (!mobile || cena !== "rota") return;
    const el = mapaMobileRef.current;
    const wrap = el?.parentElement;
    if (!el || !wrap) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    const wrapW = wrap.clientWidth, wrapH = wrap.clientHeight;
    const px = (pontoAtual.x / 100) * w;
    const py = (pontoAtual.y / 100) * h;
    let tx = wrapW / 2 - px;
    let ty = wrapH / 2 - py;
    tx = Math.min(0, Math.max(wrapW - w, tx));
    ty = Math.min(0, Math.max(wrapH - h, ty));
    setCamMobile({ tx, ty });
  }, [mobile, cena, pontoAtual.x, pontoAtual.y]);

  function onSheetPointerDown(e: React.PointerEvent) {
    dragRef.current = { startY: e.clientY, ativo: true };
  }
  function onSheetPointerMove(e: React.PointerEvent) {
    if (!dragRef.current?.ativo) return;
    const delta = e.clientY - dragRef.current.startY;
    if (delta > 0) setDragY(Math.min(delta, 220));
  }
  function onSheetPointerUp() {
    if (!dragRef.current) return;
    dragRef.current.ativo = false;
    setSheetColapsado(dragY > 80);
    setDragY(0);
  }

  function renderMapa(opts: { estacoesAcesas: Set<string>; segmentosAte: number }) {
    const { estacoesAcesas, segmentosAte } = opts;
    return (
      <div
        ref={mobile ? mapaMobileRef : undefined}
        className="an-mapa-viva"
        style={{
          transform: mobile ? `translate(${camMobile.tx}px, ${camMobile.ty}px)` : "none",
        }}
      >
        <img src="/rota/mesa-perito.png" alt="Mapa da Rota do Perito" className="an-mapa-img" />

        <svg className="an-mapa-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="an-grad-linha" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#20D9A6" />
              <stop offset="100%" stopColor="#36DCD1" />
            </linearGradient>
          </defs>
          {estacoes.map((e, i) => {
            if (i > segmentosAte) return null;
            const de = i === 0 ? { x: ENTRADA_X, y: ENTRADA_Y } : { x: estacoes[i - 1].xPct, y: estacoes[i - 1].yPct };
            const animando = i === segmentosAte && cena === "rota";
            return (
              <path
                key={e.trilhaId}
                d={caminhoCurvo(de.x, de.y, e.xPct, e.yPct, i)}
                fill="none"
                stroke="url(#an-grad-linha)"
                strokeWidth="0.6"
                strokeLinecap="round"
                pathLength={100}
                className={`an-linha-rota${!animando || linhaDesenhada ? " desenhada" : ""}`}
              />
            );
          })}
        </svg>

        {!reduzido && cena === "rota" && (
          <div
            className="an-ponta-pulso"
            style={{
              left: `${linhaDesenhada ? pontoAtual.x : (segAtivo === 0 ? ENTRADA_X : estacoes[segAtivo - 1]?.xPct ?? ENTRADA_X)}%`,
              top: `${linhaDesenhada ? pontoAtual.y : (segAtivo === 0 ? ENTRADA_Y : estacoes[segAtivo - 1]?.yPct ?? ENTRADA_Y)}%`,
            }}
          />
        )}

        <div className="an-marcador-voce" style={{ left: `${ENTRADA_X}%`, top: `${ENTRADA_Y}%` }}>
          <span>{textos.microcopy_marcador_inicial}</span>
        </div>

        {territorios.map((t) => {
          const naRota = estacoes.some((e) => e.trilhaId === t.trilhaId);
          const posicaoNaRota = estacoes.findIndex((e) => e.trilhaId === t.trilhaId);
          const ehPrimeira = posicaoNaRota === 0;
          const acesa = estacoesAcesas.has(t.trilhaId);
          return (
            <div
              key={t.trilhaId}
              className={`an-territorio${naRota ? " na-rota" : " fora-rota"}${acesa ? " acesa" : ""}`}
              style={{ left: `${t.xPct}%`, top: `${t.yPct}%` }}
              title={t.descricaoCurta}
            >
              <span className="an-territorio-ponto" />
              {acesa && cena === "rota" && posicaoNaRota === segAtivo && <span className="an-anel-pulsante" />}
              <div className="an-territorio-rotulo">
                <b>{t.trilhaNome}</b>
                {ehPrimeira && <em className="an-tag-partida">PONTO DE PARTIDA</em>}
                {!naRota && <em className="an-tag-explorar">{textos.microcopy_territorio_explorar}</em>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  /* ---------- CENA 5 · TESOURO ---------- */
  const [tesouroTextoVisivel, setTesouroTextoVisivel] = useState(false);
  const [tesouroToastVisivel, setTesouroToastVisivel] = useState(false);
  useEffect(() => {
    if (cena !== "tesouro") return;
    cerimoniaMusica.entrarTesouro();
    setTesouroTextoVisivel(false); setTesouroToastVisivel(false);
    if (reduzido) { setTesouroTextoVisivel(true); setTesouroToastVisivel(true); return; }
    const t1 = setTimeout(() => setTesouroTextoVisivel(true), 1400);
    const t2 = setTimeout(() => setTesouroToastVisivel(true), 1400 + 800);
    const t3 = setTimeout(() => trocarCena("mapa-final"), 1400 + 800 + 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [cena, reduzido, trocarCena]);

  const textoTesouro = useMemo(() => {
    if (!resultado?.ok) return "";
    const base = resultado.resumo.excedeMetaMeses
      ? interpolar(textos.tesouro_aviso_excede ?? "", { horas_sugeridas: resultado.resumo.horasSemanaSugerida })
      : textos.tesouro_base ?? "";
    const flexao =
      resultado.objetivo === "nomeacoes" ? textos.tesouro_flexao_nomeacoes
      : resultado.objetivo === "negocio" ? textos.tesouro_flexao_negocio
      : "";
    return [base, flexao].filter(Boolean).join(" ");
  }, [resultado, textos]);

  const textoPrazoHonesto = useMemo(() => {
    if (!resultado?.ok) return "";
    return interpolar(textos.microcopy_prazo_honesto ?? "", { horas: resultado.resumo.horasSemanaDeclarada });
  }, [resultado, textos]);

  /* ---------- CENA 6 · O MAPA É SEU ---------- */
  useEffect(() => {
    if (cena !== "mapa-final") return;
    cerimoniaMusica.entrarMapaFinal();
  }, [cena]);

  const [comecando, setComecando] = useState(false);
  async function handleComecarMinhaRota() {
    if (!resultado?.ok || comecando) return;
    setComecando(true);
    const primeira = resultado.estacoes[0];
    const href = primeira.trilhaSlug ? await buscarComecarMinhaRota(primeira.trilhaSlug) : "/meu-plano";
    router.push(href);
  }

  if (!resultado && (cena === "dossie" || cena === "carimbo" || cena === "mesa" || cena === "rota" || cena === "tesouro" || cena === "mapa-final")) {
    return null;
  }

  const todasAcesasIds = new Set(estacoes.map((e) => e.trilhaId));
  const acesasAteAgora = new Set(estacoes.slice(0, segAtivo + 1).map((e) => e.trilhaId));

  return (
    <div className={`pagina-anamnese${reduzido ? " reduzido" : ""}${mobile ? " mobile" : ""}`}>
      {cena !== "convite" && (
        <button
          className="an-btn-mudo"
          onClick={alternarMudo}
          aria-label={audioMudo ? "Ativar som da cerimônia" : "Silenciar cerimônia"}
          title={audioMudo ? "Ativar som" : "Silenciar"}
        >
          {audioMudo ? <IconeVolumeMudo size={16} /> : <IconeVolume size={16} />}
        </button>
      )}

      {/* ============ CENA 0 · CONVITE ============ */}
      {cena === "convite" && (
        <div className="an-cena ativa an-convite">
          <div className="an-convite-bg" />
          <div className="an-convite-vinheta" />
          <div className="an-convite-conteudo">
            <h1 className="an-convite-titulo">{textos.convite_titulo}</h1>
            <p className="an-convite-desc">{textos.convite_descricao}</p>
            <div className="an-convite-acoes">
              <button className="an-btn-primario" onClick={iniciarMergulho}>
                {textos.convite_botao_acao}
              </button>
              <Link href="/" className="an-btn-fantasma">
                {textos.convite_botao_recusa}
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ============ MERGULHO (transição) ============ */}
      {cena === "mergulho" && (
        <div className="an-cena ativa an-mergulho">
          <div className="an-convite-bg an-mergulho-zoom" />
          <div className="an-mergulho-flash" />
        </div>
      )}

      {/* ============ PERGUNTAS (16) ============ */}
      {cena === "perguntas" && q && (
        <div className={`an-cena ativa an-perguntas${emAtoIII ? " ato-3" : ""}${saindo ? " saindo" : ""}`}>
          <div className="an-perguntas-vinheta" />
          <div className="an-conteudo an-anim" key={idxAtual}>
            <div className="an-atos-barra">
              {ATOS.map((a) => {
                const respondidasAto = a.ordens.filter((o) => respostasMap[o] !== undefined).length;
                const pct = (respondidasAto / a.ordens.length) * 100;
                return (
                  <div key={a.numeral} className={`an-ato${a.numeral === ato.numeral ? " atual" : ""}`}>
                    <span className="an-ato-nome">Ato {a.numeral} · {a.label}</span>
                    <div className="an-ato-trilho"><i style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
            </div>

            <h2 className="an-pergunta-enunciado">{q.enunciado}</h2>

            <ul className="an-opcoes">
              {q.opcoes.map((o) => (
                <li key={o.ordem}>
                  <button
                    className={`an-opcao${respostasMap[q.ordem] === o.ordem ? " sel" : ""}`}
                    onClick={() => handleResponder(o.ordem)}
                    disabled={enviandoResposta}
                  >
                    <span className="an-opcao-txt">{o.texto}</span>
                  </button>
                </li>
              ))}
            </ul>

            {erro && <p className="an-erro-inline">{erro}</p>}

            <div className="an-perguntas-rodape">
              {idxAtual > 0 && (
                <button className="an-btn-voltar" onClick={handleVoltar}>
                  <IconeChevronLeft size={16} /> Voltar
                </button>
              )}
              <span className="an-contador">{idxAtual + 1} de {questoes.length}</span>
            </div>
          </div>
        </div>
      )}

      {/* ============ PROCESSANDO ============ */}
      {cena === "processando" && (
        <div className="an-cena ativa an-processando">
          <p>Traçando sua rota...</p>
        </div>
      )}

      {/* ============ CENA 1 · DOSSIÊ ============ */}
      {cena === "dossie" && (
        <div className="an-cena ativa an-dossie-cena">
          <div className="an-dossie">
            <p className="an-dossie-nota">{textos.microcopy_antes_lacre}</p>
            <pre className="an-dossie-texto">
              {linhasDossie.map((linha, li) => (
                <div key={li} className="an-dossie-linha">
                  {li === linhasDossie.length - 1 && charsPorLinha[li] === linha.length
                    ? renderStatusAceso(linha)
                    : linha.slice(0, charsPorLinha[li] ?? 0)}
                  {li === linhaAtualIdx && <span className="an-cursor" />}
                </div>
              ))}
            </pre>
          </div>
        </div>
      )}

      {/* ============ CENA 2 · CARIMBO ============ */}
      {cena === "carimbo" && (
        <div className={`an-cena ativa an-carimbo-cena${dossieRompendo ? " rompendo" : ""}`}>
          <div className="an-dossie an-dossie-fantasma">
            <pre className="an-dossie-texto">
              {linhasDossie.map((linha, li) => (
                <div key={li} className="an-dossie-linha">
                  {li === linhasDossie.length - 1 ? renderStatusAceso(linha) : linha}
                </div>
              ))}
            </pre>
            <div className="an-selo-carimbo">
              <span>{interpolar(textos.microcopy_selo_dossie ?? "", { numero: resultado?.ok ? resultado.numeroCaso : "" })}</span>
            </div>
          </div>
          <div className="an-flash-radial" />
        </div>
      )}

      {/* ============ CENA 3 · MESA SE DESDOBRA ============ */}
      {cena === "mesa" && (
        <div className="an-cena ativa an-mesa-cena">
          <div className="an-mesa-folhas">
            <div className="an-folha esq" />
            <div className="an-folha centro" />
            <div className="an-folha dir" />
          </div>
          <div className="an-mesa-vinheta" />
          {textoFrase && (
            <div className="an-mesa-frase">
              {renderFrasePalavraAPalavra(textoFrase, chaveFrase)}
            </div>
          )}
        </div>
      )}

      {/* ============ CENA 4 · ROTA VIVA ============ */}
      {cena === "rota" && estacaoAtual && (
        <div className="an-cena ativa an-rota-cena">
          <div className="an-mapa-wrap">
            {renderMapa({ estacoesAcesas: acesasAteAgora, segmentosAte: segAtivo })}

            {cartaoVisivel && (
              <div
                className={`an-cartao-capitulo${mobile ? " sheet" : ""}${sheetColapsado ? " colapsado" : ""}`}
                style={
                  mobile
                    ? { transform: `translateY(${sheetColapsado ? "calc(100% - 54px)" : `${dragY}px`})` }
                    : cartaoEstiloDesktop
                }
              >
                {mobile && (
                  <div
                    className="an-sheet-alca"
                    onPointerDown={onSheetPointerDown}
                    onPointerMove={onSheetPointerMove}
                    onPointerUp={onSheetPointerUp}
                    onClick={() => sheetColapsado && setSheetColapsado(false)}
                  />
                )}
                <span className="an-cartao-eyebrow">TERRITÓRIO {segAtivo + 1}</span>
                <h3>{estacaoAtual.trilhaNome}</h3>
                <p>{estacaoAtual.justificativa}</p>
                <p className="an-cartao-dados">{estacaoAtual.numCursos} cursos · {estacaoAtual.cargaHoras}h de conteúdo</p>
                <button className="an-btn-primario" onClick={avancarEstacao}>
                  {segAtivo + 1 < estacoes.length ? "Seguir no mapa" : "Chegar ao tesouro"} <IconeChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ CENA 5 · TESOURO ============ */}
      {cena === "tesouro" && (
        <div className="an-cena ativa an-tesouro-cena">
          <div className="an-tesouro-imagem">
            <img src="/rota/tesouro.png" alt="Sua rota está selada" />
          </div>
          {tesouroTextoVisivel && (
            <div className="an-tesouro-texto an-anim">
              <p>{textoTesouro}</p>
              <p className="an-tesouro-prazo">{textoPrazoHonesto}</p>
            </div>
          )}
          {tesouroToastVisivel && (
            <div className="an-toast-xp">
              <span>{textos.microcopy_toast_xp}</span>
            </div>
          )}
        </div>
      )}

      {/* ============ CENA 6 · O MAPA É SEU ============ */}
      {cena === "mapa-final" && (
        <div className="an-cena ativa an-rota-cena an-mapa-final">
          <div className="an-mapa-wrap">
            {renderMapa({ estacoesAcesas: todasAcesasIds, segmentosAte: estacoes.length - 1 })}
          </div>
          <div className="an-mapa-final-acoes">
            <button className="an-btn-primario" onClick={handleComecarMinhaRota} disabled={comecando}>
              {textos.microcopy_cta_principal}
            </button>
            <Link href="/meu-plano" className="an-btn-fantasma">
              {textos.microcopy_cta_secundario}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";
// components/AnamneseContent.tsx
// Cerimônia do Mapa da Rota do Perito — Capítulo 1 (Cenas 0 a 4, primeira
// estação apenas). Dados exclusivamente do motor (migration
// 20260720_anamnese_motor_rota_perito.sql + correções de âncora/expansão) e
// dos textos aprovados (anamnese_territorios/anamnese_frases_espelho/
// anamnese_textos_gerais). Aqui só a coreografia visual.
//
// A escolha de qual palavra de cada frase de espelho vira "palavra-chave" em
// degradê teal, e a posição do marcador "você está aqui" (não especificados
// no pacote de textos aprovado), são decisão de execução desta tela —
// documentadas para revisão no checkpoint.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { responderQuestao, concluirAnamnese, buscarFraseEspelho, type ResultadoConclusao } from "@/app/anamnese/actions";
import type { AnamneseQuestao, AnamneseProgresso, Territorio } from "@/lib/queries/anamnese";
import { IconeChevronLeft, IconeChevronRight } from "@/components/Icones";
import { tocarSom } from "@/lib/sons";

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
  | "fim-capitulo";

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

function renderFrasePalavraAPalavra(frase: string, chave: string) {
  const palavraChave = PALAVRA_CHAVE[chave];
  const palavras = frase.split(" ");
  return palavras.map((p, i) => {
    const limpa = p.replace(/[.,]/g, "");
    const ehChave = palavraChave && limpa.toLowerCase() === palavraChave.toLowerCase();
    return (
      <span
        key={i}
        className={`an-palavra${ehChave ? " an-palavra-chave" : ""}`}
        style={{ animationDelay: `${1600 + i * 110}ms` }}
      >
        {p}
        {i < palavras.length - 1 ? " " : ""}
      </span>
    );
  });
}

export default function AnamneseContent({ questoes, progressoInicial, textos, territorios, sonsConquista }: Props) {
  const reduzido = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

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

  async function handleResponder(opcaoOrdem: number) {
    if (enviandoResposta) return;
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
      "ABERTURA DE CASO ................ 0000",
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
    if (reduzido) { setCena("mesa"); return; }
    const t1 = setTimeout(() => setDossieRompendo(true), 1800);
    const t2 = setTimeout(() => setCena("mesa"), 2700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [cena, sonsConquista, reduzido]);

  /* ---------- CENA 3 · MESA SE DESDOBRA ---------- */
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

  /* ---------- CENA 4 · ROTA VIVA ---------- */
  const [linhaDesenhada, setLinhaDesenhada] = useState(false);
  const [estacaoChegou, setEstacaoChegou] = useState(false);
  const [zoomAtivo, setZoomAtivo] = useState(false);
  const [cartaoVisivel, setCartaoVisivel] = useState(false);

  useEffect(() => {
    if (cena !== "rota") return;
    if (reduzido) {
      setLinhaDesenhada(true); setEstacaoChegou(true); setZoomAtivo(true); setCartaoVisivel(true);
      return;
    }
    const t1 = setTimeout(() => setLinhaDesenhada(true), 50);
    const t2 = setTimeout(() => setEstacaoChegou(true), 50 + 1400);
    const t3 = setTimeout(() => setZoomAtivo(true), 50 + 1400 + 300);
    const t4 = setTimeout(() => setCartaoVisivel(true), 50 + 1400 + 300 + 900);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [cena, reduzido]);

  if (!resultado && (cena === "dossie" || cena === "carimbo" || cena === "mesa" || cena === "rota")) {
    return null;
  }

  const primeira = resultado?.ok ? resultado.primeiraEstacao : null;
  const rotaIds = resultado?.ok ? resultado.rotaTrilhaIds : [];

  const dx = primeira ? (50 - primeira.xPct) * 0.14 : 0;
  const dy = primeira ? (50 - primeira.yPct) * 0.14 : 0;

  return (
    <div className={`pagina-anamnese${reduzido ? " reduzido" : ""}`}>
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
              <span>{textos.microcopy_selo_dossie}</span>
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
      {cena === "rota" && primeira && (
        <div className="an-cena ativa an-rota-cena">
          <div className="an-mapa-wrap">
            <div
              className="an-mapa-viva"
              style={{
                transform: zoomAtivo ? `scale(1.14) translate(${dx}%, ${dy}%)` : "none",
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
                <path
                  d={`M ${ENTRADA_X} ${ENTRADA_Y} L ${primeira.xPct} ${primeira.yPct}`}
                  fill="none"
                  stroke="url(#an-grad-linha)"
                  strokeWidth="0.6"
                  strokeLinecap="round"
                  pathLength={100}
                  className={`an-linha-rota${linhaDesenhada ? " desenhada" : ""}`}
                />
              </svg>

              {!reduzido && (
                <div
                  className="an-ponta-pulso"
                  style={{
                    left: `${linhaDesenhada ? primeira.xPct : ENTRADA_X}%`,
                    top: `${linhaDesenhada ? primeira.yPct : ENTRADA_Y}%`,
                  }}
                />
              )}

              <div className="an-marcador-voce" style={{ left: `${ENTRADA_X}%`, top: `${ENTRADA_Y}%` }}>
                <span>{textos.microcopy_marcador_inicial}</span>
              </div>

              {territorios.map((t) => {
                const naRota = rotaIds.includes(t.trilhaId);
                const ehPrimeira = t.trilhaId === primeira.trilhaId;
                const acesa = ehPrimeira && estacaoChegou;
                return (
                  <div
                    key={t.trilhaId}
                    className={`an-territorio${naRota ? " na-rota" : " fora-rota"}${acesa ? " acesa" : ""}`}
                    style={{ left: `${t.xPct}%`, top: `${t.yPct}%` }}
                  >
                    <span className="an-territorio-ponto" />
                    {acesa && <span className="an-anel-pulsante" />}
                    <div className="an-territorio-rotulo">
                      <b>{t.trilhaNome}</b>
                      {ehPrimeira && <em className="an-tag-partida">PONTO DE PARTIDA</em>}
                      {!naRota && <em className="an-tag-explorar">{textos.microcopy_territorio_explorar}</em>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {cartaoVisivel && (
            <div className="an-cartao-capitulo">
              <span className="an-cartao-eyebrow">TERRITÓRIO 1</span>
              <h3>{primeira.trilhaNome}</h3>
              <p>{primeira.justificativa}</p>
              <p className="an-cartao-dados">{primeira.numCursos} cursos · {primeira.cargaHoras}h de conteúdo</p>
              <button className="an-btn-primario" onClick={() => trocarCena("fim-capitulo")}>
                Seguir no mapa <IconeChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ============ FIM DO CAPÍTULO 1 (checkpoint) ============ */}
      {cena === "fim-capitulo" && (
        <div className="an-cena ativa an-fim-capitulo">
          <div className="an-conteudo an-anim">
            <h2>Fim do Capítulo 1</h2>
            <p>O resto do mapa continua na próxima etapa da sua rota.</p>
            <Link href="/" className="an-btn-primario">Voltar ao início</Link>
          </div>
        </div>
      )}
    </div>
  );
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

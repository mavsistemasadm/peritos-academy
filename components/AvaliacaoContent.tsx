"use client";
// components/AvaliacaoContent.tsx
// Experiência "O Caso": briefing → quesitos → veredito → revisão.
// 100% banco: conteúdo vem do Supabase (sem gabarito) e a correção
// acontece na server action `submeter` (RPC submeter_avaliacao).
// As animações dos quesitos alternam entre 4 temas (q-var-0..3),
// deslocados pelo campo `tema` da avaliação — cada caso abre diferente.
// As ALTERNATIVAS são embaralhadas a cada abertura e a cada "refazer";
// a correção é por id, então a ordem da tela não afeta o gabarito.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AvaliacaoDados,
  QuestaoPublica,
  ResultadoCorrecao,
} from "@/lib/queries/avaliacao";
import { IconeChevronLeft, IconeCheck, IconeClose, IconePlay } from "@/components/Icones";
import { XP, Trofeu } from "@/components/Emblemas";

type Resposta = { opcaoId?: string; valor?: string };

type Props = {
  dados: AvaliacaoDados;
  usuarioNome: string | null;
  submeter: (
    respostas: { questao_id: string; opcao_id?: string; valor?: number }[]
  ) => Promise<ResultadoCorrecao>;
};

type Cena = "brief" | "quesito" | "veredito" | "revisao";

function parseValor(s: string): number | null {
  const t = s.trim().replace(/\s/g, "");
  if (!t) return null;
  // aceita "2.080,50" (pt-BR) e "2080.50"
  const n = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

function fmtValor(v: number | null | undefined, prefixo?: string | null, sufixo?: string | null) {
  if (v === null || v === undefined) return "—";
  const num = v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return `${prefixo ? prefixo + " " : ""}${num}${sufixo ? sufixo : ""}`;
}

function embaralhar<T>(lista: T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export default function AvaliacaoContent({ dados, usuarioNome, submeter }: Props) {
  const { curso, modulo, avaliacao, questoes } = dados;
  const ehProva = avaliacao.tipo === "prova";
  const nQ = questoes.length;

  const [cena, setCena] = useState<Cena>("brief");
  const [saindo, setSaindo] = useState(false);
  const [atual, setAtual] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, Resposta>>({});
  const [resultado, setResultado] = useState<ResultadoCorrecao | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [opcoesEmbaralhadas, setOpcoesEmbaralhadas] =
    useState<Record<string, QuestaoPublica["opcoes"]>>({});
  const notaRef = useRef<HTMLSpanElement>(null);
  const rm = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  const embaralharTudo = useCallback(() => {
    const novo: Record<string, QuestaoPublica["opcoes"]> = {};
    questoes.forEach((qq) => { novo[qq.id] = embaralhar(qq.opcoes); });
    setOpcoesEmbaralhadas(novo);
  }, [questoes]);

  // embaralha ao abrir o caso (roda só no navegador — evita divergência com o servidor)
  useEffect(() => { embaralharTudo(); }, [embaralharTudo]);

  const opcoesDe = useCallback(
    (qq: QuestaoPublica) => opcoesEmbaralhadas[qq.id] ?? qq.opcoes,
    [opcoesEmbaralhadas]
  );

  const troca = useCallback(
    (para: Cena) => {
      if (rm) { setCena(para); return; }
      setSaindo(true);
      setTimeout(() => { setCena(para); setSaindo(false); }, 340);
    },
    [rm]
  );

  const q: QuestaoPublica | undefined = questoes[atual];

  const respondida = useCallback(
    (questao: QuestaoPublica) => {
      const r = respostas[questao.id];
      if (!r) return false;
      return questao.tipo === "multipla_escolha"
        ? !!r.opcaoId
        : parseValor(r.valor ?? "") !== null;
    },
    [respostas]
  );

  const respondidas = questoes.filter(respondida).length;
  const todasRespondidas = respondidas === nQ;
  const ultima = atual === nQ - 1;

  /* ---------- envio (correção server-side) ---------- */
  const emitirLaudo = useCallback(async () => {
    if (enviando || !todasRespondidas) return;
    setEnviando(true);
    setErro(null);
    try {
      const payload = questoes.map((questao) => {
        const r = respostas[questao.id]!;
        return questao.tipo === "multipla_escolha"
          ? { questao_id: questao.id, opcao_id: r.opcaoId }
          : { questao_id: questao.id, valor: parseValor(r.valor ?? "")! };
      });
      const res = await submeter(payload);
      setResultado(res);
      troca("veredito");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setErro(`Não foi possível emitir o laudo. ${msg || "Confira sua conexão e tente de novo."}`);
    } finally {
      setEnviando(false);
    }
  }, [enviando, todasRespondidas, questoes, respostas, submeter, troca]);

  /* ---------- contagem da nota ---------- */
  useEffect(() => {
    if (cena !== "veredito" || !resultado || !notaRef.current) return;
    const el = notaRef.current;
    const alvo = resultado.nota;
    if (rm) { el.textContent = alvo.toFixed(1).replace(".", ","); return; }
    const t0 = performance.now() + 700;
    let raf = 0;
    const passo = (t: number) => {
      const p = Math.min(Math.max(t - t0, 0) / 1400, 1);
      el.textContent = (alvo * (1 - Math.pow(1 - p, 3))).toFixed(1).replace(".", ",");
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [cena, resultado, rm]);

  /* ---------- teclado ---------- */
  useEffect(() => {
    if (cena !== "quesito") return;
    const onKey = (e: KeyboardEvent) => {
      if (!q) return;
      const alvo = e.target as HTMLElement;
      const digitando = alvo?.tagName === "INPUT" || alvo?.tagName === "TEXTAREA";
      if (!digitando && q.tipo === "multipla_escolha" && ["1", "2", "3", "4"].includes(e.key)) {
        const i = parseInt(e.key) - 1;
        const op = opcoesDe(q)[i];
        if (op) setRespostas((r) => ({ ...r, [q.id]: { opcaoId: op.id } }));
      }
      if (e.key === "Enter") {
        if (!respondida(q)) return;
        if (!ultima) setAtual((a) => a + 1);
        else if (todasRespondidas) void emitirLaudo();
      }
      if (!digitando && e.key === "ArrowLeft" && atual > 0) setAtual((a) => a - 1);
      if (!digitando && e.key === "ArrowRight" && atual < nQ - 1 && respondida(q))
        setAtual((a) => a + 1);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [cena, q, atual, nQ, ultima, todasRespondidas, respondida, emitirLaudo, opcoesDe]);

  /* ---------- refazer só os errados ---------- */
  const refazerErrados = () => {
    if (!resultado) return;
    const errados = resultado.gabarito.filter((g) => !g.correta).map((g) => g.questao_id);
    if (errados.length === 0) { troca("quesito"); return; }
    setRespostas((r) => {
      const novo = { ...r };
      errados.forEach((id) => delete novo[id]);
      return novo;
    });
    const primeiro = questoes.findIndex((qq) => errados.includes(qq.id));
    setAtual(primeiro < 0 ? 0 : primeiro);
    setResultado(null);
    embaralharTudo();
    troca("quesito");
  };

  /* ---------- derivados de exibição ---------- */
  const varAnim = q ? (atual + (avaliacao.tema ?? 0)) % 4 : 0;
  const rotuloTopo = ehProva
    ? "Prova final do curso"
    : modulo
      ? `Avaliação · Módulo ${String(modulo.ordem).padStart(2, "0")}`
      : "Avaliação";
  const primeiroNome = usuarioNome ? usuarioNome.split(" ")[0] : null;
  const aprovado = resultado?.aprovado ?? false;
  const perfeito = !!resultado && resultado.acertos === resultado.total;
  const seloTexto = aprovado
    ? ehProva ? "Laudo homologado" : "Laudo aceito"
    : "Diligências complementares";
  const recadoTxt = !resultado
    ? ""
    : aprovado
      ? perfeito
        ? "Gabarito, hein! Esse é o rigor que faz juiz confiar em laudo. Te vejo no próximo caso, ele já está na sua mesa."
        : `Parecer firme${primeiroNome ? `, ${primeiroNome}` : ""}. Dá uma olhada na revisão pra fechar os detalhes. É neles que mora a diferença entre um laudo bom e um irrefutável.`
      : "Calma. Diligência complementar faz parte do trabalho de todo perito. Revisa os pareceres abaixo, volta nos vídeos indicados e emite de novo. Estou contigo.";

  const cls = (nome: Cena) =>
    `cena${cena === nome ? " ativa" : ""}${cena === nome && saindo ? " saindo" : ""}`;

  return (
    <div className={ehProva ? "eh-prova" : undefined}>
      <div className="grao" aria-hidden="true"></div>
      <div className="forca" aria-hidden="true">
        <i style={{ width: `${(respondidas / nQ) * 100}%` }}></i>
      </div>

      <div className="caso-topo">
        <Link className="sair" href={`/curso/${curso.slug}`}>
          <IconeChevronLeft size={13} strokeWidth={2.4} />
          Sair do caso
        </Link>
        <span className="caso-id num">
          {avaliacao.caso_numero ? <>Caso Nº <b>{avaliacao.caso_numero}</b> · </> : null}
          {rotuloTopo}
        </span>
        <span style={{ width: 90 }}></span>
      </div>

      {/* ============ BRIEFING ============ */}
      <section className={cls("brief")}>
        {avaliacao.capa_url && (
          <div className="brief-bg" aria-hidden="true">
            <img src={avaliacao.capa_url} alt="" />
          </div>
        )}
        <div className="cena-conteudo">
          <div className="dossie anim">
            <span className="carimbo-nomeado" aria-hidden="true">
              {ehProva ? "Convocado" : "Nomeado"}
            </span>
            <span className="eyebrow">
              {ehProva ? "O juízo convocou você para a prova final" : "Você foi designado para o caso"}
            </span>
            <h1>
              {avaliacao.titulo.split(" ").slice(0, -1).join(" ")}{" "}
              <span className="grad-txt">{avaliacao.titulo.split(" ").slice(-1)[0]}.</span>
            </h1>
            {avaliacao.descricao && <p className="desc">{avaliacao.descricao}</p>}
            <div className="brief-dados num">
              <div className="bd"><span className="v">{nQ}</span><span className="r">quesitos</span></div>
              <div className="bd"><span className="v gd"><XP size={16} /> +{avaliacao.xp_total}</span><span className="r">XP em jogo</span></div>
              <div className="bd"><span className="v">{avaliacao.nota_minima.toFixed(1).replace(".", ",")}</span><span className="r">nota mínima</span></div>
            </div>
            <button className="btn btn-primario" onClick={() => troca("quesito")}>
              <IconeCheck size={14} strokeWidth={2.4} />
              {ehProva ? "Aceitar a prova" : "Aceitar o caso"}
            </button>
            <p className="brief-nota">Sem limite de tempo. Responda com a convicção de quem assina o laudo.</p>
          </div>
        </div>
      </section>

      {/* ============ QUESITO ============ */}
      <section className={cls("quesito")}>
        {q && (
          <div className={`cena-conteudo q-var-${varAnim}`} key={q.id}>
            <div className="q-cab anim">
              <span className="eyebrow num">
                Quesito <b>{String(atual + 1).padStart(2, "0")}</b> de {String(nQ).padStart(2, "0")}
              </span>
              <h2>{q.enunciado}</h2>
            </div>

            {q.tipo === "multipla_escolha" ? (
              <ul className="opcoes anim">
                {opcoesDe(q).map((op, i) => {
                  const sel = respostas[q.id]?.opcaoId === op.id;
                  return (
                    <li key={op.id}>
                      <button
                        className={`opcao${sel ? " sel" : ""}`}
                        onClick={() =>
                          setRespostas((r) => ({ ...r, [q.id]: { opcaoId: op.id } }))
                        }
                      >
                        <span className="tecla num">{i + 1}</span>
                        <span className="txt">{op.texto}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <>
                <label className="campo-valor">
                  {q.prefixo && <span className="fixo num">{q.prefixo}</span>}
                  <input
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0,00"
                    value={respostas[q.id]?.valor ?? ""}
                    onChange={(e) =>
                      setRespostas((r) => ({ ...r, [q.id]: { valor: e.target.value } }))
                    }
                    aria-label="Digite o valor da sua resposta"
                  />
                  {q.sufixo && <span className="fixo num">{q.sufixo}</span>}
                </label>
                <p className="campo-valor-dica">
                  Digite só o número. Vírgula para decimais, como na planilha do laudo.
                </p>
              </>
            )}

            <div className="q-rodape anim">
              <button
                className="btn btn-fantasma"
                style={{ visibility: atual === 0 ? "hidden" : "visible" }}
                onClick={() => setAtual((a) => Math.max(0, a - 1))}
              >
                Quesito anterior
              </button>
              <button
                className="btn btn-primario"
                disabled={!respondida(q) || (ultima && !todasRespondidas) || enviando}
                onClick={() => {
                  if (!ultima) setAtual((a) => a + 1);
                  else void emitirLaudo();
                }}
              >
                {enviando
                  ? "Emitindo laudo…"
                  : !ultima
                    ? "Próximo quesito"
                    : todasRespondidas
                      ? "Emitir laudo"
                      : "Responda todos para emitir"}
              </button>
              <span className="dica">
                {q.tipo === "multipla_escolha" ? (
                  <>Use <kbd>1</kbd>-<kbd>4</kbd> e <kbd>Enter</kbd></>
                ) : (
                  <>Confirme com <kbd>Enter</kbd></>
                )}
              </span>
            </div>
            {erro && <p className="campo-valor-dica" role="alert" style={{ color: "var(--vermelho-suave)", marginTop: 12 }}>{erro}</p>}

            <div className="pontos anim" aria-label="Navegar entre quesitos">
              {questoes.map((qq, i) => (
                <button
                  key={qq.id}
                  className={`ponto-q${i === atual ? " aqui" : ""}${respondida(qq) && i !== atual ? " resp" : ""}`}
                  aria-label={`Ir para o quesito ${i + 1}`}
                  onClick={() => setAtual(i)}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ============ VEREDITO ============ */}
      <section className={cls("veredito")}>
        {resultado && (
          <div className="cena-conteudo veredito-c">
            <div className={`selo-veredito${!aprovado ? " dilig" : ""}`}>{seloTexto}</div>
            <div className="nota-final grad-txt num anim">
              <span ref={notaRef}>0,0</span>
            </div>
            <p className="veredito-sub anim">
              {aprovado ? "Parecer sólido: " : "O caso continua: "}
              <b className="num">{resultado.acertos} de {resultado.total}</b> quesitos corretos
              {aprovado ? "." : ". Revise e conclua as diligências."}
            </p>
            <div className="ganhos num">
              <span className="ganho"><span className="gd"><XP size={15} /> +{resultado.xp} XP</span> creditados</span>
              {aprovado && resultado.media_curso !== null && (
                <span className="ganho">Média do curso: <b style={{ marginLeft: 4 }}>{resultado.media_curso.toFixed(1).replace(".", ",")}</b></span>
              )}
              {perfeito && (
                <span className="ganho"><Trofeu size={15} /> Conquista: <b style={{ marginLeft: 4 }}>{ehProva ? "Perito de carreira" : "Caçador de abusividades"}</b></span>
              )}
            </div>
            <div className="veredito-acoes anim">
              <button className="btn btn-primario" onClick={() => troca("revisao")}>Revisar meu laudo</button>
              <Link className="btn btn-fantasma" href={`/curso/${curso.slug}`}>Voltar ao curso</Link>
            </div>
            <div className="recado">
              <span className="foto" aria-hidden="true">FM</span>
              <div>
                <span className="de">Recado do Fábio</span>
                <p>{recadoTxt}</p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ============ REVISÃO ============ */}
      <section className={cls("revisao")}>
        {resultado && (
          <div className="cena-conteudo">
            <div className="rev-cab anim">
              <span className="eyebrow">Revisão do laudo</span>
              <h2>Quesito a quesito.</h2>
              <p>
                <b className="num" style={{ color: "var(--creme)" }}>
                  {resultado.acertos} corretos · {resultado.total - resultado.acertos} para revisar.
                </b>{" "}
                Cada erro vem com o parecer do especialista e o momento exato da aula para rever.
              </p>
            </div>
            <ul className="rev-lista anim">
              {questoes.map((qq, i) => {
                const g = resultado.gabarito.find((x) => x.questao_id === qq.id);
                if (!g) return null;
                const marcada =
                  qq.tipo === "multipla_escolha"
                    ? qq.opcoes.find((o) => o.id === g.opcao_marcada)?.texto ?? "—"
                    : fmtValor(g.valor_informado, qq.prefixo, qq.sufixo);
                const correta =
                  qq.tipo === "multipla_escolha"
                    ? g.opcao_correta_texto ?? "—"
                    : fmtValor(g.resposta_valor, qq.prefixo, qq.sufixo);
                return (
                  <li className={`rev-item ${g.correta ? "certo" : "errado"}`} key={qq.id}>
                    <div className="rev-linha">
                      <span className="rev-status" aria-hidden="true">{g.correta ? <IconeCheck size={13} /> : <IconeClose size={13} />}</span>
                      <div className="rev-txt">
                        <span className="qn num">Quesito {String(i + 1).padStart(2, "0")}</span>
                        <b>{qq.enunciado}</b>
                        {g.correta ? (
                          <p className="seu">Seu parecer: <span className="ok">{marcada}</span></p>
                        ) : (
                          <>
                            <p className="seu">
                              Seu parecer: <em>{marcada}</em> · Correto: <span className="ok">{correta}</span>
                            </p>
                            {g.parecer && (
                              <div className="parecer">
                                <span className="foto" aria-hidden="true">FM</span>
                                <div className="parecer-corpo">
                                  <div className="quem"><b>Fábio Mendes</b><span className="selo-esp">Especialista</span></div>
                                  <p>{g.parecer}</p>
                                  {(g.aula_ref || g.aula_id) && (
                                    <Link
                                      className="rever-video"
                                      href={g.aula_id ? `/curso/${curso.slug}/aula/${g.aula_id}` : `/curso/${curso.slug}`}
                                    >
                                      <IconePlay size={12} />
                                      Rever no vídeo{g.aula_ref ? ` · ${g.aula_ref}` : ""}
                                    </Link>
                                  )}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="rev-acoes anim">
              {resultado.acertos < resultado.total && (
                <button className="btn btn-primario" onClick={refazerErrados}>Refazer o que errei</button>
              )}
              <Link className="btn btn-fantasma" href={`/curso/${curso.slug}`}>Voltar ao curso</Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
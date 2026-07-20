"use client";
// components/MeuPlanoContent.tsx
// "Meu Plano" — o mesmo mapa da cerimônia da Rota do Perito, mas em modo
// vivo: progresso real por trilha (aula_progresso/avaliacao_tentativas),
// sem nenhuma animação de descoberta (isso já aconteceu em /anamnese).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import NavPlataforma from "@/components/NavPlataforma";
import type { DadosNav } from "@/lib/queries/nav";
import type { PlanoVivo } from "@/lib/queries/meuPlano";
import type { Territorio, AnamneseProgresso } from "@/lib/queries/anamnese";
import { refazerAnamnese } from "@/app/anamnese/actions";
import { IconeCheck, IconeChevronRight } from "@/components/Icones";

type Props = {
  nav: DadosNav;
  plano: PlanoVivo;
  territorios: Territorio[];
  textos: Record<string, string>;
  progresso: AnamneseProgresso;
};

export default function MeuPlanoContent({ nav, plano, territorios, textos, progresso }: Props) {
  const router = useRouter();
  const [refazendo, setRefazendo] = useState(false);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    setMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const atualIdx = plano.estacoes.findIndex((e) => e.estado === "atual");
  const rotaCompleta = plano.temPlano && plano.estacoes.length > 0 && plano.estacoes.every((e) => e.estado === "concluida");
  const estacaoAtual = atualIdx >= 0 ? plano.estacoes[atualIdx] : null;
  const marcadorXPct = estacaoAtual ? estacaoAtual.xPct : plano.entradaXPct;
  const marcadorYPct = estacaoAtual ? estacaoAtual.yPct : plano.entradaYPct;
  const mapaRef = useRef<HTMLDivElement>(null);
  const [cam, setCam] = useState({ tx: 0, ty: 0 });

  useEffect(() => {
    if (!mobile) return;
    const el = mapaRef.current;
    const wrap = el?.parentElement;
    if (!el || !wrap) return;
    const alvo = plano.estacoes[atualIdx] ?? plano.estacoes[plano.estacoes.length - 1];
    if (!alvo) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    const wrapW = wrap.clientWidth, wrapH = wrap.clientHeight;
    const px = (alvo.xPct / 100) * w;
    const py = (alvo.yPct / 100) * h;
    let tx = wrapW / 2 - px;
    let ty = wrapH / 2 - py;
    tx = Math.min(0, Math.max(wrapW - w, tx));
    ty = Math.min(0, Math.max(wrapH - h, ty));
    setCam({ tx, ty });
  }, [mobile, atualIdx, plano.estacoes]);

  async function handleRefazer() {
    if (typeof window === "undefined" || !window.confirm(textos.microcopy_refazer)) return;
    setRefazendo(true);
    const r = await refazerAnamnese();
    if (r.ok) router.push("/anamnese");
    else setRefazendo(false);
  }

  return (
    <div className="pagina-meu-plano">
      <NavPlataforma dados={nav} />

      <main className="mp-conteudo">
        <header className="mp-cabecalho">
          {plano.numeroCaso && <span className="mp-numero-caso num">CASO {plano.numeroCaso}</span>}
          <h1>{textos.microcopy_meu_plano_titulo}</h1>
          {plano.temPlano && <p>Seu ritmo declarado: {plano.horasSemanaDeclarada}h por semana.</p>}
        </header>

        {!plano.temPlano ? (
          progresso.questoesRespondidas > 0 ? (
            <div className="mp-retomar-card">
              <h2>{textos.meu_plano_retomar_titulo}</h2>
              <p className="mp-retomar-sub">
                Pergunta {Math.min(progresso.questoesRespondidas + 1, progresso.totalQuestoes)} de {progresso.totalQuestoes}
              </p>
              <div className="mp-retomar-barra">
                <i style={{ width: `${Math.round((progresso.questoesRespondidas / progresso.totalQuestoes) * 100)}%` }} />
              </div>
              <Link href="/anamnese" className="mp-btn-primario">
                {textos.meu_plano_retomar_cta} <IconeChevronRight size={16} />
              </Link>
            </div>
          ) : (
            <div className="mp-convite-card">
              <div className="mp-convite-bg" />
              <div className="mp-convite-vinheta" />
              <div className="mp-convite-conteudo">
                <h2>{textos.convite_titulo}</h2>
                <p>{textos.meu_plano_convite_linha}</p>
                <Link href="/anamnese" className="mp-btn-primario">
                  {textos.convite_botao_acao} <IconeChevronRight size={16} />
                </Link>
              </div>
            </div>
          )
        ) : (
          <>
            <div className="mp-mapa-wrap">
              <div
                ref={mapaRef}
                className="mp-mapa-viva"
                style={mobile ? { transform: `translate(${cam.tx}px, ${cam.ty}px)` } : undefined}
              >
                <img src="/rota/mesa-perito.png" alt="Meu mapa da Rota do Perito" className="mp-mapa-img" />

                <svg className="mp-mapa-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {plano.estacoes.map((e, i) => {
                    const de = i === 0 ? { x: plano.entradaXPct, y: plano.entradaYPct } : { x: plano.estacoes[i - 1].xPct, y: plano.estacoes[i - 1].yPct };
                    const percorrido = e.estado === "concluida" || e.estado === "atual";
                    return (
                      <path
                        key={e.trilhaId}
                        d={`M ${de.x} ${de.y} L ${e.xPct} ${e.yPct}`}
                        fill="none"
                        stroke={percorrido ? "url(#mp-grad-linha)" : "rgba(255,255,255,.18)"}
                        strokeWidth="0.6"
                        strokeLinecap="round"
                        strokeDasharray={percorrido ? undefined : "2,2"}
                      />
                    );
                  })}
                  <defs>
                    <linearGradient id="mp-grad-linha" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#20D9A6" />
                      <stop offset="100%" stopColor="#36DCD1" />
                    </linearGradient>
                  </defs>
                </svg>

                {!rotaCompleta && (
                  <div className="mp-marcador-voce" style={{ left: `${marcadorXPct}%`, top: `${marcadorYPct}%` }}>
                    <span>{textos.microcopy_marcador_inicial}</span>
                  </div>
                )}

                {territorios.map((t) => {
                  const estacao = plano.estacoes.find((e) => e.trilhaId === t.trilhaId);
                  const naRota = !!estacao;
                  return (
                    <div
                      key={t.trilhaId}
                      className={`mp-territorio${naRota ? ` na-rota ${estacao!.estado}` : " fora-rota"}`}
                      style={{ left: `${t.xPct}%`, top: `${t.yPct}%` }}
                      title={t.descricaoCurta}
                    >
                      <span className="mp-territorio-ponto">
                        {estacao?.estado === "concluida" && (
                          <span className="mp-selo-envelope"><IconeCheck size={9} /></span>
                        )}
                      </span>
                      {estacao?.estado === "atual" && <span className="mp-anel-pulsante" />}
                      <div className="mp-territorio-rotulo">
                        <b>{t.trilhaNome}</b>
                        {naRota && <span className="mp-territorio-pct">{estacao!.progressoPct}%</span>}
                        {!naRota && <em className="mp-tag-explorar">{textos.microcopy_territorio_explorar}</em>}
                        {estacao?.estado === "atual" && estacao.continuarHref && (
                          <Link href={estacao.continuarHref} className="mp-continuar">
                            Continuar <IconeChevronRight size={13} />
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {rotaCompleta && (
              <div className="mp-tesouro-banner">
                <img src="/rota/tesouro.png" alt="Tesouro conquistado" />
                <div>
                  <h3>{textos.meu_plano_tesouro_titulo}</h3>
                  <p>{textos.meu_plano_tesouro_mensagem}</p>
                </div>
              </div>
            )}

            <footer className="mp-rodape">
              <button className="mp-btn-refazer" onClick={handleRefazer} disabled={refazendo}>
                Refazer minha Rota do Perito
              </button>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}

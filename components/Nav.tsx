"use client";

import { useState } from "react";

export function Nav({ ativo = "/" }: { ativo?: string }) {
  const [popAberto, setPopAberto] = useState(false);

  return (
    <header className="nav">
      <div className="nav-inner">
        <a className="nav-logo" href="/">
          <img src="/img/logo.png" alt="" />
          <span>peritos<small>academy</small></span>
        </a>

        <nav className="nav-links">
          {[
            { href: "/", rotulo: "Início" },
            { href: "/trilhas", rotulo: "Trilhas" },
            { href: "/biblioteca", rotulo: "Biblioteca" },
            { href: "/comunidade", rotulo: "Comunidade" },
            { href: "/agenda", rotulo: "Agenda" },
          ].map((l) => (
            <a key={l.href} href={l.href} className={ativo === l.href ? "ativo" : ""}>
              {l.rotulo}
            </a>
          ))}
        </nav>

        <div className="nav-acoes">
          <div className="nivel-wrap">
            <button
              className="nav-nivel"
              aria-expanded={popAberto}
              onClick={() => setPopAberto(!popAberto)}
            >
              <span className="insignia num">12</span>
              <span className="nivel-txt">
                <b>Perito Analista</b>
                <small className="num">Nível 12 · 2.547 XP</small>
              </span>
            </button>

            {popAberto && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 150 }} onClick={() => setPopAberto(false)} />
                <div className="pop">
                  <div className="pop-cab">
                    <span className="insignia grande num">12</span>
                    <div className="pop-cab-txt">
                      <b>Perito Analista</b>
                      <span className="titulo-nivel">Nível 12 · 2.547 XP</span>
                    </div>
                    <span className="pop-prox">Nível 13<br />faltam 280 XP</span>
                  </div>
                  <div className="barra">
                    <i style={{ width: "90%" }}></i>
                  </div>
                  <p className="pop-meta">Próxima recompensa: <b>Insígnia Estrategista</b></p>
                  <div className="pop-sequencia">
                    <span className="rotulo">Sequência</span>
                    <div className="dias">
                      {[1,1,1,1,0,0,0].map((on, i) => (
                        <span key={i} className={`dia${on ? " feito" : i === 4 ? " hoje" : ""}`} />
                      ))}
                    </div>
                    <span className="frase">4 dias seguidos 🔥</span>
                  </div>
                  <ul className="pop-lista">
                    <li><span>Moedas</span><b className="num">540</b></li>
                    <li><span>Certificados</span><b className="num">2</b></li>
                    <li><span>Conquistas</span><b className="num">7</b></li>
                  </ul>
                  <a className="btn btn-fantasma" href="/perfil">Ver meu perfil</a>
                </div>
              </>
            )}
          </div>

          <button className="nav-avatar">MH</button>
        </div>
      </div>
    </header>
  );
}
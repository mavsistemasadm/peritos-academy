// lib/sons/cerimoniaMusica.ts
// Gerenciador único da camada de música da cerimônia da Rota do Perito
// (/anamnese). Web Audio API (não HTMLAudio): AudioBufferSourceNode com
// loop=true dá loop sem emenda audível (HTMLAudioElement tem um micro-gap
// no fim do arquivo que o Web Audio não tem), e GainNode dá automação de
// volume amostra-a-amostra em vez de setar .volume no meio de um frame.
//
// Autoplay dos navegadores exige gesto do usuário: o AudioContext só é
// criado (e retomado) dentro de iniciar(), chamado no clique de "Descobrir
// minha rota" — nunca antes disso, mesmo que precarregar() já tenha rodado.
"use client";

import { tocarTom, tocarRuido } from "./util";

type Faixa = "ambiente" | "tema";

const ARQUIVOS: Record<Faixa, string> = {
  ambiente: "/rota/audio/ambiente.mp3",
  tema: "/rota/audio/tema.mp3",
};

type FonteAtiva = { source: AudioBufferSourceNode; gain: GainNode };

class CerimoniaMusica {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers: Partial<Record<Faixa, AudioBuffer>> = {};
  private fontes: Partial<Record<Faixa, FonteAtiva>> = {};
  private carregamento: Promise<void> | null = null;
  private habilitado = false;
  private mutado = false;
  private ativa = false;

  private garantirContexto(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (this.ctx) return this.ctx;
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.mutado ? 0 : 1;
      this.master.connect(this.ctx.destination);
      return this.ctx;
    } catch {
      return null;
    }
  }

  /** Decodifica os dois arquivos em background. Não toca nada sozinho. */
  precarregar() {
    if (typeof window === "undefined" || this.carregamento) return;
    const ctx = this.garantirContexto();
    if (!ctx) return;
    this.carregamento = Promise.all(
      (Object.keys(ARQUIVOS) as Faixa[]).map(async (faixa) => {
        try {
          const resp = await fetch(ARQUIVOS[faixa]);
          const bytes = await resp.arrayBuffer();
          this.buffers[faixa] = await ctx.decodeAudioData(bytes);
        } catch {
          // arquivo indisponível — a cerimônia segue sem essa faixa
        }
      })
    ).then(() => undefined);
  }

  private async tocar(faixa: Faixa, volumeAlvo: number, fadeInMs: number) {
    if (!this.habilitado || !this.carregamento) return;
    await this.carregamento;
    const ctx = this.ctx;
    const buffer = this.buffers[faixa];
    if (!ctx || !this.master || !buffer) return;
    this.pararFaixa(faixa, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = ctx.createGain();
    const agora = ctx.currentTime;
    gain.gain.setValueAtTime(0, agora);
    if (fadeInMs > 0) gain.gain.linearRampToValueAtTime(volumeAlvo, agora + fadeInMs / 1000);
    else gain.gain.setValueAtTime(volumeAlvo, agora);

    source.connect(gain);
    gain.connect(this.master);
    source.start();
    this.fontes[faixa] = { source, gain };
  }

  private ajustarVolume(faixa: Faixa, volumeAlvo: number, duracaoMs: number) {
    const f = this.fontes[faixa];
    if (!f || !this.ctx) return;
    const agora = this.ctx.currentTime;
    f.gain.gain.cancelScheduledValues(agora);
    f.gain.gain.setValueAtTime(f.gain.gain.value, agora);
    f.gain.gain.linearRampToValueAtTime(volumeAlvo, agora + Math.max(duracaoMs, 1) / 1000);
  }

  private pararFaixa(faixa: Faixa, fadeOutMs: number) {
    const f = this.fontes[faixa];
    if (!f || !this.ctx) return;
    const { source, gain } = f;
    const agora = this.ctx.currentTime;
    if (fadeOutMs > 0) {
      gain.gain.cancelScheduledValues(agora);
      gain.gain.setValueAtTime(gain.gain.value, agora);
      gain.gain.linearRampToValueAtTime(0, agora + fadeOutMs / 1000);
      setTimeout(() => { try { source.stop(); } catch {} }, fadeOutMs + 60);
    } else {
      try { source.stop(); } catch {}
    }
    delete this.fontes[faixa];
  }

  // ---------------- API de cena (chamada por AnamneseContent) ----------------

  /** Chamada só dentro do clique de "Descobrir minha rota" — o gesto que libera autoplay. */
  iniciar(habilitado: boolean) {
    this.habilitado = habilitado;
    if (!habilitado) return;
    const ctx = this.garantirContexto();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    this.precarregar();
    this.ativa = true;
    this.tocar("ambiente", 0.15, 400);
  }

  /** Ato III das perguntas: ambiente desce pra ~10%. */
  entrarAtoIII() {
    this.ajustarVolume("ambiente", 0.1, 1200);
  }

  /** Dossiê: música sai, a datilografia reina. */
  entrarDossie() {
    this.ajustarVolume("ambiente", 0, 900);
  }

  /** Carimbo: silêncio total de música (a pausa dramática é sonora). */
  entrarCarimbo() {
    this.pararFaixa("ambiente", 0);
  }

  /** Clique sutil de tecla, um por caractere da datilografia do dossiê. */
  tocarTecla() {
    if (!this.habilitado || !this.ctx || !this.master) return;
    const variacao = 0.85 + Math.random() * 0.3; // leve aleatoriedade de pitch
    tocarTom(this.ctx, this.master, 1800 * variacao, 0, 0.02, { tipo: "square", volume: 0.04 });
    tocarRuido(this.ctx, this.master, 0, 0.018, { volume: 0.05, filtro: { tipo: "highpass", freq: 3000 } });
  }

  /** Mesa se desdobra: tema entra com swell. */
  entrarMesa() {
    this.pararFaixa("ambiente", 0);
    this.tocar("tema", 0.25, 1500);
  }

  /** Ping curto e sutil quando um anel de estação acende. */
  pingEstacao() {
    if (!this.habilitado || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 1046.5;
    const agora = ctx.currentTime;
    gain.gain.setValueAtTime(0, agora);
    gain.gain.linearRampToValueAtTime(0.06, agora + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, agora + 0.5);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(agora);
    osc.stop(agora + 0.55);
  }

  /** Tesouro: leve subida. */
  entrarTesouro() {
    this.ajustarVolume("tema", 0.3, 800);
  }

  /** O mapa é seu (CTAs): decaimento suave. */
  entrarMapaFinal() {
    this.ajustarVolume("tema", 0.12, 1600);
  }

  /** Botão de mute discreto — não mexe no que está tocando, só no ganho mestre. */
  mudo(mutado: boolean) {
    this.mutado = mutado;
    if (!this.master || !this.ctx) return;
    const agora = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(agora);
    this.master.gain.setValueAtTime(this.master.gain.value, agora);
    this.master.gain.linearRampToValueAtTime(mutado ? 0 : 1, agora + 0.15);
  }

  /** Já foi iniciada nesta sessão de página (usado pra iniciar sob demanda
   * quando a cena "convite" é pulada, ex.: retomar uma anamnese parcial). */
  estaAtiva() {
    return this.ativa;
  }

  /** Sair da página: fade out de 1s em tudo que estiver tocando. */
  sair() {
    if (!this.ativa) return;
    this.pararFaixa("ambiente", 1000);
    this.pararFaixa("tema", 1000);
    this.ativa = false;
  }
}

export const cerimoniaMusica = new CerimoniaMusica();

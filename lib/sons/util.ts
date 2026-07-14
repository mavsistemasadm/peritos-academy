// lib/sons/util.ts
// Helpers de síntese compartilhados pelos sons de conquista (osciladores e
// ruído filtrado via Web Audio API — nada de arquivo de áudio).

export function tocarTom(
  ctx: AudioContext,
  destino: AudioNode,
  freq: number,
  inicio: number,
  duracao: number,
  opts: { tipo?: OscillatorType; volume?: number; freqFinal?: number } = {}
) {
  const { tipo = 'sine', volume = 0.5, freqFinal } = opts
  const t0 = ctx.currentTime + inicio

  const osc = ctx.createOscillator()
  osc.type = tipo
  osc.frequency.setValueAtTime(freq, t0)
  if (freqFinal) osc.frequency.exponentialRampToValueAtTime(freqFinal, t0 + duracao)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(volume, t0 + Math.min(0.02, duracao / 4))
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duracao)

  osc.connect(gain)
  gain.connect(destino)
  osc.start(t0)
  osc.stop(t0 + duracao + 0.02)
}

export function tocarRuido(
  ctx: AudioContext,
  destino: AudioNode,
  inicio: number,
  duracao: number,
  opts: { volume?: number; filtro?: { tipo: BiquadFilterType; freq: number; q?: number } } = {}
) {
  const { volume = 0.4, filtro } = opts
  const t0 = ctx.currentTime + inicio

  const tamanho = Math.max(1, Math.floor(ctx.sampleRate * duracao))
  const buffer = ctx.createBuffer(1, tamanho, ctx.sampleRate)
  const dados = buffer.getChannelData(0)
  for (let i = 0; i < tamanho; i++) dados[i] = Math.random() * 2 - 1

  const fonte = ctx.createBufferSource()
  fonte.buffer = buffer

  let ultimoNo: AudioNode = fonte
  if (filtro) {
    const f = ctx.createBiquadFilter()
    f.type = filtro.tipo
    f.frequency.value = filtro.freq
    if (filtro.q) f.Q.value = filtro.q
    fonte.connect(f)
    ultimoNo = f
  }

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(volume, t0 + Math.min(0.03, duracao / 4))
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duracao)

  ultimoNo.connect(gain)
  gain.connect(destino)
  fonte.start(t0)
  fonte.stop(t0 + duracao + 0.02)
}

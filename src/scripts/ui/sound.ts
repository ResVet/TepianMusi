// Every sound on the site is synthesised here with Web Audio: the river,
// the ketek engine (the "tok-tok" that gave the boat its name), insects at
// night and small cues for the interactions. Nothing plays until the
// visitor turns sound on.
export type Cue = 'tok' | 'stamp' | 'chime' | 'sizzle' | 'page' | 'pop' | 'tear' | 'wrong' | 'pour' | 'knead';

class Sound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private riverGain!: GainNode;
  private engineGain!: GainNode;
  private engineSrc!: AudioBufferSourceNode;
  private nightGain!: GainNode;
  private noise!: AudioBuffer;
  enabled = false;

  private build() {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    const n = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;

    // river: brown noise, low-passed, slowly breathing
    const brown = ctx.createBuffer(1, n, ctx.sampleRate);
    const b = brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      b[i] = last * 3.2;
    }
    const river = ctx.createBufferSource();
    river.buffer = brown;
    river.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 520;
    this.riverGain = ctx.createGain();
    this.riverGain.gain.value = 0.35;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoAmt = ctx.createGain();
    lfoAmt.gain.value = 0.12;
    lfo.connect(lfoAmt).connect(this.riverGain.gain);
    river.connect(lp).connect(this.riverGain).connect(this.master);
    river.start();
    lfo.start();

    // ketek engine: a loop of single-cylinder putts
    const sec = ctx.sampleRate;
    const eng = ctx.createBuffer(1, sec, ctx.sampleRate);
    const e = eng.getChannelData(0);
    const putts = 8;
    for (let k = 0; k < putts; k++) {
      const start = Math.floor((k / putts) * sec + (Math.random() - 0.5) * 300);
      const amp = 0.75 + Math.random() * 0.25;
      for (let i = 0; i < 2600; i++) {
        const t = i / sec;
        const env = Math.exp(-t * 55);
        const v = (Math.sin(2 * Math.PI * 62 * t) * 0.8 + Math.sin(2 * Math.PI * 131 * t) * 0.35 + (Math.random() * 2 - 1) * 0.25) * env * amp;
        const j = (start + i) % sec;
        e[j] += v;
      }
    }
    this.engineSrc = ctx.createBufferSource();
    this.engineSrc.buffer = eng;
    this.engineSrc.loop = true;
    const elp = ctx.createBiquadFilter();
    elp.type = 'lowpass';
    elp.frequency.value = 900;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineSrc.connect(elp).connect(this.engineGain).connect(this.master);
    this.engineSrc.start();

    // night insects: a high chirp pattern, quiet
    const ins = ctx.createBuffer(1, n, ctx.sampleRate);
    const s = ins.getChannelData(0);
    for (let k = 0; k < 18; k++) {
      const st = Math.floor(Math.random() * (n - sec * 0.3));
      const f = 4200 + Math.random() * 900;
      for (let i = 0; i < sec * 0.22; i++) {
        const t = i / sec;
        const env = Math.max(0, Math.sin((t / 0.22) * Math.PI)) * (0.5 + 0.5 * Math.sign(Math.sin(t * 2 * Math.PI * 28)));
        s[st + i] += Math.sin(2 * Math.PI * f * t) * env * 0.12;
      }
    }
    const insSrc = ctx.createBufferSource();
    insSrc.buffer = ins;
    insSrc.loop = true;
    this.nightGain = ctx.createGain();
    this.nightGain.gain.value = 0;
    insSrc.connect(this.nightGain).connect(this.master);
    insSrc.start();
  }

  async enable() {
    if (!this.ctx) this.build();
    const ctx = this.ctx!;
    if (ctx.state === 'suspended') await ctx.resume();
    this.enabled = true;
    this.master.gain.setTargetAtTime(0.7, ctx.currentTime, 0.4);
  }

  disable() {
    this.enabled = false;
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
  }

  /** speed in m/s of the ketek, night 0..1. */
  setScene(speed: number, night: number, inside: boolean) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const k = Math.min(1, speed / 6);
    this.engineGain.gain.setTargetAtTime(inside ? 0.02 : 0.05 + k * 0.32, t, 0.3);
    this.engineSrc.playbackRate.setTargetAtTime(0.82 + k * 0.55, t, 0.4);
    this.riverGain.gain.setTargetAtTime(inside ? 0.18 : 0.32, t, 0.6);
    this.nightGain.gain.setTargetAtTime(night * 0.5, t, 1.2);
  }

  play(cue: Cue) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.connect(this.master);
    const tone = (f: number, dur: number, gain: number, type: OscillatorType = 'sine', at = 0, slide?: number) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f, t + at);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + at + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + at);
      g.gain.exponentialRampToValueAtTime(gain, t + at + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
      o.connect(g).connect(out);
      o.start(t + at);
      o.stop(t + at + dur + 0.05);
    };
    const hiss = (dur: number, gain: number, type: BiquadFilterType, freq: number, q = 1, at = 0, shape: 'decay' | 'swell' | 'crackle' = 'decay') => {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      const t0 = t + at;
      g.gain.setValueAtTime(0.0001, t0);
      if (shape === 'swell') {
        g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.4);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      } else if (shape === 'crackle') {
        for (let i = 0; i < 26; i++) {
          const at2 = t0 + (i / 26) * dur;
          g.gain.setValueAtTime(gain * (0.3 + Math.random() * 0.7), at2);
          g.gain.setValueAtTime(gain * 0.15, at2 + 0.02);
        }
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      } else {
        g.gain.exponentialRampToValueAtTime(gain, t0 + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      }
      src.connect(f).connect(g).connect(out);
      src.start(t0, Math.random() * 1.5);
      src.stop(t0 + dur + 0.05);
    };
    switch (cue) {
      case 'tok':
        tone(820, 0.09, 0.22, 'sine');
        hiss(0.03, 0.08, 'bandpass', 2400, 2);
        break;
      case 'pop':
        tone(560, 0.12, 0.16, 'sine', 0, 880);
        break;
      case 'stamp':
        tone(92, 0.22, 0.5, 'sine');
        hiss(0.12, 0.25, 'lowpass', 900);
        break;
      case 'chime': {
        // a little slendro-ish run on bonang-like bells
        const base = 392;
        [1, 1.14, 1.31, 1.5].forEach((r, i) => {
          tone(base * r, 1.3, 0.12, 'sine', i * 0.13);
          tone(base * r * 2.76, 0.5, 0.03, 'sine', i * 0.13);
        });
        break;
      }
      case 'wrong':
        tone(230, 0.22, 0.12, 'triangle');
        tone(185, 0.3, 0.1, 'triangle', 0.16);
        break;
      case 'sizzle':
        hiss(1.8, 0.12, 'highpass', 3200, 0.7, 0, 'crackle');
        break;
      case 'page':
        hiss(0.32, 0.1, 'bandpass', 1400, 0.8, 0, 'swell');
        break;
      case 'tear':
        hiss(0.28, 0.14, 'highpass', 1800, 0.6, 0, 'crackle');
        break;
      case 'pour':
        hiss(0.9, 0.08, 'bandpass', 900, 3, 0, 'swell');
        break;
      case 'knead':
        hiss(0.22, 0.07, 'lowpass', 500, 1, 0, 'swell');
        break;
    }
    setTimeout(() => out.disconnect(), 2500);
  }
}

export const sound = new Sound();

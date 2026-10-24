/**
 * Procedural sound effects (WebAudio only, no assets).
 * Sizzle: all slots are mixed into ONE shared voice (a looping noise source ->
 * low bandpass + bright highpass -> gains), so cost is constant for any slot count.
 */
type Ctx = AudioContext;

const MASTER = 0.6;
const MAX_SLOTS = 32;

export class Sfx {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private _muted = false;

  // shared sizzle voice
  private levels = new Float32Array(MAX_SLOTS);
  private bodyGain: GainNode | null = null;
  private hissGain: GainNode | null = null;
  private hissFilter: BiquadFilterNode | null = null;
  private bodyFilter: BiquadFilterNode | null = null;
  private crackleTimer: ReturnType<typeof setTimeout> | null = null;
  private total = 0;

  get muted(): boolean { return this._muted; }
  set muted(v: boolean) {
    this._muted = v;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(v ? 0 : MASTER, this.ctx.currentTime, 0.02);
    }
  }

  unlock(): void {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this._muted ? 0 : MASTER;
        const comp = this.ctx.createDynamicsCompressor();
        this.master.connect(comp).connect(this.ctx.destination);
        this.noise = this.makeNoise(this.ctx);
        this.buildSizzle();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch { /* audio unavailable */ }
  }

  setSizzle(slot: number, level: number): void {
    if (!this.ctx || slot < 0 || slot >= MAX_SLOTS) return;
    this.levels[slot] = level > 0 ? Math.min(1, level) : 0;
    let sum = 0, max = 0;
    for (let i = 0; i < MAX_SLOTS; i++) { const l = this.levels[i]; sum += l; if (l > max) max = l; }
    this.total = sum;
    const t = this.ctx.currentTime;
    // loudness: soft-saturating sum so many slots don't blow up
    const loud = 1 - Math.exp(-sum * 0.9);
    this.bodyGain?.gain.setTargetAtTime(loud * 0.22, t, 0.08);
    this.hissGain?.gain.setTargetAtTime(loud * (0.08 + 0.3 * max), t, 0.08);
    this.hissFilter?.frequency.setTargetAtTime(3500 + 3500 * max, t, 0.1);
    this.bodyFilter?.frequency.setTargetAtTime(900 + 900 * max, t, 0.1);
    if (sum > 0.01 && this.crackleTimer === null) this.scheduleCrackle();
  }

  stopAll(): void {
    this.levels.fill(0);
    this.total = 0;
    if (this.crackleTimer !== null) { clearTimeout(this.crackleTimer); this.crackleTimer = null; }
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.bodyGain?.gain.setTargetAtTime(0, t, 0.05);
    this.hissGain?.gain.setTargetAtTime(0, t, 0.05);
  }

  place(): void {
    this.burst({ dur: 0.18, type: 'highpass', f0: 5000, f1: 7000, q: 0.5, gain: 0.22, attack: 0.005 });
  }

  flip(): void {
    this.burst({ dur: 0.3, type: 'bandpass', f0: 2500, f1: 6000, q: 0.8, gain: 0.35, attack: 0.01 });
    this.tone({ f0: 900, f1: 500, dur: 0.05, gain: 0.18, type: 'triangle', delay: 0.02 });
  }

  ding(): void {
    // soft bell: two inharmonic partials with gentle decay
    this.tone({ f0: 1318, dur: 0.7, gain: 0.12, type: 'sine', attack: 0.004 });
    this.tone({ f0: 1318 * 2.76, dur: 0.3, gain: 0.03, type: 'sine', attack: 0.004 });
  }

  burnt(): void {
    this.burst({ dur: 0.55, type: 'lowpass', f0: 900, f1: 200, q: 0.7, gain: 0.4, attack: 0.04 });
    this.tone({ f0: 180, f1: 90, dur: 0.5, gain: 0.1, type: 'sine', attack: 0.04 });
  }

  flare(): void {
    this.burst({ dur: 0.8, type: 'bandpass', f0: 300, f1: 1800, q: 0.6, gain: 0.5, attack: 0.15 });
  }

  spray(): void {
    this.burst({ dur: 0.45, type: 'bandpass', f0: 6500, f1: 5000, q: 1.2, gain: 0.3, attack: 0.02 });
  }

  bin(): void {
    this.tone({ f0: 140, f1: 60, dur: 0.18, gain: 0.35, type: 'sine', attack: 0.003 });
    this.burst({ dur: 0.1, type: 'lowpass', f0: 600, f1: 300, q: 0.5, gain: 0.2, attack: 0.002 });
  }

  coin(): void {
    this.tone({ f0: 1568, dur: 0.12, gain: 0.12, type: 'square', attack: 0.002 });
    this.tone({ f0: 2093, dur: 0.5, gain: 0.12, type: 'square', attack: 0.002, delay: 0.07 });
  }

  shake(): void {
    // soft rattle of powder: a few short highpass-noise ticks
    for (let i = 0; i < 4; i++) {
      setTimeout(() => this.burst({ dur: 0.03, type: 'highpass', f0: 3500 + Math.random() * 3000, q: 0.6, gain: 0.12, attack: 0.002 }), i * 45 + Math.random() * 20);
    }
  }

  // ---- internals ----

  private makeNoise(ctx: Ctx): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) { // light pink-ish noise
      const w = Math.random() * 2 - 1;
      b0 = 0.99 * b0 + w * 0.15; b1 = 0.96 * b1 + w * 0.3; b2 = 0.57 * b2 + w * 0.5;
      d[i] = (b0 + b1 + b2 + w * 0.3) * 0.5;
    }
    return buf;
  }

  private buildSizzle(): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const body = ctx.createBiquadFilter(); body.type = 'bandpass'; body.frequency.value = 900; body.Q.value = 0.7;
    const hiss = ctx.createBiquadFilter(); hiss.type = 'highpass'; hiss.frequency.value = 4000; hiss.Q.value = 0.5;
    this.bodyGain = ctx.createGain(); this.bodyGain.gain.value = 0;
    this.hissGain = ctx.createGain(); this.hissGain.gain.value = 0;
    src.connect(body).connect(this.bodyGain).connect(this.master!);
    src.connect(hiss).connect(this.hissGain).connect(this.master!);
    src.start();
    this.bodyFilter = body;
    this.hissFilter = hiss;
  }

  private scheduleCrackle(): void {
    const run = () => {
      this.crackleTimer = null;
      if (!this.ctx || this.total < 0.01) return;
      if (!this._muted) {
        const g = Math.min(1, this.total);
        this.burst({ dur: 0.02 + Math.random() * 0.03, type: 'highpass', f0: 2500 + Math.random() * 4000, q: 0.7, gain: 0.05 + 0.1 * g * Math.random(), attack: 0.001 });
      }
      const rate = 4 + 14 * Math.min(1, this.total); // crackles per second
      this.crackleTimer = setTimeout(run, (1000 / rate) * (0.4 + Math.random() * 1.2));
    };
    this.crackleTimer = setTimeout(run, 60);
  }

  private burst(o: { dur: number; type: BiquadFilterType; f0: number; f1?: number; q?: number; gain: number; attack: number }): void {
    if (!this.ctx || !this.master || !this.noise || this._muted) return;
    try {
      const ctx = this.ctx, t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const f = ctx.createBiquadFilter();
      f.type = o.type; f.Q.value = o.q ?? 0.7;
      f.frequency.setValueAtTime(o.f0, t);
      if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(o.gain, t + o.attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
      src.connect(f).connect(g).connect(this.master);
      src.start(t, Math.random() * 1.5, o.dur + 0.05);
      src.stop(t + o.dur + 0.05);
    } catch { /* ignore */ }
  }

  private tone(o: { f0: number; f1?: number; dur: number; gain: number; type: OscillatorType; attack?: number; delay?: number }): void {
    if (!this.ctx || !this.master || this._muted) return;
    try {
      const ctx = this.ctx, t = ctx.currentTime + (o.delay ?? 0);
      const osc = ctx.createOscillator();
      osc.type = o.type;
      osc.frequency.setValueAtTime(o.f0, t);
      if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(o.gain, t + (o.attack ?? 0.005));
      g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + o.dur + 0.02);
    } catch { /* ignore */ }
  }
}

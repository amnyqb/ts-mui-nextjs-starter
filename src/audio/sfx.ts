/**
 * Synthesised sound effects (Web Audio). No audio files: every sound is generated from oscillators and
 * filtered noise, so the game stays 100% original and tiny. Nothing plays until the first user gesture.
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private noiseBuf!: AudioBuffer;
  private unlocked = false;
  private last: Record<string, number> = {};
  private voices = 0;
  muted = false;
  volume = 0.5;
  /** number of sounds actually started (used by the browser test) */
  played = 0;

  /** Call from any user gesture (pointer/key). Safe to call repeatedly. */
  unlock() {
    this.unlocked = true;
    const c = this.ensure();
    if (c && c.state === 'suspended') void c.resume();
  }

  get state(): string {
    return this.ctx?.state ?? 'none';
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
  }

  private ensure(): AudioContext | null {
    if (!this.unlocked) return null;
    if (!this.ctx) {
      try {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : this.volume;
        const comp = this.ctx.createDynamicsCompressor(); // keeps big battles from clipping
        this.master.connect(comp).connect(this.ctx.destination);
        const len = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      } catch {
        return null;
      }
    }
    return this.ctx;
  }

  /** rate-limit a sound name and the total number of overlapping voices */
  private gate(name: string, minGapMs: number): AudioContext | null {
    const c = this.ensure();
    if (!c || c.state !== 'running') return null;
    const now = performance.now();
    if (now - (this.last[name] ?? -1e9) < minGapMs || this.voices > 24) return null;
    this.last[name] = now;
    return c;
  }

  private done(dur: number) {
    this.voices++;
    this.played++;
    setTimeout(() => this.voices--, dur * 1000);
  }

  private tone(c: AudioContext, f0: number, f1: number, dur: number, type: OscillatorType, vol: number, delay = 0) {
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(c: AudioContext, dur: number, vol: number, f0: number, f1: number, delay = 0) {
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  // ------------------------------------------------------------------ sounds (vol is 0..1 distance falloff)

  rifle(vol: number) {
    const c = this.gate('rifle', 45);
    if (!c) return;
    this.noise(c, 0.09, 0.22 * vol, 5200, 900);
    this.tone(c, 900, 260, 0.07, 'square', 0.08 * vol);
    this.done(0.1);
  }

  tank(vol: number) {
    const c = this.gate('tank', 70);
    if (!c) return;
    this.noise(c, 0.22, 0.4 * vol, 2200, 120);
    this.tone(c, 150, 45, 0.25, 'sawtooth', 0.28 * vol);
    this.done(0.3);
  }

  boom(big: boolean, vol: number) {
    const c = this.gate('boom', 60);
    if (!c) return;
    const d = big ? 0.9 : 0.4;
    this.noise(c, d, (big ? 0.7 : 0.45) * vol, 1800, 60);
    this.tone(c, big ? 90 : 140, 28, d, 'sine', (big ? 0.6 : 0.35) * vol);
    this.done(d);
  }

  /** rising two-note jingle for a capture, falling one for a loss */
  capture(mine: boolean) {
    const c = this.gate('capture', 200);
    if (!c) return;
    if (mine) {
      this.tone(c, 440, 440, 0.14, 'triangle', 0.25);
      this.tone(c, 660, 660, 0.25, 'triangle', 0.25, 0.12);
    } else {
      this.tone(c, 330, 330, 0.16, 'sawtooth', 0.2);
      this.tone(c, 220, 200, 0.3, 'sawtooth', 0.2, 0.14);
    }
    this.done(0.45);
  }

  command() {
    const c = this.gate('command', 60);
    if (!c) return;
    this.tone(c, 700, 1000, 0.06, 'square', 0.07);
    this.done(0.08);
  }

  spawn() {
    const c = this.gate('spawn', 120);
    if (!c) return;
    this.tone(c, 300, 600, 0.12, 'triangle', 0.1);
    this.done(0.15);
  }

  end(win: boolean) {
    const c = this.ensure();
    if (!c || c.state !== 'running') return;
    const notes = win ? [392, 494, 587, 784] : [392, 330, 262, 196];
    notes.forEach((f, i) => this.tone(c, f, f, 0.35, win ? 'triangle' : 'sawtooth', 0.28, i * 0.18));
    this.played++;
  }
}

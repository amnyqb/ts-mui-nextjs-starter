import type { Sfx } from '../audio/sfx';
import { LINES, MOOD, type Cat, type Mood } from '../data/lines';
import { CHUCK_NAME, GENERAL_LINES, GENERAL_NAME, chooseSpeaker, type Speaker } from '../data/general';
import { ShuffleBag } from '../data/shuffle';

/** minimum real-time gap (ms) before the same category may be spoken again */
const COOLDOWN: Partial<Record<Cat, number>> = {
  captureMine: 9000, captureLost: 9000, enemyTook: 15000, tankLost: 12000, tankKill: 12000, unitLost: 9000, baseAttack: 20000, bloodbath: 35000, idle: 30000,
  crushing: 60000, losing: 60000, comeback: 40000, order: 1e9, pause: 8000, resume: 8000,
};
const GAP_MS = 3500;
const CHARS_PER_SEC = 42;

interface Item { cat: Cat; speaker: Speaker; text: string; key: string; prio: number; at: number }
interface Playing extends Item { start: number; dur: number; cps: number; talkUntil: number; waiting: boolean }

/**
 * Chuck Sprocket's TV transmission: animated face, typewriter subtitles, optional robotic voice.
 * Lines arrive via say(); this class only presents them (cooldowns, queueing, no-repeat shuffling).
 */
export class Commentator {
  enabled = true;
  voiceOn = true;
  /** everything he has said, for tests */
  log: { cat: Cat; speaker: Speaker; text: string; clip: boolean }[] = [];

  private cur: Playing | null = null;
  private pending: Item[] = [];
  private lastEnd = -1e9;
  private lastCat: Partial<Record<Cat, number>> = {};
  private bags = new Map<string, ShuffleBag>();
  private nameEl = document.querySelector('#reporter .name') as HTMLElement;
  private shown = -1;
  private panel = document.getElementById('reporter') as HTMLElement;
  private text = document.getElementById('rep-text') as HTMLElement;
  private face = document.getElementById('rep-face') as HTMLCanvasElement;
  private g = this.face.getContext('2d')!;

  constructor(private sfx: Sfx) {}

  reset() {
    this.cur = null;
    this.pending = [];
    this.lastCat = {};
    this.lastEnd = -1e9;
    this.log = [];
    this.stopVoice();
    this.panel.style.display = 'none';
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) {
      this.cur = null;
      this.pending = [];
      this.stopVoice();
      this.panel.style.display = 'none';
    }
  }
  setVoice(on: boolean) {
    this.voiceOn = on;
    if (!on) this.stopVoice();
  }

  /** pick a line without repeating until the whole category has been heard */
  pick(cat: Cat, speaker: Speaker): { i: number; text: string } {
    const lines = speaker === 'general' ? GENERAL_LINES[cat]! : LINES[cat];
    const id = `${speaker}:${cat}`;
    let bag = this.bags.get(id);
    if (!bag) this.bags.set(id, (bag = new ShuffleBag(lines.length)));
    const i = bag.next();
    return { i, text: lines[i] };
  }

  /** `speaker` forces who talks (used by tests); normally it is decided at random per event (see GENERAL_CHANCE). */
  say(cat: Cat, prio = 1, speaker?: Speaker) {
    if (!this.enabled) return;
    const now = performance.now();
    if (prio < 3 && now - (this.lastCat[cat] ?? -1e9) < (COOLDOWN[cat] ?? 15000)) return;
    this.lastCat[cat] = now;
    const who: Speaker = speaker === 'general' ? (GENERAL_LINES[cat] ? 'general' : 'chuck') : (speaker ?? chooseSpeaker(cat));
    const p = this.pick(cat, who);
    const item: Item = { cat, speaker: who, text: p.text, key: `${who === 'general' ? 'g_' : ''}${cat}_${p.i}`, prio, at: now };
    if (prio >= 3) {
      this.pending = [];
      this.start(item, now);
    } else if (!this.cur && now - this.lastEnd >= GAP_MS) {
      this.start(item, now);
    } else {
      this.pending.push(item);
      if (this.pending.length > 4) {
        this.pending.sort((a, b) => b.prio - a.prio || b.at - a.at);
        this.pending.length = 4;
      }
    }
  }

  private start(item: Item, now: number) {
    const c: Playing = { ...item, start: now, dur: (item.text.length / CHARS_PER_SEC) * 1000 + 2600, cps: CHARS_PER_SEC, talkUntil: 0, waiting: false };
    const entry = { cat: item.cat, speaker: item.speaker, text: item.text, clip: false };
    this.cur = c;
    this.shown = -1;
    this.log.push(entry);
    this.panel.style.display = 'block';
    this.panel.className = `panel ${MOOD[item.cat]} ${item.speaker}`; // the frame reacts to the mood and the speaker
    this.nameEl.textContent = item.speaker === 'general' ? GENERAL_NAME : CHUCK_NAME;
    if (!this.voiceOn || this.sfx.muted) return;

    // Chuck's recorded clip: subtitles and mouth then follow the real length of the audio.
    // If it cannot be loaded or played within a second (no audio yet, blocked), fall back to browser speech.
    c.waiting = true;
    const giveUp = window.setTimeout(() => {
      if (this.cur !== c || !c.waiting) return;
      c.waiting = false;
      c.start = performance.now();
      this.speak(item.text);
    }, 1000);
    void this.sfx.loadVoice(item.key).then((buf) => {
      if (this.cur !== c || !c.waiting) return;
      window.clearTimeout(giveUp);
      c.waiting = false;
      c.start = performance.now();
      if (buf && this.sfx.playVoice(buf)) {
        entry.clip = true;
        c.cps = item.text.length / buf.duration;
        c.dur = buf.duration * 1000 + 1800;
        c.talkUntil = c.start + buf.duration * 1000;
      } else this.speak(item.text);
    });
  }

  private speak(text: string) {
    if (!this.voiceOn || this.sfx.muted) return;
    const ss = window.speechSynthesis;
    if (!ss) return;
    ss.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.pitch = 0.55; // low and tinny: a robot who thinks he is a newsreader
    u.rate = 1.08;
    u.volume = 0.9;
    const voices = ss.getVoices();
    const v = voices.find((x) => /^en[-_]/i.test(x.lang) && /male|daniel|david|alex|fred|george/i.test(x.name)) ?? voices.find((x) => /^en/i.test(x.lang));
    if (v) u.voice = v;
    ss.speak(u);
  }

  private stopVoice() {
    this.sfx.stopVoice();
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* speech not available */
    }
  }

  /** call every frame */
  update(now: number) {
    if (!this.enabled) return;
    if (this.cur) {
      const c = this.cur;
      const el = c.waiting ? 0 : now - c.start;
      const n = c.waiting ? 0 : Math.min(c.text.length, Math.floor((el / 1000) * c.cps));
      if (n !== this.shown) {
        this.shown = n;
        this.text.textContent = c.text.slice(0, n);
      }
      const talking = !c.waiting && (c.talkUntil ? now < c.talkUntil : n < c.text.length);
      if (c.speaker === 'general') this.drawGeneral(now, el, talking, MOOD[c.cat]);
      else this.draw(now, el, talking, MOOD[c.cat]);
      if (!c.waiting && el > c.dur) {
        this.cur = null;
        this.lastEnd = now;
        this.stopVoice();
        if (!this.pending.length) this.panel.style.display = 'none';
      }
    } else if (this.pending.length && now - this.lastEnd >= GAP_MS) {
      // news goes stale: chatter after 12 s, reactions to events after 25 s
      this.pending = this.pending.filter((p) => now - p.at < (p.prio >= 2 ? 25000 : 12000));
      this.pending.sort((a, b) => b.prio - a.prio || a.at - b.at);
      const next = this.pending.shift();
      if (next) this.start(next, now);
      else this.panel.style.display = 'none';
    }
  }

  // ------------------------------------------------------------- Chuck's face

  private draw(now: number, el: number, talking: boolean, mood: Mood) {
    const g = this.g;
    const t = now / 1000;
    const shout = mood === 'shout';
    const excited = mood === 'excited';
    g.clearRect(0, 0, 96, 96);
    g.fillStyle = g.createLinearGradient(0, 0, 0, 96);
    (g.fillStyle as CanvasGradient).addColorStop(0, '#203a5c');
    (g.fillStyle as CanvasGradient).addColorStop(1, '#101a2b');
    g.fillRect(0, 0, 96, 96);

    const ink = '#15171b';
    const outline = (w = 2) => {
      g.lineWidth = w;
      g.strokeStyle = ink;
      g.lineJoin = 'round';
      g.stroke();
    };
    const rr = (x: number, y: number, w: number, h: number, r: number) => {
      g.beginPath();
      g.moveTo(x + r, y);
      g.arcTo(x + w, y, x + w, y + h, r);
      g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r);
      g.arcTo(x, y, x + w, y, r);
      g.closePath();
    };

    // body language: he bounces when excited and shakes when he is shouting
    g.save();
    g.translate(shout ? (Math.random() - 0.5) * 3 : 0, shout ? Math.sin(t * 22) * 1.6 : excited ? Math.sin(t * 11) * 1.8 : 0);

    // suit, collar, tie, press badge
    rr(6, 70, 84, 40, 12);
    g.fillStyle = '#2b3447';
    g.fill();
    outline();
    g.beginPath();
    g.moveTo(34, 70);
    g.lineTo(48, 86);
    g.lineTo(62, 70);
    g.closePath();
    g.fillStyle = '#f2f4f8';
    g.fill();
    outline(1.5);
    g.beginPath();
    g.moveTo(46, 80);
    g.lineTo(50, 80);
    g.lineTo(52, 96);
    g.lineTo(44, 96);
    g.closePath();
    g.fillStyle = '#d6372b';
    g.fill();
    outline(1.5);
    rr(66, 80, 14, 9, 2);
    g.fillStyle = '#ffd34d';
    g.fill();
    outline(1);

    // neck
    g.fillStyle = '#8a92a0';
    g.fillRect(40, 60, 16, 12);

    // ears with bolts
    for (const x of [21, 75]) {
      g.beginPath();
      g.arc(x, 40, 6, 0, Math.PI * 2);
      g.fillStyle = '#aab1bd';
      g.fill();
      outline(1.8);
      g.beginPath();
      g.arc(x, 40, 1.8, 0, Math.PI * 2);
      g.fillStyle = '#5b6270';
      g.fill();
    }

    // head
    rr(24, 14, 48, 50, 11);
    const hg = g.createLinearGradient(24, 14, 72, 64);
    hg.addColorStop(0, '#f1f3f8');
    hg.addColorStop(1, '#8e96a4');
    g.fillStyle = hg;
    g.fill();
    outline(2.2);

    // magnificent metal hair
    g.beginPath();
    g.moveTo(24, 26);
    g.quadraticCurveTo(26, 6, 50, 8);
    g.quadraticCurveTo(74, 6, 72, 26);
    g.quadraticCurveTo(64, 17, 52, 19);
    g.quadraticCurveTo(38, 16, 24, 26);
    g.closePath();
    g.fillStyle = '#3a3f4a';
    g.fill();
    outline(2);
    g.strokeStyle = '#7d8594';
    g.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.moveTo(32 + i * 8, 12 - (i % 2));
      g.lineTo(34 + i * 8, 18);
      g.stroke();
    }

    // eyes (they wander), eyebrows (they emote)
    const look = Math.sin(t * 0.8) * 1.6;
    const brow = (shout ? 4 : excited ? 2.5 : mood === 'worried' ? 1 : 0) + (talking ? Math.sin(t * 6) * 1.2 : 0);
    const eyeR = shout ? 7.6 : excited ? 7 : 6.4; // eyes go wide
    for (const x of [38, 58]) {
      g.beginPath();
      g.arc(x, 36, eyeR, 0, Math.PI * 2);
      g.fillStyle = '#fff';
      g.fill();
      outline(1.6);
      g.beginPath();
      g.arc(x + look, 36.5, shout ? 1.9 : 2.6, 0, Math.PI * 2);
      g.fillStyle = ink;
      g.fill();
      g.fillStyle = '#fff';
      g.fillRect(x + look - 1.2, 35, 1.2, 1.2);
    }
    const blink = Math.sin(t * 0.9) > 0.985 || (t % 4.2) < 0.12;
    if (blink) {
      g.fillStyle = '#b7bec9';
      for (const x of [38, 58]) g.fillRect(x - 7, 30, 14, 12);
      g.strokeStyle = ink;
      g.lineWidth = 2;
      for (const x of [38, 58]) {
        g.beginPath();
        g.moveTo(x - 6, 36);
        g.lineTo(x + 6, 36);
        g.stroke();
      }
    }
    g.fillStyle = ink;
    g.save();
    g.translate(0, -brow);
    g.beginPath();
    g.moveTo(30, 25);
    g.lineTo(44, 27);
    g.lineTo(44, 30);
    g.lineTo(30, 28.5);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(66, 25);
    g.lineTo(52, 27);
    g.lineTo(52, 30);
    g.lineTo(66, 28.5);
    g.closePath();
    g.fill();
    g.restore();

    // nose and glorious wire moustache
    g.beginPath();
    g.moveTo(48, 40);
    g.lineTo(44, 49);
    g.lineTo(52, 49);
    g.closePath();
    g.fillStyle = '#9ba3b0';
    g.fill();
    outline(1.4);
    g.strokeStyle = ink;
    g.lineWidth = 3;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(48, 51);
    g.quadraticCurveTo(38, 48, 30, 54);
    g.moveTo(48, 51);
    g.quadraticCurveTo(58, 48, 66, 54);
    g.stroke();

    // talking grille mouth
    const open = talking ? 0.5 + 0.5 * Math.sin(now / 65) : 0;
    const mh = (shout ? 6 : excited ? 4 : 3) + open * (shout ? 13 : excited ? 10 : 8); // a shout is a big open mouth
    rr(38, 54, 20, mh, 2.5);
    g.fillStyle = '#1b1d22';
    g.fill();
    outline(1.6);
    g.fillStyle = '#f2f4f8';
    for (let x = 40; x < 56; x += 4.2) g.fillRect(x, 55, 2.8, Math.min(3, mh - 2));

    // antenna with a blinking light
    g.strokeStyle = ink;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(60, 14);
    g.lineTo(66, 3);
    g.stroke();
    g.beginPath();
    g.arc(66, 3, 3, 0, Math.PI * 2);
    g.fillStyle = Math.floor(t * 2) % 2 ? '#ff4d3d' : '#7a1d17';
    g.fill();
    outline(1.2);

    // the microphone: foam ball, label, handle
    g.save();
    g.translate(12, 88);
    g.rotate(-0.5);
    rr(-3, 0, 6, 20, 2);
    g.fillStyle = '#3a3f4a';
    g.fill();
    outline(1.4);
    g.beginPath();
    g.arc(0, -4, 8, 0, Math.PI * 2);
    g.fillStyle = '#ff9a1a';
    g.fill();
    outline(1.8);
    g.fillStyle = ink;
    g.font = 'bold 7px monospace';
    g.textAlign = 'center';
    g.fillText('WW5', 0, -1.5);
    g.restore();

    // mood extras: sparkles when thrilled, a sweat drop when worried
    if (excited)
      for (const [x, y, ph] of [[14, 22, 0], [84, 28, 2], [78, 8, 4], [12, 54, 1]]) {
        g.fillStyle = `rgba(255,232,120,${0.5 + 0.5 * Math.sin(t * 8 + ph)})`;
        g.fillRect(x - 1, y - 4, 2, 8);
        g.fillRect(x - 4, y - 1, 8, 2);
      }
    if (mood === 'worried') {
      g.fillStyle = '#7fc8ff';
      g.beginPath();
      g.moveTo(76, 22 + Math.sin(t * 3) * 2);
      g.quadraticCurveTo(80, 30, 76, 32);
      g.quadraticCurveTo(72, 30, 76, 22 + Math.sin(t * 3) * 2);
      g.fill();
    }
    g.restore();

    this.tv(el, t, shout);
  }

  /** TV treatment shared by both presenters: scanlines, vignette, a burst of static at the start, red flicker when shouting */
  private tv(el: number, t: number, shout: boolean) {
    const g = this.g;
    g.fillStyle = 'rgba(0,0,0,0.16)';
    for (let y = 0; y < 96; y += 3) g.fillRect(0, y, 96, 1);
    if (el < 260) {
      for (let i = 0; i < 90; i++) {
        g.fillStyle = `rgba(255,255,255,${Math.random() * 0.7})`;
        g.fillRect(Math.random() * 96, Math.random() * 96, 14 + Math.random() * 30, 1 + Math.random() * 2);
      }
    }
    const vg = g.createRadialGradient(48, 48, 30, 48, 48, 70);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = vg;
    g.fillRect(0, 0, 96, 96);
    if (shout) {
      g.fillStyle = `rgba(255,50,40,${0.14 + 0.08 * Math.sin(t * 20)})`;
      g.fillRect(0, 0, 96, 96);
    }
  }

  /**
   * General Grandiose: a gold-plated robot in a peaked cap with a plume, aviator sunglasses and far too many medals.
   * Original character art. He bounces when excited and shakes when he shouts, like Chuck.
   */
  private drawGeneral(now: number, el: number, talking: boolean, mood: Mood) {
    const g = this.g;
    const t = now / 1000;
    const shout = mood === 'shout';
    const excited = mood === 'excited';
    const ink = '#15171b';
    const outline = (w = 2) => {
      g.lineWidth = w;
      g.strokeStyle = ink;
      g.lineJoin = 'round';
      g.stroke();
    };
    const rr = (x: number, y: number, w: number, h: number, r: number) => {
      g.beginPath();
      g.moveTo(x + r, y);
      g.arcTo(x + w, y, x + w, y + h, r);
      g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r);
      g.arcTo(x, y, x + w, y, r);
      g.closePath();
    };

    g.clearRect(0, 0, 96, 96);
    const bg = g.createLinearGradient(0, 0, 0, 96);
    bg.addColorStop(0, '#5a1f1a');
    bg.addColorStop(1, '#1f0d0c');
    g.fillStyle = bg;
    g.fillRect(0, 0, 96, 96);
    // he arranges his own spotlight
    g.save();
    g.translate(48, 46);
    g.fillStyle = 'rgba(255,205,70,0.13)';
    for (let i = 0; i < 10; i++) {
      g.rotate(Math.PI / 5);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(70, -9);
      g.lineTo(70, 9);
      g.closePath();
      g.fill();
    }
    g.restore();

    g.save();
    g.translate(shout ? (Math.random() - 0.5) * 3 : 0, shout ? Math.sin(t * 22) * 1.6 : excited ? Math.sin(t * 11) * 1.8 : 0);

    // uniform: olive jacket, gold epaulettes, braid, a chest full of medals
    rr(6, 70, 84, 40, 12);
    g.fillStyle = '#4b5a3c';
    g.fill();
    outline();
    for (const x of [8, 68]) {
      rr(x, 69, 20, 7, 2);
      g.fillStyle = '#f2c230';
      g.fill();
      outline(1.4);
    }
    g.strokeStyle = '#f2c230';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(34, 70);
    g.lineTo(48, 90);
    g.lineTo(62, 70);
    g.stroke();
    const medals = ['#d6372b', '#2f7fd6', '#f2c230', '#2fb86a', '#f2c230', '#d6372b', '#2f7fd6', '#f2c230'];
    medals.forEach((c, i) => {
      g.beginPath();
      g.arc(i < 4 ? 14 + i * 6 : 58 + (i - 4) * 6, 80 + (i % 2) * 7, 2.8, 0, Math.PI * 2);
      g.fillStyle = c;
      g.fill();
      outline(1);
    });

    // neck and gold head
    g.fillStyle = '#b98a18';
    g.fillRect(41, 60, 14, 12);
    rr(22, 18, 52, 48, 12);
    const hg = g.createLinearGradient(22, 18, 74, 66);
    hg.addColorStop(0, '#fff4b0');
    hg.addColorStop(0.5, '#f2c230');
    hg.addColorStop(1, '#a9741a');
    g.fillStyle = hg;
    g.fill();
    outline(2.2);
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.beginPath();
    g.ellipse(34, 30, 4, 7, -0.5, 0, Math.PI * 2);
    g.fill();

    // peaked cap with gold band, badge and an enormous plume
    g.beginPath();
    g.moveTo(62, 9);
    g.quadraticCurveTo(80, -6, 88, 14);
    g.quadraticCurveTo(76, 6, 62, 9);
    g.fillStyle = '#d6372b';
    g.fill();
    outline(1.4);
    rr(18, 6, 60, 16, 6);
    g.fillStyle = '#2f3a2a';
    g.fill();
    outline(2);
    g.fillStyle = '#f2c230';
    g.fillRect(19, 15, 58, 4);
    rr(27, 19, 42, 6, 3);
    g.fillStyle = '#1c231a';
    g.fill();
    outline(1.4);
    g.beginPath();
    g.arc(48, 11, 3.6, 0, Math.PI * 2);
    g.fillStyle = '#d6372b';
    g.fill();
    outline(1.2);

    // aviator sunglasses, so the eyebrows do the acting
    const brow = (shout ? -4 : excited ? -2.5 : mood === 'worried' ? -1 : 0) - (talking ? Math.sin(t * 6) * 1.2 : 0);
    for (const x of [29, 50]) {
      rr(x, 31, 17, 13, 6);
      const lens = g.createLinearGradient(x, 31, x + 17, 44);
      lens.addColorStop(0, '#2a2f38');
      lens.addColorStop(1, '#07080a');
      g.fillStyle = lens;
      g.fill();
      g.lineWidth = 1.8;
      g.strokeStyle = '#f7d65a';
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.fillRect(x + 3, 33, 5, 2);
    }
    g.strokeStyle = '#f7d65a';
    g.lineWidth = 1.8;
    g.beginPath();
    g.moveTo(46, 34);
    g.lineTo(50, 34);
    g.stroke();
    g.fillStyle = ink;
    g.fillRect(29, 26 + brow, 17, 3);
    g.fillRect(50, 26 + brow, 17, 3);

    // nose and a very large grin with one gold tooth
    g.beginPath();
    g.moveTo(48, 44);
    g.lineTo(44, 52);
    g.lineTo(52, 52);
    g.closePath();
    g.fillStyle = '#c99a1c';
    g.fill();
    outline(1.2);
    const open = talking ? 0.5 + 0.5 * Math.sin(now / 60) : 0;
    const mh = (shout ? 7 : excited ? 5 : 4) + open * (shout ? 12 : excited ? 9 : 7);
    rr(31, 55, 34, mh, 3);
    g.fillStyle = '#1b1d22';
    g.fill();
    outline(1.6);
    for (let x = 33, i = 0; x < 62; x += 4.6, i++) {
      g.fillStyle = i === 4 ? '#ffd34d' : '#fff7d6';
      g.fillRect(x, 56, 3.4, Math.min(3.6, mh - 2));
    }

    // glitter when thrilled, a sweat drop when worried
    if (excited || shout)
      for (const [x, y, ph] of [[12, 24, 0], [86, 34, 2], [10, 52, 4], [84, 56, 1]]) {
        g.fillStyle = `rgba(255,232,120,${0.5 + 0.5 * Math.sin(t * 8 + ph)})`;
        g.fillRect(x - 1, y - 4, 2, 8);
        g.fillRect(x - 4, y - 1, 8, 2);
      }
    if (mood === 'worried') {
      g.fillStyle = '#7fc8ff';
      g.beginPath();
      g.moveTo(78, 26 + Math.sin(t * 3) * 2);
      g.quadraticCurveTo(82, 34, 78, 36);
      g.quadraticCurveTo(74, 34, 78, 26 + Math.sin(t * 3) * 2);
      g.fill();
    }
    g.restore();

    this.tv(el, t, shout);
  }
}

import Phaser from 'phaser';
import { BUILDINGS, TICKS_PER_SEC, UNITS } from '../data/units';
import { Director } from '../ai/reporter';
import { Sfx } from '../audio/sfx';
import { Commentator } from './commentator';
import { buildingKey, ensureSprites, makeTerrainCanvas, rifleKey } from './sprites';
import { Match, type Difficulty } from '../sim/match';
import type { Building, Unit } from '../sim/types';

const TS = 32;
const STEP_MS = 1000 / TICKS_PER_SEC;
const PLAYER = 0;
const AMBER = 0xffb000;
const TEAL = 0x00c2b8;
const NEUTRAL = 0x8a8f98;
const teamColor = (o: number) => (o === 0 ? AMBER : o === 1 ? TEAL : NEUTRAL);

interface Fx { x: number; y: number; ttl: number; life: number; color: number; kind: 'tracer' | 'boom' | 'ring' | 'marker' | 'flash' | 'smoke'; x2?: number; y2?: number; big?: boolean }
interface USprite { img: Phaser.GameObjects.Image; turret?: Phaser.GameObjects.Image; lastAnim: number; lastMove: number; smoke: number }

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export class BattleScene extends Phaser.Scene {
  match!: Match;
  private gfx!: Phaser.GameObjects.Graphics;
  private acc = 0;
  private paused = false;
  private seed = 1;
  /** simulation speed multiplier, e.g. ?speed=4 (used by tests and the future AI-vs-AI observer) */
  private speed = Math.min(16, Math.max(0.25, Number(new URLSearchParams(location.search).get('speed')) || 1));
  private sel = new Set<number>();
  private selBuilding: number | null = null;
  private groups = new Map<number, number[]>();
  private fx: Fx[] = [];
  private dragStart: { sx: number; sy: number; wx: number; wy: number } | null = null;
  private dragNow: { sx: number; sy: number; wx: number; wy: number } | null = null;
  private armedAttack = false;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private hudTimer = 0;
  private panelKey = '';
  private sfx = new Sfx();
  private rep!: Commentator;
  private director = new Director();
  /** AI level: ?ai=easy|normal|hard in the URL, default easy so new players can learn */
  private difficulty: Difficulty = ((): Difficulty => {
    const v = new URLSearchParams(location.search).get('ai');
    return v === 'normal' || v === 'hard' ? v : 'easy';
  })();
  /** the game waits on the title screen until the first tap/click (browsers need a gesture before audio can play) */
  private started = new URLSearchParams(location.search).get('autostart') === '1';
  /** each side opens with a small squad; ?start=0 gives the old empty start */
  private startForce = new URLSearchParams(location.search).get('start') !== '0';
  private pinch: { d: number; zoom: number; mx: number; my: number } | null = null;
  private touch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  private tipsDone = false;
  /** mouse is over the game (not a HUD panel): edge scrolling only applies then */
  private overGame = false;
  private orderIssued = false;
  private myCaptures = 0;
  private coachOn = true;
  private miniTerrain!: HTMLCanvasElement;
  /** low layer: flags, selection rings (drawn beneath sprites); this.gfx is the top layer: bars, effects */
  private under!: Phaser.GameObjects.Graphics;
  private unitSprites = new Map<number, USprite>();
  private bldSprites = new Map<number, Phaser.GameObjects.Image>();
  private terrainImg?: Phaser.GameObjects.Image;
  private ended = false;

  constructor() {
    super('battle');
  }

  create() {
    this.input.mouse?.disableContextMenu();
    ensureSprites(this);
    this.rep = new Commentator(this.sfx);
    this.under = this.add.graphics().setDepth(-5);
    this.gfx = this.add.graphics().setDepth(5000);
    this.newMatch();

    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => this.onKey(e));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    // releasing the button over a HUD panel arrives as "outside"; it must still finish the drag
    this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      const cam = this.cameras.main;
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), 0.5, 2.5));
    });

    // browsers only allow audio after a user gesture
    const unlock = () => this.sfx.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('touchend', unlock); // iOS Safari unlocks audio on touchend/click, not pointerdown
    window.addEventListener('click', unlock);
    window.addEventListener('keydown', unlock);
    $('b-mute').onclick = () => this.toggleMute();
    $('start').style.display = this.started ? 'none' : 'flex';
    $('start-btn').onclick = () => {
      this.sfx.unlock();
      this.started = true;
      $('start').style.display = 'none';
    };
    // track whether the mouse is over the map itself; HUD panels sit above the canvas, so entering one counts as leaving
    const cv = this.game.canvas;
    cv.addEventListener('pointerenter', (e) => (this.overGame = e.pointerType === 'mouse'));
    cv.addEventListener('pointerleave', () => (this.overGame = false));
    this.input.addPointer(1); // enables two-finger pan and pinch zoom
    $('q-all').onclick = () => this.selectAll();
    $('q-atk').onclick = () => this.armAttack();
    $('q-stop').onclick = () => this.stopSel();
    $('q-menu').onclick = () => $('btns').classList.toggle('open');
    $('b-rep').onclick = () => this.toggleReporter();
    $('b-voice').onclick = () => this.toggleVoice();
    $('b-diff').onclick = () => {
      const order: Difficulty[] = ['easy', 'normal', 'hard'];
      this.difficulty = order[(order.indexOf(this.difficulty) + 1) % 3];
      this.restart();
    };

    $('b-pause').onclick = () => this.togglePause();
    $('b-restart').onclick = () => this.restart();
    $('end-btn').onclick = () => this.restart();
    const mini = $<HTMLCanvasElement>('minimap');
    const miniGo = (e: PointerEvent) => {
      const r = mini.getBoundingClientRect();
      const tx = ((e.clientX - r.left) / r.width) * this.match.world.map.w;
      const ty = ((e.clientY - r.top) / r.height) * this.match.world.map.h;
      this.cameras.main.centerOn(tx * TS, ty * TS);
    };
    mini.onpointerdown = (e) => {
      miniGo(e);
      mini.setPointerCapture(e.pointerId);
      mini.onpointermove = (ev) => ev.buttons && miniGo(ev);
    };

    // Test/debug hook: lets the Playwright smoke test drive and inspect the real running game.
    (window as unknown as Record<string, unknown>).__scrapline = {
      scene: this,
      sfx: this.sfx,
      rep: this.rep,
      tileSize: TS,
      screenOf: (tx: number, ty: number) => {
        const cam = this.cameras.main;
        const r = this.game.canvas.getBoundingClientRect();
        return { x: r.left + (tx * TS - cam.worldView.x) * cam.zoom, y: r.top + (ty * TS - cam.worldView.y) * cam.zoom };
      },
    };
  }

  // ------------------------------------------------------------ lifecycle

  private newMatch() {
    this.match = new Match(this.seed, [1], this.difficulty, this.startForce);
    this.orderIssued = false;
    this.tipsDone = false;
    this.myCaptures = 0;
    this.director.reset();
    this.rep.reset();
    $('b-diff').textContent = `AI: ${this.difficulty.toUpperCase()}`;
    this.sel.clear();
    this.selBuilding = null;
    this.groups.clear();
    this.fx = [];
    for (const s of this.unitSprites.values()) {
      s.img.destroy();
      s.turret?.destroy();
    }
    this.unitSprites.clear();
    for (const i of this.bldSprites.values()) i.destroy();
    this.bldSprites.clear();
    this.acc = 0;
    this.ended = false;
    this.paused = false;
    $('end').style.display = 'none';
    $('feed').innerHTML = '';
    this.drawTerrain();
    const hq = this.match.world.hq(PLAYER)!;
    const cam = this.cameras.main;
    cam.setBounds(-TS * 2, -TS * 2, (this.match.world.map.w + 4) * TS, (this.match.world.map.h + 4) * TS);
    cam.setZoom(Phaser.Math.Clamp(window.innerWidth / 900, 0.5, 1)); // see more of the map on a phone
    cam.centerOn(hq.x * TS + 6 * TS, hq.y * TS + 4 * TS);
  }

  private restart() {
    this.seed++;
    this.newMatch();
  }
  private selectAll() {
    this.sel = new Set(this.match.world.unitsOf(PLAYER).map((u) => u.id));
    this.selBuilding = null;
  }

  private toggleReporter() {
    this.rep.setEnabled(!this.rep.enabled);
    $('b-rep').textContent = this.rep.enabled ? 'Reporter: ON' : 'Reporter: OFF';
  }

  private toggleVoice() {
    this.rep.setVoice(!this.rep.voiceOn);
    $('b-voice').textContent = this.rep.voiceOn ? 'Voice: ON' : 'Voice: OFF';
  }

  private toggleMute() {
    this.sfx.setMuted(!this.sfx.muted);
    $('b-mute').textContent = this.sfx.muted ? 'Sound: OFF' : 'Sound: ON';
  }

  /** 0..1 loudness by distance from what the player is looking at; off-screen fights are faint or silent */
  private loudness(tx: number, ty: number): number {
    const v = this.cameras.main.worldView;
    const d = Math.hypot(tx * TS - (v.x + v.width / 2), ty * TS - (v.y + v.height / 2));
    const reach = Math.hypot(v.width, v.height) * 0.75;
    const l = 1 - d / reach;
    return l < 0.05 ? 0 : Math.min(1, l);
  }

  private togglePause() {
    this.paused = !this.paused;
    $('b-pause').textContent = this.paused ? 'Resume' : 'Pause';
    this.rep.say(this.paused ? 'pause' : 'resume', 1);
  }

  // ---------------------------------------------------------------- input

  private onKey(e: KeyboardEvent) {
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'a') {
      e.preventDefault();
      this.selectAll();
    } else if (k === 'e') this.selectAll();
    else if (k === 'h') this.coachOn = !this.coachOn;
    else if (/^[1-9]$/.test(k)) {
      const n = Number(k);
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        this.groups.set(n, [...this.sel]);
      } else {
        const g = (this.groups.get(n) ?? []).filter((id) => this.match.world.getEntity(id));
        if (g.length) {
          this.sel = new Set(g);
          this.selBuilding = null;
        }
      }
    } else if (k === 'p') this.togglePause();
    else if (k === 'm') this.toggleMute();
    else if (k === 'c') this.toggleReporter();
    else if (k === 'v') this.toggleVoice();
    else if (k === 'r') this.restart();
    else if (k === 'a') this.armAttack();
    else if (k === 's') this.stopSel();
    else if (k === 'escape') this.armedAttack = false;
  }

  private armAttack() {
    if (this.sel.size) this.armedAttack = true;
  }
  private stopSel() {
    if (this.sel.size) this.match.world.issue({ type: 'stop', ids: [...this.sel] });
  }

  private pt(p: Phaser.Input.Pointer) {
    return { sx: p.x, sy: p.y, wx: p.worldX, wy: p.worldY };
  }

  private onDown(p: Phaser.Input.Pointer) {
    if (this.ended) return;
    // second finger down: switch from selecting to pan/pinch-zoom
    const f1 = this.input.pointer1;
    const f2 = this.input.pointer2;
    if (f1?.isDown && f2?.isDown) {
      this.pinch = {
        d: Math.hypot(f1.x - f2.x, f1.y - f2.y) || 1,
        zoom: this.cameras.main.zoom,
        mx: (f1.x + f2.x) / 2,
        my: (f1.y + f2.y) / 2,
      };
      this.dragStart = this.dragNow = null;
      return;
    }
    const ev = p.event as MouseEvent | undefined;
    // Ctrl/Cmd+click = right-click, for laptops and trackpads without a right button
    if (p.button === 0 && (ev?.ctrlKey || ev?.metaKey) && this.sel.size) {
      this.rightClick(p.worldX / TS, p.worldY / TS);
      return;
    }
    if (p.button === 0) {
      this.dragStart = this.pt(p);
      this.dragNow = this.dragStart;
    } else if (p.button === 2) this.rightClick(p.worldX / TS, p.worldY / TS);
  }
  private onMove(p: Phaser.Input.Pointer) {
    if (this.pinch) {
      const f1 = this.input.pointer1;
      const f2 = this.input.pointer2;
      if (f1.isDown && f2.isDown) {
        const cam = this.cameras.main;
        const d = Math.hypot(f1.x - f2.x, f1.y - f2.y) || 1;
        const mx = (f1.x + f2.x) / 2;
        const my = (f1.y + f2.y) / 2;
        cam.scrollX -= (mx - this.pinch.mx) / cam.zoom;
        cam.scrollY -= (my - this.pinch.my) / cam.zoom;
        cam.setZoom(Phaser.Math.Clamp((this.pinch.zoom * d) / this.pinch.d, 0.5, 2.5));
        this.pinch.mx = mx;
        this.pinch.my = my;
      }
      return;
    }
    if (p.isDown && (p.button === 1 || p.middleButtonDown())) {
      const cam = this.cameras.main;
      cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
      cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
    }
    if (this.dragStart && p.isDown) this.dragNow = this.pt(p);
  }
  private onUp(p: Phaser.Input.Pointer) {
    if (this.pinch) {
      if (!(this.input.pointer1.isDown && this.input.pointer2.isDown)) this.pinch = null;
      return;
    }
    if (p.button !== 0 || !this.dragStart) return;
    const a = this.dragStart;
    const b = this.pt(p);
    this.dragStart = this.dragNow = null;
    const dragged = Math.hypot(b.sx - a.sx, b.sy - a.sy) > (p.wasTouch ? 16 : 8);
    const w = this.match.world;
    if (this.armedAttack && !dragged && this.sel.size) {
      w.issue({ type: 'attackmove', ids: [...this.sel], x: b.wx / TS, y: b.wy / TS });
      this.marker(b.wx / TS, b.wy / TS, 0xff5a4d);
      this.armedAttack = false;
      return;
    }
    this.armedAttack = false;
    if (dragged) {
      const x0 = Math.min(a.wx, b.wx) / TS, x1 = Math.max(a.wx, b.wx) / TS;
      const y0 = Math.min(a.wy, b.wy) / TS, y1 = Math.max(a.wy, b.wy) / TS;
      this.sel = new Set(w.units.filter((u) => u.owner === PLAYER && u.hp > 0 && u.x >= x0 && u.x <= x1 && u.y >= y0 && u.y <= y1).map((u) => u.id));
      this.selBuilding = null;
      return;
    }
    const tx = b.wx / TS, ty = b.wy / TS;
    let best: Unit | null = null;
    let bd = Infinity;
    for (const u of w.units) {
      if (u.owner !== PLAYER || u.hp <= 0) continue;
      const d = Math.hypot(u.x - tx, u.y - ty);
      if (d < Math.max(0.7, UNITS[u.type].radius + 0.3) && d < bd) { best = u; bd = d; }
    }
    if (best) { this.sel = new Set([best.id]); this.selBuilding = null; return; }
    const bld = w.buildings.find((q) => q.owner === PLAYER && BUILDINGS[q.bkind].produces && Math.hypot(q.x - tx, q.y - ty) < BUILDINGS[q.bkind].half + 0.2);
    // mouse and touch alike: with robots selected, a click on the map is the command
    // (ground = move, grey or enemy flag = capture, enemy robot or base = attack). Drag a box on empty ground to deselect.
    if (!bld && this.sel.size) {
      this.rightClick(tx, ty);
      return;
    }
    this.sel.clear();
    this.selBuilding = bld ? bld.id : null;
  }

  private rightClick(tx: number, ty: number) {
    const w = this.match.world;
    const ids = [...this.sel].filter((id) => w.getEntity(id));
    if (!ids.length) return;
    let foe: Unit | Building | null = null;
    let bd = Infinity;
    for (const u of w.units) {
      if (u.owner === PLAYER || u.hp <= 0) continue;
      const d = Math.hypot(u.x - tx, u.y - ty);
      if (d < 0.9 && d < bd) { foe = u; bd = d; }
    }
    const hq = w.buildings.find((b) => b.bkind === 'hq' && b.owner !== PLAYER && b.hp > 0 && Math.hypot(b.x - tx, b.y - ty) < BUILDINGS.hq.half + 0.3);
    if (!foe && hq) foe = hq;
    if (foe) {
      w.issue({ type: 'attack', ids, target: foe.id });
      this.marker(foe.x, foe.y, 0xff5a4d);
      return;
    }
    const flag = w.territories.find((t) => t.owner !== PLAYER && Math.hypot(t.fx + 0.5 - tx, t.fy + 0.5 - ty) < 1.6);
    if (flag) {
      w.issue({ type: 'capture', ids, territory: flag.id });
      this.marker(flag.fx + 0.5, flag.fy + 0.5, AMBER);
      return;
    }
    w.issue({ type: 'move', ids, x: tx, y: ty });
    this.marker(tx, ty, 0x6dff7a);
  }

  private marker(x: number, y: number, color: number) {
    this.fx.push({ x, y, ttl: 700, life: 700, color, kind: 'marker' });
    this.sfx.command();
    this.orderIssued = true;
    const cue = this.director.noteOrder();
    if (cue) this.rep.say(cue.cat, cue.prio);
  }

  // --------------------------------------------------------------- update

  update(_t: number, delta: number) {
    const w = this.match.world;
    if (!this.paused && !this.ended && this.started) {
      this.acc += Math.min(delta, 100) * this.speed;
      let n = 0;
      while (this.acc >= STEP_MS && n++ < 40) {
        this.match.step();
        this.consumeEvents();
        for (const c of this.director.consume(w, w.events)) {
          this.rep.say(c.cat, c.prio);
          if (c.cat === 'intro') this.rep.say(this.difficulty, 0);
        }
        this.acc -= STEP_MS;
      }
    }
    this.rep.update(performance.now());
    const cam = this.cameras.main;
    const sp = (600 * delta) / 1000 / cam.zoom;
    if (this.keys.A.isDown || this.keys.LEFT.isDown) cam.scrollX -= sp;
    if (this.keys.D.isDown || this.keys.RIGHT.isDown) cam.scrollX += sp;
    if (this.keys.W.isDown || this.keys.UP.isDown) cam.scrollY -= sp;
    if (this.keys.S.isDown || this.keys.DOWN.isDown) cam.scrollY += sp;
    // mouse-only scrolling: push the pointer against the edge of the map view (never while dragging or over a HUD panel)
    const ptr = this.input.activePointer;
    if (this.overGame && !ptr.isDown && !this.touch && this.started) {
      const edge = 22;
      const W = this.scale.width;
      const H = this.scale.height;
      if (ptr.x < edge) cam.scrollX -= sp;
      else if (ptr.x > W - edge) cam.scrollX += sp;
      if (ptr.y < edge) cam.scrollY -= sp;
      else if (ptr.y > H - edge) cam.scrollY += sp;
    }

    for (const id of [...this.sel]) if (!w.getEntity(id)) this.sel.delete(id);
    for (const f of this.fx) f.ttl -= delta;
    this.fx = this.fx.filter((f) => f.ttl > 0);
    this.draw(this.paused ? 1 : Math.min(1, this.acc / STEP_MS));

    this.hudTimer -= delta;
    if (this.hudTimer <= 0) {
      this.hudTimer = 100;
      this.updateHud();
      this.drawMinimap();
    }
  }

  private consumeEvents() {
    const w = this.match.world;
    for (const e of w.events) {
      if (e.t === 'shot') {
        const l = this.loudness(e.x1, e.y1);
        if (l > 0) (e.unit === 'tank' ? this.sfx.tank(l) : this.sfx.rifle(l));
        this.fx.push({ x: e.x1 + (e.x2 > e.x1 ? 0.5 : -0.5) * 0.6, y: e.y1, ttl: 90, life: 90, color: 0xfff2b0, kind: 'flash' });
        this.fx.push({ x: e.x1, y: e.y1, x2: e.x2 + (e.hit ? 0 : (Math.random() - 0.5) * 0.8), y2: e.y2 + (e.hit ? 0 : (Math.random() - 0.5) * 0.8), ttl: 90, life: 90, color: teamColor(e.owner), kind: 'tracer' });
      } else if (e.t === 'spawn') {
        if (e.owner === PLAYER) this.sfx.spawn();
      } else if (e.t === 'death') {
        const l = this.loudness(e.x, e.y);
        if (l > 0) this.sfx.boom(e.big, l);
        this.fx.push({ x: e.x, y: e.y, ttl: e.big ? 900 : 500, life: e.big ? 900 : 500, color: 0xff8a2a, kind: 'boom', big: e.big });
      } else if (e.t === 'capture') {
        const t = w.territories[e.territory];
        this.fx.push({ x: t.fx + 0.5, y: t.fy + 0.5, ttl: 900, life: 900, color: teamColor(e.owner), kind: 'ring' });
        const mine = e.owner === PLAYER;
        const lost = e.prev === PLAYER;
        if (mine || lost) this.sfx.capture(mine);
        if (mine) this.myCaptures++;
        // only news that concerns you; Chuck covers the rest
        if (mine || lost) this.feed(mine ? `Captured ${t.name}.` : `LOST ${t.name}!`, mine ? 'won' : 'lost');
      } else if (e.t === 'victory') {
        this.ended = true;
        const win = e.winner === PLAYER;
        this.sfx.end(win);
        $('end').style.display = 'flex';
        const title = $('end-title');
        title.textContent = e.winner === -1 ? 'DRAW' : win ? 'VICTORY' : 'DEFEAT';
        title.style.color = win ? '#ffb000' : '#ff5a4d';
        $('end-sub').textContent = e.winner === -1 ? 'Both headquarters fell.' : win ? 'Enemy headquarters destroyed.' : 'Your headquarters has fallen.';
      }
    }
  }

  private feed(text: string, cls: string) {
    const el = document.createElement('div');
    el.textContent = text;
    if (cls) el.className = cls;
    const feed = $('feed');
    feed.prepend(el);
    while (feed.children.length > 2) feed.lastChild!.remove();
    setTimeout(() => el.remove(), 5000);
  }

  // ------------------------------------------------------------------ HUD

  private updateHud() {
    const w = this.match.world;
    $('t-you').textContent = String(w.ownedTerritories(0));
    $('t-foe').textContent = String(w.ownedTerritories(1));
    $('u-you').textContent = String(w.unitsOf(0).length);
    $('u-foe').textContent = String(w.unitsOf(1).length);
    const s = Math.floor(w.tick / TICKS_PER_SEC);
    $('clock').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

    // Step-by-step coach: always tells a new player the next useful thing to do (H hides it).
    const mineN = w.unitsOf(0).length;
    let tip = '';
    if (this.myCaptures >= 3) this.tipsDone = true; // you have the hang of it: the coach retires
    if (!this.coachOn || this.ended || this.tipsDone) tip = '';
    else if (mineN === 0) tip = 'Your factories are building your first robots. Hang on a few seconds...';
    else if (!this.orderIssued && !this.sel.size) tip = 'STEP 1 — Press ALL to select your robots.';
    else if (!this.orderIssued) tip = 'STEP 2 — Click a grey flag. Your rifle robots will go and capture it.';
    else if (this.myCaptures === 0) tip = 'Captured flags give you their factories. Click more flags!';
    else if (mineN < 8) tip = 'STEP 3 — Keep capturing flags and let your army grow before attacking.';
    else tip = 'STEP 4 — Press ALL, then ATTACK, then click the teal base in the east.';
    const coach = $('coach');
    coach.style.display = tip ? 'block' : 'none';
    if (tip && coach.textContent !== tip) coach.textContent = tip;

    // The panel is only re-rendered when its structure changes, so buttons stay clickable between frames.
    const panel = $('sel');
    panel.style.display = this.selBuilding !== null || this.sel.size ? 'block' : 'none'; // nothing selected, nothing shown
    const render = (key: string, html: string) => {
      if (key === this.panelKey) return false;
      this.panelKey = key;
      panel.innerHTML = html;
      return true;
    };
    if (this.selBuilding !== null) {
      const b = w.getEntity(this.selBuilding) as Building;
      const prod = BUILDINGS[b.bkind].produces!;
      const pct = Math.min(100, Math.round((b.progress / UNITS[prod].buildTicks) * 100));
      const fresh = render(
        `b:${b.id}:${b.owner}:${b.paused}`,
        `<div class="h">${BUILDINGS[b.bkind].name.toUpperCase()}</div><span id="prod-txt"></span><div class="bar"><i id="prod-bar"></i></div><button id="b-prod">${b.paused ? 'Resume production' : 'Pause production'}</button>`,
      );
      if (fresh) $('b-prod').onclick = () => w.issue({ type: 'togglePause', building: b.id });
      $('prod-txt').textContent = `Builds: ${UNITS[prod].name} · ${b.paused ? 'PAUSED' : pct + '%'}`;
      $('prod-bar').style.width = pct + '%';
    } else if (this.sel.size) {
      const counts: Record<string, number> = {};
      for (const id of this.sel) {
        const u = w.getEntity(id) as Unit | undefined;
        if (u && 'type' in u) counts[UNITS[u.type].name] = (counts[UNITS[u.type].name] ?? 0) + 1;
      }
      const html = `<div class="h">${this.sel.size} SELECTED &nbsp;·&nbsp; ${Object.entries(counts).map(([k, v]) => `${v} × ${k}`).join(' · ')}</div><small>${this.armedAttack ? '<b style="color:#ff5a4d">ATTACK-MOVE: click where to fight your way to</b>' : 'Click the map: move, capture a flag, or attack'}</small>`;
      render('s:' + html, html);
    } else {
      render('none', '');
    }
  }

  private drawMinimap() {
    const c = $<HTMLCanvasElement>('minimap');
    // tiny canvas: keep it on the software 2D path (avoids GPU-canvas compositing glitches)
    const g = c.getContext('2d', { willReadFrequently: true })!;
    const w = this.match.world;
    const k = c.width / w.map.w;
    g.drawImage(this.miniTerrain, 0, 0);
    for (const t of w.territories) {
      g.fillStyle = '#' + teamColor(t.owner).toString(16).padStart(6, '0');
      g.fillRect(t.fx * k - 2, t.fy * k - 2, 5, 5);
    }
    for (const u of w.units) {
      g.fillStyle = u.owner === 0 ? '#ffb000' : '#00c2b8';
      g.fillRect(u.x * k - 1, u.y * k - 1, u.type === 'tank' ? 3 : 2, u.type === 'tank' ? 3 : 2);
    }
    const v = this.cameras.main.worldView;
    g.strokeStyle = '#fff';
    g.lineWidth = 1;
    g.strokeRect((v.x / TS) * k, (v.y / TS) * k, (v.width / TS) * k, (v.height / TS) * k);
  }

  // -------------------------------------------------------------- drawing

  private drawTerrain() {
    // Terrain is painted once into a single texture (see sprites.ts), then shrunk for the minimap.
    const m = this.match.world.map;
    this.terrainImg?.destroy();
    if (this.textures.exists('terrain')) this.textures.remove('terrain');
    const big = makeTerrainCanvas(m, TS);
    this.textures.addCanvas('terrain', big);
    this.terrainImg = this.add.image(0, 0, 'terrain').setOrigin(0).setDepth(-10);
    const mini = document.createElement('canvas');
    mini.width = 224;
    mini.height = 128;
    const mg = mini.getContext('2d', { willReadFrequently: true })!;
    mg.imageSmoothingEnabled = true;
    mg.drawImage(big, 0, 0, mini.width, mini.height);
    this.miniTerrain = mini;
  }

  private draw(alpha: number) {
    const g = this.gfx;
    const lo = this.under;
    g.clear();
    lo.clear();
    const w = this.match.world;
    const time = this.time.now;

    for (const t of w.territories) {
      const cx = (t.fx + 0.5) * TS, cy = (t.fy + 0.5) * TS;
      lo.fillStyle(teamColor(t.owner), 0.07).fillCircle(cx, cy, 1.2 * TS);
      lo.lineStyle(2, teamColor(t.owner), 0.35).strokeCircle(cx, cy, 1.2 * TS);
      lo.fillStyle(0x000000, 0.25).fillEllipse(cx + 1, cy + 7, 12, 5);
      lo.lineStyle(4, 0x15171b, 1).lineBetween(cx, cy + 6, cx, cy - 28);
      lo.lineStyle(2, 0xc9ccd3, 1).lineBetween(cx, cy + 6, cx, cy - 28);
      const wave = Math.sin(time / 180 + t.id) * 3;
      lo.fillStyle(teamColor(t.owner), 1).fillTriangle(cx, cy - 28, cx + 22, cy - 22 + wave, cx, cy - 14);
      lo.lineStyle(1.5, 0x15171b, 1).strokeTriangle(cx, cy - 28, cx + 22, cy - 22 + wave, cx, cy - 14);
      lo.fillStyle(0x15171b, 1).fillCircle(cx, cy - 29, 2.5);
    }

    for (const b of w.buildings) this.drawBuilding(b, time);

    for (const u of w.units) {
      const x = (u.px + (u.x - u.px) * alpha) * TS;
      const y = (u.py + (u.y - u.py) * alpha) * TS;
      this.drawUnit(u, x, y, time);
    }
    for (const [id, s] of this.unitSprites) {
      if (w.getEntity(id)) continue;
      s.img.destroy();
      s.turret?.destroy();
      this.unitSprites.delete(id);
    }

    for (const f of this.fx) this.drawFx(f);

    if (this.dragStart && this.dragNow && Math.hypot(this.dragNow.sx - this.dragStart.sx, this.dragNow.sy - this.dragStart.sy) > 8) {
      const a = this.dragStart, b = this.dragNow;
      g.lineStyle(1.5 / this.cameras.main.zoom, 0x6dff7a, 1).strokeRect(Math.min(a.wx, b.wx), Math.min(a.wy, b.wy), Math.abs(a.wx - b.wx), Math.abs(a.wy - b.wy));
      g.fillStyle(0x6dff7a, 0.12).fillRect(Math.min(a.wx, b.wx), Math.min(a.wy, b.wy), Math.abs(a.wx - b.wx), Math.abs(a.wy - b.wy));
    }
  }

  private drawUnit(u: Unit, x: number, y: number, now: number) {
    const g = this.gfx;
    const def = UNITS[u.type];
    const team = u.owner === 0 ? '0' : '1';
    let s = this.unitSprites.get(u.id);
    if (!s) {
      s =
        u.type === 'rifle'
          ? { img: this.add.image(0, 0, rifleKey(u.owner), '0_0_0').setOrigin(0.5, 0.68).setScale(1.1), lastAnim: u.anim, lastMove: -1e9, smoke: 0 }
          : {
              img: this.add.image(0, 0, 'hull' + team, '0').setScale(1),
              turret: this.add.image(0, 0, 'turret' + team).setOrigin(0.4375, 0.5).setScale(1),
              lastAnim: u.anim,
              lastMove: -1e9,
              smoke: 0,
            };
      this.unitSprites.set(u.id, s);
    }
    if (u.anim !== s.lastAnim) {
      s.lastAnim = u.anim;
      s.lastMove = now;
    }
    const moving = now - s.lastMove < 180;
    const hurt = u.hp < def.hp * 0.35;
    const selected = this.sel.has(u.id);
    let top: number;
    if (u.type === 'rifle') {
      const d = ((Math.round(u.face / (Math.PI / 4)) % 8) + 8) % 8;
      const f = moving ? Math.floor(u.anim * 2.4) % 4 : 0;
      s.img.setFrame(`${d}_${f}_${hurt ? 1 : 0}`).setPosition(x, y).setDepth(y);
      if (selected) this.under.lineStyle(2.5, 0x6dff7a, 1).strokeEllipse(x, y + 8, 36, 15);
      top = y - 33;
    } else {
      s.img.setFrame(moving ? String(Math.floor(u.anim * 3) % 2) : '0').setPosition(x, y).setRotation(u.face).setDepth(y);
      s.turret!.setPosition(x, y).setRotation(u.aim).setFlipY(Math.cos(u.aim) < 0).setDepth(y + 0.5);
      if (selected) this.under.lineStyle(2.5, 0x6dff7a, 1).strokeEllipse(x, y + 3, 66, 44);
      top = y - 30;
    }
    if (hurt && now - s.smoke > 220) {
      s.smoke = now;
      this.fx.push({ x: u.x, y: u.y - 0.45, ttl: 750, life: 750, color: 0x555555, kind: 'smoke' });
    }
    if (u.hp < def.hp) {
      const wBar = 24;
      g.fillStyle(0x000000, 0.85).fillRect(x - wBar / 2 - 1, top, wBar + 2, 6);
      const f = Math.max(0, u.hp / def.hp);
      g.fillStyle(f > 0.5 ? 0x6dff7a : f > 0.25 ? 0xffd34d : 0xff5a4d, 1).fillRect(x - wBar / 2, top + 1, wBar * f, 4);
    }
  }

  private drawBuilding(b: Building, time: number) {
    const g = this.gfx;
    const st = BUILDINGS[b.bkind];
    const col = teamColor(b.owner);
    const hs = st.half * TS;
    const x = b.x * TS, y = b.y * TS;
    const ruined = b.bkind === 'hq' && b.hp <= 0;
    const key = buildingKey(b.bkind, b.owner);
    let img = this.bldSprites.get(b.id);
    if (!img) {
      img = this.add.image(x, y, key);
      this.bldSprites.set(b.id, img);
    }
    if (img.texture.key !== key) img.setTexture(key);
    img.setPosition(x, y).setDepth(y - 24);
    if (ruined) {
      img.setTint(0x3a3a3a);
      g.fillStyle(0xff6a1a, 0.6 + 0.3 * Math.sin(time / 90)).fillCircle(x, y, 14);
      g.fillStyle(0xffd34d, 0.7).fillCircle(x + 6, y - 4, 6);
      return;
    }
    if (b.bkind === 'hq') {
      const f = Math.max(0, b.hp / 500);
      g.fillStyle(0x000000, 0.85).fillRect(x - hs, y + hs + 5, hs * 2, 7);
      g.fillStyle(f > 0.5 ? 0x6dff7a : f > 0.25 ? 0xffd34d : 0xff5a4d, 1).fillRect(x - hs + 1, y + hs + 6, (hs * 2 - 2) * f, 5);
      return;
    }
    const prod = st.produces!;
    const pct = Math.min(1, b.progress / UNITS[prod].buildTicks);
    if (b.owner >= 0) {
      g.fillStyle(0x000000, 0.8).fillRect(x - hs, y + hs + 4, hs * 2, 6);
      g.fillStyle(b.paused ? 0x888888 : col, 1).fillRect(x - hs + 1, y + hs + 5, (hs * 2 - 2) * pct, 4);
      if (b.paused) g.fillStyle(0xff5a4d, 1).fillRect(x - 5, y - hs - 10, 3, 9).fillRect(x + 2, y - hs - 10, 3, 9);
    }
    if (this.selBuilding === b.id) g.lineStyle(2, 0x6dff7a, 1).strokeRect(x - hs - 4, y - hs - 4, hs * 2 + 8, hs * 2 + 8);
  }

  private drawFx(f: Fx) {
    const g = this.gfx;
    const t = 1 - f.ttl / f.life;
    const x = f.x * TS, y = f.y * TS;
    if (f.kind === 'tracer') {
      g.lineStyle(2, 0xfff2b0, 1 - t).lineBetween(x, y, f.x2! * TS, f.y2! * TS);
    } else if (f.kind === 'flash') {
      g.fillStyle(0xfff2b0, 1 - t).fillCircle(x, y - 6, 7 * (1 - t) + 2);
      g.fillStyle(0xff9a1a, 0.8 * (1 - t)).fillCircle(x, y - 6, 4);
    } else if (f.kind === 'smoke') {
      g.fillStyle(0x4a4a4a, 0.55 * (1 - t)).fillCircle(x + Math.sin(t * 6 + f.x) * 3, y - 8 - t * 26, 4 + t * 7);
    } else if (f.kind === 'boom') {
      const r = (f.big ? 34 : 18) * (0.4 + t);
      g.fillStyle(0xffd34d, 1 - t).fillCircle(x, y, r * 0.6);
      g.fillStyle(0xff6a1a, 0.8 * (1 - t)).fillCircle(x, y, r);
      g.fillStyle(0x333333, 0.5 * (1 - t)).fillCircle(x + 6 * t, y - 24 * t, r * 0.8);
      for (let i = 0; i < (f.big ? 7 : 3); i++) {
        const a = i * 2.4 + f.x;
        g.fillStyle(0x23262b, 1 - t).fillRect(x + Math.cos(a) * r * 1.3 - 2, y + Math.sin(a) * r * 1.3 - 2, 4, 4);
      }
    } else if (f.kind === 'ring') {
      g.lineStyle(4, f.color, 1 - t).strokeCircle(x, y, 20 + t * 60);
    } else {
      g.lineStyle(2, f.color, 1 - t).strokeCircle(x, y, 14 - t * 8).strokeCircle(x, y, 3);
    }
  }
}

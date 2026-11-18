import Phaser from 'phaser';
import { T_BRIDGE, T_GRASS, T_ROCK, T_WATER } from '../data/maps';
import { BUILDINGS, TICKS_PER_SEC, UNITS } from '../data/units';
import { Match } from '../sim/match';
import type { Building, Unit } from '../sim/types';

const TS = 32;
const STEP_MS = 1000 / TICKS_PER_SEC;
const PLAYER = 0;
const AMBER = 0xffb000;
const TEAL = 0x00c2b8;
const NEUTRAL = 0x8a8f98;
const teamColor = (o: number) => (o === 0 ? AMBER : o === 1 ? TEAL : NEUTRAL);
const dark = (c: number, f = 0.55) =>
  (Math.floor(((c >> 16) & 255) * f) << 16) | (Math.floor(((c >> 8) & 255) * f) << 8) | Math.floor((c & 255) * f);

interface Fx { x: number; y: number; ttl: number; life: number; color: number; kind: 'tracer' | 'boom' | 'ring' | 'marker'; x2?: number; y2?: number; big?: boolean }

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
  private miniTerrain!: HTMLCanvasElement;
  private ended = false;

  constructor() {
    super('battle');
  }

  create() {
    this.input.mouse?.disableContextMenu();
    this.newMatch();
    this.gfx = this.add.graphics().setDepth(2);

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

    $('b-attack').onclick = () => this.armAttack();
    $('b-stop').onclick = () => this.stopSel();
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
    this.match = new Match(this.seed, [1]);
    this.sel.clear();
    this.selBuilding = null;
    this.groups.clear();
    this.fx = [];
    this.acc = 0;
    this.ended = false;
    this.paused = false;
    $('end').style.display = 'none';
    $('feed').innerHTML = '';
    this.drawTerrain();
    const hq = this.match.world.hq(PLAYER)!;
    const cam = this.cameras.main;
    cam.setBounds(-TS * 2, -TS * 2, (this.match.world.map.w + 4) * TS, (this.match.world.map.h + 4) * TS);
    cam.setZoom(1);
    cam.centerOn(hq.x * TS + 6 * TS, hq.y * TS + 4 * TS);
  }

  private restart() {
    this.seed++;
    this.newMatch();
  }
  private togglePause() {
    this.paused = !this.paused;
    $('b-pause').textContent = this.paused ? 'Resume (P)' : 'Pause (P)';
  }

  // ---------------------------------------------------------------- input

  private onKey(e: KeyboardEvent) {
    const k = e.key.toLowerCase();
    if (/^[1-9]$/.test(k)) {
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
    if (p.button === 0) {
      this.dragStart = this.pt(p);
      this.dragNow = this.dragStart;
    } else if (p.button === 2) this.rightClick(p.worldX / TS, p.worldY / TS);
  }
  private onMove(p: Phaser.Input.Pointer) {
    if (p.isDown && (p.button === 1 || p.middleButtonDown())) {
      const cam = this.cameras.main;
      cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
      cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
    }
    if (this.dragStart && p.leftButtonDown()) this.dragNow = this.pt(p);
  }
  private onUp(p: Phaser.Input.Pointer) {
    if (p.button !== 0 || !this.dragStart) return;
    const a = this.dragStart;
    const b = this.pt(p);
    this.dragStart = this.dragNow = null;
    const dragged = Math.hypot(b.sx - a.sx, b.sy - a.sy) > 8;
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
  }

  // --------------------------------------------------------------- update

  update(_t: number, delta: number) {
    const w = this.match.world;
    if (!this.paused && !this.ended) {
      this.acc += Math.min(delta, 100) * this.speed;
      let n = 0;
      while (this.acc >= STEP_MS && n++ < 40) {
        this.match.step();
        this.consumeEvents();
        this.acc -= STEP_MS;
      }
    }
    const cam = this.cameras.main;
    const sp = (600 * delta) / 1000 / cam.zoom;
    if (this.keys.A.isDown || this.keys.LEFT.isDown) cam.scrollX -= sp;
    if (this.keys.D.isDown || this.keys.RIGHT.isDown) cam.scrollX += sp;
    if (this.keys.W.isDown || this.keys.UP.isDown) cam.scrollY -= sp;
    if (this.keys.S.isDown || this.keys.DOWN.isDown) cam.scrollY += sp;

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
        this.fx.push({ x: e.x1, y: e.y1, x2: e.x2 + (e.hit ? 0 : (Math.random() - 0.5) * 0.8), y2: e.y2 + (e.hit ? 0 : (Math.random() - 0.5) * 0.8), ttl: 90, life: 90, color: teamColor(e.owner), kind: 'tracer' });
      } else if (e.t === 'death') {
        this.fx.push({ x: e.x, y: e.y, ttl: e.big ? 900 : 500, life: e.big ? 900 : 500, color: 0xff8a2a, kind: 'boom', big: e.big });
      } else if (e.t === 'capture') {
        const t = w.territories[e.territory];
        this.fx.push({ x: t.fx + 0.5, y: t.fy + 0.5, ttl: 900, life: 900, color: teamColor(e.owner), kind: 'ring' });
        const mine = e.owner === PLAYER;
        const lost = e.prev === PLAYER;
        this.feed(mine ? `Captured ${t.name}.` : lost ? `LOST ${t.name}!` : `Enemy took ${t.name}.`, mine ? 'won' : lost ? 'lost' : '');
      } else if (e.t === 'victory') {
        this.ended = true;
        const win = e.winner === PLAYER;
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
    while (feed.children.length > 5) feed.lastChild!.remove();
    setTimeout(() => el.remove(), 8000);
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

    // The panel is only re-rendered when its structure changes, so buttons stay clickable between frames.
    const panel = $('sel');
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
      const html = `<div class="h">${this.sel.size} SELECTED</div>${Object.entries(counts).map(([k, v]) => `${v} × ${k}`).join(' · ')}<br/><small>RMB: move / attack / capture flag</small>${this.armedAttack ? '<br/><b style="color:#ff5a4d">ATTACK-MOVE: click a target point</b>' : ''}`;
      render('s:' + html, html);
    } else {
      render('none', '<div class="h">NO SELECTION</div>Drag a box around your robots, or click a factory.');
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
    const w = this.match.world.map;
    this.children.list.filter((o) => o.getData('terrain')).forEach((o) => o.destroy());
    const g = this.add.graphics().setDepth(0).setData('terrain', true);
    const mini = document.createElement('canvas');
    mini.width = 224;
    mini.height = 128;
    const mg = mini.getContext('2d', { willReadFrequently: true })!;
    const k = mini.width / w.w;
    const hash = (x: number, y: number) => ((Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0) % 100;
    for (let y = 0; y < w.h; y++)
      for (let x = 0; x < w.w; x++) {
        const t = w.tiles[y * w.w + x];
        const n = hash(x, y);
        let col: number;
        if (t === T_WATER) col = n < 50 ? 0x1f5a8a : 0x226494;
        else if (t === T_BRIDGE) col = n < 50 ? 0x8a7650 : 0x7d6a46;
        else if (t === T_ROCK) col = 0x5d5f66;
        else col = n < 33 ? 0x4a6b33 : n < 66 ? 0x45652f : 0x4e7036;
        g.fillStyle(col, 1).fillRect(x * TS, y * TS, TS, TS);
        mg.fillStyle = '#' + col.toString(16).padStart(6, '0');
        mg.fillRect(x * k, y * k, Math.ceil(k), Math.ceil(k));
        if (t === T_GRASS && n % 7 === 0) g.fillStyle(0x3a5a28, 1).fillRect(x * TS + 8 + (n % 5) * 3, y * TS + 10, 3, 6);
        if (t === T_WATER && n % 5 === 0) g.fillStyle(0x6fb1de, 0.35).fillRect(x * TS + 6, y * TS + 14, 14, 2);
        if (t === T_BRIDGE) g.lineStyle(2, 0x3f3220, 0.7).strokeRect(x * TS + 1, y * TS + 1, TS - 2, TS - 2);
        if (t === T_ROCK) {
          g.fillStyle(0x7a7c85, 1).fillRect(x * TS + 3, y * TS + 3, TS - 10, TS - 10);
          g.fillStyle(0x3c3d42, 1).fillRect(x * TS + TS - 8, y * TS + 6, 5, TS - 9);
        }
      }
    this.miniTerrain = mini;
  }

  private draw(alpha: number) {
    const g = this.gfx;
    g.clear();
    const w = this.match.world;
    const time = this.time.now;

    for (const t of w.territories) {
      const cx = (t.fx + 0.5) * TS, cy = (t.fy + 0.5) * TS;
      g.lineStyle(2, teamColor(t.owner), 0.35).strokeCircle(cx, cy, 1.2 * TS);
      g.lineStyle(3, 0x222222, 1).lineBetween(cx, cy + 6, cx, cy - 26);
      const wave = Math.sin(time / 180 + t.id) * 3;
      g.fillStyle(teamColor(t.owner), 1).fillTriangle(cx, cy - 26, cx + 20, cy - 20 + wave, cx, cy - 12);
      g.fillStyle(0x222222, 1).fillCircle(cx, cy + 6, 3);
    }

    for (const b of w.buildings) this.drawBuilding(b, time);

    const sorted = [...w.units].sort((a, b) => a.y - b.y);
    for (const u of sorted) {
      const x = (u.px + (u.x - u.px) * alpha) * TS;
      const y = (u.py + (u.y - u.py) * alpha) * TS;
      this.drawUnit(u, x, y);
    }

    for (const f of this.fx) this.drawFx(f);

    if (this.dragStart && this.dragNow && Math.hypot(this.dragNow.sx - this.dragStart.sx, this.dragNow.sy - this.dragStart.sy) > 8) {
      const a = this.dragStart, b = this.dragNow;
      g.lineStyle(1.5 / this.cameras.main.zoom, 0x6dff7a, 1).strokeRect(Math.min(a.wx, b.wx), Math.min(a.wy, b.wy), Math.abs(a.wx - b.wx), Math.abs(a.wy - b.wy));
      g.fillStyle(0x6dff7a, 0.12).fillRect(Math.min(a.wx, b.wx), Math.min(a.wy, b.wy), Math.abs(a.wx - b.wx), Math.abs(a.wy - b.wy));
    }
  }

  private rot(cx: number, cy: number, a: number, pts: [number, number][]) {
    const c = Math.cos(a), s = Math.sin(a);
    return pts.map(([x, y]) => new Phaser.Math.Vector2(cx + x * c - y * s, cy + x * s + y * c));
  }

  private drawUnit(u: Unit, x: number, y: number) {
    const g = this.gfx;
    const col = teamColor(u.owner);
    const def = UNITS[u.type];
    g.fillStyle(0x000000, 0.28).fillEllipse(x, y + 8, def.radius * 2.4 * TS, def.radius * 1.2 * TS);
    if (this.sel.has(u.id)) g.lineStyle(2, 0x6dff7a, 1).strokeEllipse(x, y + 6, def.radius * 2.8 * TS, def.radius * 1.7 * TS);
    if (u.type === 'rifle') {
      const bob = Math.sin(u.anim * 6) * 2.5;
      g.fillStyle(0x23262b, 1).fillRect(x - 5, y + 3, 4, 7 + bob).fillRect(x + 1, y + 3, 4, 7 - bob);
      g.fillStyle(dark(col), 1).fillCircle(x, y - 1, 8.5);
      g.fillStyle(col, 1).fillCircle(x, y - 2, 7);
      g.fillStyle(0xd9dde3, 1).fillCircle(x + Math.cos(u.aim) * 2, y - 8, 3.6);
      g.fillStyle(0x15171a, 1).fillRect(x + Math.cos(u.aim) * 2 - 2, y - 9, 4, 1.8);
      g.lineStyle(3, 0x15171a, 1).lineBetween(x, y - 1, x + Math.cos(u.aim) * 13, y - 1 + Math.sin(u.aim) * 13);
    } else {
      const hull = this.rot(x, y, u.face, [[-14, -9], [14, -9], [16, 0], [14, 9], [-14, 9]]);
      g.fillStyle(0x23262b, 1).fillPoints(this.rot(x, y, u.face, [[-15, -13], [15, -13], [15, -9], [-15, -9]]), true);
      g.fillPoints(this.rot(x, y, u.face, [[-15, 9], [15, 9], [15, 13], [-15, 13]]), true);
      g.fillStyle(dark(col, 0.7), 1).fillPoints(hull, true);
      g.lineStyle(2, dark(col, 0.4), 1).strokePoints(hull, true);
      g.fillStyle(col, 1).fillCircle(x, y, 8);
      g.lineStyle(4, 0x15171a, 1).lineBetween(x, y, x + Math.cos(u.aim) * 20, y + Math.sin(u.aim) * 20);
      g.fillStyle(dark(col, 0.8), 1).fillCircle(x, y, 4);
    }
    if (u.hp < def.hp || this.sel.has(u.id)) {
      const wBar = 20;
      g.fillStyle(0x000000, 0.8).fillRect(x - wBar / 2 - 1, y - 20, wBar + 2, 5);
      const f = Math.max(0, u.hp / def.hp);
      g.fillStyle(f > 0.5 ? 0x6dff7a : f > 0.25 ? 0xffd34d : 0xff5a4d, 1).fillRect(x - wBar / 2, y - 19, wBar * f, 3);
    }
  }

  private drawBuilding(b: Building, time: number) {
    const g = this.gfx;
    const st = BUILDINGS[b.bkind];
    const col = teamColor(b.owner);
    const hs = st.half * TS;
    const x = b.x * TS, y = b.y * TS;
    const ruined = b.bkind === 'hq' && b.hp <= 0;
    g.fillStyle(0x000000, 0.3).fillRect(x - hs + 4, y - hs + 6, hs * 2, hs * 2);
    g.fillStyle(ruined ? 0x2a2a2a : 0x3b4048, 1).fillRect(x - hs, y - hs, hs * 2, hs * 2);
    g.lineStyle(3, ruined ? 0x1a1a1a : col, 1).strokeRect(x - hs, y - hs, hs * 2, hs * 2);
    if (ruined) {
      g.fillStyle(0xff6a1a, 0.6 + 0.3 * Math.sin(time / 90)).fillCircle(x, y, 10);
      return;
    }
    if (b.bkind === 'hq') {
      g.fillStyle(dark(col, 0.6), 1).fillRect(x - hs + 8, y - hs + 8, hs * 2 - 16, hs * 2 - 16);
      g.fillStyle(col, 1).fillCircle(x, y, 13);
      g.fillStyle(0x15171a, 1).fillCircle(x, y, 6);
      g.lineStyle(2, 0xd9dde3, 1).lineBetween(x + hs - 10, y - hs + 10, x + hs - 10, y - hs - 8);
      g.fillStyle(col, 1).fillCircle(x + hs - 10, y - hs - 8, 3);
      const f = Math.max(0, b.hp / 500);
      g.fillStyle(0x000000, 0.85).fillRect(x - hs, y + hs + 5, hs * 2, 7);
      g.fillStyle(f > 0.5 ? 0x6dff7a : f > 0.25 ? 0xffd34d : 0xff5a4d, 1).fillRect(x - hs + 1, y + hs + 6, (hs * 2 - 2) * f, 5);
      return;
    }
    if (b.bkind === 'barracks') {
      g.fillStyle(dark(col, 0.7), 1).fillRect(x - hs + 6, y - hs + 6, hs * 2 - 12, 12);
      g.fillStyle(0x15171a, 1).fillRect(x - 7, y + 2, 14, hs - 4);
    } else {
      g.fillStyle(dark(col, 0.7), 1).fillRect(x - hs + 6, y - hs + 6, hs * 2 - 12, 10);
      g.fillStyle(0x15171a, 1).fillRect(x - 12, y, 24, hs - 2);
      g.lineStyle(1, 0x555a63, 1).lineBetween(x - 12, y + 6, x + 12, y + 6).lineBetween(x - 12, y + 12, x + 12, y + 12);
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

import {
  BUILDINGS,
  CAPTURE_RADIUS,
  TICKS_PER_SEC,
  UNITS,
  UNIT_CAP_PER_SIDE,
  productionRate,
} from '../data/units';
import { PathGrid } from './pathfind';
import { Rng } from './rng';
import { SpatialHash } from './spatial';
import type {
  Building,
  Command,
  MapDef,
  Owner,
  SimEvent,
  Territory,
  Unit,
  UnitType,
} from './types';

type Target = Unit | Building;
const isBuilding = (t: Target): t is Building => 'bkind' in t;

export class World {
  tick = 0;
  readonly rng: Rng;
  readonly grid: PathGrid;
  units: Unit[] = [];
  buildings: Building[] = [];
  territories: Territory[] = [];
  events: SimEvent[] = [];
  /** null while playing; side index of the winner; -1 for a draw */
  winner: number | null = null;
  commandLog: { tick: number; cmd: Command }[] = [];

  private nextId = 1;
  private pendingDamage: [Target, number][] = [];
  private hash: SpatialHash<Unit>;
  private byId = new Map<number, Target>();

  constructor(
    readonly map: MapDef,
    seed: number,
  ) {
    this.rng = new Rng(seed);
    this.grid = new PathGrid(map);
    this.hash = new SpatialHash<Unit>(map.w, map.h);
    map.territories.forEach((t, id) =>
      this.territories.push({ id, name: t.name, fx: t.fx, fy: t.fy, owner: t.owner, buildings: [] }),
    );
    for (const b of map.buildings) {
      const terr = this.territories[b.territory];
      const stats = BUILDINGS[b.bkind];
      const building: Building = {
        id: this.nextId++,
        bkind: b.bkind,
        territory: b.territory,
        owner: terr.owner,
        x: b.x,
        y: b.y,
        hp: stats.hp,
        maxHp: stats.hp,
        progress: 0,
        paused: false,
      };
      this.buildings.push(building);
      this.byId.set(building.id, building);
      terr.buildings.push(building.id);
    }
  }

  // ---------------------------------------------------------------- queries

  getEntity(id: number): Target | undefined {
    return this.byId.get(id);
  }
  unitsOf(owner: Owner): Unit[] {
    return this.units.filter((u) => u.owner === owner && u.hp > 0);
  }
  ownedTerritories(owner: Owner): number {
    let n = 0;
    for (const t of this.territories) if (t.owner === owner) n++;
    return n;
  }
  hq(owner: Owner): Building | undefined {
    return this.buildings.find((b) => b.bkind === 'hq' && b.owner === owner);
  }

  // --------------------------------------------------------------- commands

  /** Apply a player/AI command at the current tick boundary and record it for replay. */
  issue(cmd: Command, log = true) {
    if (log) this.commandLog.push({ tick: this.tick, cmd });
    if (cmd.type === 'togglePause') {
      const b = this.byId.get(cmd.building);
      if (b && isBuilding(b)) b.paused = !b.paused;
      return;
    }
    const units = cmd.ids
      .map((id) => this.byId.get(id))
      .filter((e): e is Unit => !!e && !isBuilding(e) && e.hp > 0)
      .sort((a, b) => a.id - b.id);
    units.forEach((u, i) => {
      switch (cmd.type) {
        case 'stop':
          this.setOrder(u, 'none', u.x, u.y, 0);
          u.path = [];
          break;
        case 'move':
        case 'attackmove': {
          const [fx, fy] = this.formationPoint(cmd.x, cmd.y, i, units.length);
          this.setOrder(u, cmd.type, fx, fy, 0);
          this.repath(u, fx, fy);
          if (!u.path.length && Math.hypot(u.x - fx, u.y - fy) > 1) this.setOrder(u, 'none', u.x, u.y, 0);
          break;
        }
        case 'attack': {
          const t = this.byId.get(cmd.target);
          if (!t || t.hp <= 0) break;
          this.setOrder(u, 'attack', t.x, t.y, cmd.target);
          u.repathAt = 0;
          break;
        }
        case 'capture': {
          const terr = this.territories[cmd.territory];
          if (!terr) break;
          if (!UNITS[u.type].canCapture) {
            this.setOrder(u, 'move', terr.fx + 0.5, terr.fy + 0.5, 0);
          } else {
            this.setOrder(u, 'capture', terr.fx + 0.5, terr.fy + 0.5, cmd.territory);
          }
          this.repath(u, terr.fx + 0.5, terr.fy + 0.5);
          break;
        }
      }
    });
  }

  private setOrder(u: Unit, kind: Unit['order']['kind'], x: number, y: number, target: number) {
    u.order = { kind, x, y, target };
  }

  /** Spread a group around a point: 4-wide rows centred on the target. */
  private formationPoint(x: number, y: number, i: number, n: number): [number, number] {
    if (n <= 1) return [x, y];
    const cols = Math.min(4, n);
    const col = i % cols;
    const row = (i / cols) | 0;
    const px = x + (col - (cols - 1) / 2) * 1.1;
    const py = y + (row - ((Math.ceil(n / cols) - 1) / 2)) * 1.1;
    const open = this.grid.nearestOpen(Math.floor(px), Math.floor(py));
    return open ? [open[0] + 0.5, open[1] + 0.5] : [x, y];
  }

  private repath(u: Unit, tx: number, ty: number) {
    const p = this.grid.findPath(Math.floor(u.x), Math.floor(u.y), Math.floor(tx), Math.floor(ty));
    u.path = p ?? [];
    u.pathIdx = 0;
  }

  // ------------------------------------------------------------------ spawn

  spawnUnit(type: UnitType, owner: Owner, x: number, y: number): Unit {
    const u: Unit = {
      id: this.nextId++,
      type,
      owner,
      x,
      y,
      px: x,
      py: y,
      hp: UNITS[type].hp,
      order: { kind: 'none', x, y, target: 0 },
      path: [],
      pathIdx: 0,
      cooldown: 0,
      repathAt: 0,
      face: owner === 0 ? 0 : Math.PI,
      aim: owner === 0 ? 0 : Math.PI,
      anim: 0,
    };
    this.units.push(u);
    this.byId.set(u.id, u);
    this.events.push({ t: 'spawn', id: u.id, owner });
    return u;
  }

  // ------------------------------------------------------------------- step

  step() {
    this.events.length = 0;
    if (this.winner !== null) {
      this.tick++;
      return;
    }
    this.hash.clear();
    for (const u of this.units) {
      u.px = u.x;
      u.py = u.y;
      if (u.hp > 0) this.hash.insert(u);
    }
    // Alternate iteration direction each tick so neither side systematically moves/targets first.
    const n = this.units.length;
    const rev = (this.tick & 1) === 1;
    for (let i = 0; i < n; i++) {
      const u = this.units[rev ? n - 1 - i : i];
      if (u.hp > 0) this.updateUnit(u);
    }
    // Damage lands simultaneously so lower unit ids get no first-strike advantage.
    for (const [t, dmg] of this.pendingDamage) t.hp -= dmg;
    this.pendingDamage.length = 0;
    this.separate();
    this.captures();
    this.production();
    this.reap();
    this.checkVictory();
    this.tick++;
  }

  // ------------------------------------------------------------- unit logic

  private updateUnit(u: Unit) {
    const def = UNITS[u.type];
    if (u.cooldown > 0) u.cooldown--;
    const o = u.order;
    switch (o.kind) {
      case 'none': {
        const t = this.acquire(u, def.detect);
        if (t) this.pursueFire(u, t);
        break;
      }
      case 'move': {
        this.followPath(u);
        this.autoFire(u);
        if (u.pathIdx >= u.path.length) u.order = { kind: 'none', x: u.x, y: u.y, target: 0 };
        break;
      }
      case 'capture': {
        const terr = this.territories[o.target];
        if (terr.owner === u.owner) {
          u.order = { kind: 'none', x: u.x, y: u.y, target: 0 };
          break;
        }
        if (u.pathIdx >= u.path.length && this.tick >= u.repathAt) {
          this.repath(u, o.x, o.y);
          u.repathAt = this.tick + 20;
        }
        this.followPath(u);
        this.autoFire(u);
        break;
      }
      case 'attack': {
        const t = this.byId.get(o.target);
        if (!t || t.hp <= 0) {
          u.order = { kind: 'none', x: u.x, y: u.y, target: 0 };
          break;
        }
        this.pursueFire(u, t);
        break;
      }
      case 'attackmove': {
        const t = this.acquire(u, def.detect);
        if (t) {
          this.pursueFire(u, t);
          u.path = [];
          u.pathIdx = 0;
          break;
        }
        if (Math.hypot(u.x - o.x, u.y - o.y) < 1.2) {
          u.order = { kind: 'none', x: u.x, y: u.y, target: 0 };
          break;
        }
        if (u.pathIdx >= u.path.length && this.tick >= u.repathAt) {
          this.repath(u, o.x, o.y);
          u.repathAt = this.tick + 20;
        }
        this.followPath(u);
        break;
      }
    }
  }

  /** Advance along the path. Returns true if the unit moved. */
  private followPath(u: Unit): boolean {
    if (u.pathIdx >= u.path.length) return false;
    const step = UNITS[u.type].speed / TICKS_PER_SEC;
    const [tx, ty] = u.path[u.pathIdx];
    const wx = tx + 0.5;
    const wy = ty + 0.5;
    const dx = wx - u.x;
    const dy = wy - u.y;
    const d = Math.hypot(dx, dy);
    u.face = Math.atan2(dy, dx);
    if (d <= step) {
      u.x = wx;
      u.y = wy;
      u.pathIdx++;
    } else {
      u.x += (dx / d) * step;
      u.y += (dy / d) * step;
    }
    u.anim += step;
    return true;
  }

  private distTo(u: Unit, t: Target): number {
    const d = Math.hypot(t.x - u.x, t.y - u.y);
    return isBuilding(t) ? Math.max(0, d - BUILDINGS[t.bkind].half) : d;
  }

  /** Nearest living enemy unit (or enemy HQ) within radius. Ties broken by id. */
  acquire(u: Unit, radius: number): Target | null {
    let best: Target | null = null;
    let bestD = Infinity;
    this.hash.query(u.x, u.y, radius, (e) => {
      if (e.owner === u.owner || e.hp <= 0) return;
      const d = Math.hypot(e.x - u.x, e.y - u.y);
      if (d <= radius && (d < bestD || (d === bestD && best !== null && e.id < best.id))) {
        best = e;
        bestD = d;
      }
    });
    for (const b of this.buildings) {
      if (b.bkind !== 'hq' || b.owner === u.owner || b.hp <= 0) continue;
      const d = this.distTo(u, b);
      if (d <= radius && d < bestD) {
        best = b;
        bestD = d;
      }
    }
    return best;
  }

  private autoFire(u: Unit) {
    const t = this.acquire(u, UNITS[u.type].range);
    if (t) this.fire(u, t);
  }

  private pursueFire(u: Unit, t: Target) {
    const def = UNITS[u.type];
    if (this.distTo(u, t) <= def.range) {
      u.path = [];
      u.pathIdx = 0;
      u.repathAt = 0;
      this.fire(u, t);
      return;
    }
    if (this.tick >= u.repathAt) {
      this.repath(u, t.x, t.y);
      u.repathAt = this.tick + 8 + (u.id % 4);
    }
    this.followPath(u);
  }

  private fire(u: Unit, t: Target) {
    const def = UNITS[u.type];
    u.aim = Math.atan2(t.y - u.y, t.x - u.x);
    if (u.type === 'rifle') u.face = u.aim;
    if (u.cooldown > 0) return;
    u.cooldown = def.reload;
    const d = Math.hypot(t.x - u.x, t.y - u.y);
    const acc = def.accuracy * (1 - 0.3 * Math.min(1, d / def.range));
    const hit = this.rng.next() < acc;
    if (hit) {
      const armor = isBuilding(t) ? 'building' : UNITS[t.type].armor;
      this.pendingDamage.push([t, def.damage * def.vs[armor]]);
    }
    this.events.push({ t: 'shot', x1: u.x, y1: u.y, x2: t.x, y2: t.y, hit, owner: u.owner, unit: u.type });
  }

  // ---------------------------------------------------------- world passes

  private separate() {
    for (const u of this.units) {
      if (u.hp <= 0) continue;
      const ru = UNITS[u.type].radius;
      let sx = 0;
      let sy = 0;
      this.hash.query(u.x, u.y, 1.6, (e) => {
        if (e === u || e.hp <= 0) return;
        const minD = ru + UNITS[e.type].radius;
        let dx = u.x - e.x;
        let dy = u.y - e.y;
        let d = Math.hypot(dx, dy);
        if (d >= minD) return;
        if (d < 1e-4) {
          const a = u.id * 2.399963;
          dx = Math.cos(a);
          dy = Math.sin(a);
          d = 1;
        }
        const push = (minD - d) * 0.5;
        sx += (dx / d) * push;
        sy += (dy / d) * push;
      });
      const m = Math.hypot(sx, sy);
      if (m > 0.12) {
        sx = (sx / m) * 0.12;
        sy = (sy / m) * 0.12;
      }
      if (this.grid.open(Math.floor(u.x + sx), Math.floor(u.y))) u.x += sx;
      if (this.grid.open(Math.floor(u.x), Math.floor(u.y + sy))) u.y += sy;
    }
  }

  private captures() {
    for (const u of this.units) {
      if (u.hp <= 0 || !UNITS[u.type].canCapture) continue;
      for (const t of this.territories) {
        if (t.owner === u.owner) continue;
        if (Math.hypot(u.x - (t.fx + 0.5), u.y - (t.fy + 0.5)) > CAPTURE_RADIUS) continue;
        this.captureTerritory(t, u.owner);
        if (u.order.kind === 'capture') u.order = { kind: 'none', x: u.x, y: u.y, target: 0 };
        break;
      }
    }
  }

  captureTerritory(t: Territory, owner: Owner) {
    const prev = t.owner;
    t.owner = owner;
    for (const id of t.buildings) {
      const b = this.byId.get(id) as Building;
      if (b.bkind === 'hq') continue; // headquarters never change hands; destroy them instead
      b.owner = owner;
      b.progress = 0;
    }
    this.events.push({ t: 'capture', territory: t.id, owner, prev });
  }

  private production() {
    const counts = new Map<Owner, number>();
    for (const u of this.units) if (u.hp > 0) counts.set(u.owner, (counts.get(u.owner) ?? 0) + 1);
    for (const b of this.buildings) {
      const prod = BUILDINGS[b.bkind].produces;
      if (!prod || b.owner < 0 || b.paused) continue;
      if ((counts.get(b.owner) ?? 0) >= UNIT_CAP_PER_SIDE) continue;
      b.progress += productionRate(this.ownedTerritories(b.owner));
      if (b.progress < UNITS[prod].buildTicks) continue;
      b.progress = 0;
      const dir = b.x < this.map.w / 2 ? 1 : -1;
      const half = BUILDINGS[b.bkind].half;
      const sx = Math.floor(b.x + dir * (half + 0.9));
      const sy = Math.floor(b.y + this.rng.range(-1, 1));
      const open = this.grid.nearestOpen(sx, sy);
      if (!open) continue;
      this.spawnUnit(prod, b.owner, open[0] + 0.5, open[1] + 0.5);
      counts.set(b.owner, (counts.get(b.owner) ?? 0) + 1);
    }
  }

  private reap() {
    let dead = false;
    for (const u of this.units) {
      if (u.hp <= 0) {
        dead = true;
        this.byId.delete(u.id);
        this.events.push({ t: 'death', x: u.x, y: u.y, big: u.type === 'tank', owner: u.owner });
      }
    }
    if (dead) this.units = this.units.filter((u) => u.hp > 0);
    for (const b of this.buildings) {
      if (b.bkind === 'hq' && b.hp <= 0 && b.maxHp > 0) {
        b.maxHp = 0; // mark as already announced
        this.events.push({ t: 'death', x: b.x, y: b.y, big: true, owner: b.owner });
      }
    }
  }

  private sideAlive(side: Owner): boolean {
    const hq = this.hq(side);
    if (!hq || hq.hp <= 0) return false;
    if (this.units.some((u) => u.owner === side)) return true;
    return this.buildings.some((b) => b.owner === side && BUILDINGS[b.bkind].produces);
  }

  private checkVictory() {
    const a = this.sideAlive(0);
    const b = this.sideAlive(1);
    if (a && b) return;
    this.winner = !a && !b ? -1 : a ? 0 : 1;
    this.events.push({ t: 'victory', winner: this.winner });
  }

  // ------------------------------------------------------------------- hash

  /** FNV-1a over the whole simulation state; used by determinism and (later) save/load tests. */
  stateHash(): number {
    let h = 0x811c9dc5;
    const mix = (n: number) => {
      h ^= n | 0;
      h = Math.imul(h, 0x01000193);
    };
    mix(this.tick);
    mix(this.rng.state);
    for (const u of this.units) {
      mix(u.id);
      mix(u.owner);
      mix(Math.round(u.x * 1000));
      mix(Math.round(u.y * 1000));
      mix(Math.round(u.hp * 100));
      mix(u.cooldown);
    }
    for (const t of this.territories) mix(t.owner + 7);
    for (const b of this.buildings) {
      mix(b.owner + 7);
      mix(Math.round(b.progress * 100));
      mix(Math.round(b.hp * 100));
    }
    return h >>> 0;
  }
}

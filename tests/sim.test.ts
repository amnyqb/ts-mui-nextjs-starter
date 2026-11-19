import { describe, expect, it } from 'vitest';
import { buildFrontline } from '../src/data/maps';
import { UNITS } from '../src/data/units';
import { Match } from '../src/sim/match';
import { PathGrid } from '../src/sim/pathfind';
import { Rng } from '../src/sim/rng';
import { SpatialHash } from '../src/sim/spatial';
import { World } from '../src/sim/world';
import type { Command } from '../src/sim/types';

const fresh = (seed = 1) => new World(buildFrontline(), seed);
const run = (w: World, n: number) => {
  for (let i = 0; i < n; i++) w.step();
};

describe('rng', () => {
  it('is reproducible per seed and differs across seeds', () => {
    const a = new Rng(5);
    const b = new Rng(5);
    const c = new Rng(6);
    const sa = Array.from({ length: 8 }, () => a.next());
    expect(Array.from({ length: 8 }, () => b.next())).toEqual(sa);
    expect(Array.from({ length: 8 }, () => c.next())).not.toEqual(sa);
  });
});

describe('spatial hash', () => {
  it('finds only nearby items', () => {
    const h = new SpatialHash<{ x: number; y: number; n: string }>(56, 32);
    h.insert({ x: 2, y: 2, n: 'near' });
    h.insert({ x: 40, y: 20, n: 'far' });
    const seen: string[] = [];
    h.query(3, 3, 3, (i) => seen.push(i.n));
    expect(seen).toEqual(['near']);
  });
});

describe('pathfinding', () => {
  const grid = new PathGrid(buildFrontline());
  it('crosses the river only via bridges', () => {
    const p = grid.findPath(20, 16, 35, 16)!;
    expect(p).not.toBeNull();
    let [px, py] = [20, 16];
    let riverSamples = 0;
    for (const [x, y] of p) {
      for (let i = 0; i <= 40; i++) {
        const sx = Math.floor(px + 0.5 + ((x - px) * i) / 40);
        const sy = Math.floor(py + 0.5 + ((y - py) * i) / 40);
        expect(grid.open(sx, sy)).toBe(true);
        if (sx >= 26 && sx <= 29) {
          riverSamples++;
          expect([3, 4, 14, 15, 16, 27, 28]).toContain(sy);
        }
      }
      [px, py] = [x, y];
    }
    expect(riverSamples).toBeGreaterThan(0);
  });
  it('routes around rocks without cutting corners', () => {
    const p = grid.findPath(15, 10, 20, 10)!;
    expect(p.some(([x, y]) => x >= 17 && x <= 18 && y >= 9 && y <= 11)).toBe(false);
    // every straight segment of the smoothed path must be walkable (sampled densely)
    let [px, py] = [15, 10];
    for (const [x, y] of p) {
      expect(grid.clearLine(px, py, x, y)).toBe(true);
      for (let i = 0; i <= 20; i++) {
        const sx = px + 0.5 + ((x - px) * i) / 20;
        const sy = py + 0.5 + ((y - py) * i) / 20;
        expect(grid.open(Math.floor(sx), Math.floor(sy))).toBe(true);
      }
      [px, py] = [x, y];
    }
  });
  it('retargets a blocked goal to the nearest open tile and returns null when boxed in', () => {
    const p = grid.findPath(15, 10, 17, 10)!;
    expect(grid.open(...p[p.length - 1])).toBe(true);
    expect(grid.findPath(-3, -3, 5, 5)).toBeNull();
  });
});

describe('territory capture', () => {
  it('a rifle on a neutral flag captures it and transfers its buildings', () => {
    const w = fresh();
    const north = w.territories[1];
    const barracks = w.getEntity(north.buildings[0])!;
    expect((barracks as { owner: number }).owner).toBe(-1);
    w.spawnUnit('rifle', 0, north.fx + 0.5, north.fy + 0.5);
    w.step();
    expect(north.owner).toBe(0);
    expect((barracks as { owner: number }).owner).toBe(0);
    expect(w.events.some((e) => e.t === 'capture')).toBe(true);
  });
  it('tanks cannot capture', () => {
    const w = fresh();
    const t = w.territories[2];
    w.spawnUnit('tank', 0, t.fx + 0.5, t.fy + 0.5);
    run(w, 5);
    expect(t.owner).toBe(-1);
  });
  it('capture resets production progress and speeds up owner factories', () => {
    const w = fresh();
    const north = w.territories[1];
    const b = w.getEntity(north.buildings[0]) as { progress: number; owner: number };
    b.owner = 1;
    b.progress = 50;
    w.spawnUnit('rifle', 0, north.fx + 0.5, north.fy + 0.5);
    w.step();
    expect(b.owner).toBe(0);
    // reset to 0, then one tick of production at the new owner's rate (1 + 0.15 * (2 - 1))
    expect(b.progress).toBeCloseTo(1.15, 5);
  });
  it('an HQ stays with its owner when its flag is captured', () => {
    const w = fresh();
    const base = w.territories[0];
    w.spawnUnit('rifle', 1, base.fx + 0.5, base.fy + 0.5);
    w.step();
    expect(base.owner).toBe(1);
    expect(w.hq(0)!.owner).toBe(0);
    const barracks = w.buildings.find((b) => b.territory === 0 && b.bkind === 'barracks')!;
    expect(barracks.owner).toBe(1);
  });
});

describe('production', () => {
  it('owned factories finish units on time; paused factories do not', () => {
    const w = fresh();
    const barracks = w.buildings.find((b) => b.territory === 0 && b.bkind === 'barracks')!;
    const vehicle = w.buildings.find((b) => b.territory === 0 && b.bkind === 'vehicle')!;
    vehicle.paused = true;
    run(w, UNITS.rifle.buildTicks);
    expect(w.units.filter((u) => u.owner === 0 && u.type === 'rifle').length).toBe(1);
    expect(w.units.filter((u) => u.type === 'tank').length).toBe(0);
    expect(barracks.progress).toBe(0);
  });
  it('neutral factories produce nothing', () => {
    const w = fresh();
    run(w, 400);
    expect(w.units.filter((u) => u.owner === -1).length).toBe(0);
  });
  it('togglePause command flips the flag', () => {
    const w = fresh();
    const b = w.buildings[1];
    w.issue({ type: 'togglePause', building: b.id });
    expect(b.paused).toBe(true);
  });
});

describe('combat', () => {
  it('applies armour-class multipliers and kills units', () => {
    const w = fresh(3);
    const rifle = w.spawnUnit('rifle', 0, 10.5, 25.5);
    const tank = w.spawnUnit('tank', 1, 14.5, 25.5);
    const hp0 = tank.hp;
    run(w, 200);
    // rifle does 30% to vehicles: any damage it dealt is a multiple of 6*0.3
    const dealt = hp0 - tank.hp;
    expect(dealt % (UNITS.rifle.damage * UNITS.rifle.vs.vehicle)).toBeCloseTo(0, 5);
    // the tank (18 dmg x0.6 vs infantry) must have killed the rifle
    expect(rifle.hp).toBeLessThanOrEqual(0);
    expect(w.units.includes(rifle)).toBe(false);
  });
  it('idle units acquire and pursue enemies inside detection range', () => {
    const w = fresh(2);
    const a = w.spawnUnit('rifle', 0, 10.5, 25.5);
    const b = w.spawnUnit('rifle', 1, 16.5, 25.5); // 6 away: inside detect (7), outside range (5)
    run(w, 5);
    expect(a.x).toBeGreaterThan(10.5);
    run(w, 400);
    expect(a.hp <= 0 || b.hp <= 0).toBe(true);
  });
  it('HQs can be destroyed and end the match', () => {
    const w = fresh();
    const hq = w.hq(1)!;
    for (let i = 0; i < 6; i++) w.spawnUnit('tank', 0, hq.x - 5 + (i % 3) * 0.1, hq.y + 3 + i * 0.1);
    w.issue({ type: 'attack', ids: w.units.map((u) => u.id), target: hq.id });
    run(w, 800);
    expect(hq.hp).toBeLessThanOrEqual(0);
    expect(w.winner).toBe(0);
  });
});

describe('orders', () => {
  it('move orders reach their destination over bridges', () => {
    const w = fresh();
    const u = w.spawnUnit('rifle', 0, 24.5, 15.5);
    w.issue({ type: 'move', ids: [u.id], x: 32.5, y: 15.5 });
    run(w, 200);
    expect(Math.hypot(u.x - 32.5, u.y - 15.5)).toBeLessThan(1);
    expect(u.order.kind).toBe('none');
  });
  it('capture orders send a rifle to the flag', () => {
    const w = fresh();
    const u = w.spawnUnit('rifle', 0, 8.5, 16.5);
    w.issue({ type: 'capture', ids: [u.id], territory: 3 });
    run(w, 300);
    expect(w.territories[3].owner).toBe(0);
  });
  it('stop clears orders', () => {
    const w = fresh();
    const u = w.spawnUnit('rifle', 0, 8.5, 16.5);
    w.issue({ type: 'move', ids: [u.id], x: 20.5, y: 16.5 });
    w.issue({ type: 'stop', ids: [u.id] });
    expect(u.order.kind).toBe('none');
    expect(u.path.length).toBe(0);
  });
});

describe('AI commander and match outcomes', () => {
  it('captures neutral territories early', () => {
    const m = new Match(7, [0, 1]);
    m.run(20 * 90);
    const owned = (s: number) => m.world.ownedTerritories(s);
    expect(owned(0)).toBeGreaterThan(1);
    expect(owned(1)).toBeGreaterThan(1);
  });
  it('a passive player loses to the AI (defeat condition)', () => {
    const m = new Match(11, [1]);
    m.run(20 * 60 * 15);
    expect(m.world.winner).toBe(1);
  });
  it('an active side beats a passive one (victory condition)', () => {
    const m = new Match(12, [0]);
    m.run(20 * 60 * 15);
    expect(m.world.winner).toBe(0);
  });
  it('AI vs AI matches finish on several seeds', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const m = new Match(seed, [0, 1]);
      m.run(20 * 60 * 20);
      expect(m.world.winner, `seed ${seed}`).not.toBeNull();
    }
  }, 60000);
});

describe('determinism', () => {
  it('same seed gives the same state hash; different seeds diverge', () => {
    const a = new Match(42, [0, 1]);
    const b = new Match(42, [0, 1]);
    const c = new Match(43, [0, 1]);
    a.run(3000);
    b.run(3000);
    c.run(3000);
    expect(a.world.stateHash()).toBe(b.world.stateHash());
    expect(a.world.stateHash()).not.toBe(c.world.stateHash());
  });
  it('replaying the command log on a fresh world reproduces the state', () => {
    const m = new Match(9, [0, 1]);
    for (let t = 0; t < 2500; t++) m.step(); // fixed tick count: run() would stop early if the match ended
    const log = m.world.commandLog.slice();
    expect(log.length).toBeGreaterThan(5);
    const w = new World(buildFrontline(), 9);
    let i = 0;
    for (let t = 0; t < 2500; t++) {
      while (i < log.length && log[i].tick === w.tick) w.issue(log[i++].cmd as Command, false);
      w.step();
    }
    expect(w.stateHash()).toBe(m.world.stateHash());
  });
});

import { describe, expect, it } from 'vitest';
import { Director } from '../src/ai/reporter';
import { buildFrontline } from '../src/data/maps';
import { LINES, LINE_COUNT, MOOD, type Cat } from '../src/data/lines';
import { Match } from '../src/sim/match';
import type { SimEvent } from '../src/sim/types';
import { World } from '../src/sim/world';

const world = () => new World(buildFrontline(), 1);
const cats = (d: Director, w: World, ev: SimEvent[] = []) => d.consume(w, ev).map((c) => c.cat);

describe('reporter script', () => {
  it('has at least 80 original lines, all non-empty, short enough for subtitles, none duplicated', () => {
    expect(LINE_COUNT).toBeGreaterThanOrEqual(80);
    const all = Object.values(LINES).flat();
    expect(new Set(all).size).toBe(all.length);
    for (const l of all) {
      expect(l.trim().length).toBeGreaterThan(10);
      // short statements: one breath each
      expect(l.length, l).toBeLessThanOrEqual(80);
      expect(l.split(/\s+/).length, l).toBeLessThanOrEqual(15);
    }
    expect(all.reduce((n, l) => n + l.length, 0) / all.length, 'average line length').toBeLessThan(50);
    for (const [cat, lines] of Object.entries(LINES)) expect(lines.length, cat).toBeGreaterThan(0);
  });

  it('gives every category a mood, and uses all the moods (calm, deadpan, excited, shout, worried)', () => {
    const moods = new Set<string>();
    for (const cat of Object.keys(LINES)) {
      const m = MOOD[cat as Cat];
      expect(['calm', 'deadpan', 'excited', 'shout', 'worried'], cat).toContain(m);
      moods.add(m);
    }
    expect([...moods].sort()).toEqual(['calm', 'deadpan', 'excited', 'shout', 'worried']);
  });

  it('shouts about trouble and gets excited about progress', () => {
    for (const c of ['captureLost', 'unitLost', 'tankLost', 'hqHurt', 'hqCritical', 'baseAttack', 'bloodbath', 'firstLoss'] as Cat[]) expect(MOOD[c], c).toBe('shout');
    for (const c of ['captureMine', 'tankKill', 'firstKill', 'enemyHqHurt', 'enemyHqCritical', 'comeback', 'crushing', 'victory'] as Cat[]) expect(MOOD[c], c).toBe('excited');
  });
});

describe('reporter director reacts to real events', () => {
  it('opens with a briefing, then a tip after 14 seconds', () => {
    const d = new Director();
    const w = world();
    w.tick = 1;
    expect(cats(d, w)).toEqual(['intro']);
    w.tick = 14 * 20;
    expect(cats(d, w)).toContain('intro2');
    expect(cats(d, w)).not.toContain('intro2');
  });

  it('maps captures to the right commentary', () => {
    const d = new Director();
    const w = world();
    w.tick = 30;
    expect(cats(d, w, [{ t: 'capture', territory: 3, owner: 0, prev: -1 }])).toEqual(['captureMine']);
    expect(cats(d, w, [{ t: 'capture', territory: 0, owner: 1, prev: 0 }])).toEqual(['captureLost']);
    expect(cats(d, w, [{ t: 'capture', territory: 5, owner: 1, prev: -1 }])).toEqual(['enemyTook']);
  });

  it('reacts to deaths by whose they are: shouts for ours, cheers for theirs', () => {
    const d = new Director();
    const w = world();
    w.tick = 40;
    const death = (big: boolean, owner: number): SimEvent => ({ t: 'death', x: 5, y: 5, big, owner });
    expect(cats(d, w, [death(false, 0)])).toEqual(['firstLoss']);
    expect(cats(d, w, [death(false, 0)])).toEqual(['unitLost']);
    expect(cats(d, w, [death(true, 0)])).toEqual(['tankLost']);
    expect(cats(d, w, [death(true, 1)])).toEqual(['tankKill']);
    expect(cats(d, w, [death(false, 1)])).toEqual([]); // an ordinary enemy death is not worth a line
    const first = new Director();
    expect(cats(first, w, [death(false, 1)])).toEqual(['firstKill']);
  });

  it('ignores a headquarters falling (the victory or defeat line covers it)', () => {
    const d = new Director();
    const w = world();
    w.tick = 40;
    expect(cats(d, w, [{ t: 'death', x: 5, y: 5, big: true, owner: 0, hq: true }])).toEqual([]);
  });

  it('raises the alarm when enemy robots reach our base, but not constantly', () => {
    const d = new Director();
    const w = world();
    const hq = w.hq(0)!;
    w.spawnUnit('rifle', 1, hq.x + 6, hq.y + 2);
    w.tick = 100;
    const cue = d.consume(w, []).find((c) => c.cat === 'baseAttack');
    expect(cue?.prio).toBe(2);
    w.tick = 110;
    expect(cats(d, w)).not.toContain('baseAttack');
    w.tick = 100 + 26 * 20;
    expect(cats(d, w)).toContain('baseAttack');
  });

  it('notices a bloodbath: six deaths within four seconds', () => {
    const d = new Director();
    const w = world();
    w.tick = 100;
    const ev: SimEvent[] = Array.from({ length: 6 }, () => ({ t: 'death', x: 5, y: 5, big: false, owner: 1 }));
    expect(cats(d, w, ev)).toContain('bloodbath');
  });

  it('announces victory, defeat and draw as must-play', () => {
    for (const [winner, cat] of [[0, 'victory'], [1, 'defeat'], [-1, 'draw']] as const) {
      const d = new Director();
      const w = world();
      w.tick = 500;
      const cue = d.consume(w, [{ t: 'victory', winner }]).find((c) => c.cat === cat)!;
      expect(cue.prio).toBe(3);
    }
  });

  it('warns about headquarters damage in stages, once each', () => {
    const d = new Director();
    const w = world();
    w.tick = 200;
    w.hq(0)!.hp = 200;
    expect(cats(d, w)).toContain('hqHurt');
    expect(cats(d, w)).not.toContain('hqHurt');
    w.hq(0)!.hp = 60;
    expect(cats(d, w)).toContain('hqCritical');
    w.hq(1)!.hp = 200;
    expect(cats(d, w)).toContain('enemyHqHurt');
    w.hq(1)!.hp = 60;
    expect(cats(d, w)).toContain('enemyHqCritical');
  });

  it('fills long silences, but not constantly', () => {
    const d = new Director();
    const w = world();
    w.tick = 46 * 20;
    expect(cats(d, w)).toContain('idle');
    w.tick += 10;
    expect(cats(d, w)).not.toContain('idle');
    w.tick += 40 * 20;
    expect(cats(d, w)).toContain('idle');
  });

  it('comments on a big lead and on a comeback', () => {
    const d = new Director();
    const w = world();
    for (let i = 0; i < 8; i++) w.spawnUnit('rifle', 0, 10.5, 10.5 + i);
    for (let i = 0; i < 2; i++) w.spawnUnit('rifle', 1, 45.5, 10.5 + i);
    w.tick = 61 * 20;
    expect(cats(d, w)).toContain('crushing');

    const d2 = new Director();
    const w2 = world();
    w2.territories[1].owner = 1;
    w2.territories[2].owner = 1;
    w2.territories[3].owner = 1;
    w2.tick = 100;
    cats(d2, w2);
    w2.territories[1].owner = 0;
    w2.territories[2].owner = 0;
    w2.territories[3].owner = 0;
    w2.tick = 110;
    expect(cats(d2, w2)).toContain('comeback');
  });

  it('on a real AI-vs-AI match it covers the whole story, start to finish', () => {
    const m = new Match(5, [0, 1], 'hard');
    const d = new Director();
    const seen = new Set<Cat>();
    for (let t = 0; t < 20 * 60 * 20 && m.world.winner === null; t++) {
      m.step();
      for (const c of d.consume(m.world, m.world.events)) seen.add(c.cat);
    }
    for (const must of ['intro', 'intro2', 'firstRobots', 'captureMine', 'captureLost'] as Cat[]) expect(seen.has(must), must).toBe(true);
    expect(seen.has('firstKill') || seen.has('firstLoss')).toBe(true);
    expect(seen.has('unitLost') || seen.has('tankLost'), 'he shouts when our robots die').toBe(true);
    expect(seen.has('victory') || seen.has('defeat') || seen.has('draw')).toBe(true);
  });
});

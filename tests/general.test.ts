import { describe, expect, it } from 'vitest';
import { GENERAL_CHANCE, GENERAL_LINES, GENERAL_LINE_COUNT, chooseSpeaker } from '../src/data/general';
import { LINES, MOOD, type Cat } from '../src/data/lines';
import { ShuffleBag } from '../src/data/shuffle';
import { Rng } from '../src/sim/rng';

const seeded = (n: number) => {
  const r = new Rng(n);
  return () => r.next();
};
const all = Object.values(GENERAL_LINES).flat() as string[];

describe('General Grandiose script', () => {
  it('has 120+ lines, short like Chuck\'s, and no duplicates (also across Chuck\'s lines)', () => {
    expect(GENERAL_LINE_COUNT).toBeGreaterThanOrEqual(120);
    for (const l of all) {
      expect(l.length, l).toBeLessThanOrEqual(80);
      expect(l.split(/\s+/).length, l).toBeLessThanOrEqual(15);
    }
    const everything = [...all, ...Object.values(LINES).flat()];
    expect(new Set(everything).size).toBe(everything.length);
  });

  it('only covers real categories, each with a decent bank and a chance of speaking', () => {
    for (const [cat, lines] of Object.entries(GENERAL_LINES)) {
      expect(Object.keys(LINES), cat).toContain(cat);
      expect(lines!.length, cat).toBeGreaterThanOrEqual(4);
      expect(GENERAL_CHANCE[cat as Cat], cat).toBeGreaterThan(0);
    }
    for (const cat of Object.keys(GENERAL_CHANCE)) expect(GENERAL_LINES[cat as Cat]?.length, cat).toBeGreaterThan(0);
  });

  it('uses the same moods as Chuck, so he shouts at trouble and brags at progress', () => {
    for (const c of ['captureLost', 'unitLost', 'baseAttack'] as Cat[]) expect(MOOD[c]).toBe('shout');
    for (const c of ['captureMine', 'tankKill', 'victory'] as Cat[]) expect(MOOD[c]).toBe('excited');
  });

  it('is an original character: no real names, no borrowed catchphrases', () => {
    const banned = [/trump/i, /president/i, /obama|biden|clinton|putin|musk/i, /tired of winning/i, /unpresidential/i, /\bchina\b|\bchinese\b/i, /fake news/i, /make .* great again/i, /covfefe|bigly/i, /witch hunt/i];
    for (const l of all) for (const b of banned) expect(l, `${b} in "${l}"`).not.toMatch(b);
  });
});

describe('who speaks (chooseSpeaker)', () => {
  it('Chuck always opens the broadcast and covers everything the General does not', () => {
    expect(chooseSpeaker('intro', () => 0)).toBe('chuck');
    expect(chooseSpeaker('idle', () => 0)).toBe('chuck');
    expect(chooseSpeaker('pause', () => 0)).toBe('chuck');
  });

  it('the General takes an event when the dice say so, Chuck otherwise', () => {
    expect(chooseSpeaker('victory', () => 0)).toBe('general');
    expect(chooseSpeaker('victory', () => 0.999)).toBe('chuck');
  });

  it('interrupts at roughly the configured rate', () => {
    const rng = seeded(5);
    for (const cat of ['captureMine', 'victory', 'unitLost'] as Cat[]) {
      let g = 0;
      const N = 4000;
      for (let i = 0; i < N; i++) if (chooseSpeaker(cat, rng) === 'general') g++;
      expect(Math.abs(g / N - GENERAL_CHANCE[cat]!), cat).toBeLessThan(0.04);
    }
  });

  it('the General\'s lines are also served shuffled with no repeats', () => {
    const lines = GENERAL_LINES.captureMine!;
    const bag = new ShuffleBag(lines.length, seeded(3));
    const seen = new Set(Array.from({ length: lines.length }, () => bag.next()));
    expect(seen.size).toBe(lines.length);
  });
});

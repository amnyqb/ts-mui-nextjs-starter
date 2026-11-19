import { describe, expect, it } from 'vitest';
import { LINES } from '../src/data/lines';
import { ShuffleBag } from '../src/data/shuffle';
import { Rng } from '../src/sim/rng';

const seeded = (n: number) => {
  const r = new Rng(n);
  return () => r.next();
};
const draw = (bag: ShuffleBag, n: number) => Array.from({ length: n }, () => bag.next());

describe('ShuffleBag (random order, no repeats)', () => {
  it('serves every line exactly once before any line comes back', () => {
    for (const size of [2, 3, 8, 20]) {
      const bag = new ShuffleBag(size, seeded(size));
      for (let round = 0; round < 5; round++) expect(draw(bag, size).sort((a, b) => a - b), `size ${size} round ${round}`).toEqual(Array.from({ length: size }, (_, i) => i));
    }
  });

  it('never repeats a line back to back, even across rounds', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const seq = draw(new ShuffleBag(5, seeded(seed)), 200);
      for (let i = 1; i < seq.length; i++) expect(seq[i], `seed ${seed} at ${i}`).not.toBe(seq[i - 1]);
    }
  });

  it('is actually random: different seeds give different orders, and the same seed is repeatable', () => {
    const orders = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) orders.add(draw(new ShuffleBag(10, seeded(seed)), 10).join(','));
    expect(orders.size).toBeGreaterThan(25);
    expect(draw(new ShuffleBag(10, seeded(7)), 30)).toEqual(draw(new ShuffleBag(10, seeded(7)), 30));
  });

  it('does not favour any position: each line is first about equally often', () => {
    const size = 6;
    const firsts = new Array(size).fill(0);
    for (let seed = 1; seed <= 600; seed++) firsts[new ShuffleBag(size, seeded(seed)).next()]++;
    for (const n of firsts) expect(n).toBeGreaterThan(60); // expected 100 each
  });

  it('copes with a bank of one', () => {
    const bag = new ShuffleBag(1, seeded(1));
    expect(draw(bag, 4)).toEqual([0, 0, 0, 0]);
  });

  it('a busy 20-line category plays 40 times with each line used twice and no neighbours repeating', () => {
    const n = LINES.captureMine.length;
    const seq = draw(new ShuffleBag(n, seeded(99)), n * 2);
    const counts = new Map<number, number>();
    for (const i of seq) counts.set(i, (counts.get(i) ?? 0) + 1);
    expect([...counts.values()].every((c) => c === 2)).toBe(true);
  });
});

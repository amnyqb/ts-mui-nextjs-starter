import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LINES } from '../src/data/lines';
import { Match } from '../src/sim/match';

describe("Chuck's recorded voice", () => {
  const manifest: Record<string, number> = JSON.parse(readFileSync('public/voice/manifest.json', 'utf8'));

  it('has exactly one clip per script line (re-run scripts/make-voice.ts if this fails)', () => {
    const expected = Object.entries(LINES).flatMap(([cat, lines]) => lines.map((_, i) => `${cat}_${i}`));
    expect(Object.keys(manifest).sort()).toEqual(expected.sort());
  });

  it('every clip exists, is non-trivial in size, and has a believable length', () => {
    for (const [key, dur] of Object.entries(manifest)) {
      const file = `public/voice/${key}.mp3`;
      expect(existsSync(file), key).toBe(true);
      expect(statSync(file).size, key).toBeGreaterThan(5000);
      expect(dur, key).toBeGreaterThan(0.8);
      expect(dur, key).toBeLessThan(20);
    }
  });

  it('clip length roughly matches line length (guards against truncated speech)', () => {
    for (const [cat, lines] of Object.entries(LINES))
      lines.forEach((text, i) => {
        const secsPerChar = manifest[`${cat}_${i}`] / text.length;
        expect(secsPerChar, `${cat}_${i}`).toBeGreaterThan(0.03);
        expect(secsPerChar, `${cat}_${i}`).toBeLessThan(0.2);
      });
  });
});

describe('starting squads', () => {
  it('each side opens with 4 rifle robots and 2 tanks, mirrored, so a new game has actors at once', () => {
    const m = new Match(1, [1], 'easy', true);
    const w = m.world;
    for (const side of [0, 1]) {
      const mine = w.unitsOf(side);
      expect(mine.filter((u) => u.type === 'rifle').length).toBe(4);
      expect(mine.filter((u) => u.type === 'tank').length).toBe(2);
    }
    const west = w.unitsOf(0).map((u) => [u.type, u.x, u.y]);
    const east = w.unitsOf(1).map((u) => [u.type, w.map.w - (u.x as number), u.y]);
    expect(east).toEqual(west);
  });

  it('the default match still starts empty (headless tests and AI-vs-AI baselines are unchanged)', () => {
    expect(new Match(1, [1]).world.units.length).toBe(0);
  });

  it('matches with starting squads still finish, on several seeds', () => {
    for (const seed of [1, 2, 3, 4]) {
      const m = new Match(seed, [0, 1], 'hard', true);
      m.run(20 * 60 * 20);
      expect(m.world.winner, `seed ${seed}`).not.toBeNull();
    }
  }, 60000);
});

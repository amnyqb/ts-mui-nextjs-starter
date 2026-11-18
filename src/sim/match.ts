import { SimpleCommander } from '../ai/commander';
import { buildFrontline } from '../data/maps';
import { World } from './world';

export type Difficulty = 'easy' | 'normal' | 'hard';

/** AI tuning per level: think interval (ticks), attack wave size, opening delay (ticks). No hidden bonuses. */
export const DIFFICULTY: Record<Difficulty, { interval: number; wave: number; delay: number }> = {
  easy: { interval: 100, wave: 12, delay: 20 * 60 },
  normal: { interval: 60, wave: 8, delay: 20 * 25 },
  hard: { interval: 40, wave: 6, delay: 0 },
};

/** A world plus the AI commanders that drive it. Headless-safe: used by the game, tests and batch runner. */
export class Match {
  readonly world: World;
  readonly commanders: SimpleCommander[];
  constructor(
    readonly seed: number,
    aiSides: number[] = [1],
    readonly difficulty: Difficulty = 'hard',
  ) {
    const d = DIFFICULTY[difficulty];
    this.world = new World(buildFrontline(), seed);
    this.commanders = aiSides.map((s) => new SimpleCommander(s, d.interval, s * 20 % d.interval, d.wave, d.delay));
  }
  step() {
    if (this.world.winner === null) for (const c of this.commanders) c.update(this.world);
    this.world.step();
  }
  /** Run until someone wins or maxTicks pass. Returns ticks run. */
  run(maxTicks: number): number {
    let n = 0;
    while (this.world.winner === null && n < maxTicks) {
      this.step();
      n++;
    }
    return n;
  }
}

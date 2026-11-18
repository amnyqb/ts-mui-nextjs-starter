import { SimpleCommander } from '../ai/commander';
import { buildFrontline } from '../data/maps';
import { World } from './world';

/** A world plus the AI commanders that drive it. Headless-safe: used by the game, tests and batch runner. */
export class Match {
  readonly world: World;
  readonly commanders: SimpleCommander[];
  constructor(
    readonly seed: number,
    aiSides: number[] = [1],
  ) {
    this.world = new World(buildFrontline(), seed);
    this.commanders = aiSides.map((s) => new SimpleCommander(s, 40, s * 20));
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

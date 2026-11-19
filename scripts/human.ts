// How does a sensible human-style player fare against each AI level? (same capture-then-mass policy a person would use,
// reacting once per second, massing 12 robots before attacking)
import { SimpleCommander } from '../src/ai/commander';
import { DIFFICULTY, Match, type Difficulty } from '../src/sim/match';

const N = Number(process.argv[2] ?? 40);
for (const level of ['easy', 'normal', 'hard'] as Difficulty[]) {
  let wins = 0, losses = 0, other = 0;
  const secs: number[] = [];
  for (let seed = 1; seed <= N; seed++) {
    const m = new Match(seed, [1], level);
    const human = new SimpleCommander(0, 20, 0, 12, 0);
    for (let t = 0; t < 20 * 60 * 20 && m.world.winner === null; t++) {
      human.update(m.world);
      m.step();
    }
    const w = m.world.winner;
    if (w === 0) { wins++; secs.push(m.world.tick / 20); } else if (w === 1) losses++; else other++;
  }
  secs.sort((a, b) => a - b);
  console.log(level.padEnd(7), `human wins ${wins}/${N}`, `losses ${losses}`, `unfinished ${other}`, secs.length ? `median win ${Math.round(secs[secs.length >> 1])}s` : '', JSON.stringify(DIFFICULTY[level]));
}

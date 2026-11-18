import { Match } from '../src/sim/match';

const N = Number(process.argv[2] ?? 50);
const MAX = 20 * 60 * 20;
let wins = [0, 0];
let stalemates = 0;
let draws = 0;
const lens: number[] = [];
const t0 = performance.now();
for (let seed = 1; seed <= N; seed++) {
  const m = new Match(seed, [0, 1]);
  const ticks = m.run(MAX);
  const w = m.world.winner;
  if (w === null) stalemates++;
  else if (w === -1) draws++;
  else wins[w]++;
  lens.push(ticks / 20);
}
const ms = performance.now() - t0;
lens.sort((a, b) => a - b);
console.log(
  JSON.stringify({
    matches: N,
    westWins: wins[0],
    eastWins: wins[1],
    draws,
    stalemates,
    medianSeconds: lens[(lens.length / 2) | 0],
    maxSeconds: lens[lens.length - 1],
    wallMs: Math.round(ms),
  }),
);

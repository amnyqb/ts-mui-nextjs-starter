import { UNITS } from '../data/units';
import type { World } from '../sim/world';

/**
 * Stage-1 opponent: a deliberately simple commander. (Stage 2 replaces it with the utility-scored
 * commander + squad layer.) Every `interval` ticks it
 *  1. sends idle rifle robots to the nearest unowned flag (max 2 per flag), and
 *  2. once 6 idle units are waiting, attack-moves them all to the enemy HQ.
 */
export class SimpleCommander {
  constructor(
    readonly side: number,
    readonly interval = 40,
    readonly offset = 0,
    readonly waveSize = 6,
  ) {}

  update(w: World) {
    if (w.tick % this.interval !== this.offset) return;
    const mine = w.unitsOf(this.side);
    const assigned = new Map<number, number>();
    for (const u of mine) {
      if (u.order.kind === 'capture') assigned.set(u.order.target, (assigned.get(u.order.target) ?? 0) + 1);
    }
    const army: number[] = [];
    for (const u of mine) {
      if (u.order.kind !== 'none') continue;
      if (UNITS[u.type].canCapture) {
        let best = -1;
        let bestD = Infinity;
        for (const t of w.territories) {
          if (t.owner === this.side || (assigned.get(t.id) ?? 0) >= 2) continue;
          const d = Math.hypot(t.fx - u.x, t.fy - u.y);
          if (d < bestD) {
            bestD = d;
            best = t.id;
          }
        }
        if (best >= 0) {
          assigned.set(best, (assigned.get(best) ?? 0) + 1);
          w.issue({ type: 'capture', ids: [u.id], territory: best });
          continue;
        }
      }
      army.push(u.id);
    }
    const enemy = w.hq(1 - this.side);
    if (enemy && army.length >= this.waveSize) {
      w.issue({ type: 'attackmove', ids: army, x: enemy.x, y: enemy.y });
    }
  }
}

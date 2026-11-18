import type { Cat } from '../data/lines';
import { BUILDINGS, TICKS_PER_SEC } from '../data/units';
import type { SimEvent } from '../sim/types';
import type { World } from '../sim/world';

export interface Cue {
  cat: Cat;
  /** 0 = chatter, 1 = normal, 2 = important, 3 = must-play (interrupts) */
  prio: number;
}

const S = TICKS_PER_SEC;
const PLAYER = 0;

/**
 * Decides WHAT the reporter should talk about, from real simulation events. No DOM: fully testable headless.
 * (The Commentator in src/render picks a line, enforces cooldowns and shows it.)
 */
export class Director {
  private lastActivity = 0;
  private deaths: number[] = [];
  private flags = { intro2: false, firstRobots: false, firstBlood: false, army: false, hqHurt: false, hqCrit: false, eHqHurt: false, eHqCrit: false, order: false };
  private wasBehind = false;
  private lastRatioCheck = 0;
  private lastComeback = -1e9;

  reset() {
    this.lastActivity = 0;
    this.deaths = [];
    this.flags = { intro2: false, firstRobots: false, firstBlood: false, army: false, hqHurt: false, hqCrit: false, eHqHurt: false, eHqCrit: false, order: false };
    this.wasBehind = false;
    this.lastRatioCheck = 0;
    this.lastComeback = -1e9;
  }

  /** the player issued their first order */
  noteOrder(): Cue | null {
    if (this.flags.order) return null;
    this.flags.order = true;
    return { cat: 'order', prio: 1 };
  }

  consume(w: World, events: SimEvent[]): Cue[] {
    const out: Cue[] = [];
    const tick = w.tick;
    const push = (cat: Cat, prio: number) => out.push({ cat, prio });

    if (tick === 1) push('intro', 3);
    if (!this.flags.intro2 && tick >= 14 * S) {
      this.flags.intro2 = true;
      push('intro2', 0);
    }

    for (const e of events) {
      if (e.t === 'capture') {
        this.lastActivity = tick;
        if (e.owner === PLAYER) push('captureMine', 2);
        else if (e.prev === PLAYER) push('captureLost', 2);
        else if (e.prev === -1) push('enemyTook', 0);
      } else if (e.t === 'death') {
        this.lastActivity = tick;
        this.deaths.push(tick);
        if (!this.flags.firstBlood) {
          this.flags.firstBlood = true;
          push('firstBlood', 1);
        } else if (e.big) push('tankDown', 1);
      } else if (e.t === 'spawn' && e.owner === PLAYER && !this.flags.firstRobots) {
        this.flags.firstRobots = true;
        push('firstRobots', 1);
      } else if (e.t === 'victory') {
        push(e.winner === PLAYER ? 'victory' : e.winner === -1 ? 'draw' : 'defeat', 3);
      }
    }

    this.deaths = this.deaths.filter((t) => tick - t <= 4 * S);
    if (this.deaths.length >= 6) {
      push('bloodbath', 1);
      this.deaths = [];
    }

    // cheap checks, a few times per second
    if (tick % 10 === 0) {
      const mine = w.hq(PLAYER);
      const theirs = w.hq(1);
      const full = BUILDINGS.hq.hp;
      if (mine && mine.hp > 0) {
        if (!this.flags.hqCrit && mine.hp < full * 0.2) {
          this.flags.hqCrit = true;
          this.flags.hqHurt = true;
          push('hqCritical', 2);
        } else if (!this.flags.hqHurt && mine.hp < full * 0.5) {
          this.flags.hqHurt = true;
          push('hqHurt', 2);
        }
      }
      if (theirs && theirs.hp > 0) {
        if (!this.flags.eHqCrit && theirs.hp < full * 0.2) {
          this.flags.eHqCrit = true;
          this.flags.eHqHurt = true;
          push('enemyHqCritical', 2);
        } else if (!this.flags.eHqHurt && theirs.hp < full * 0.5) {
          this.flags.eHqHurt = true;
          push('enemyHqHurt', 2);
        }
      }

      const myFlags = w.ownedTerritories(PLAYER);
      const theirFlags = w.ownedTerritories(1);
      if (myFlags + 1 < theirFlags) this.wasBehind = true;
      if (this.wasBehind && myFlags > theirFlags && tick - this.lastComeback > 60 * S) {
        this.wasBehind = false;
        this.lastComeback = tick;
        push('comeback', 2);
      }

      if (!this.flags.army && w.unitsOf(PLAYER).length >= 15) {
        this.flags.army = true;
        push('army', 1);
      }

      if (tick - this.lastRatioCheck >= 15 * S && tick > 60 * S) {
        this.lastRatioCheck = tick;
        const a = w.unitsOf(PLAYER).length;
        const b = w.unitsOf(1).length;
        if (a >= 6 && a >= b * 2.5) push('crushing', 1);
        else if (b >= 6 && b >= a * 2.5) push('losing', 1);
      }

      if (tick - this.lastActivity > 45 * S) {
        this.lastActivity = tick - 10 * S; // fills the silence again in ~35 s if it stays quiet
        push('idle', 0);
      }
    }
    return out;
  }
}

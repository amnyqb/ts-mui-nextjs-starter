import { T_ROCK, T_WATER } from '../data/maps';
import type { MapDef } from './types';

export class PathGrid {
  readonly w: number;
  readonly h: number;
  readonly blocked: Uint8Array;
  // scratch buffers reused across searches (generation-stamped to avoid clearing)
  private g: Float32Array;
  private parent: Int32Array;
  private seen: Uint32Array;
  private closed: Uint32Array;
  private gen = 0;

  constructor(map: MapDef) {
    this.w = map.w;
    this.h = map.h;
    this.blocked = new Uint8Array(map.w * map.h);
    for (let i = 0; i < map.tiles.length; i++) {
      const t = map.tiles[i];
      this.blocked[i] = t === T_WATER || t === T_ROCK ? 1 : 0;
    }
    const n = map.w * map.h;
    this.g = new Float32Array(n);
    this.parent = new Int32Array(n);
    this.seen = new Uint32Array(n);
    this.closed = new Uint32Array(n);
  }

  open(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.blocked[y * this.w + x] === 0;
  }

  /** Nearest open tile to (x,y) by expanding square rings; deterministic scan order. */
  nearestOpen(x: number, y: number): [number, number] | null {
    if (this.open(x, y)) return [x, y];
    for (let r = 1; r < Math.max(this.w, this.h); r++) {
      let best: [number, number] | null = null;
      let bestD = Infinity;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (!this.open(x + dx, y + dy)) continue;
          const d = dx * dx + dy * dy;
          if (d < bestD) {
            bestD = d;
            best = [x + dx, y + dy];
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  /**
   * A* on the tile grid, 8-way, no corner cutting. Returns tile coordinates from the step after start to the goal,
   * or null if unreachable. If the goal tile is blocked the nearest open tile is used.
   */
  findPath(sx: number, sy: number, tx: number, ty: number): [number, number][] | null {
    const raw = this.rawPath(sx, sy, tx, ty);
    return raw && this.smooth(sx, sy, raw);
  }

  /** True if a unit of half-width ~0.35 can walk the straight segment between two tile centres. */
  clearLine(ax: number, ay: number, bx: number, by: number): boolean {
    const x0 = ax + 0.5;
    const y0 = ay + 0.5;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (len === 0) return true;
    const nx = (-dy / len) * 0.35;
    const ny = (dx / len) * 0.35;
    const steps = Math.ceil(len / 0.2);
    for (let i = 0; i <= steps; i++) {
      const px = x0 + (dx * i) / steps;
      const py = y0 + (dy * i) / steps;
      if (
        !this.open(Math.floor(px), Math.floor(py)) ||
        !this.open(Math.floor(px + nx), Math.floor(py + ny)) ||
        !this.open(Math.floor(px - nx), Math.floor(py - ny))
      )
        return false;
    }
    return true;
  }

  /** Greedy string-pulling: keep only the waypoints needed to turn corners. */
  private smooth(sx: number, sy: number, path: [number, number][]): [number, number][] {
    if (path.length < 2) return path;
    const out: [number, number][] = [];
    let anchor: [number, number] = [sx, sy];
    let i = 0;
    while (i < path.length) {
      let j = i;
      while (j + 1 < path.length && this.clearLine(anchor[0], anchor[1], path[j + 1][0], path[j + 1][1])) j++;
      out.push(path[j]);
      anchor = path[j];
      i = j + 1;
    }
    return out;
  }

  private rawPath(sx: number, sy: number, tx: number, ty: number): [number, number][] | null {
    const goal = this.nearestOpen(tx, ty);
    if (!goal || !this.open(sx, sy)) return null;
    [tx, ty] = goal;
    if (sx === tx && sy === ty) return [];

    const { w } = this;
    const gen = ++this.gen;
    const start = sy * w + sx;
    const end = ty * w + tx;
    const heap: number[] = []; // node indices
    const fs = new Map<number, number>(); // node -> f at push time (lazy deletion)

    const h = (i: number) => {
      const dx = Math.abs((i % w) - tx);
      const dy = Math.abs(((i / w) | 0) - ty);
      return Math.max(dx, dy) + 0.41421356 * Math.min(dx, dy);
    };
    const less = (a: number, b: number) => {
      const fa = fs.get(a)!;
      const fb = fs.get(b)!;
      return fa < fb || (fa === fb && a < b);
    };
    const push = (i: number) => {
      heap.push(i);
      let c = heap.length - 1;
      while (c > 0) {
        const p = (c - 1) >> 1;
        if (!less(heap[c], heap[p])) break;
        [heap[c], heap[p]] = [heap[p], heap[c]];
        c = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        let p = 0;
        for (;;) {
          const l = p * 2 + 1;
          const r = l + 1;
          let m = p;
          if (l < heap.length && less(heap[l], heap[m])) m = l;
          if (r < heap.length && less(heap[r], heap[m])) m = r;
          if (m === p) break;
          [heap[p], heap[m]] = [heap[m], heap[p]];
          p = m;
        }
      }
      return top;
    };

    this.g[start] = 0;
    this.parent[start] = -1;
    this.seen[start] = gen;
    fs.set(start, h(start));
    push(start);

    while (heap.length) {
      const cur = pop();
      if (this.closed[cur] === gen) continue;
      this.closed[cur] = gen;
      if (cur === end) {
        const out: [number, number][] = [];
        for (let n = cur; n !== start; n = this.parent[n]) out.push([n % w, (n / w) | 0]);
        return out.reverse();
      }
      const cx = cur % w;
      const cy = (cur / w) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (!this.open(nx, ny)) continue;
          if (dx && dy && (!this.open(cx + dx, cy) || !this.open(cx, cy + dy))) continue;
          const ni = ny * w + nx;
          if (this.closed[ni] === gen) continue;
          const ng = this.g[cur] + (dx && dy ? 1.41421356 : 1);
          if (this.seen[ni] !== gen || ng < this.g[ni]) {
            this.seen[ni] = gen;
            this.g[ni] = ng;
            this.parent[ni] = cur;
            fs.set(ni, ng + h(ni));
            push(ni);
          }
        }
      }
    }
    return null;
  }
}

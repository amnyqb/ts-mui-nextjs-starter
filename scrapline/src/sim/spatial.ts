/** Uniform grid hash. Rebuilt every tick; query order is deterministic (row-major cells, insertion order). */
export class SpatialHash<T extends { x: number; y: number }> {
  private cells: T[][];
  private cw: number;
  private ch: number;
  constructor(
    w: number,
    h: number,
    private cell = 4,
  ) {
    this.cw = Math.ceil(w / cell);
    this.ch = Math.ceil(h / cell);
    this.cells = Array.from({ length: this.cw * this.ch }, () => []);
  }
  clear() {
    for (const c of this.cells) c.length = 0;
  }
  insert(item: T) {
    const cx = Math.min(this.cw - 1, Math.max(0, (item.x / this.cell) | 0));
    const cy = Math.min(this.ch - 1, Math.max(0, (item.y / this.cell) | 0));
    this.cells[cy * this.cw + cx].push(item);
  }
  /** Visit every item whose cell overlaps the circle (x,y,r); caller does the exact distance test. */
  query(x: number, y: number, r: number, visit: (item: T) => void) {
    const x0 = Math.max(0, ((x - r) / this.cell) | 0);
    const x1 = Math.min(this.cw - 1, ((x + r) / this.cell) | 0);
    const y0 = Math.max(0, ((y - r) / this.cell) | 0);
    const y1 = Math.min(this.ch - 1, ((y + r) / this.cell) | 0);
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++) {
        const c = this.cells[cy * this.cw + cx];
        for (let i = 0; i < c.length; i++) visit(c[i]);
      }
  }
}

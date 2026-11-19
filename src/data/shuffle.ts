/**
 * Random order without repeats: every index is drawn once, in random order, before any index comes back. When a round
 * ends the bag reshuffles, and the first line of the new round is never the last line of the old one.
 * (Pass a seeded rng in tests; the game uses Math.random.)
 */
export class ShuffleBag {
  private bag: number[] = [];
  private last = -1;

  constructor(
    private readonly size: number,
    private readonly rng: () => number = Math.random,
  ) {}

  next(): number {
    if (!this.bag.length) {
      this.bag = Array.from({ length: this.size }, (_, i) => i);
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
      // next() pops from the end: make sure it is not the line we just used
      const end = this.bag.length - 1;
      if (this.size > 1 && this.bag[end] === this.last) {
        const k = Math.floor(this.rng() * end);
        [this.bag[end], this.bag[k]] = [this.bag[k], this.bag[end]];
      }
    }
    this.last = this.bag.pop()!;
    return this.last;
  }
}

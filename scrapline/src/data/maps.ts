import type { BuildingDef, MapDef, TerritoryDef } from '../sim/types';

export const T_GRASS = 0;
export const T_WATER = 1;
export const T_BRIDGE = 2;
export const T_ROCK = 3;

/** "Broken Bridge": two bases, a river with three crossings (north, centre chokepoint, south), 8 territories. */
export function buildFrontline(): MapDef {
  const w = 56;
  const h = 32;
  const tiles = new Uint8Array(w * h);
  const mx = (x: number) => w - 1 - x;
  const rect = (x0: number, x1: number, y0: number, y1: number, v: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) tiles[y * w + x] = v;
  };

  rect(26, 29, 0, h - 1, T_WATER);
  rect(26, 29, 14, 16, T_BRIDGE);
  rect(26, 29, 3, 4, T_BRIDGE);
  rect(26, 29, 27, 28, T_BRIDGE);

  const rocks: [number, number, number, number][] = [
    [17, 18, 9, 11],
    [17, 18, 20, 22],
    [21, 22, 11, 12],
    [21, 22, 19, 20],
  ];
  for (const [x0, x1, y0, y1] of rocks) {
    rect(x0, x1, y0, y1, T_ROCK);
    rect(mx(x1), mx(x0), y0, y1, T_ROCK);
  }

  // West side defined by hand, east side mirrored.
  const west: { t: TerritoryDef; b: Omit<BuildingDef, 'territory'>[] }[] = [
    {
      t: { name: 'West Base', fx: 5, fy: 16, owner: 0 },
      b: [
        { bkind: 'hq', x: 4.5, y: 11.5 },
        { bkind: 'barracks', x: 9.5, y: 13.5 },
        { bkind: 'vehicle', x: 9.5, y: 19.5 },
      ],
    },
    { t: { name: 'North Depot', fx: 14, fy: 6, owner: -1 }, b: [{ bkind: 'barracks', x: 16.5, y: 8.5 }] },
    { t: { name: 'South Depot', fx: 14, fy: 26, owner: -1 }, b: [{ bkind: 'vehicle', x: 16.5, y: 24.5 }] },
    { t: { name: 'West Ford', fx: 22, fy: 16, owner: -1 }, b: [] },
  ];
  const eastNames = ['East Ford', 'North Ridge', 'South Ridge', 'East Base'];
  const eastOf = [3, 1, 2, 0];

  const territories: TerritoryDef[] = west.map((e) => e.t);
  const buildings: BuildingDef[] = [];
  west.forEach((e, i) => e.b.forEach((b) => buildings.push({ ...b, territory: i })));
  eastOf.forEach((wi, k) => {
    const id = 4 + k;
    const src = west[wi];
    territories.push({
      name: eastNames[k],
      fx: mx(src.t.fx),
      fy: src.t.fy,
      owner: wi === 0 ? 1 : -1,
    });
    // Buildings use continuous (tile-centre) coordinates, so their mirror is w - x, not w - 1 - x.
    src.b.forEach((b) => buildings.push({ bkind: b.bkind, x: w - b.x, y: b.y, territory: id }));
  });

  return { name: 'Broken Bridge', w, h, tiles, territories, buildings };
}

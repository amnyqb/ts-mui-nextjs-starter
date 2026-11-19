export type UnitType = 'rifle' | 'tank';
export type ArmorClass = 'infantry' | 'vehicle' | 'building';
export type OrderKind = 'none' | 'move' | 'attackmove' | 'attack' | 'capture';
export type BuildingKind = 'hq' | 'barracks' | 'vehicle';

/** -1 = neutral, otherwise side index (0 = player, 1 = opponent). */
export type Owner = number;

export interface Order {
  kind: OrderKind;
  x: number;
  y: number;
  /** attack: entity id; capture: territory id */
  target: number;
}

export interface Unit {
  id: number;
  type: UnitType;
  owner: Owner;
  x: number;
  y: number;
  px: number;
  py: number;
  hp: number;
  order: Order;
  path: [number, number][];
  pathIdx: number;
  cooldown: number;
  /** tick at which a pursuing unit may recompute its path (time-sliced repathing) */
  repathAt: number;
  face: number;
  aim: number;
  anim: number;
}

export interface Building {
  id: number;
  bkind: BuildingKind;
  territory: number;
  owner: Owner;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  progress: number;
  paused: boolean;
}

export interface Territory {
  id: number;
  name: string;
  fx: number;
  fy: number;
  owner: Owner;
  buildings: number[];
}

export type Command =
  | { type: 'move'; ids: number[]; x: number; y: number }
  | { type: 'attackmove'; ids: number[]; x: number; y: number }
  | { type: 'attack'; ids: number[]; target: number }
  | { type: 'capture'; ids: number[]; territory: number }
  | { type: 'stop'; ids: number[] }
  | { type: 'togglePause'; building: number };

export type SimEvent =
  | { t: 'shot'; x1: number; y1: number; x2: number; y2: number; hit: boolean; owner: Owner; unit: UnitType }
  | { t: 'death'; x: number; y: number; big: boolean; owner: Owner; hq?: boolean }
  | { t: 'capture'; territory: number; owner: Owner; prev: Owner }
  | { t: 'spawn'; id: number; owner: Owner }
  | { t: 'victory'; winner: number };

export interface BuildingDef {
  bkind: BuildingKind;
  x: number;
  y: number;
  territory: number;
}
export interface TerritoryDef {
  name: string;
  fx: number;
  fy: number;
  owner: Owner;
}
export interface MapDef {
  name: string;
  w: number;
  h: number;
  /** 0 grass, 1 water, 2 bridge, 3 rock */
  tiles: Uint8Array;
  territories: TerritoryDef[];
  buildings: BuildingDef[];
}

import type { ArmorClass, BuildingKind, UnitType } from '../sim/types';

export const TICKS_PER_SEC = 20;
export const UNIT_CAP_PER_SIDE = 60;
export const CAPTURE_RADIUS = 1.2;

export interface UnitDef {
  name: string;
  armor: ArmorClass;
  hp: number;
  /** tiles per second */
  speed: number;
  detect: number;
  range: number;
  damage: number;
  accuracy: number;
  /** ticks between shots */
  reload: number;
  /** base ticks to build */
  buildTicks: number;
  radius: number;
  canCapture: boolean;
  /** damage multiplier by target armour class */
  vs: Record<ArmorClass, number>;
}

export const UNITS: Record<UnitType, UnitDef> = {
  rifle: {
    name: 'Rifle Robot',
    armor: 'infantry',
    hp: 40,
    speed: 2.6,
    detect: 7,
    range: 5,
    damage: 6,
    accuracy: 0.8,
    reload: 10,
    buildTicks: 100,
    radius: 0.35,
    canCapture: true,
    vs: { infantry: 1, vehicle: 0.3, building: 0.4 },
  },
  tank: {
    name: 'Light Tank',
    armor: 'vehicle',
    hp: 140,
    speed: 2.0,
    detect: 9,
    range: 7,
    damage: 18,
    accuracy: 0.75,
    reload: 24,
    buildTicks: 240,
    radius: 0.6,
    canCapture: false,
    vs: { infantry: 0.6, vehicle: 1, building: 1.2 },
  },
};

export interface BuildingDefStats {
  name: string;
  hp: number;
  produces: UnitType | null;
  /** footprint half-size in tiles (for targeting and drawing) */
  half: number;
}

export const BUILDINGS: Record<BuildingKind, BuildingDefStats> = {
  hq: { name: 'Headquarters', hp: 500, produces: null, half: 1.5 },
  barracks: { name: 'Robot Barracks', hp: 1, produces: 'rifle', half: 1.1 },
  vehicle: { name: 'Vehicle Works', hp: 1, produces: 'tank', half: 1.3 },
};

/**
 * Production speed multiplier: each extra owned territory speeds every factory up by 15%.
 * progress += productionRate(owned) each tick; a unit completes at buildTicks.
 */
export function productionRate(ownedTerritories: number): number {
  return 1 + 0.15 * Math.max(0, ownedTerritories - 1);
}

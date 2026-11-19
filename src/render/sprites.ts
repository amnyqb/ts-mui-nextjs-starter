/**
 * Procedural sprite factory. Every image in the game is drawn here with the 2D canvas API at startup, then handed
 * to Phaser as a texture. Nothing is downloaded, so all art is original. The same texture keys can later be
 * replaced by pre-rendered sheets (e.g. from Blender) without touching game code.
 *
 * Keys:  rifle0 / rifle1      8x8 sheet, frame "<dir>_<walk>_<hurt>"   (dir 0..7 clockwise from east)
 *        hull0 / hull1        frames "0","1" (tread phase), faces east, rotated in game
 *        turret0 / turret1    faces east, rotated in game
 *        bld_<kind>_<0|1|n>   hq / barracks / vehicle for amber, teal, neutral
 */
import type Phaser from 'phaser';
import { T_BRIDGE, T_ROCK, T_WATER } from '../data/maps';
import type { MapDef } from '../sim/types';

interface Pal { main: string; light: string; dark: string }
const PAL: Record<string, Pal> = {
  '0': { main: '#ffae00', light: '#ffe08a', dark: '#a8630a' },
  '1': { main: '#08c4b8', light: '#8af5ec', dark: '#0a726c' },
  n: { main: '#8d929c', light: '#c9cdd4', dark: '#565b65' },
};
const OUT = '#15171b';
type Ctx = CanvasRenderingContext2D;

function mk(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}
function rr(g: Ctx, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function circ(g: Ctx, x: number, y: number, r: number) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
}
function ell(g: Ctx, x: number, y: number, rx: number, ry: number) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}
function lin(g: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
}
/** fill the current path then outline it */
function ink(g: Ctx, fill: string | CanvasGradient, lw = 2) {
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = lw;
  g.strokeStyle = OUT;
  g.lineJoin = 'round';
  g.stroke();
}
function line(g: Ctx, x0: number, y0: number, x1: number, y1: number, w: number, c: string) {
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.lineWidth = w;
  g.strokeStyle = c;
  g.lineCap = 'round';
  g.stroke();
}
const hash = (x: number, y: number, s = 0) => ((Math.imul(x + s * 131, 73856093) ^ Math.imul(y + s * 71, 19349663)) >>> 0) % 1000 / 1000;

// ===================================================================== RIFLE ROBOT

/** A chubby tin soldier: big dome head, googly angry eyes, antenna, oversized gun. 64x64, feet near y=50. */
function drawRifle(g: Ctx, pal: Pal, d: number, f: number, hurt: boolean) {
  const a = (d * Math.PI) / 4;
  const fx = Math.cos(a);
  const fy = Math.sin(a);
  const ph = (f * Math.PI) / 2;
  const swing = Math.sin(ph);
  const bob = Math.abs(Math.sin(ph)) * 1.6;
  const behind = fy < -0.25; // facing away: gun is hidden behind the body

  g.fillStyle = 'rgba(0,0,0,0.30)';
  ell(g, 32, 52, 14, 5.5);
  g.fill();

  for (const s of [-1, 1]) {
    const off = swing * s * 4.2;
    const bx = 32 + s * 5.5 + fx * off;
    const by = 49 + fy * off * 0.6;
    rr(g, bx - 4.5, by - 3.2, 9, 7, 3);
    ink(g, '#3b4049', 1.6);
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.fillRect(bx - 3, by - 2.4, 6, 1.6);
  }

  const gun = () => {
    const sx = 32 + fx * 3;
    const sy = 38 + fy * 2 - bob;
    const ex = sx + fx * 17;
    const ey = sy + fy * 17 * 0.62;
    line(g, sx, sy, ex, ey, 7, OUT);
    line(g, sx, sy, ex, ey, 4.6, '#59606c');
    line(g, sx, sy - 0.8, ex, ey - 0.8, 1.2, '#a9b0bc');
    circ(g, ex, ey, 3.3);
    ink(g, '#2a2d33', 1.4);
    circ(g, sx, sy, 3.8);
    ink(g, '#2d3138', 1.4);
  };
  if (behind) gun();

  const by0 = 30 - bob;
  rr(g, 22, by0, 20, 18, 6.5);
  ink(g, lin(g, 22, by0, 42, by0 + 18, [[0, pal.light], [1, pal.main]]), 2);
  g.fillStyle = pal.dark;
  g.fillRect(24.5, by0 + 11, 15, 2.6);
  g.fillStyle = '#f2f4f8';
  for (const rx of [26, 38]) {
    circ(g, rx, by0 + 5, 1.1);
    g.fill();
  }
  if (hurt) {
    g.strokeStyle = OUT;
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(30, by0 + 1);
    g.lineTo(33, by0 + 6);
    g.lineTo(30, by0 + 9);
    g.lineTo(34, by0 + 14);
    g.stroke();
  }
  for (const s of [-1, 1]) {
    circ(g, 32 + s * 11.5, by0 + 9, 3.7);
    ink(g, pal.dark, 1.5);
  }
  if (!behind) gun();

  const hx = 32 + fx * 2;
  const hy = 21 - bob + fy;
  circ(g, hx, hy, 11.5);
  ink(g, lin(g, hx - 10, hy - 10, hx + 10, hy + 10, [[0, '#eef1f6'], [1, '#8f97a4']]), 2);
  g.beginPath();
  g.arc(hx, hy, 11.5, Math.PI, Math.PI * 2);
  g.closePath();
  ink(g, lin(g, hx - 10, hy - 12, hx + 10, hy, [[0, pal.light], [1, pal.main]]), 2);
  g.fillStyle = 'rgba(255,255,255,0.45)';
  ell(g, hx - 4, hy - 7, 3.2, 1.6);
  g.fill();

  if (fy > -0.35) {
    const ey = hy + 2 + fy * 1.5;
    for (const s of [-1, 1]) {
      const ex = hx + s * 4.4 + fx * 3.2;
      circ(g, ex, ey, 4);
      ink(g, '#ffffff', 1.3);
      if (hurt) {
        g.strokeStyle = '#d42b1f';
        g.lineWidth = 1.7;
        g.beginPath();
        g.moveTo(ex - 2, ey - 2);
        g.lineTo(ex + 2, ey + 2);
        g.moveTo(ex + 2, ey - 2);
        g.lineTo(ex - 2, ey + 2);
        g.stroke();
      } else {
        circ(g, ex + fx * 1.7, ey + fy * 1.1, 2);
        g.fillStyle = OUT;
        g.fill();
        g.fillStyle = '#fff';
        circ(g, ex + fx * 1.7 - 0.7, ey + fy * 1.1 - 0.8, 0.7);
        g.fill();
      }
      // angry brows: the inner end sits lower
      const inner = s < 0 ? 1 : -1;
      line(g, ex - 3.2 * inner * -1, ey - 5.6, ex + 3.2 * inner * -1, ey - 5.6 + 2.6 * 1, 1.9, OUT);
    }
    g.fillStyle = OUT;
    if (hurt) {
      g.strokeStyle = OUT;
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(hx + fx * 3 - 3, hy + 9.2);
      g.lineTo(hx + fx * 3 - 1, hy + 7.8);
      g.lineTo(hx + fx * 3 + 1, hy + 9.2);
      g.lineTo(hx + fx * 3 + 3, hy + 7.8);
      g.stroke();
    } else {
      rr(g, hx + fx * 3 - 3, hy + 7.6, 6, 2.2, 1.1);
      g.fill();
    }
  } else {
    g.strokeStyle = 'rgba(40,44,52,0.7)';
    g.lineWidth = 1.4;
    for (const dy of [2, 5, 8]) {
      g.beginPath();
      g.moveTo(hx - 5, hy + dy);
      g.lineTo(hx + 5, hy + dy);
      g.stroke();
    }
  }

  const sway = Math.sin(ph) * 1.6;
  line(g, hx, hy - 11, hx + sway, hy - 17, 1.8, OUT);
  circ(g, hx + sway, hy - 18, 2.6);
  ink(g, hurt ? '#ffd34d' : '#ff4d3d', 1.4);
}

// =========================================================================== TANK

function drawHull(g: Ctx, pal: Pal, phase: number) {
  g.fillStyle = 'rgba(0,0,0,0.28)';
  rr(g, 9, 17, 50, 34, 8);
  g.fill();
  for (const ty of [10, 44]) {
    rr(g, 5, ty, 54, 11, 5.5);
    ink(g, '#2b2e35', 1.8);
    g.strokeStyle = '#5b616d';
    g.lineWidth = 1.5;
    for (let x = 9 + phase * 2; x < 57; x += 4) {
      g.beginPath();
      g.moveTo(x, ty + 1.8);
      g.lineTo(x, ty + 9.2);
      g.stroke();
    }
    for (const wx of [12, 32, 52]) {
      circ(g, wx, ty + 5.5, 3.4);
      ink(g, '#80869a', 1.2);
    }
  }
  rr(g, 8, 16, 47, 32, 8);
  ink(g, lin(g, 0, 16, 0, 48, [[0, pal.light], [0.45, pal.main], [1, pal.dark]]), 2.2);
  g.beginPath();
  g.moveTo(45, 17);
  g.lineTo(55, 23);
  g.lineTo(55, 41);
  g.lineTo(45, 47);
  g.closePath();
  ink(g, pal.dark, 1.8);
  for (const hy of [24, 40]) {
    circ(g, 55, hy, 2.8);
    ink(g, '#ffee99', 1.3);
  }
  g.fillStyle = '#f4f6fa';
  for (let x = 13; x < 40; x += 7) {
    for (const y of [20.5, 43.5]) {
      circ(g, x, y, 1.1);
      g.fill();
    }
  }
  rr(g, 3, 26, 6, 12, 2);
  ink(g, '#2f3239', 1.5);
}

function drawTurret(g: Ctx, pal: Pal) {
  rr(g, 31, 28.2, 27, 7.6, 3.5);
  ink(g, lin(g, 0, 28, 0, 36, [[0, '#7a8190'], [1, '#2f333b']]), 1.8);
  rr(g, 53, 25.5, 8, 13, 2.5);
  ink(g, '#2a2d33', 1.6);
  circ(g, 28, 32, 13.5);
  ink(g, lin(g, 16, 18, 40, 46, [[0, pal.light], [0.5, pal.main], [1, pal.dark]]), 2.2);
  circ(g, 20.5, 32, 4);
  ink(g, pal.dark, 1.4);
  for (const ey of [26.6, 37.4]) {
    circ(g, 33.5, ey, 4.4);
    ink(g, '#ffffff', 1.3);
    circ(g, 35.2, ey, 2.1);
    g.fillStyle = OUT;
    g.fill();
  }
  line(g, 29.5, 21.6, 38, 24.6, 2, OUT);
  line(g, 29.5, 42.4, 38, 39.4, 2, OUT);
}

// ================================================================== BUILDINGS

function robotFace(g: Ctx, x: number, y: number, r: number) {
  circ(g, x, y, r);
  ink(g, lin(g, x - r, y - r, x + r, y + r, [[0, '#eef1f6'], [1, '#8f97a4']]), 1.8);
  for (const s of [-1, 1]) {
    circ(g, x + s * r * 0.42, y + r * 0.1, r * 0.3);
    ink(g, '#fff', 1);
    circ(g, x + s * r * 0.42, y + r * 0.14, r * 0.14);
    g.fillStyle = OUT;
    g.fill();
  }
  line(g, x - r * 0.75, y - r * 0.38, x - r * 0.12, y - r * 0.2, 1.6, OUT);
  line(g, x + r * 0.75, y - r * 0.38, x + r * 0.12, y - r * 0.2, 1.6, OUT);
}

function hazard(g: Ctx, x: number, y: number, w: number, h: number) {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.fillStyle = '#f5c518';
  g.fillRect(x, y, w, h);
  g.fillStyle = '#1b1d21';
  for (let i = -h; i < w + h; i += 10) {
    g.beginPath();
    g.moveTo(x + i, y + h);
    g.lineTo(x + i + 5, y + h);
    g.lineTo(x + i + 5 + h, y);
    g.lineTo(x + i + h, y);
    g.closePath();
    g.fill();
  }
  g.restore();
}

function smokePuffs(g: Ctx, x: number, y: number) {
  g.fillStyle = 'rgba(210,214,220,0.75)';
  for (const [dx, dy, r] of [[0, 0, 3.4], [3, -5, 4.2], [-1, -11, 5]]) {
    circ(g, x + dx, y + dy, r);
    g.fill();
  }
}

function drawBarracks(g: Ctx, pal: Pal) {
  g.fillStyle = 'rgba(0,0,0,0.28)';
  rr(g, 17, 22, 70, 66, 7);
  g.fill();
  rr(g, 13, 19, 70, 64, 7);
  ink(g, lin(g, 0, 19, 0, 83, [[0, '#5a616d'], [1, '#353a44']]), 2.2);
  rr(g, 10, 12, 76, 24, 7);
  ink(g, lin(g, 0, 12, 0, 36, [[0, pal.light], [0.5, pal.main], [1, pal.dark]]), 2.2);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  for (const vx of [18, 28, 62, 72]) g.fillRect(vx, 20, 6, 10);
  robotFace(g, 48, 23, 8);
  rr(g, 68, 3, 9, 14, 2);
  ink(g, '#4a4f59', 1.6);
  smokePuffs(g, 72.5, 4);
  g.beginPath();
  g.moveTo(33, 82);
  g.lineTo(33, 56);
  g.quadraticCurveTo(33, 46, 48, 46);
  g.quadraticCurveTo(63, 46, 63, 56);
  g.lineTo(63, 82);
  g.closePath();
  ink(g, '#0c0e11', 2);
  for (const ex of [42, 54]) {
    circ(g, ex, 62, 4.3);
    ink(g, '#ffe66b', 1.2);
    circ(g, ex + 0.8, 62.6, 1.8);
    g.fillStyle = OUT;
    g.fill();
  }
  g.fillStyle = '#e8ebf0';
  for (let x = 36; x < 62; x += 6) g.fillRect(x, 76, 4, 6);
  for (const wx of [21, 69]) {
    rr(g, wx, 48, 10, 10, 2);
    ink(g, '#ffe28a', 1.4);
  }
  hazard(g, 14, 80, 68, 4);
}

function drawVehicle(g: Ctx, pal: Pal) {
  g.fillStyle = 'rgba(0,0,0,0.28)';
  rr(g, 18, 24, 84, 78, 8);
  g.fill();
  rr(g, 14, 20, 84, 76, 8);
  ink(g, lin(g, 0, 20, 0, 96, [[0, '#5e6572'], [1, '#383d48']]), 2.2);
  rr(g, 10, 12, 92, 26, 8);
  ink(g, lin(g, 0, 12, 0, 38, [[0, pal.light], [0.5, pal.main], [1, pal.dark]]), 2.2);
  // gear emblem
  g.save();
  g.translate(56, 25);
  for (let i = 0; i < 8; i++) {
    g.rotate(Math.PI / 4);
    g.fillStyle = '#2b2e35';
    g.fillRect(-2.5, -11, 5, 5);
  }
  g.restore();
  circ(g, 56, 25, 8);
  ink(g, '#dfe3ea', 1.6);
  circ(g, 56, 25, 3);
  ink(g, '#2b2e35', 1.2);
  for (const px of [22, 90]) {
    rr(g, px - 4, 3, 8, 14, 2);
    ink(g, '#4a4f59', 1.5);
    smokePuffs(g, px, 3);
  }
  rr(g, 26, 48, 60, 46, 4);
  ink(g, '#2d3038', 2);
  for (let y = 54; y < 92; y += 6) {
    g.fillStyle = y % 12 === 0 ? '#5b6270' : '#464c58';
    g.fillRect(28, y, 56, 4.5);
  }
  rr(g, 46, 41, 20, 9, 3);
  ink(g, '#ffe28a', 1.5);
  g.fillStyle = OUT;
  g.font = 'bold 7px monospace';
  g.textAlign = 'center';
  g.fillText('TANKS', 56, 48);
  hazard(g, 15, 92, 82, 4);
}

function drawHQ(g: Ctx, pal: Pal) {
  g.fillStyle = 'rgba(0,0,0,0.30)';
  rr(g, 22, 22, 98, 98, 12);
  g.fill();
  rr(g, 16, 16, 96, 96, 12);
  ink(g, lin(g, 0, 16, 0, 112, [[0, '#5c6370'], [1, '#343944']]), 2.4);
  rr(g, 22, 22, 84, 84, 8);
  ink(g, lin(g, 22, 22, 106, 106, [[0, pal.light], [0.5, pal.main], [1, pal.dark]]), 2);
  g.fillStyle = 'rgba(255,255,255,0.5)';
  for (const [x, y] of [[26, 26], [102, 26], [26, 102], [102, 102]]) {
    circ(g, x, y, 2.2);
    g.fill();
  }
  // big robot face
  rr(g, 36, 40, 56, 44, 12);
  ink(g, lin(g, 0, 40, 0, 84, [[0, '#f0f3f8'], [1, '#8d95a3']]), 2.2);
  for (const s of [-1, 1]) {
    circ(g, 64 + s * 12.5, 58, 7.5);
    ink(g, '#ffffff', 1.6);
    circ(g, 64 + s * 12.5 + s * 0.5, 59.5, 3.4);
    g.fillStyle = OUT;
    g.fill();
  }
  line(g, 44, 46, 60, 51, 2.6, OUT);
  line(g, 84, 46, 68, 51, 2.6, OUT);
  rr(g, 50, 71, 28, 8, 3);
  ink(g, '#1b1d22', 1.4);
  g.fillStyle = '#f2f4f8';
  for (let x = 53; x < 76; x += 5) g.fillRect(x, 72.5, 3, 5);
  // radar dish and antenna
  line(g, 98, 26, 98, 8, 2.4, OUT);
  circ(g, 98, 7, 3.2);
  ink(g, '#ff4d3d', 1.4);
  ell(g, 24, 20, 9, 5);
  ink(g, '#dfe3ea', 1.6);
  line(g, 24, 20, 24, 28, 2, OUT);
  hazard(g, 24, 104, 80, 4);
}

// ================================================================== TERRAIN

export function makeTerrainCanvas(map: MapDef, TS: number): HTMLCanvasElement {
  const [c, g] = mk(map.w * TS, map.h * TS);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= map.w || y >= map.h ? -1 : map.tiles[y * map.w + x]);
  const isWater = (x: number, y: number) => at(x, y) === T_WATER;
  const greens = ['#4b6e34', '#47692f', '#50753a', '#446330'];

  for (let y = 0; y < map.h; y++)
    for (let x = 0; x < map.w; x++) {
      const t = at(x, y);
      const px = x * TS;
      const py = y * TS;
      if (t === T_WATER || t === T_BRIDGE) {
        g.fillStyle = lin(g, px, py, px, py + TS, [[0, '#2a6a9a'], [1, '#1d5584']]);
        g.fillRect(px, py, TS, TS);
        g.strokeStyle = 'rgba(160,215,245,0.35)';
        g.lineWidth = 1.5;
        for (let k = 0; k < 2; k++) {
          const wx = px + hash(x, y, k + 1) * 14 + 2;
          const wy = py + 6 + k * 14 + hash(x, y, k + 5) * 6;
          g.beginPath();
          g.moveTo(wx, wy);
          g.quadraticCurveTo(wx + 5, wy - 3, wx + 10, wy);
          g.quadraticCurveTo(wx + 15, wy + 3, wx + 20, wy);
          g.stroke();
        }
      } else {
        g.fillStyle = greens[Math.floor(hash(x, y) * 4)];
        g.fillRect(px, py, TS, TS);
        // soft blotches
        for (let k = 0; k < 2; k++) {
          const bx = px + hash(x, y, k + 11) * TS;
          const by = py + hash(x, y, k + 13) * TS;
          const rg = g.createRadialGradient(bx, by, 1, bx, by, 14);
          const dark = hash(x, y, k + 17) > 0.5;
          rg.addColorStop(0, dark ? 'rgba(20,45,20,0.22)' : 'rgba(150,200,90,0.16)');
          rg.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = rg;
          g.fillRect(px - 8, py - 8, TS + 16, TS + 16);
        }
      }
    }

  // grass details, shore, bridges, boulders
  for (let y = 0; y < map.h; y++)
    for (let x = 0; x < map.w; x++) {
      const t = at(x, y);
      const px = x * TS;
      const py = y * TS;
      if (t !== T_WATER && t !== T_BRIDGE) {
        for (let k = 0; k < 3; k++) {
          if (hash(x, y, k + 20) > 0.2) continue; // sparse tufts: the field should read as calm ground, not texture noise
          const tx = px + 4 + hash(x, y, k + 23) * (TS - 8);
          const ty = py + 8 + hash(x, y, k + 29) * (TS - 10);
          g.strokeStyle = hash(x, y, k + 31) > 0.5 ? '#3f5f30' : '#628c46';
          g.lineWidth = 1.6;
          g.beginPath();
          g.moveTo(tx, ty);
          g.lineTo(tx - 2, ty - 5);
          g.moveTo(tx, ty);
          g.lineTo(tx + 0.5, ty - 6);
          g.moveTo(tx, ty);
          g.lineTo(tx + 2.5, ty - 4);
          g.stroke();
        }
        if (hash(x, y, 40) > 0.985) {
          const fx = px + 6 + hash(x, y, 41) * (TS - 12);
          const fy = py + 6 + hash(x, y, 42) * (TS - 12);
          g.fillStyle = ['#ffffff', '#ffd84d', '#ff9ac8'][Math.floor(hash(x, y, 43) * 3)];
          circ(g, fx, fy, 1.8);
          g.fill();
        }
        // sandy bank where land meets water
        g.fillStyle = 'rgba(196,172,112,0.9)';
        if (isWater(x - 1, y)) g.fillRect(px, py, 4, TS);
        if (isWater(x + 1, y)) g.fillRect(px + TS - 4, py, 4, TS);
      }
      if (t === T_WATER) {
        g.fillStyle = 'rgba(235,248,255,0.55)';
        const land = (xx: number, yy: number) => at(xx, yy) !== T_WATER && at(xx, yy) !== T_BRIDGE && at(xx, yy) !== -1;
        if (land(x - 1, y)) g.fillRect(px, py, 3, TS);
        if (land(x + 1, y)) g.fillRect(px + TS - 3, py, 3, TS);
      }
      if (t === T_BRIDGE) {
        g.fillStyle = lin(g, px, py, px, py + TS, [[0, '#9a8358'], [1, '#7c6840']]);
        g.fillRect(px, py, TS, TS);
        g.strokeStyle = 'rgba(40,28,12,0.65)';
        g.lineWidth = 1.5;
        for (let k = 8; k < TS; k += 8) {
          g.beginPath();
          g.moveTo(px + k, py);
          g.lineTo(px + k, py + TS);
          g.stroke();
        }
        for (const [edge, dy] of [[-1, 0], [1, TS - 5]] as const) {
          if (at(x, y + edge) === T_BRIDGE) continue;
          g.fillStyle = '#4b3a1f';
          g.fillRect(px, py + dy, TS, 5);
          g.fillStyle = '#c9a96a';
          g.fillRect(px, py + dy, TS, 1.5);
          g.fillStyle = '#2d2212';
          for (const postX of [2, TS - 6]) g.fillRect(px + postX, py + dy - 1, 4, 7);
        }
      }
      if (t === T_ROCK) {
        const cx = px + TS / 2;
        const cy = py + TS / 2 + 1;
        g.fillStyle = 'rgba(0,0,0,0.3)';
        ell(g, cx + 3, cy + 7, 15, 8);
        g.fill();
        g.beginPath();
        const n = 9;
        for (let i = 0; i < n; i++) {
          const ang = (i / n) * Math.PI * 2;
          const rad = 12.5 + hash(x, y, i + 50) * 4.5;
          const vx = cx + Math.cos(ang) * rad;
          const vy = cy + Math.sin(ang) * rad * 0.85;
          if (i === 0) g.moveTo(vx, vy);
          else g.lineTo(vx, vy);
        }
        g.closePath();
        ink(g, lin(g, cx - 14, cy - 14, cx + 14, cy + 14, [[0, '#a6a9b2'], [0.55, '#767983'], [1, '#4a4c55']]), 1.8);
        g.strokeStyle = 'rgba(30,31,36,0.6)';
        g.lineWidth = 1.4;
        g.beginPath();
        g.moveTo(cx - 3, cy - 6);
        g.lineTo(cx + 1, cy);
        g.lineTo(cx - 2, cy + 6);
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.35)';
        ell(g, cx - 5, cy - 6, 4, 2);
        g.fill();
      }
    }
  return c;
}

// ================================================================== REGISTRATION

export function ensureSprites(scene: Phaser.Scene) {
  const tx = scene.textures;
  for (const team of ['0', '1']) {
    const pal = PAL[team];
    if (!tx.exists('rifle' + team)) {
      const [c, g] = mk(512, 512);
      for (let d = 0; d < 8; d++)
        for (let h = 0; h < 2; h++)
          for (let f = 0; f < 4; f++) {
            g.save();
            g.translate(d * 64, (h * 4 + f) * 64);
            drawRifle(g, pal, d, f, h === 1);
            g.restore();
          }
      const t = tx.addCanvas('rifle' + team, c)!;
      for (let d = 0; d < 8; d++)
        for (let h = 0; h < 2; h++)
          for (let f = 0; f < 4; f++) t.add(`${d}_${f}_${h}`, 0, d * 64, (h * 4 + f) * 64, 64, 64);
    }
    if (!tx.exists('hull' + team)) {
      const [c, g] = mk(128, 64);
      for (let p = 0; p < 2; p++) {
        g.save();
        g.translate(p * 64, 0);
        drawHull(g, pal, p);
        g.restore();
      }
      const t = tx.addCanvas('hull' + team, c)!;
      t.add('0', 0, 0, 0, 64, 64);
      t.add('1', 0, 64, 0, 64, 64);
    }
    if (!tx.exists('turret' + team)) {
      const [c, g] = mk(64, 64);
      drawTurret(g, pal);
      tx.addCanvas('turret' + team, c);
    }
  }
  const sizes = { barracks: 96, vehicle: 112, hq: 128 } as const;
  const painters = { barracks: drawBarracks, vehicle: drawVehicle, hq: drawHQ } as const;
  for (const kind of ['barracks', 'vehicle', 'hq'] as const)
    for (const team of ['0', '1', 'n']) {
      const key = `bld_${kind}_${team}`;
      if (tx.exists(key)) continue;
      const [c, g] = mk(sizes[kind], sizes[kind]);
      painters[kind](g, PAL[team]);
      tx.addCanvas(key, c);
    }
}

export const rifleKey = (owner: number) => 'rifle' + (owner === 0 ? '0' : '1');
export const buildingKey = (kind: string, owner: number) => `bld_${kind}_${owner === 0 ? '0' : owner === 1 ? '1' : 'n'}`;

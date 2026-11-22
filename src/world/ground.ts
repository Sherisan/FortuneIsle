import { Container, Graphics } from 'pixi.js';
import type { ZoneKey } from '../api/types.ts';
import { idx, inside, isWaterGround, N, TH, TW, toScreen, type Cell, type Ground, type WorldMap } from './map.ts';

/*
 * The ground: water, then a foam rim, then the island's cliff faces and land tiles. Drawn once into 8 × 8-tile chunks
 * (one Graphics each, cullable so off-screen chunks cost nothing). The fog layer greys out locked zones.
 */

const HW = TW / 2, HH = TH / 2;
const CHUNK = 8;
const FACE = 16;

const COLORS: Record<Ground, [number, number]> = {
  deep: [0x1b8cc2, 0x1986bb],
  water: [0x26a9d3, 0x23a2cc],
  shallow: [0x45cbdc, 0x41c4d6],
  sand: [0xf8db96, 0xf2d289],
  grass: [0x88d862, 0x7ed05a],
  meadow: [0xa3e06c, 0x97d862],
  planks: [0xd19a5c, 0xc58e52],
  plaza: [0x9468d8, 0x8659cc],
  cobble: [0xf8cdd9, 0xf1c0ce],
  jungle: [0x4caa51, 0x43a049],
  ruin: [0xcac3a5, 0xbdb698],
  rock: [0x7b6868, 0x705e5e],
  basalt: [0x4b3f40, 0x433839],
  void: [0x1a0f24, 0x1a0f24],
  carpet: [0x9a2245, 0x92203f],
  marble: [0xf3ede6, 0xe3d8cc],
  stage: [0xf2c14e, 0xe8b640],
  coral: [0xffd1c4, 0xf9c3b5],
  snow: [0xf4f8ff, 0xe8f0fb],
  ice: [0xc4ecfb, 0xb4e2f5],
  icy: [0x8fd4e8, 0x86cde2],
  polar: [0x2b6f94, 0x28688c],
  skygrass: [0xa8ec8a, 0x9ce27e],
  gold: [0xffe27a, 0xf6d564],
  rainbow: [0xffffff, 0xffffff],
};

/** The rainbow bridges' bands, by the tile's position across the bridge. */
const RAINBOW = [0xff5b6e, 0xff9d3d, 0xffe066, 0x5fd38a, 0x4fc3ff, 0xb07cff];

const FACE_COLOR: Partial<Record<Ground, [number, number]>> = {
  sand: [0xe0b46e, 0xb98a4e],
  rock: [0x544343, 0x3e3131],
  basalt: [0x3a2f30, 0x2b2223],
  carpet: [0x5a1028, 0x3d0a1b],
  marble: [0xcfc4b6, 0xa89c8d],
  stage: [0xc99a2e, 0x9a7420],
  plaza: [0x5a35a0, 0x3b2066],
  planks: [0x9a6534, 0x7a4f28],
  snow: [0xc6d6ec, 0x9fb4d1],
  ice: [0x8cc9e6, 0x5fa3c8],
  coral: [0xe8a493, 0xc7806e],
  // The Sky Kingdom's islands float: their sides are earth and rock.
  skygrass: [0x9a7458, 0x75553e],
  gold: [0xc99a2e, 0x9a7420],
  rainbow: [0xd8c8f0, 0xb7a3dc],
};

const diamond = (x: number, y: number, s = 1) => [x, y - HH * s, x + HW * s, y, x, y + HH * s, x - HW * s, y];

function detail(g: Graphics, c: Cell, x: number, y: number) {
  const r = c.r;
  switch (c.ground) {
    case 'grass':
    case 'meadow':
    case 'jungle': {
      if (r < 0.45) {
        const col = c.ground === 'jungle' ? 0x2f8a3e : 0x5fb545;
        for (let k = 0; k < 3; k++) {
          const tx = x + (((r * 97 + k * 31) % 1) - 0.5) * HW * 1.1, ty = y + (((r * 53 + k * 17) % 1) - 0.5) * HH * 0.9;
          g.moveTo(tx - 4, ty).lineTo(tx - 1, ty - 7).lineTo(tx + 1, ty).lineTo(tx + 4, ty - 6).stroke({ width: 2, color: col, cap: 'round', join: 'round' });
        }
      }
      if (c.ground === 'meadow' && r > 0.85) g.circle(x + 10, y - 2, 3).fill(0xffffff).circle(x - 12, y + 4, 2.5).fill(0xffd23f);
      break;
    }
    case 'sand':
      if (r < 0.5) for (let k = 0; k < 3; k++) g.circle(x + ((r * 71 + k * 0.37) % 1 - 0.5) * HW, y + ((r * 37 + k * 0.29) % 1 - 0.5) * HH, 1.6).fill({ color: 0xc99a55, alpha: 0.6 });
      break;
    case 'planks':
      for (let k = -1; k <= 1; k++) {
        const o = k / 3;
        g.moveTo(x - HW * (0.5 - o * 0.5) + o * 0, y - HH * (0.5 + o * 0.5) + HH * 0).lineTo(x + HW * (0.5 + o * 0.5), y + HH * (0.5 - o * 0.5)).stroke({ width: 1.5, color: 0x8f5c30, alpha: 0.55 });
      }
      break;
    case 'plaza':
      if ((c.gx + c.gy) % 2 === 0) g.poly(diamond(x, y, 0.42)).fill({ color: 0xf2c14e, alpha: 0.85 });
      break;
    case 'cobble':
      for (const [dx, dy] of [[-0.45, 0], [0.45, 0], [0, -0.45], [0, 0.45], [0, 0]]) g.ellipse(x + dx * HW, y + dy * HH, 9, 4.5).fill({ color: 0xffffff, alpha: 0.35 });
      break;
    case 'ruin':
      if (r < 0.35) g.moveTo(x - 14, y - 3).lineTo(x - 2, y + 2).lineTo(x + 6, y - 4).stroke({ width: 1.5, color: 0x8a8266, alpha: 0.7 });
      if (r > 0.8) g.circle(x + 8, y + 3, 4).fill(0x4caa51);
      break;
    case 'rock':
      if (r < 0.4) g.ellipse(x + (r - 0.2) * 40, y + 2, 5, 2.5).fill({ color: 0x5b4a4a, alpha: 0.8 });
      break;
    case 'carpet':
      // Gold diamond motif on alternate tiles, a dot on the rest.
      if ((c.gx + c.gy) % 2 === 0) {
        g.poly(diamond(x, y, 0.36)).stroke({ width: 2, color: 0xf2c14e, alpha: 0.7 });
        g.poly(diamond(x, y, 0.12)).fill({ color: 0xf2c14e, alpha: 0.8 });
      } else g.circle(x, y, 2.5).fill({ color: 0xf2c14e, alpha: 0.45 });
      break;
    case 'marble':
      if (r < 0.3) g.moveTo(x - 20, y - 4).quadraticCurveTo(x, y + 6, x + 18, y - 2).stroke({ width: 1.2, color: 0xb9ab9a, alpha: 0.6 });
      g.poly(diamond(x, y, 1)).stroke({ width: 1, color: 0xc9bba8, alpha: 0.5 });
      break;
    case 'stage':
      g.star(x, y, 5, 18, 8).fill({ color: 0xfff3b0, alpha: 0.9 });
      break;
    case 'basalt':
      if (r < 0.25) g.moveTo(x - 16, y).lineTo(x - 4, y + 4).lineTo(x + 10, y - 2).stroke({ width: 2, color: 0xff6a2a, alpha: 0.75 });
      break;
    case 'snow':
      if (r < 0.35) g.ellipse(x + (r - 0.17) * 50, y + 2, 7, 2.5).fill({ color: 0xd6e4f5, alpha: 0.9 });
      if (r > 0.9) g.circle(x - 10, y - 2, 1.6).fill({ color: 0xffffff, alpha: 0.9 }).circle(x + 12, y + 3, 1.2).fill({ color: 0xffffff, alpha: 0.9 });
      break;
    case 'ice':
      // Cracks and a glint.
      if (r < 0.4) g.moveTo(x - 18, y - 2).lineTo(x - 6, y + 3).lineTo(x + 2, y - 3).lineTo(x + 14, y + 2).stroke({ width: 1.3, color: 0xffffff, alpha: 0.8 });
      if (r > 0.75) g.ellipse(x + 8, y - 3, 8, 2).fill({ color: 0xffffff, alpha: 0.55 });
      break;
    case 'skygrass':
      if (r < 0.4) {
        for (let k = 0; k < 3; k++) {
          const tx = x + (((r * 97 + k * 31) % 1) - 0.5) * HW * 1.1, ty = y + (((r * 53 + k * 17) % 1) - 0.5) * HH * 0.9;
          g.moveTo(tx - 4, ty).lineTo(tx - 1, ty - 7).lineTo(tx + 1, ty).lineTo(tx + 4, ty - 6).stroke({ width: 2, color: 0x6fcf5a, cap: 'round', join: 'round' });
        }
      }
      if (r > 0.88) g.circle(x + 9, y - 1, 3).fill(0xffffff).circle(x + 9, y - 1, 1.2).fill(0xffb3d9);
      break;
    case 'gold':
      if ((c.gx + c.gy) % 2 === 0) g.poly(diamond(x, y, 0.4)).fill({ color: 0xfff3b0, alpha: 0.75 });
      else g.star(x, y, 4, 6, 2.5).fill({ color: 0xffffff, alpha: 0.6 });
      break;
    case 'rainbow': {
      // Six bands across the tile, coloured by where the tile sits across the bridge, so neighbours line up.
      const k = ((c.gx - c.gy) % RAINBOW.length + RAINBOW.length) % RAINBOW.length;
      for (let i = 0; i < 2; i++) g.poly(diamond(x + (i - 0.5) * HW * 0.5, y + (0.5 - i) * HH * 0.5, 0.52)).fill(RAINBOW[(k * 2 + i) % RAINBOW.length]);
      g.poly(diamond(x, y, 1)).stroke({ width: 1.5, color: 0xffffff, alpha: 0.6 });
      break;
    }
    case 'coral':
      if (r < 0.3) g.circle(x + (r - 0.15) * 60, y + 2, 2).fill({ color: 0xff7a8a, alpha: 0.7 });
      break;
    default:
      break;
  }
}

export interface GroundLayers {
  water: Container;
  foam: Container;
  land: Container;
  fog: Graphics;
  redrawFog(open: Set<ZoneKey>): void;
}

export function buildGround(map: WorldMap): GroundLayers {
  const water = new Container(), foam = new Container(), land = new Container();
  const at = (gx: number, gy: number) => (inside(gx, gy) ? map.cells[idx(gx, gy)] : undefined);
  // Faces wherever the floor ends; foam only where it meets the sea (not the void around the casino's room).
  const isWater = (gx: number, gy: number) => !at(gx, gy)?.land;
  const isSea = (gx: number, gy: number) => { const c = at(gx, gy); return !c || (!c.land && isWaterGround(c.ground)); };

  // The Sky Kingdom's islands float, so their sides hang deep.
  const face = map.kind === 'sky' ? 54 : FACE;
  for (let cy = 0; cy < N; cy += CHUNK)
    for (let cx = 0; cx < N; cx += CHUNK) {
      const wg = new Graphics(), fg = new Graphics(), lg = new Graphics();
      for (const g of [wg, fg, lg]) g.cullable = true;
      for (let gy = cy; gy < cy + CHUNK; gy++)
        for (let gx = cx; gx < cx + CHUNK; gx++) {
          const c = map.cells[idx(gx, gy)];
          const { x, y } = toScreen(gx, gy);
          if (!c.land) {
            if (c.ground === 'void') continue;
            const [a, b] = COLORS[c.ground];
            wg.poly(diamond(x, y, 1.02)).fill(c.r > 0.5 ? a : b);
            if (c.ground === 'shallow') wg.poly(diamond(x, y, 0.6)).fill({ color: 0xffffff, alpha: 0.06 });
            continue;
          }
          // Foam rim around the coast.
          if (isSea(gx + 1, gy) || isSea(gx - 1, gy) || isSea(gx, gy + 1) || isSea(gx, gy - 1)) {
            fg.poly(diamond(x, y + 6, 1.28)).fill({ color: 0xffffff, alpha: 0.85 });
          }
        }
      // Cliff faces first, then tops, so faces never cover land.
      for (let gy = cy; gy < cy + CHUNK; gy++)
        for (let gx = cx; gx < cx + CHUNK; gx++) {
          const c = map.cells[idx(gx, gy)];
          if (!c.land) continue;
          const { x, y } = toScreen(gx, gy);
          const [f1, f2] = FACE_COLOR[c.ground] ?? [0xb98a4e, 0x8f6436];
          // Bridges and piers out over the sea or sky are thin decks, not cliffs.
          const isle = map.kind === 'lagoon' || map.kind === 'frost' || map.kind === 'sky';
          const deck = isle && c.path && (c.ground === 'planks' || c.ground === 'rainbow' || (c.ground === 'gold' && map.kind === 'sky'));
          const h = deck ? (map.kind === 'sky' && c.ground !== 'rainbow' ? 14 : 8) : face;
          if (isWater(gx + 1, gy)) {
            lg.poly([x + HW, y, x, y + HH, x, y + HH + h, x + HW, y + h]).fill(f1);
            lg.poly([x + HW, y + h * 0.55, x, y + HH + h * 0.55, x, y + HH + h, x + HW, y + h]).fill(f2);
          }
          if (isWater(gx, gy + 1)) {
            lg.poly([x - HW, y, x, y + HH, x, y + HH + h, x - HW, y + h]).fill(f2);
            lg.poly([x - HW, y + h * 0.55, x, y + HH + h * 0.55, x, y + HH + h, x - HW, y + h]).fill({ color: 0x000000, alpha: 0.18 });
          }
        }
      for (let gy = cy; gy < cy + CHUNK; gy++)
        for (let gx = cx; gx < cx + CHUNK; gx++) {
          const c = map.cells[idx(gx, gy)];
          if (!c.land) continue;
          const { x, y } = toScreen(gx, gy);
          const [a, b] = COLORS[c.ground];
          const checker = c.ground === 'plaza' || c.ground === 'cobble' || c.ground === 'planks' || c.ground === 'marble' || c.ground === 'gold' ? (gx + gy) % 2 === 0 : c.r > 0.5;
          lg.poly(diamond(x, y, 1.015)).fill(checker ? a : b);
          if (c.path && c.ground !== 'plaza') lg.poly(diamond(x, y, 1)).stroke({ width: 1, color: 0x000000, alpha: 0.07 });
          detail(lg, c, x, y);
        }
      water.addChild(wg);
      foam.addChild(fg);
      land.addChild(lg);
    }

  const fog = new Graphics();
  const redrawFog = (open: Set<ZoneKey>) => {
    fog.clear();
    for (const c of map.cells) {
      if (!c.land || !c.zone || open.has(c.zone)) continue;
      const { x, y } = toScreen(c.gx, c.gy);
      fog.poly(diamond(x, y, 1.03)).fill({ color: 0x3a2a5c, alpha: 0.38 });
    }
  };
  return { water, foam, land, fog, redrawFog };
}

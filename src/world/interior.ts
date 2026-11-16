import type { ZoneKey } from '../api/types.ts';
import { idx, N, toScreen, type Cell, type Ground, type Prop, type SceneKey, type Spot, type WorldMap } from './map.ts';

/*
 * The rooms you walk into. Each is a rectangle on the same 48 × 48 grid as the island (everything outside it is 'void'
 * and isn't drawn). The back walls run along the room's top-left and top-right edges (casinoArt's buildWalls); the front
 * edges are open so you can see in. Doorways are spots: 'exit' on the front edge leads back out, and 'enter' spots lead
 * further in (the casino's stairs up to the VIP Salon).
 *
 *   Grand Casino (casino)  the bar, two roulette tables, Island Reels slots under the big screen, Dragon Tiger at the
 *                          card tables, the table-games board, and the stairs up to the VIP Salon behind velvet ropes.
 *   VIP Salon (vip)        upstairs, level 5: a gold roulette table, Dragon Tiger, two golden reels, a piano, a champagne
 *                          tower and a window over the island at night. Same games and odds as downstairs.
 *   Rusty Anchor (tavern)  the Harbour's pirate tavern: two Pirate Dice tables, the bar, a hearth, barrels and a notice
 *                          board.
 */

export type InteriorKind = Exclude<SceneKey, 'island'>;

export const ROOMS: Record<InteriorKind, { x0: number; y0: number; x1: number; y1: number }> = {
  casino: { x0: 14, y0: 14, x1: 33, y1: 33 },
  vip: { x0: 16, y0: 16, x1: 31, y1: 31 },
  tavern: { x0: 16, y0: 16, x1: 29, y1: 29 },
};

function room(kind: InteriorKind, zone: ZoneKey, floor: Ground, seed: number) {
  const cells: Cell[] = [];
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const { x0, y0, x1, y1 } = ROOMS[kind];
  const inRoom = (gx: number, gy: number) => gx >= x0 && gx <= x1 && gy >= y0 && gy <= y1;
  for (let gy = 0; gy < N; gy++)
    for (let gx = 0; gx < N; gx++) {
      const r = inRoom(gx, gy);
      cells.push({ gx, gy, land: r, zone: r ? zone : null, ground: r ? floor : 'void', path: false, blocked: false, shore: 0, r: rnd() });
    }
  const at = (gx: number, gy: number) => cells[idx(gx, gy)];
  const props: Prop[] = [];
  const spots: Spot[] = [];
  return {
    at,
    ground: (gx: number, gy: number, g: Ground) => (at(gx, gy).ground = g),
    fill: (ax: number, ay: number, bx: number, by: number, g: Ground) => {
      for (let gy = ay; gy <= by; gy++) for (let gx = ax; gx <= bx; gx++) at(gx, gy).ground = g;
    },
    prop: (kind: string, gx: number, gy: number, solid = true) => {
      props.push({ kind, gx, gy, zone, seed: rnd() });
      if (solid) at(gx, gy).blocked = true;
    },
    spot: (s: Omit<Spot, 'zone'> & { zone?: ZoneKey }) => {
      at(s.gx, s.gy).blocked = true;
      spots.push({ zone, ...s });
    },
    finish: (spawn: { gx: number; gy: number }): WorldMap => {
      // Camera bounds: the room's diamond plus head room for the walls.
      const pts = [toScreen(x0, y0), toScreen(x1, y0), toScreen(x0, y1), toScreen(x1, y1)];
      const bounds = {
        minX: Math.min(...pts.map((p) => p.x)) - 120,
        maxX: Math.max(...pts.map((p) => p.x)) + 120,
        minY: Math.min(...pts.map((p) => p.y)) - 260,
        maxY: Math.max(...pts.map((p) => p.y)) + 120,
      };
      return { kind, bounds, cells, spots, props, gates: [], spawn, centers: {} };
    },
  };
}

export function buildInterior(kind: InteriorKind): WorldMap {
  if (kind === 'vip') return buildVip();
  if (kind === 'tavern') return buildTavern();
  return buildCasino();
}

function buildCasino(): WorldMap {
  const r = room('casino', 'casino', 'carpet', 7);
  const { x0, y0, x1, y1 } = ROOMS.casino;

  // Marble runner and rotunda, gold stage under the chandelier, the VIP corner's purple carpet (VIP zone: locked
  // players see it fogged and can't walk in).
  r.fill(23, 27, 25, 32, 'marble');
  for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) if (Math.hypot(gx - 24, gy - 23) <= 3.2) r.ground(gx, gy, 'marble');
  r.ground(24, 23, 'stage');
  for (let gy = y0; gy <= 18; gy++)
    for (let gx = 29; gx <= x1; gx++) {
      r.ground(gx, gy, 'plaza');
      r.at(gx, gy).zone = 'vip';
    }

  // Slot machines under the big screen: the outer three are decor, two are Island Reels.
  for (const gx of [17, 21, 25]) r.prop('slot', gx, 15);
  r.spot({ id: 'island-reels', kind: 'game', game: 'island-reels', label: 'Island Reels', gx: 19, gy: 15, ax: 19, ay: 16 });
  r.spot({ id: 'island-reels-2', kind: 'game', game: 'island-reels', label: 'Island Reels', gx: 23, gy: 15, ax: 23, ay: 16 });
  // The bar: counter, stools, bartender.
  for (let gy = 18; gy <= 23; gy++) r.prop('bar', 16, gy);
  for (const gy of [18, 20, 22]) r.prop('stool', 17, gy);
  r.prop('bartender', 15, 20);
  // Velvet ropes along the entrance runner.
  for (const gx of [22, 26]) {
    for (const gy of [28, 29, 30]) r.prop('rope-y', gx, gy);
    r.prop('stanchion', gx, 31);
  }
  // The VIP corner: ropes with a gap at gx 31 leading to the stairs up.
  for (const gx of [28, 29]) r.prop('rope-x', gx, 19);
  r.prop('stanchion', 30, 19);
  r.prop('rope-x', 32, 19);
  r.prop('stanchion', 33, 19);
  for (let gy = 15; gy <= 18; gy++) r.prop('rope-y', 28, gy);
  r.prop('sofa', 29, 17);
  r.prop('viptable', 30, 15);
  r.prop('sofa', 33, 17);
  r.spot({ id: 'vip-stairs', kind: 'enter', to: 'vip', zone: 'vip', label: 'VIP Salon', gx: 31, gy: 15, ax: 31, ay: 16 });
  // Dragon Tiger at the card tables, columns, palms, chandeliers.
  r.spot({ id: 'dragon-tiger', kind: 'game', game: 'dragon-tiger', label: 'Dragon Tiger', gx: 29, gy: 25, ax: 28, ay: 25 });
  r.spot({ id: 'dragon-tiger-2', kind: 'game', game: 'dragon-tiger', label: 'Dragon Tiger', gx: 29, gy: 29, ax: 28, ay: 29 });
  for (const [gx, gy] of [[20, 18], [28, 22], [20, 30], [27, 31]]) r.prop('column', gx, gy);
  for (const [gx, gy] of [[15, 15], [15, 33], [33, 33], [15, 26]]) r.prop('potpalm', gx, gy);
  for (const [gx, gy] of [[24, 23], [19, 24], [30, 27]]) r.prop('chandelier', gx, gy, false);

  r.spot({ id: 'roulette', kind: 'game', game: 'roulette', label: 'Roulette', gx: 19, gy: 21, ax: 20, ay: 21 });
  r.spot({ id: 'roulette-2', kind: 'game', game: 'roulette', label: 'Roulette', gx: 19, gy: 27, ax: 20, ay: 27 });
  r.spot({ id: 'tables-board', kind: 'board', label: 'Table games', gx: 31, gy: 22, ax: 30, ay: 22 });
  r.spot({ id: 'casino-exit', kind: 'exit', to: 'island', label: 'Exit to the island', gx: 24, gy: 33, ax: 24, ay: 32 });
  return r.finish({ gx: 24, gy: 30 });
}

function buildVip(): WorldMap {
  const r = room('vip', 'vip', 'marble', 11);
  // A purple-and-gold rug in the middle, a gold landing by the stairs down.
  r.fill(19, 19, 28, 27, 'plaza');
  r.fill(23, 29, 25, 31, 'stage');

  r.spot({ id: 'vip-roulette', kind: 'game', game: 'roulette', label: 'Roulette', gx: 19, gy: 21, ax: 20, ay: 21 });
  r.spot({ id: 'vip-dragon', kind: 'game', game: 'dragon-tiger', label: 'Dragon Tiger', gx: 28, gy: 22, ax: 27, ay: 22 });
  r.spot({ id: 'vip-reels', kind: 'game', game: 'island-reels', label: 'Golden Reels', gx: 21, gy: 17, ax: 21, ay: 18 });
  r.spot({ id: 'vip-reels-2', kind: 'game', game: 'island-reels', label: 'Golden Reels', gx: 25, gy: 17, ax: 25, ay: 18 });
  r.prop('piano', 19, 27);
  r.prop('champagne', 28, 27);
  r.prop('sofa', 30, 18);
  r.prop('viptable', 30, 20);
  r.prop('sofa', 17, 24);
  for (const [gx, gy] of [[18, 18], [29, 29], [18, 30]]) r.prop('column', gx, gy);
  for (const [gx, gy] of [[16, 16], [31, 16], [16, 31], [31, 31]]) r.prop('potpalm', gx, gy);
  for (const gx of [22, 26]) {
    for (const gy of [29, 30]) r.prop('rope-y', gx, gy);
    r.prop('stanchion', gx, 31);
  }
  for (const [gx, gy] of [[24, 23], [20, 21], [27, 26]]) r.prop('chandelier', gx, gy, false);
  r.spot({ id: 'vip-exit', kind: 'exit', to: 'casino', label: 'Down to the casino', gx: 24, gy: 31, ax: 24, ay: 30 });
  return r.finish({ gx: 24, gy: 29 });
}

function buildTavern(): WorldMap {
  const r = room('tavern', 'harbour', 'planks', 23);
  // A red rug between the dice tables, a hearthstone apron.
  r.fill(20, 21, 26, 25, 'carpet');
  r.fill(24, 17, 26, 17, 'marble');

  // The bar along the back-left wall, the landlord behind it (rum shelves are on the wall).
  for (let gy = 19; gy <= 23; gy++) r.prop('bar', 17, gy);
  for (const gy of [19, 21, 23]) r.prop('woodstool', 18, gy);
  r.prop('pirate', 16, 21);
  // Barrels in the corners, the hearth on the back-right wall.
  for (const [gx, gy] of [[16, 16], [17, 16], [16, 17], [16, 27], [16, 28], [29, 28]]) r.prop('barrel', gx, gy);
  r.prop('hearth', 25, 16);
  r.prop('perch', 29, 24);
  r.prop('chestdecor', 28, 16);
  // Pirate Dice tables, a spare table with stools, lanterns.
  r.spot({ id: 'pirate-dice', kind: 'game', game: 'pirate-dice', label: 'Pirate Dice', gx: 21, gy: 22, ax: 21, ay: 23 });
  r.spot({ id: 'pirate-dice-2', kind: 'game', game: 'pirate-dice', label: 'Pirate Dice', gx: 25, gy: 21, ax: 25, ay: 22 });
  r.prop('woodtable', 26, 26);
  for (const [gx, gy] of [[27, 26], [26, 27]]) r.prop('woodstool', gx, gy);
  for (const [gx, gy] of [[21, 22], [25, 21], [23, 26]]) r.prop('lantern', gx, gy, false);
  r.spot({ id: 'tavern-board', kind: 'board', label: 'Notice Board', gx: 29, gy: 20, ax: 28, ay: 20 });
  r.spot({ id: 'tavern-exit', kind: 'exit', to: 'island', label: 'Back to the Harbour', gx: 23, gy: 29, ax: 23, ay: 28 });
  return r.finish({ gx: 23, gy: 27 });
}

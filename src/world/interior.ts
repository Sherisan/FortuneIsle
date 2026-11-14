import { idx, N, toScreen, type Cell, type Ground, type Prop, type Spot, type WorldMap } from './map.ts';

/*
 * The Grand Casino's interior: a 20 × 20 hall on the same 48 × 48 grid as the island (everything outside the room is
 * 'void' and isn't drawn). The back walls run along the room's top-left and top-right edges (drawn by casinoArt's
 * buildWalls); the front edges are open so you can see in.
 *
 *   Entrance runner (marble) from the exit arch up to a marble rotunda under the big chandelier.
 *   Left:  the bar along the back-left wall, two roulette tables (both open Roulette).
 *   Right: card tables, the table-games board, and the roped-off VIP lounge in the back corner.
 *   Back:  a row of (decorative) slot machines under the big screen.
 */

export const ROOM = { x0: 14, y0: 14, x1: 33, y1: 33 };
export const EXIT: [number, number] = [24, 33];

export function buildCasinoInterior(): WorldMap {
  const cells: Cell[] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const { x0, y0, x1, y1 } = ROOM;
  const inRoom = (gx: number, gy: number) => gx >= x0 && gx <= x1 && gy >= y0 && gy <= y1;

  for (let gy = 0; gy < N; gy++)
    for (let gx = 0; gx < N; gx++) {
      const room = inRoom(gx, gy);
      cells.push({ gx, gy, land: room, zone: room ? 'casino' : null, ground: room ? 'carpet' : 'void', path: false, blocked: false, shore: 0, r: rnd() });
    }
  const at = (gx: number, gy: number) => cells[idx(gx, gy)];
  const ground = (gx: number, gy: number, g: Ground) => (at(gx, gy).ground = g);

  // Marble runner and rotunda, gold stage under the chandelier, purple VIP carpet.
  for (let gy = 27; gy <= 32; gy++) for (let gx = 23; gx <= 25; gx++) ground(gx, gy, 'marble');
  for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) if (Math.hypot(gx - 24, gy - 23) <= 3.2) ground(gx, gy, 'marble');
  ground(24, 23, 'stage');
  for (let gy = y0; gy <= 18; gy++) for (let gx = 29; gx <= x1; gx++) ground(gx, gy, 'plaza');

  const props: Prop[] = [];
  const prop = (kind: string, gx: number, gy: number, solid = true) => {
    props.push({ kind, gx, gy, zone: 'casino', seed: rnd() });
    if (solid) at(gx, gy).blocked = true;
  };

  // Slot machines under the big screen.
  for (const gx of [17, 19, 21, 23, 25]) prop('slot', gx, 15);
  // The bar: counter, stools, bartender.
  for (let gy = 18; gy <= 23; gy++) prop('bar', 16, gy);
  for (const gy of [18, 20, 22]) prop('stool', 17, gy);
  prop('bartender', 15, 20);
  // Velvet ropes along the entrance runner.
  for (const gx of [22, 26]) {
    for (const gy of [28, 29, 30]) prop('rope-y', gx, gy);
    prop('stanchion', gx, 31);
  }
  // VIP lounge, roped off in the back-right corner.
  for (let gx = 28; gx <= 32; gx++) prop('rope-x', gx, 19);
  prop('stanchion', 33, 19);
  for (let gy = 15; gy <= 18; gy++) prop('rope-y', 28, gy);
  prop('sofa', 31, 15);
  prop('sofa', 32, 17);
  prop('viptable', 30, 17);
  // Card tables, columns, palms, chandeliers.
  prop('cardtable', 29, 25);
  prop('cardtable', 29, 29);
  for (const [gx, gy] of [[20, 18], [28, 22], [20, 30], [27, 31]]) prop('column', gx, gy);
  for (const [gx, gy] of [[15, 15], [15, 33], [33, 33], [15, 26]]) prop('potpalm', gx, gy);
  for (const [gx, gy] of [[24, 23], [19, 24], [30, 27]]) prop('chandelier', gx, gy, false);

  const spot = (s: Omit<Spot, 'zone'>) => {
    at(s.gx, s.gy).blocked = true;
    spots.push({ ...s, zone: 'casino' });
  };
  const spots: Spot[] = [];
  spot({ id: 'roulette', kind: 'game', game: 'roulette', label: 'Roulette', gx: 19, gy: 21, ax: 20, ay: 21 });
  spot({ id: 'roulette-2', kind: 'game', game: 'roulette', label: 'Roulette', gx: 19, gy: 27, ax: 20, ay: 27 });
  spot({ id: 'tables-board', kind: 'board', label: 'Table games', gx: 31, gy: 22, ax: 30, ay: 22 });
  spot({ id: 'casino-exit', kind: 'exit', label: 'Exit to the island', gx: EXIT[0], gy: EXIT[1], ax: EXIT[0], ay: EXIT[1] - 1 });

  // Camera bounds: the room's diamond plus head room for the walls.
  const pts = [toScreen(x0, y0), toScreen(x1, y0), toScreen(x0, y1), toScreen(x1, y1)];
  const bounds = {
    minX: Math.min(...pts.map((p) => p.x)) - 120,
    maxX: Math.max(...pts.map((p) => p.x)) + 120,
    minY: Math.min(...pts.map((p) => p.y)) - 260,
    maxY: Math.max(...pts.map((p) => p.y)) + 120,
  };

  return {
    kind: 'casino',
    bounds,
    cells,
    spots,
    props,
    gates: [],
    spawn: { gx: 24, gy: 30 },
    centers: { casino: [24, 24], harbour: [24, 24], boardwalk: [24, 24], fairground: [24, 24], jungle: [24, 24], volcano: [24, 24] },
  };
}

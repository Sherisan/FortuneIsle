import type { GameKey, ZoneKey } from '../api/types.ts';

/*
 * FORTUNE ISLE's map: a 48 × 48 isometric grid, generated deterministically (same island every load).
 *   - Land is a union of discs (a main island plus a lobe per outer zone) with a ragged edge.
 *   - Each land tile belongs to its nearest zone centre. Paths join the zones in a ring and to the casino at the centre
 *     ("routes loop back to the casino"); each zone has a paved plaza.
 *   - Landmarks (lighthouse, ferris wheel, casino, temple, volcano) sit in the widest gap between a zone's paths; its
 *     stalls and signpost ring the plaza in the next widest gaps.
 * Stalls are data (SPOT_DEFS): adding a game is an entry here plus its overlay.
 */

export const N = 48;
export const TW = 96;
export const TH = 48;

export type Ground =
  | 'deep' | 'water' | 'shallow' | 'sand' | 'grass' | 'meadow' | 'planks' | 'plaza' | 'cobble' | 'jungle' | 'ruin' | 'rock' | 'basalt'
  // Indoors: 'void' is outside the room (not drawn); carpet, marble and the gold stage are floors.
  | 'void' | 'carpet' | 'marble' | 'stage';

/** Water tiles (the island's sea); 'void' is not water. */
export const isWaterGround = (g: Ground) => g === 'deep' || g === 'water' || g === 'shallow';

export interface Cell {
  gx: number;
  gy: number;
  ground: Ground;
  zone: ZoneKey | null;
  land: boolean;
  path: boolean;
  blocked: boolean;
  /** Water: steps from land (1 = touching). */
  shore: number;
  r: number;
}

/** enter / exit are doorways between maps: walking up to one triggers it. */
export type SpotKind = 'game' | 'travel' | 'daily' | 'wardrobe' | 'board' | 'cashier' | 'chest' | 'enter' | 'exit' | 'fun';

/** Landmarks you can play with (no money involved): the spot sits on the landmark, the player stands at (ax, ay). */
export const FUN_LABELS: Record<string, string> = {
  ferris: 'Ride the Ferris wheel',
  lighthouse: 'Light the lighthouse',
  volcano: 'Poke the volcano',
  temple: 'Touch the temple gem',
};

export type SceneKey = 'island' | 'casino';

export interface Spot {
  id: string;
  kind: SpotKind;
  game?: GameKey;
  zone: ZoneKey;
  gx: number;
  gy: number;
  label: string;
  /** The walkable tile the player stands on to use it. */
  ax: number;
  ay: number;
}

export interface Prop {
  kind: string;
  gx: number;
  gy: number;
  zone: ZoneKey | null;
  seed: number;
  /** Footprint radius in tiles (landmarks). */
  size?: number;
}

export interface Gate {
  gx: number;
  gy: number;
  zone: ZoneKey;
}

export interface WorldMap {
  kind: SceneKey;
  /** The playable area in screen coordinates, for the camera. */
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  cells: Cell[];
  spots: Spot[];
  props: Prop[];
  gates: Gate[];
  spawn: { gx: number; gy: number };
  centers: Record<ZoneKey, [number, number]>;
}

export const CENTERS: Record<ZoneKey, [number, number]> = {
  casino: [24, 24],
  harbour: [34, 34],
  boardwalk: [36, 23],
  fairground: [32, 12],
  jungle: [12, 33],
  volcano: [13, 14],
};

const DISCS: [number, number, number][] = [
  [24, 24, 17.5],
  [12, 12, 8],
  [11, 34, 8],
  [32, 11, 7.5],
  [35, 35, 7],
  [38, 23, 7],
  [22, 38, 6],
  [38, 12, 4.5],
];

const LINKS: [ZoneKey, ZoneKey, number][] = [
  ['casino', 'harbour', 0],
  ['casino', 'boardwalk', 0.8],
  ['casino', 'fairground', -0.8],
  ['casino', 'jungle', 0.8],
  ['casino', 'volcano', 0],
  ['harbour', 'boardwalk', 1.5],
  ['boardwalk', 'fairground', 1.5],
  ['harbour', 'jungle', -2.5],
  ['jungle', 'volcano', 2],
  ['volcano', 'fairground', -2],
];

const LANDMARKS: Partial<Record<ZoneKey, { kind: string; dist: number; size: number }>> = {
  harbour: { kind: 'lighthouse', dist: 7.5, size: 1.2 },
  fairground: { kind: 'ferris', dist: 5.2, size: 1.6 },
  casino: { kind: 'casino', dist: 5.4, size: 2.1 },
  jungle: { kind: 'temple', dist: 5.2, size: 1.9 },
  volcano: { kind: 'volcano', dist: 6.2, size: 3.1 },
};

/** Spots ringing each plaza, in placement order (the first gets the best gap). */
const SPOT_DEFS: Record<ZoneKey, { id: string; kind: SpotKind; game?: GameKey; label: string; front?: boolean }[]> = {
  harbour: [
    { id: 'daily', kind: 'daily', label: 'Daily Chest' },
    { id: 'wardrobe', kind: 'wardrobe', label: 'Wardrobe' },
    { id: 'board', kind: 'board', label: 'Notice Board' },
    { id: 'cashier', kind: 'cashier', label: 'Cashier' },
    { id: 'sign-harbour', kind: 'travel', label: 'Signpost' },
  ],
  boardwalk: [
    { id: 'coconut-shy', kind: 'game', game: 'coconut-shy', label: 'Coconut Shy' },
    { id: 'cup-shuffle', kind: 'game', game: 'cup-shuffle', label: 'Cup Shuffle' },
    { id: 'scratch-kiosk', kind: 'game', game: 'scratch-kiosk', label: 'Scratch Kiosk' },
    { id: 'sign-boardwalk', kind: 'travel', label: 'Signpost' },
  ],
  fairground: [
    { id: 'prize-wheel', kind: 'game', game: 'prize-wheel', label: 'Prize Wheel' },
    { id: 'duck-pond', kind: 'game', game: 'duck-pond', label: 'Duck Pond' },
    { id: 'high-striker', kind: 'game', game: 'high-striker', label: 'High Striker' },
    { id: 'sign-fairground', kind: 'travel', label: 'Signpost' },
  ],
  casino: [
    // The door: walking in opens the entrance overlay, then the casino's interior map (roulette is inside).
    { id: 'casino-door', kind: 'enter', label: 'Grand Casino', front: true },
    { id: 'sign-casino', kind: 'travel', label: 'Signpost' },
  ],
  jungle: [
    { id: 'temple-doors', kind: 'game', game: 'temple-doors', label: 'Temple Doors', front: true },
    { id: 'sign-jungle', kind: 'travel', label: 'Signpost' },
  ],
  volcano: [
    { id: 'lava-crash', kind: 'game', game: 'lava-crash', label: 'Lava Crash', front: true },
    { id: 'sign-volcano', kind: 'travel', label: 'Signpost' },
  ],
};

const PATH_GROUND: Record<ZoneKey, Ground> = {
  harbour: 'planks', boardwalk: 'planks', fairground: 'cobble', casino: 'plaza', jungle: 'ruin', volcano: 'basalt',
};
const LAND_GROUND: Record<ZoneKey, Ground> = {
  harbour: 'grass', boardwalk: 'sand', fairground: 'meadow', casino: 'grass', jungle: 'jungle', volcano: 'rock',
};

function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const idx = (gx: number, gy: number) => gy * N + gx;
export const inside = (gx: number, gy: number) => gx >= 0 && gy >= 0 && gx < N && gy < N;
export const toScreen = (gx: number, gy: number) => ({ x: (gx - gy) * (TW / 2), y: (gx + gy) * (TH / 2) });
export const toGrid = (x: number, y: number) => ({ gx: (x / (TW / 2) + y / (TH / 2)) / 2, gy: (y / (TH / 2) - x / (TW / 2)) / 2 });

const angDiff = (a: number, b: number) => {
  const d = Math.abs(a - b) % (Math.PI * 2);
  return d > Math.PI ? Math.PI * 2 - d : d;
};

export function buildMap(): WorldMap {
  const rnd = mulberry(20261114);
  const cells: Cell[] = [];
  const zones = Object.keys(CENTERS) as ZoneKey[];

  // Land and zones.
  for (let gy = 0; gy < N; gy++)
    for (let gx = 0; gx < N; gx++) {
      const wobble = Math.sin(gx * 0.9 + gy * 0.4) * 0.6 + Math.sin(gy * 1.3 - gx * 0.7) * 0.5;
      const land = DISCS.some(([cx, cy, r]) => Math.hypot(gx - cx, gy - cy) < r + wobble) && gx > 1 && gy > 1 && gx < N - 2 && gy < N - 2;
      let zone: ZoneKey | null = null;
      if (land) {
        let best = Infinity;
        for (const z of zones) {
          const [cx, cy] = CENTERS[z];
          const d = Math.hypot(gx - cx, gy - cy) * (z === 'casino' ? 1.35 : 1);
          if (d < best) { best = d; zone = z; }
        }
      }
      cells.push({ gx, gy, land, zone, ground: land ? LAND_GROUND[zone!] : 'deep', path: false, blocked: false, shore: 0, r: rnd() });
    }
  const at = (gx: number, gy: number) => (inside(gx, gy) ? cells[idx(gx, gy)] : undefined);

  // Beaches: land touching water (except the volcano's black rock).
  for (const c of cells) {
    if (!c.land) continue;
    let edge = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!at(c.gx + dx, c.gy + dy)?.land) edge = true;
    if (edge && c.zone !== 'volcano') c.ground = 'sand';
  }

  const pave = (gx: number, gy: number, zoneHint?: ZoneKey) => {
    const c = at(gx, gy);
    if (!c) return;
    if (!c.land) { c.land = true; c.zone = zoneHint ?? c.zone ?? 'harbour'; }
    c.path = true;
    c.ground = PATH_GROUND[c.zone!];
  };

  // Paths: gently curved, two tiles wide.
  const pathAngles: Record<ZoneKey, number[]> = { casino: [], harbour: [], boardwalk: [], fairground: [], jungle: [], volcano: [] };
  for (const [a, b, bend] of LINKS) {
    const [ax, ay] = CENTERS[a];
    const [bx, by] = CENTERS[b];
    const len = Math.hypot(bx - ax, by - ay);
    const nx = -(by - ay) / len, ny = (bx - ax) / len;
    for (let s = 0; s <= len * 3; s++) {
      const t = s / (len * 3);
      const bow = Math.sin(t * Math.PI) * bend;
      const x = ax + (bx - ax) * t + nx * bow;
      const y = ay + (by - ay) * t + ny * bow;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const gx = Math.round(x) + dx, gy = Math.round(y) + dy;
          if (Math.hypot(gx - x, gy - y) <= 0.95) pave(gx, gy, t < 0.5 ? a : b);
        }
    }
    pathAngles[a].push(Math.atan2(by - ay, bx - ax));
    pathAngles[b].push(Math.atan2(ay - by, ax - bx));
  }
  pathAngles.harbour.push(Math.PI / 4); // the pier, built below

  // Plazas.
  for (const z of zones) {
    const [cx, cy] = CENTERS[z];
    const r = z === 'casino' ? 3.3 : 2.7;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (Math.hypot(dx, dy) <= r) pave(cx + dx, cy + dy, z);
  }

  // The pier: from the harbour plaza straight out to sea (screen-down), over the water.
  const pierTiles: [number, number][] = [];
  for (let k = 3; k <= 11; k++) {
    for (const [gx, gy] of [[34 + k, 34 + k], [35 + k, 34 + k]] as [number, number][]) {
      const c = at(gx, gy);
      if (!c) continue;
      const wasWater = !c.land;
      c.land = true;
      c.zone = 'harbour';
      c.path = true;
      c.ground = 'planks';
      if (wasWater) pierTiles.push([gx, gy]);
    }
  }

  const props: Prop[] = [];
  const spots: Spot[] = [];
  const taken = new Set<number>();

  const block = (gx: number, gy: number) => {
    const c = at(gx, gy);
    if (c && !c.path) c.blocked = true;
    if (c) taken.add(idx(gx, gy));
  };

  const approach = (gx: number, gy: number, z: ZoneKey) => {
    const [cx, cy] = CENTERS[z];
    let best: [number, number] = [cx, cy];
    let bd = Infinity;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const c = at(gx + dx, gy + dy);
        if (!c || !c.land || c.blocked || (dx === 0 && dy === 0)) continue;
        const d = Math.hypot(c.gx - cx, c.gy - cy) + (c.path ? 0 : 0.5);
        if (d < bd) { bd = d; best = [c.gx, c.gy]; }
      }
    return best;
  };

  for (const z of zones) {
    const [cx, cy] = CENTERS[z];
    const used = [...pathAngles[z]];
    const gapScore = (a: number) => Math.min(...used.map((u) => angDiff(a, u)));
    const bestAngle = (minGap = 0) => {
      let best = 0, bs = -1;
      for (let k = 0; k < 72; k++) {
        const a = (k / 72) * Math.PI * 2 - Math.PI;
        const s = gapScore(a);
        if (s > bs && s >= minGap) { bs = s; best = a; }
      }
      return best;
    };

    const lm = LANDMARKS[z];
    let lmAngle: number | null = null;
    if (lm) {
      // Buildings go behind their plaza (screen-north, grid direction (-1, -1)) where a wide enough gap allows, so the
      // stall in front of them is never hidden. The lighthouse and the volcano keep the widest gap (the coast).
      const UP = -0.75 * Math.PI;
      lmAngle = bestAngle();
      if (z !== 'harbour' && z !== 'volcano') {
        let best = -Infinity;
        for (let k = 0; k < 72; k++) {
          const a = (k / 72) * Math.PI * 2 - Math.PI;
          const gap = gapScore(a);
          if (gap < 0.6) continue;
          const s = gap + 0.9 * Math.cos(angDiff(a, UP));
          if (s > best) { best = s; lmAngle = a; }
        }
      }
      const lx = Math.round(cx + Math.cos(lmAngle) * lm.dist);
      const ly = Math.round(cy + Math.sin(lmAngle) * lm.dist);
      props.push({ kind: lm.kind, gx: lx, gy: ly, zone: z, seed: rnd(), size: lm.size });
      const f = Math.ceil(lm.size);
      for (let dy = -f; dy <= f; dy++) for (let dx = -f; dx <= f; dx++) if (Math.hypot(dx, dy) <= lm.size + 0.2) block(lx + dx, ly + dy);
      used.push(lmAngle);
    }

    for (const def of SPOT_DEFS[z]) {
      let angle = def.front && lmAngle != null ? lmAngle : bestAngle();
      let dist = def.front ? 3.2 : def.kind === 'travel' ? 2.6 : 3.4;
      let gx = Math.round(cx + Math.cos(angle) * dist), gy = Math.round(cy + Math.sin(angle) * dist);
      // Nudge off a taken tile.
      for (let tries = 0; taken.has(idx(gx, gy)) && tries < 12; tries++) {
        angle += 0.35;
        dist += 0.15;
        gx = Math.round(cx + Math.cos(angle) * dist);
        gy = Math.round(cy + Math.sin(angle) * dist);
      }
      const c = at(gx, gy)!;
      c.blocked = true;
      c.path = false;
      if (!c.land) { c.land = true; c.zone = z; }
      if (c.ground === 'deep' || c.ground === 'water') c.ground = LAND_GROUND[z];
      taken.add(idx(gx, gy));
      const [ax, ay] = approach(gx, gy, z);
      spots.push({ ...def, zone: z, gx, gy, ax, ay });
      if (!def.front) used.push(angle);
    }
  }

  // The jungle's hidden treasure chest: a narrow trail off the plaza to a clearing.
  {
    const [cx, cy] = CENTERS.jungle;
    const tx = cx + 2, ty = cy + 6;
    for (let s = 0; s <= 24; s++) {
      const t = s / 24;
      const x = cx + (tx - cx) * t + Math.sin(t * Math.PI) * 1.5, y = cy + (ty - cy) * t;
      pave(Math.round(x), Math.round(y), 'jungle');
    }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) pave(tx + dx, ty + dy, 'jungle');
    const c = at(tx, ty + 1)!;
    c.blocked = true;
    c.path = false;
    taken.add(idx(tx, ty + 1));
    spots.push({ id: 'chest', kind: 'chest', zone: 'jungle', gx: tx, gy: ty + 1, label: 'Treasure Chest', ax: tx, ay: ty });
  }

  // Water depth for shading: steps to the nearest land.
  {
    const queue: number[] = [];
    for (const c of cells) if (c.land) { c.shore = 0; queue.push(idx(c.gx, c.gy)); } else c.shore = 99;
    for (let q = 0; q < queue.length; q++) {
      const c = cells[queue[q]];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = at(c.gx + dx, c.gy + dy);
        if (n && n.shore > c.shore + 1) { n.shore = c.shore + 1; queue.push(idx(n.gx, n.gy)); }
      }
    }
    for (const c of cells) if (!c.land) c.ground = c.shore <= 1 ? 'shallow' : c.shore <= 3 ? 'water' : 'deep';
  }

  // Decor.
  const near = (gx: number, gy: number, r: number) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (taken.has(idx(gx + dx, gy + dy))) return true;
    return false;
  };
  for (const c of cells) {
    if (!c.land || c.path || c.blocked || near(c.gx, c.gy, 1)) continue;
    const r = rnd();
    let kind: string | null = null;
    let solid = true;
    const sand = c.ground === 'sand';
    switch (c.zone) {
      case 'harbour':
      case 'boardwalk':
        if (r < (sand ? 0.1 : 0.07)) kind = 'palm';
        else if (r < 0.13) { kind = sand ? 'shell' : 'flowers'; solid = false; }
        else if (r < 0.15) kind = 'bush';
        break;
      case 'fairground':
        if (r < 0.05) kind = 'palm';
        else if (r < 0.1) kind = 'tree';
        else if (r < 0.2) { kind = 'flowers'; solid = false; }
        else if (r < 0.23) kind = 'balloons';
        break;
      case 'casino':
        if (r < 0.06) kind = 'hedge';
        else if (r < 0.1) kind = 'palm';
        else if (r < 0.15) { kind = 'flowers'; solid = false; }
        break;
      case 'jungle':
        if (r < (sand ? 0.08 : 0.24)) kind = sand ? 'palm' : 'jtree';
        else if (r < 0.38) { kind = 'fern'; solid = false; }
        else if (r < 0.41) kind = 'pillar';
        break;
      case 'volcano':
        if (r < 0.1) kind = 'boulder';
        else if (r < 0.14) kind = 'deadtree';
        else if (r < 0.18) kind = 'lavapool';
        else if (r < 0.22) { kind = 'vent'; solid = false; }
        break;
    }
    if (!kind) continue;
    props.push({ kind, gx: c.gx, gy: c.gy, zone: c.zone, seed: rnd() });
    if (solid) c.blocked = true;
  }

  // Lamp posts along the casino and fairground plazas; bunting posts on the boardwalk.
  for (const z of ['casino', 'fairground', 'boardwalk'] as ZoneKey[]) {
    const [cx, cy] = CENTERS[z];
    const r = z === 'casino' ? 4.3 : 3.7;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.2;
      const gx = Math.round(cx + Math.cos(a) * r), gy = Math.round(cy + Math.sin(a) * r);
      const c = at(gx, gy);
      if (!c || !c.land || c.path || c.blocked || taken.has(idx(gx, gy))) continue;
      props.push({ kind: z === 'boardwalk' ? 'torch' : 'lamp', gx, gy, zone: z, seed: rnd() });
      c.blocked = true;
    }
  }

  // Boats moored by the pier, rocks out at sea.
  for (const [k, side] of [[5, -1], [8, 1], [10, -1]] as [number, number][]) {
    const gx = 34 + k + (side > 0 ? 2 : -1), gy = 34 + k + (side > 0 ? -1 : 1);
    if (at(gx, gy) && !at(gx, gy)!.land) props.push({ kind: 'boat', gx, gy, zone: null, seed: rnd() });
  }
  for (const c of cells) if (!c.land && c.shore === 2 && rnd() < 0.03) props.push({ kind: 'searock', gx: c.gx, gy: c.gy, zone: null, seed: rnd() });
  for (const [gx, gy] of pierTiles) if ((gx + gy) % 4 === 0) props.push({ kind: 'post', gx, gy, zone: 'harbour', seed: rnd() });

  // Gates: where a path tile of one zone meets another zone's open ground.
  const gates: Gate[] = [];
  for (const c of cells) {
    if (!c.path || !c.zone || c.zone === 'harbour' || c.zone === 'boardwalk' || c.zone === 'fairground') continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = at(c.gx + dx, c.gy + dy);
      if (n && n.land && n.zone && n.zone !== c.zone && !n.blocked) {
        gates.push({ gx: c.gx, gy: c.gy, zone: c.zone });
        break;
      }
    }
  }

  // Fun spots on the landmarks: stand on the nearest open tile on the plaza side.
  for (const p of props) {
    const label = FUN_LABELS[p.kind];
    if (!label || !p.zone) continue;
    const [cx, cy] = CENTERS[p.zone];
    const f = Math.ceil(p.size ?? 1);
    let best: [number, number] | null = null;
    let bd = Infinity;
    for (let r = f + 1; r <= f + 4 && !best; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const c = at(p.gx + dx, p.gy + dy);
          if (!c || !c.land || c.blocked || c.zone !== p.zone) continue;
          const d = Math.hypot(c.gx - cx, c.gy - cy) - (c.path ? 1 : 0);
          if (d < bd) { bd = d; best = [c.gx, c.gy]; }
        }
    if (best) spots.push({ id: `fun-${p.kind}`, kind: 'fun', zone: p.zone, gx: p.gx, gy: p.gy, label, ax: best[0], ay: best[1] });
  }

  return {
    kind: 'island',
    bounds: { minX: -N * (TW / 2), maxX: N * (TW / 2), minY: -200, maxY: N * TH + 100 },
    cells, spots, props, gates, spawn: { gx: CENTERS.harbour[0], gy: CENTERS.harbour[1] + 1 }, centers: CENTERS,
  };
}

// ── Pathfinding ─────────────────────────────────────────────────────────

/** A* over walkable tiles, 8 directions (no corner cutting). Returns tile centres from start (exclusive) to goal. */
export function findPath(map: WorldMap, walkable: (c: Cell) => boolean, sx: number, sy: number, tx: number, ty: number): [number, number][] | null {
  const start = idx(sx, sy), goal = idx(tx, ty);
  if (!inside(tx, ty) || !walkable(map.cells[goal])) return null;
  const g = new Float32Array(N * N).fill(Infinity);
  const from = new Int32Array(N * N).fill(-1);
  const closed = new Uint8Array(N * N);
  const open: number[] = [start];
  const f = new Float32Array(N * N).fill(Infinity);
  g[start] = 0;
  const h = (i: number) => {
    const dx = Math.abs((i % N) - tx), dy = Math.abs(Math.floor(i / N) - ty);
    return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
  };
  f[start] = h(start);
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
    const cur = open[bi];
    open[bi] = open[open.length - 1];
    open.pop();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % N, cy = Math.floor(cur / N);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (!inside(nx, ny)) continue;
        const ni = idx(nx, ny);
        if (closed[ni] || !walkable(map.cells[ni])) continue;
        if (dx && dy && (!walkable(map.cells[idx(cx + dx, cy)]) || !walkable(map.cells[idx(cx, cy + dy)]))) continue;
        const ng = g[cur] + (dx && dy ? 1.414 : 1);
        if (ng < g[ni]) {
          g[ni] = ng;
          from[ni] = cur;
          f[ni] = ng + h(ni);
          open.push(ni);
        }
      }
  }
  if (from[goal] === -1 && goal !== start) return null;
  const out: [number, number][] = [];
  for (let i = goal; i !== start && i !== -1; i = from[i]) out.push([i % N, Math.floor(i / N)]);
  return out.reverse();
}

/** The nearest walkable tile to (tx, ty), searching outwards. */
export function nearestWalkable(map: WorldMap, walkable: (c: Cell) => boolean, tx: number, ty: number): [number, number] | null {
  for (let r = 0; r < 6; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const gx = tx + dx, gy = ty + dy;
        if (inside(gx, gy) && walkable(map.cells[idx(gx, gy)])) return [gx, gy];
      }
  return null;
}

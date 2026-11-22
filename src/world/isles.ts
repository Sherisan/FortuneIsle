import { idx, inside, mulberry, N, toScreen, type Cell, type Ground, type IsleKind, type Prop, type Spot, type WorldMap } from './map.ts';

/*
 * The isles the Island Hopper ferry sails to — one per level from 6, each with two games of its own. Every isle is laid
 * out by hand on the same 48 × 48 grid as the island (centre 24, 24; screen-up is grid (-1, -1), screen-right (+1, -1)):
 *
 *   Coral Lagoon (lagoon, level 6)  an atoll: a sandy ring round a turquoise lagoon, a plank deck in the middle with
 *                                   bridges out to the ring. Coral Drop (left), Seahorse Derby (right), the mermaid
 *                                   statue at the back. Secrets: a shipwreck offshore, a giant clam on the beach.
 *   Frost Isle (frost, level 7)     snow and ice in a polar sea: a frozen lake with the Ice Fishing hut, the Ice Vault in
 *                                   the rocks, the aurora crystal at the back. Secrets: three penguins, a yeti's pine.
 *   Sky Kingdom (sky, level 8)      floating islands in open sky joined by rainbow bridges: Star Keno's observatory
 *                                   (left), the Oracle's temple (right), the sky gong (back). Secrets: the moon, and a
 *                                   rainbow that leads somewhere.
 *
 * Each has a ferry dock at the front (screen-down, a 'ferry' spot: the sailing chart) where you arrive, and a signpost.
 */

const wobble = (gx: number, gy: number) => Math.sin(gx * 0.9 + gy * 0.4) * 0.6 + Math.sin(gy * 1.3 - gx * 0.7) * 0.5;

/** A blank sea (or sky) and the tools to draw an isle on it. */
function sketch(kind: IsleKind, seed: number) {
  const rnd = mulberry(seed);
  const sea = kind !== 'sky';
  const zone = kind;
  const cells: Cell[] = [];
  for (let gy = 0; gy < N; gy++)
    for (let gx = 0; gx < N; gx++) cells.push({ gx, gy, land: false, zone: null, ground: sea ? 'deep' : 'void', path: false, blocked: false, shore: 0, r: rnd() });
  const at = (gx: number, gy: number) => (inside(gx, gy) ? cells[idx(gx, gy)] : undefined);
  const props: Prop[] = [];
  const spots: Spot[] = [];
  const taken = new Set<number>();

  const land = (gx: number, gy: number, g: Ground) => {
    const c = at(gx, gy);
    if (!c) return;
    c.land = true;
    c.zone = zone;
    c.ground = g;
  };
  const each = (fn: (c: Cell) => void) => cells.forEach(fn);

  const s = {
    rnd, at, cells, props, spots, taken,
    /** Land within r of (cx, cy), with a ragged edge. */
    disc(cx: number, cy: number, r: number, g: Ground, rough = 1) {
      each((c) => { if (Math.hypot(c.gx - cx, c.gy - cy) < r + wobble(c.gx, c.gy) * rough) land(c.gx, c.gy, g); });
    },
    /** Repaint land between r0 and r1 of (cx, cy). */
    band(cx: number, cy: number, r0: number, r1: number, g: Ground) {
      each((c) => {
        const d = Math.hypot(c.gx - cx, c.gy - cy);
        if (c.land && !c.path && d >= r0 && d < r1) c.ground = g;
      });
    },
    /** Back to water (or sky) within r of (cx, cy). */
    carve(cx: number, cy: number, r: number, rough = 0.5) {
      each((c) => {
        if (Math.hypot(c.gx - cx, c.gy - cy) < r + wobble(c.gx, c.gy) * rough) Object.assign(c, { land: false, zone: null, path: false, ground: sea ? 'shallow' : 'void' });
      });
    },
    pave(gx: number, gy: number, g: Ground) {
      land(gx, gy, g);
      const c = at(gx, gy);
      if (c) c.path = true;
    },
    /** A path two tiles wide from (ax, ay) to (bx, by) — over water or sky too (a bridge, a pier). */
    road(ax: number, ay: number, bx: number, by: number, g: Ground) {
      const len = Math.hypot(bx - ax, by - ay);
      for (let k = 0; k <= len * 3; k++) {
        const t = k / (len * 3);
        const x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const gx = Math.round(x) + dx, gy = Math.round(y) + dy;
            if (Math.hypot(gx - x, gy - y) <= 0.95) s.pave(gx, gy, g);
          }
      }
    },
    plaza(cx: number, cy: number, r: number, g: Ground) {
      each((c) => { if (Math.hypot(c.gx - cx, c.gy - cy) <= r) s.pave(c.gx, c.gy, g); });
    },
    /** A prop; solid ones block their tile (or their footprint, for a landmark of size > 1). */
    prop(kind: string, gx: number, gy: number, o: { solid?: boolean; size?: number } = {}) {
      props.push({ kind, gx, gy, zone, seed: rnd(), size: o.size });
      const f = o.size ? Math.ceil(o.size) : 0;
      for (let dy = -f; dy <= f; dy++)
        for (let dx = -f; dx <= f; dx++) {
          if (Math.hypot(dx, dy) > (o.size ?? 0) + 0.2) continue;
          const c = at(gx + dx, gy + dy);
          if (!c) continue;
          taken.add(idx(c.gx, c.gy));
          if (o.solid !== false) c.blocked = true;
        }
    },
    spot(sp: Omit<Spot, 'zone'>) {
      const c = at(sp.gx, sp.gy);
      if (c) {
        c.blocked = true;
        taken.add(idx(c.gx, c.gy));
      }
      spots.push({ zone, ...sp });
    },
    /** Decor on open land: pick(cell, roll) names a prop (and whether it's solid), or null. */
    scatter(pick: (c: Cell, r: number) => [string, boolean] | null) {
      const near = (gx: number, gy: number) => {
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (taken.has(idx(gx + dx, gy + dy))) return true;
        return false;
      };
      for (const c of cells) {
        if (c.blocked || c.path || near(c.gx, c.gy)) continue;
        const hit = pick(c, rnd());
        if (!hit) continue;
        props.push({ kind: hit[0], gx: c.gx, gy: c.gy, zone: c.land ? zone : null, seed: rnd() });
        if (hit[1] && c.land) c.blocked = true;
      }
    },
    finish(spawn: { gx: number; gy: number }): WorldMap {
      // Water depth: steps from land, for shading (the polar sea is icy by the shore).
      if (sea) {
        const queue: number[] = [];
        for (const c of cells) if (c.land) { c.shore = 0; queue.push(idx(c.gx, c.gy)); } else c.shore = 99;
        for (let q = 0; q < queue.length; q++) {
          const c = cells[queue[q]];
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const n = at(c.gx + dx, c.gy + dy);
            if (n && n.shore > c.shore + 1) { n.shore = c.shore + 1; queue.push(idx(n.gx, n.gy)); }
          }
        }
        for (const c of cells) {
          if (c.land) continue;
          c.ground = kind === 'frost' ? (c.shore <= 1 ? 'icy' : 'polar') : c.shore <= 1 ? 'shallow' : c.shore <= 3 ? 'water' : 'deep';
        }
      }
      // Camera bounds: the isle and its spots, with head room for the tall landmarks.
      const pts = cells.filter((c) => c.land).map((c) => toScreen(c.gx, c.gy)).concat(spots.map((p) => toScreen(p.gx, p.gy)));
      const bounds = {
        minX: Math.min(...pts.map((p) => p.x)) - 300,
        maxX: Math.max(...pts.map((p) => p.x)) + 300,
        minY: Math.min(...pts.map((p) => p.y)) - 420,
        maxY: Math.max(...pts.map((p) => p.y)) + 240,
      };
      return { kind, bounds, cells, spots, props, gates: [], spawn, centers: { [zone]: [24, 24] } };
    },
  };
  return s;
}

export function buildIsle(kind: IsleKind): WorldMap {
  if (kind === 'frost') return buildFrost();
  if (kind === 'sky') return buildSky();
  return buildLagoon();
}

function buildLagoon(): WorldMap {
  const s = sketch('lagoon', 6061);
  // The atoll: a sand ring round the lagoon, green in the middle of the ring.
  s.disc(24, 24, 9.6, 'sand');
  s.carve(24, 24, 5.0);
  s.band(24, 24, 6.3, 8.4, 'grass');
  // The deck in the middle of the lagoon, and bridges out to the ring (down, up, left, right on screen).
  s.plaza(24, 24, 2.2, 'planks');
  s.road(24, 24, 29, 29, 'planks');
  s.road(24, 24, 20, 20, 'planks');
  s.road(24, 24, 19, 29, 'planks');
  s.road(24, 24, 29, 19, 'planks');
  // The ferry dock, out from the front of the ring.
  s.road(29, 29, 34, 34, 'planks');
  s.spot({ id: 'lagoon-ferry', kind: 'ferry', label: 'Island Hopper', gx: 35, gy: 35, ax: 34, ay: 34 });

  s.spot({ id: 'coral-drop', kind: 'game', game: 'coral-drop', label: 'Coral Drop', gx: 18, gy: 30, ax: 19, ay: 29 });
  s.spot({ id: 'seahorse-derby', kind: 'game', game: 'seahorse-derby', label: 'Seahorse Derby', gx: 30, gy: 18, ax: 29, ay: 19 });
  s.spot({ id: 'sign-lagoon', kind: 'travel', label: 'Signpost', gx: 28, gy: 31, ax: 29, ay: 30 });
  // The mermaid on the back of the ring (the show is a fun spot).
  s.prop('mermaid', 17, 17, { size: 1.5 });
  s.spot({ id: 'fun-mermaid', kind: 'fun', label: 'Hear the mermaid sing', gx: 17, gy: 17, ax: 20, ay: 20 });
  s.at(17, 17)!.blocked = true;

  // Secrets: a shipwreck in the shallows off the left of the ring, a giant clam on the right-hand beach.
  s.prop('shipwreck', 12, 32, { solid: false });
  s.prop('clam', 32, 23);

  s.scatter((c, r) => {
    if (c.land) {
      if (c.ground === 'grass') return r < 0.16 ? ['palm', true] : r < 0.24 ? ['flowers', false] : null;
      return r < 0.05 ? ['palm', true] : r < 0.09 ? ['shell', false] : r < 0.115 ? ['umbrella', true] : null;
    }
    // The outer shallows, just off the ring.
    const d = Math.hypot(c.gx - 24, c.gy - 24);
    if (d > 10.6 && d < 12.5) return r < 0.08 ? ['coral', false] : null;
    return null;
  });
  // Coral in the lagoon itself (the depth isn't known until finish(), so by distance from the deck).
  for (const [gx, gy] of [[21, 23], [27, 25], [26, 21], [22, 27], [20, 25], [28, 23]] as [number, number][]) {
    const c = s.at(gx, gy);
    if (c && !c.land) s.props.push({ kind: 'coral', gx, gy, zone: null, seed: s.rnd() });
  }
  return s.finish({ gx: 33, gy: 33 });
}

function buildFrost(): WorldMap {
  const s = sketch('frost', 7071);
  s.disc(24, 24, 9.4, 'snow');
  s.disc(18, 19, 5, 'snow');
  s.disc(30, 20, 4.5, 'snow');
  s.disc(27, 30, 4.5, 'snow');
  s.disc(19, 29, 4.8, 'snow');
  // The frozen lake (walkable ice), the plaza and the paths of packed ice.
  s.disc(19.5, 29.5, 3.2, 'ice', 0.4);
  s.plaza(24, 24, 2.6, 'ice');
  s.road(24, 24, 31, 31, 'ice');
  s.road(24, 24, 29, 19, 'ice');
  s.road(24, 24, 20.5, 27.5, 'ice');
  s.road(24, 24, 19.5, 19.5, 'ice');
  s.road(31, 31, 34, 34, 'planks');
  s.spot({ id: 'frost-ferry', kind: 'ferry', label: 'Island Hopper', gx: 35, gy: 35, ax: 34, ay: 34 });

  s.spot({ id: 'ice-fishing', kind: 'game', game: 'ice-fishing', label: 'Ice Fishing', gx: 18, gy: 30, ax: 19, ay: 29 });
  s.spot({ id: 'ice-vault', kind: 'game', game: 'ice-vault', label: 'Ice Vault', gx: 30, gy: 18, ax: 29, ay: 19 });
  s.spot({ id: 'sign-frost', kind: 'travel', label: 'Signpost', gx: 29, gy: 31, ax: 30, ay: 30 });
  s.prop('crystal', 16, 16, { size: 1.6 });
  s.spot({ id: 'fun-crystal', kind: 'fun', label: 'Touch the ice crystal', gx: 16, gy: 16, ax: 19, ay: 19 });
  s.at(16, 16)!.blocked = true;

  // Secrets: three penguins by the lake, the yeti's pine at the far left.
  for (const [gx, gy] of [[16, 32], [18, 33], [22, 32]] as [number, number][]) s.prop('penguin', gx, gy);
  s.prop('yetipine', 14, 21);
  s.prop('igloo', 26, 17);
  s.prop('igloo', 31, 25);
  s.prop('snowman', 26, 29);
  s.prop('snowman', 22, 20);

  s.scatter((c, r) => {
    if (c.land) {
      if (c.ground !== 'snow') return null;
      return r < 0.13 ? ['pine', true] : r < 0.16 ? ['snowrock', true] : null;
    }
    // Icebergs drifting a little way off the coast.
    const d = Math.hypot(c.gx - 24, c.gy - 24);
    if (d > 12 && d < 17 && r < 0.03) return ['iceberg', false];
    return null;
  });
  return s.finish({ gx: 33, gy: 33 });
}

function buildSky(): WorldMap {
  const s = sketch('sky', 8081);
  s.disc(24, 24, 6.8, 'skygrass', 0.7);
  s.disc(14, 34, 3.6, 'skygrass', 0.5); // Star Keno's islet (screen-left)
  s.disc(34, 14, 3.6, 'skygrass', 0.5); // the Oracle's islet (screen-right)
  s.disc(14, 14, 3.4, 'skygrass', 0.5); // the gong's islet (screen-up)
  s.disc(37.5, 24, 1.7, 'skygrass', 0.3); // a little cloud at the end of a rainbow
  s.plaza(24, 24, 2.4, 'gold');
  // Rainbow bridges out to the islets, gold walks on the islands, the airship pier at the front.
  s.road(19.5, 28.5, 16, 32, 'rainbow');
  s.road(28.5, 19.5, 32, 16, 'rainbow');
  s.road(19.5, 19.5, 16, 16, 'rainbow');
  s.road(30, 24, 36, 24, 'rainbow');
  s.road(24, 24, 19.5, 28.5, 'gold');
  s.road(24, 24, 28.5, 19.5, 'gold');
  s.road(24, 24, 19.5, 19.5, 'gold');
  s.road(24, 24, 30, 24, 'gold');
  s.road(24, 24, 32, 32, 'gold');
  s.spot({ id: 'sky-ferry', kind: 'ferry', label: 'Sky Ferry', gx: 33, gy: 33, ax: 32, ay: 32 });

  s.spot({ id: 'star-keno', kind: 'game', game: 'star-keno', label: 'Star Keno', gx: 13, gy: 35, ax: 15, ay: 33 });
  s.spot({ id: 'oracle-chests', kind: 'game', game: 'oracle-chests', label: 'Oracle’s Chests', gx: 35, gy: 13, ax: 33, ay: 15 });
  s.spot({ id: 'sign-sky', kind: 'travel', label: 'Signpost', gx: 27, gy: 29, ax: 28, ay: 28 });
  s.prop('gong', 13, 13, { size: 1.2 });
  s.spot({ id: 'fun-gong', kind: 'fun', label: 'Ring the sky gong', gx: 13, gy: 13, ax: 15, ay: 15 });
  s.at(13, 13)!.blocked = true;

  // Secrets: the pot of gold at the rainbow's end (walk there), the moon up in the sky (tap it).
  s.prop('potofgold', 38, 25);
  s.props.push({ kind: 'moon', gx: 9, gy: 12, zone: null, seed: s.rnd() });

  s.scatter((c, r) => {
    if (!c.land || c.ground !== 'skygrass') return null;
    return r < 0.12 ? ['cloudtree', true] : r < 0.15 ? ['goldpillar', true] : r < 0.22 ? ['flowers', false] : null;
  });
  return s.finish({ gx: 31, gy: 31 });
}

import { Container, Graphics, Text } from 'pixi.js';
import * as A from './art.ts';
import { ROOMS, type InteriorKind } from './interior.ts';
import { TH, TW, toScreen } from './map.ts';
import { tavernDecor, vipDecor, type WallKit } from './roomsArt.ts';

/*
 * Art for the Grand Casino: its interior (walls, slot machines, the bar, chandeliers, the VIP lounge, card tables, the
 * exit arch) and the red-carpet entrance outside. Same style as art.ts: plum outlines, gloss, candy and gold.
 */

const OUT = A.OUT;
const HW = TW / 2, HH = TH / 2;
const WALL_H = 200;
const ln = (g: Graphics, w = 3, color = OUT) => g.stroke({ width: w, color, join: 'round', cap: 'round' });
const shadow = (g: Graphics, rx: number, ry: number) => g.ellipse(0, 0, rx, ry).fill({ color: 0x1b1030, alpha: 0.28 });
const gloss = (g: Graphics, x: number, y: number, rx: number, ry: number, a = 0.45) => g.ellipse(x, y, rx, ry).fill({ color: 0xffffff, alpha: a });

function neon(text: string, size: number, color: number): Text {
  const t = new Text({
    text,
    style: { fontFamily: 'Fredoka', fontWeight: '700', fontSize: size, fill: 0xffffff, stroke: { color, width: 6, join: 'round' }, dropShadow: { color, blur: 12, distance: 0, alpha: 0.9 } },
  });
  t.resolution = 2;
  return t;
}

// ── Walls ───────────────────────────────────────────────────────────────

/** Each room's wall colours: right (top-right) and left wall base + wainscot, the trim, the pattern. */
const THEMES: Record<InteriorKind, { right: [number, number]; left: [number, number]; trim: number; pattern: 'damask' | 'planks'; sconce: number }> = {
  casino: { right: [0x6d44b8, 0x3b2066], left: [0x5a35a0, 0x311a57], trim: 0xf2c14e, pattern: 'damask', sconce: 0xffe27a },
  vip: { right: [0x2a2350, 0x15112b], left: [0x231d45, 0x110d24], trim: 0xf2c14e, pattern: 'damask', sconce: 0xffc6ff },
  tavern: { right: [0x8a5a33, 0x5a381f], left: [0x7a4a22, 0x4a2e14], trim: 0x3e2418, pattern: 'planks', sconce: 0xffb347 },
};

/** A room's two back walls (sconces, then the room's own decor: the casino's screen and neon, the tavern's shelves…). */
export function buildWalls(kind: InteriorKind = 'casino'): A.Thing {
  const view = new Container();
  const g = new Graphics();
  const { x0, y0, x1, y1 } = ROOMS[kind];
  const theme = THEMES[kind];
  const lights: Graphics[] = [];

  const panel = (p0: [number, number], p1: [number, number], base: number, dark: number, k: number) => {
    const up = (p: [number, number], h: number) => [p[0], p[1] - h];
    g.poly([...p0, ...p1, ...up(p1, WALL_H), ...up(p0, WALL_H)]).fill(base);
    if (theme.pattern === 'damask') {
      for (let i = 0; i < 2; i++) {
        const t = 0.25 + i * 0.5;
        const cx = p0[0] + (p1[0] - p0[0]) * t, cy = p0[1] + (p1[1] - p0[1]) * t - 120;
        g.poly([cx, cy - 12, cx + 7, cy, cx, cy + 12, cx - 7, cy]).fill({ color: 0xf2c14e, alpha: 0.35 });
      }
    } else {
      // Planks: horizontal seams, a beam every third tile.
      for (let h = 72; h < WALL_H - 20; h += 22)
        g.moveTo(...(up(p0, h) as [number, number])).lineTo(...(up(p1, h) as [number, number])).stroke({ width: 1.5, color: 0x3e2418, alpha: 0.45 });
      if (k % 3 === 0) g.poly([...p0, ...up(p0, WALL_H), ...[up(p0, WALL_H)[0] + (p1[0] - p0[0]) * 0.18, up(p0, WALL_H)[1] + (p1[1] - p0[1]) * 0.18], ...[p0[0] + (p1[0] - p0[0]) * 0.18, p0[1] + (p1[1] - p0[1]) * 0.18]]).fill(0x4a2e14);
    }
    g.poly([...p0, ...p1, ...up(p1, 56), ...up(p0, 56)]).fill(dark); // wainscot
    g.moveTo(...(up(p0, 56) as [number, number])).lineTo(...(up(p1, 56) as [number, number])).stroke({ width: 4, color: theme.trim });
    g.poly([...up(p0, WALL_H - 18), ...up(p1, WALL_H - 18), ...up(p1, WALL_H), ...up(p0, WALL_H)]).fill(theme.trim); // crown
    g.moveTo(...(p0)).lineTo(...(up(p0, WALL_H) as [number, number])).stroke({ width: 1.5, color: 0x000000, alpha: 0.12 });
    if (k % 3 === 1) {
      const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2 - 104;
      g.roundRect(mx - 4, my - 4, 8, 16, 3).fill(theme.trim === 0xf2c14e ? 0xf2c14e : 0x8a8fa3);
      const glow = new Graphics();
      glow.circle(mx, my - 8, 20).fill({ color: theme.sconce, alpha: 0.25 });
      glow.circle(mx, my - 8, 6).fill(0xfff6c2);
      lights.push(glow);
    }
  };

  // Back-right wall: the n→e edge of every tile in the top row.
  for (let gx = x0; gx <= x1; gx++) {
    const { x, y } = toScreen(gx, y0);
    panel([x, y - HH], [x + HW, y], theme.right[0], theme.right[1], gx - x0);
  }
  // Back-left wall: the w→n edge of every tile in the left column (a shade darker).
  for (let gy = y0; gy <= y1; gy++) {
    const { x, y } = toScreen(x0, gy);
    panel([x - HW, y], [x, y - HH], theme.left[0], theme.left[1], gy - y0);
  }
  // Outlines along the tops and the corner post.
  const tl = toScreen(x0, y1), tc = toScreen(x0, y0), tr = toScreen(x1, y0);
  g.moveTo(tl.x - HW, tl.y - WALL_H).lineTo(tc.x, tc.y - HH - WALL_H).lineTo(tr.x + HW, tr.y - WALL_H).stroke({ width: 4, color: OUT });
  ln(g.roundRect(tc.x - 9, tc.y - HH - WALL_H - 6, 18, WALL_H + 6, 6).fill(theme.trim), 3);
  view.addChild(g, ...lights);

  // Wall decor: skewed so it lies flat on the wall (the wall rises 1 px for every 2 px left).
  const onRight = (gx: number, h: number) => {
    const c = new Container();
    const { x, y } = toScreen(gx, y0);
    c.position.set(x, y - HH - h);
    c.skew.y = Math.atan2(HH, HW);
    view.addChild(c);
    return c;
  };
  const onLeft = (gy: number, h: number) => {
    const c = new Container();
    const { x, y } = toScreen(x0, gy);
    c.position.set(x - HW, y - h);
    c.skew.y = -Math.atan2(HH, HW);
    view.addChild(c);
    return c;
  };
  const kit: WallKit = { view, onRight, onLeft };
  const decor = kind === 'tavern' ? tavernDecor(kit) : kind === 'vip' ? vipDecor(kit) : casinoDecor(kit);
  return {
    view,
    update: (t) => {
      lights.forEach((l, i) => (l.alpha = 0.75 + Math.sin(t * 2 + i) * 0.25));
      decor(t);
    },
  };
}

/** The Grand Casino's walls: the Lava Crash screen, VIP neon, the bar's shelves, card suits and the casino's name. */
function casinoDecor({ onRight, onLeft }: WallKit): (t: number) => void {
  // The big screen: an advert for Lava Crash, with lava bubbling across it.
  const screen = onRight(17, 186);
  const sw = 8 * HW;
  const sg = new Graphics();
  ln(sg.roundRect(-6, -6, sw + 12, 92, 10).fill(0x2c1d3f), 4);
  sg.roundRect(0, 0, sw, 80, 6).fill(0x1a0f24);
  const lava = new Graphics();
  for (let i = 0; i < 12; i++) lava.circle(i * (sw / 11), 80, 14).fill(0xff5a1f);
  lava.rect(0, 74, sw, 6).fill(0xff5a1f);
  const mask = new Graphics();
  mask.roundRect(0, 0, sw, 80, 6).fill(0xffffff);
  lava.mask = mask;
  const title = neon('LAVA CRASH', 30, 0xff5a1f);
  title.anchor.set(0.5);
  title.position.set(sw / 2, 30);
  const sub = new Text({ text: 'up to ×500 · Volcano Summit', style: { fontFamily: 'Fredoka', fontWeight: '600', fontSize: 15, fill: 0xffe27a } });
  sub.resolution = 2;
  sub.anchor.set(0.5);
  sub.position.set(sw / 2, 60);
  screen.addChild(sg, lava, mask, title, sub);

  // VIP neon over the stairs up.
  const vip = onRight(29, 160);
  const vt = neon('VIP SALON', 30, 0xff4fb0);
  vt.position.set(8, 0);
  vip.addChild(vt);

  // Bar shelves with bottles behind the counter.
  const shelf = onLeft(23, 150);
  const bg = new Graphics();
  const span = 6 * HW;
  for (const sy of [36, 84]) {
    const cols = [0x2fc36f, 0xffd23f, 0xff5b6e, 0x4fc3ff, 0xb07cff, 0xff8a3d];
    for (let i = 0; i < 11; i++) {
      const bx = 10 + i * (span - 20) / 10, h = 22 + ((i * 7) % 3) * 5;
      ln(bg.roundRect(bx - 5, sy - h, 10, h, 4).fill(cols[(i + sy) % cols.length]), 2);
      bg.rect(bx - 2, sy - h - 6, 4, 6).fill(OUT);
    }
    ln(bg.roundRect(0, sy, span, 7, 3).fill(0xf2c14e), 2.5);
  }
  shelf.addChild(bg);

  // Card suits neon on the left wall.
  const suits = onLeft(31, 160);
  const st = neon('♠ ♥ ♦ ♣', 34, 0x4fc3ff);
  st.position.set(10, 0);
  suits.addChild(st);
  const gc = onLeft(29, 104);
  const gt = neon('GRAND CASINO', 22, 0xffd23f);
  gt.position.set(0, 0);
  gc.addChild(gt);

  return (t) => {
    lava.y = Math.sin(t * 1.5) * 5;
    lava.x = ((t * 30) % (sw / 11)) - sw / 11;
    title.alpha = 0.8 + Math.abs(Math.sin(t * 3)) * 0.2;
    vt.alpha = Math.sin(t * 7) > -0.9 ? 1 : 0.4;
  };
}

// ── Interior props ──────────────────────────────────────────────────────

export function slotMachine(seed: number): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 30, 12);
  const [body, side] = ([[0xff4f5e, 0xd63a4c], [0x9b5cf6, 0x7a45d0], [0x3e8ef7, 0x2a6fd0], [0x2fc36f, 0x229a55]] as const)[Math.floor(seed * 4) % 4];
  A.isoBox(g, 0.62, 0.5, 78, 0xf2c14e, body, side);
  // Screen with three reels (static symbols: these machines are decor).
  ln(g.roundRect(-26, -66, 34, 24, 5).fill(0x1a0f24), 2.5);
  const sym = ['7', '★', '♦'];
  const reels: Text[] = [];
  for (let i = 0; i < 3; i++) {
    g.roundRect(-24 + i * 10.5, -63, 9, 18, 2).fill(0xfffdf2);
    const t = new Text({ text: sym[(i + Math.floor(seed * 3)) % 3], style: { fontFamily: 'Fredoka', fontWeight: '700', fontSize: 11, fill: i === 0 ? 0xff3b4e : 0x2c1d3f } });
    t.resolution = 2;
    t.anchor.set(0.5);
    t.position.set(-19.5 + i * 10.5, -54);
    reels.push(t);
  }
  // Lever
  g.moveTo(14, -52).lineTo(22, -76).stroke({ width: 3, color: 0xc0c6d4 });
  ln(g.circle(22, -78, 5).fill(0xff3b4e), 2);
  gloss(g, -18, -86, 8, 3, 0.4);
  const light = new Graphics();
  light.circle(-4, -96, 7).fill(0xfff3b0);
  light.circle(-4, -96, 14).fill({ color: 0xffe27a, alpha: 0.35 });
  view.addChild(g, ...reels, light);
  return { view, update: (t) => (light.alpha = Math.sin(t * 6 + seed * 20) > 0 ? 1 : 0.3) };
}

export function barCounter(): A.Thing {
  const view = new Container();
  const g = new Graphics();
  A.isoBox(g, 0.75, 1.02, 44, 0x3e2418, 0x7a4a22, 0x6b4428);
  g.poly([-36, -26, 0, -8, 0, -12, -36, -30]).fill({ color: 0xf2c14e, alpha: 0.9 });
  view.addChild(g);
  return { view };
}

export function stool(): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 12, 5);
  g.moveTo(0, 0).lineTo(0, -22).stroke({ width: 4, color: 0xc0c6d4 });
  ln(g.ellipse(0, -2, 9, 4).fill(0x8a8fa3), 2);
  ln(g.ellipse(0, -24, 12, 6).fill(0xe5394b), 2.5);
  gloss(g, -4, -26, 4, 2, 0.5);
  view.addChild(g);
  return { view };
}

export function bartender(): A.Thing {
  const a = A.avatar();
  a.setLook({ hat: 'hat-none', outfit: 'outfit-tux', pet: 'pet-none' });
  return { view: a.view, update: (t) => a.pose(t, false, 0) };
}

export function chandelier(seed: number): A.Thing {
  const view = new Container();
  const c = new Container();
  c.y = -300;
  const g = new Graphics();
  g.moveTo(0, -140).lineTo(0, -30).stroke({ width: 3, color: 0xf2c14e });
  ln(g.ellipse(0, 0, 54, 16).fill(0xf2c14e), 3);
  ln(g.ellipse(0, -16, 30, 10).fill(0xf6cf5e), 3);
  ln(g.circle(0, -34, 8).fill(0xf2c14e), 2.5);
  const drops: Graphics[] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const x = Math.cos(a) * 48, y = Math.sin(a) * 13 + 8;
    g.moveTo(x, y - 6).lineTo(x, y + 6).stroke({ width: 1.5, color: 0xffffff, alpha: 0.8 });
    const d = new Graphics();
    d.poly([x, y + 4, x + 4, y + 10, x, y + 16, x - 4, y + 10]).fill(0xdff6ff);
    drops.push(d);
  }
  const flames = new Graphics();
  for (let i = 0; i < 6; i++) {
    const x = -40 + i * 16;
    flames.roundRect(x - 3, -18, 6, 12, 2).fill(0xfff6e5);
    flames.circle(x, -24, 9).fill({ color: 0xffe27a, alpha: 0.4 });
    flames.circle(x, -23, 3.5).fill(0xfff3b0);
  }
  c.addChild(g, ...drops, flames);
  view.addChild(c);
  return {
    view,
    update: (t) => {
      c.rotation = Math.sin(t * 0.7 + seed * 5) * 0.015;
      flames.alpha = 0.85 + Math.sin(t * 9 + seed * 9) * 0.15;
      drops.forEach((d, i) => (d.alpha = 0.6 + Math.max(0, Math.sin(t * 3 + i * 1.7)) * 0.4));
    },
  };
}

export function column(): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 24, 10);
  ln(g.ellipse(0, -2, 22, 10).fill(0xf2c14e));
  ln(g.roundRect(-15, -180, 30, 176, 6).fill(0xf6efe6));
  g.rect(-15, -180, 9, 176).fill({ color: 0xffffff, alpha: 0.5 });
  for (const x of [-5, 4]) g.moveTo(x, -170).lineTo(x, -14).stroke({ width: 1.5, color: 0xcfc4b6 });
  ln(g.roundRect(-22, -194, 44, 18, 5).fill(0xf2c14e));
  view.addChild(g);
  return { view };
}

export function potPalm(seed: number): A.Thing {
  const view = new Container();
  const palm = A.palm(seed);
  palm.view.scale.set(0.62);
  palm.view.y = -26;
  const g = new Graphics();
  ln(g.poly([-18, -30, 18, -30, 13, 0, -13, 0]).fill(0xf2c14e));
  g.rect(-18, -30, 36, 6).fill(0xe0ad38);
  view.addChild(palm.view, g);
  return { view, update: palm.update };
}

/** A gold stanchion; with dir, a red rope sags to the next post (+gx or +gy). */
export function stanchion(dir?: 'x' | 'y'): A.Thing {
  const view = new Container();
  const g = new Graphics();
  g.ellipse(0, 0, 9, 4).fill({ color: 0x1b1030, alpha: 0.25 });
  if (dir) {
    const [dx, dy] = dir === 'x' ? [HW, HH] : [-HW, HH];
    g.moveTo(0, -36).quadraticCurveTo(dx / 2, dy / 2 - 22, dx, dy - 36).stroke({ width: 5, color: OUT });
    g.moveTo(0, -36).quadraticCurveTo(dx / 2, dy / 2 - 22, dx, dy - 36).stroke({ width: 3, color: 0xd6203f });
  }
  ln(g.ellipse(0, 0, 8, 3.5).fill(0xf2c14e), 2);
  ln(g.roundRect(-2.5, -38, 5, 38, 2).fill(0xf2c14e), 2);
  ln(g.circle(0, -40, 4).fill(0xf6cf5e), 2);
  view.addChild(g);
  return { view };
}

export function cardTable(seed: number): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 56, 22);
  g.rect(-4, -30, 8, 30).fill(0x6b4428);
  ln(g.ellipse(0, -32, 56, 26).fill(0x6b4428), 3);
  g.ellipse(0, -35, 48, 20).fill(0x1f8f4e);
  g.ellipse(0, -35, 30, 12).stroke({ width: 1.5, color: 0xffffff, alpha: 0.35 });
  for (let i = 0; i < 4; i++) {
    const x = -30 + i * 20, y = -32 + Math.abs(i - 1.5) * 4;
    ln(g.roundRect(x - 5, y - 7, 10, 14, 2).fill(0xffffff), 1.5);
    g.circle(x, y, 2).fill(i % 2 ? 0xe5394b : OUT);
  }
  for (const [x, c] of [[24, 0xff4f5e], [32, 0x3e8ef7]] as const) for (let k = 0; k < 3; k++) ln(g.ellipse(x, -42 - k * 3, 6, 3).fill(c), 1.5);
  gloss(g, -20, -44, 12, 4, 0.2);
  view.addChild(g);
  void seed;
  return { view };
}

export function sofa(): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 44, 18);
  A.isoBox(g, 1.0, 0.55, 18, 0xb03a8c, 0x8a2a6e, 0x7a2260);
  A.isoBox(g, 1.0, 0.18, 26, 0xc0479c, 0x8a2a6e, 0x7a2260, 18);
  gloss(g, -10, -30, 12, 3, 0.3);
  view.addChild(g);
  return { view };
}

export function vipTable(): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 18, 7);
  g.rect(-2, -22, 4, 22).fill(0xf2c14e);
  ln(g.ellipse(0, -24, 18, 8).fill(0xf6cf5e), 2.5);
  ln(g.roundRect(-6, -46, 12, 20, 4).fill(0xc0c6d4), 2);
  g.moveTo(-1, -46).lineTo(-3, -58).stroke({ width: 4, color: 0x2f7a3a });
  view.addChild(g);
  return { view };
}

export function tablesBoard(): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 30, 12);
  for (const x of [-26, 26]) ln(g.roundRect(x - 3, -60, 6, 60, 2).fill(0xf2c14e), 2);
  ln(g.roundRect(-46, -128, 92, 74, 10).fill(0x1a0f24), 3.5);
  g.roundRect(-40, -122, 80, 62, 7).stroke({ width: 2, color: 0xf2c14e });
  view.addChild(g);
  const t1 = neon('TABLES', 15, 0x2fc36f);
  t1.anchor.set(0.5);
  t1.position.set(0, -108);
  const t2 = new Text({ text: 'Roulette 97.3%\nDragon Tiger 96%\nReels 96%', style: { fontFamily: 'Fredoka', fontWeight: '600', fontSize: 11, fill: 0xffe27a, align: 'center', lineHeight: 12 } });
  t2.resolution = 2;
  t2.anchor.set(0.5);
  t2.position.set(0, -78);
  view.addChild(t1, t2);
  return { view };
}

export function exitArch(): A.Thing {
  const view = new Container();
  const glow = new Graphics();
  glow.ellipse(0, 6, 60, 22).fill({ color: 0xfff3b0, alpha: 0.35 });
  const g = new Graphics();
  // A free-standing gold door frame on the front edge, glowing with daylight from outside.
  const arch = new Container();
  const a = new Graphics();
  ln(a.roundRect(-46, -128, 92, 128, 40).fill(0xf2c14e), 3.5);
  a.roundRect(-34, -116, 68, 116, 32).fill(0xfff6d6);
  a.roundRect(-34, -116, 68, 116, 32).fill({ color: 0xffe27a, alpha: 0.5 });
  ln(a.roundRect(-30, -152, 60, 24, 7).fill(0x2fc36f), 3);
  arch.addChild(a);
  const t = new Text({ text: 'EXIT', style: { fontFamily: 'Fredoka', fontWeight: '700', fontSize: 16, fill: 0xffffff } });
  t.resolution = 2;
  t.anchor.set(0.5);
  t.position.set(0, -140);
  arch.addChild(t);
  view.addChild(glow, g, arch);
  return { view, update: (tt) => (glow.alpha = 0.7 + Math.sin(tt * 2.5) * 0.3) };
}

/** Outside: the red carpet and ropes at the casino's door. */
export function casinoEntrance(): A.Thing {
  const view = new Container();
  const g = new Graphics();
  // Red carpet diamond with a gold edge.
  ln(g.poly([0, -HH * 1.1, HW * 1.1, 0, 0, HH * 1.1, -HW * 1.1, 0]).fill(0xd6203f), 3);
  g.poly([0, -HH * 0.85, HW * 0.85, 0, 0, HH * 0.85, -HW * 0.85, 0]).stroke({ width: 2, color: 0xf2c14e });
  view.addChild(g);
  // A gold post either side of the carpet.
  for (const x of [-HW * 0.95, HW * 0.95]) {
    const post = stanchion();
    post.view.position.set(x, 0);
    view.addChild(post.view);
  }
  const glow = new Graphics();
  glow.poly([0, -HH * 0.8, HW * 0.8, 0, 0, HH * 0.8, -HW * 0.8, 0]).fill({ color: 0xffe27a, alpha: 0.25 });
  view.addChild(glow);
  return { view, update: (t) => (glow.alpha = 0.4 + Math.sin(t * 3) * 0.4) };
}

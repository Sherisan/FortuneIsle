import { Container, Graphics, Text } from 'pixi.js';
import * as A from './art.ts';
import { TH, TW } from './map.ts';

/*
 * Art for the rooms added after the Grand Casino: the Rusty Anchor tavern (its building on the Harbour, the interior's
 * props and wall decor) and the VIP Salon upstairs, plus the playable tables and machines (Island Reels, Dragon Tiger,
 * Pirate Dice) and the doorways between rooms. Same style as art.ts: plum outlines, gloss, candy and gold.
 */

const OUT = A.OUT;
const HW = TW / 2, HH = TH / 2;
const ln = (g: Graphics, w = 3, color = OUT) => g.stroke({ width: w, color, join: 'round', cap: 'round' });
const shadow = (g: Graphics, rx: number, ry: number) => g.ellipse(0, 0, rx, ry).fill({ color: 0x1b1030, alpha: 0.28 });
const gloss = (g: Graphics, x: number, y: number, rx: number, ry: number, a = 0.45) => g.ellipse(x, y, rx, ry).fill({ color: 0xffffff, alpha: a });

export function neon(text: string, size: number, color: number): Text {
  const t = new Text({
    text,
    style: { fontFamily: 'Fredoka', fontWeight: '700', fontSize: size, fill: 0xffffff, stroke: { color, width: 6, join: 'round' }, dropShadow: { color, blur: 12, distance: 0, alpha: 0.9 } },
  });
  t.resolution = 2;
  return t;
}

function text(s: string, size: number, fill: number, weight: '600' | '700' = '700') {
  const t = new Text({ text: s, style: { fontFamily: 'Fredoka', fontWeight: weight, fontSize: size, fill, align: 'center' } });
  t.resolution = 2;
  t.anchor.set(0.5);
  return t;
}

/** Wall decor helpers from buildWalls: a container lying flat on the right (top-right) or left (top-left) wall. */
export interface WallKit {
  view: Container;
  onRight(gx: number, h: number): Container;
  onLeft(gy: number, h: number): Container;
}

// ── The Rusty Anchor: on the island ─────────────────────────────────────

export function tavernBuilding(): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 120, 46);
  // Stone footing, timber walls, a second storey, a shingled roof.
  A.isoBox(g, 2.4, 2.4, 16, 0x9d9476, 0x8a8266, 0x7a735a);
  const body = A.isoBox(g, 2.2, 2.2, 74, 0x8a5a33, 0xa06a38, 0x8a5a33, 16);
  // Plank lines on both faces
  for (let k = 1; k < 5; k++) {
    const y = 16 + k * 14;
    g.moveTo(-105, -y + 0).lineTo(0, 53 - y).stroke({ width: 1.5, color: 0x5a381f, alpha: 0.55 });
    g.moveTo(0, 53 - y).lineTo(105, -y).stroke({ width: 1.5, color: 0x5a381f, alpha: 0.55 });
  }
  // Roof
  const top = body.n[1];
  ln(g.poly([-118, -76, 0, top - 70, 0, top - 24, -118, -34 - 40]).fill(0x6b2f2a), 3);
  ln(g.poly([118, -76, 0, top - 70, 0, top - 24, 118, -34 - 40]).fill(0x8a3b33), 3);
  ln(g.poly([-118, -76, 0, -18, 0, -4, -118, -62]).fill(0x5a2622), 3);
  ln(g.poly([118, -76, 0, -18, 0, -4, 118, -62]).fill(0x7a332c), 3);
  for (let k = 0; k < 4; k++) g.moveTo(-104 + k * 24, -66 + k * 12).lineTo(-104 + k * 24 + 18, top - 40 + k * 12).stroke({ width: 1.5, color: 0x3e1a17, alpha: 0.5 });
  // Chimney with smoke
  ln(g.roundRect(46, top - 96, 22, 40, 4).fill(0x8a8266), 3);
  // Windows (warm light) and the door
  const win = new Graphics();
  for (const [x, y] of [[-70, -40], [-38, -24], [42, -24], [74, -40]]) {
    ln(win.roundRect(x - 9, y - 14, 18, 22, 6).fill(0xffd27a), 2.5);
    win.moveTo(x, y - 14).lineTo(x, y + 8).stroke({ width: 2, color: OUT });
  }
  ln(g.roundRect(-16, 26, 32, 46, 14).fill(0x3e2418), 3);
  g.circle(8, 52, 2.5).fill(0xf2c14e);
  // Hanging sign
  const sign = new Container();
  const sg = new Graphics();
  sg.moveTo(-60, -10).lineTo(-60, 0).stroke({ width: 2, color: OUT });
  sg.moveTo(60, -10).lineTo(60, 0).stroke({ width: 2, color: OUT });
  ln(sg.roundRect(-92, 0, 184, 34, 10).fill(0x3e2418), 3);
  sg.roundRect(-86, 4, 172, 26, 7).stroke({ width: 2, color: 0xf2c14e, alpha: 0.8 });
  sign.addChild(sg, A.label('⚓ RUSTY ANCHOR', 17, 0xffe27a, OUT));
  (sign.children[1] as Text).position.set(0, 17);
  sign.position.set(0, top - 6);
  // Lantern by the door, a barrel
  const lamp = new Graphics();
  lamp.circle(-30, 20, 16).fill({ color: 0xffb347, alpha: 0.35 });
  ln(lamp.roundRect(-35, 12, 10, 14, 3).fill(0xffd27a), 2);
  const barrel = new Graphics();
  ln(barrel.ellipse(44, 60, 14, 7).fill(0x7a4a22), 2.5);
  ln(barrel.roundRect(30, 36, 28, 26, 8).fill(0x8a5a33), 2.5);
  barrel.rect(30, 42, 28, 3).fill(0x3e2418);
  barrel.rect(30, 54, 28, 3).fill(0x3e2418);
  const smoke = new Container();
  const puffs: Graphics[] = [];
  for (let i = 0; i < 4; i++) {
    const p = new Graphics();
    p.circle(0, 0, 9 + i * 2).fill({ color: 0xe8e2f0, alpha: 0.7 });
    smoke.addChild(p);
    puffs.push(p);
  }
  smoke.position.set(57, top - 100);
  view.addChild(g, win, sign, lamp, barrel, smoke);
  return {
    view,
    update: (t) => {
      win.alpha = 0.85 + Math.sin(t * 3.1) * 0.08 + Math.sin(t * 7.3) * 0.05;
      lamp.alpha = 0.8 + Math.sin(t * 9) * 0.15;
      sign.rotation = Math.sin(t * 1.4) * 0.025;
      puffs.forEach((p, i) => {
        const k = (t * 0.35 + i / 4) % 1;
        p.position.set(Math.sin(k * 5 + i) * 8, -k * 90);
        p.alpha = 0.7 * (1 - k);
        p.scale.set(0.6 + k);
      });
    },
  };
}

/** Outside the tavern's door: a doormat and a crate of bottles (walking onto it goes in). */
export function tavernDoorstep(): A.Thing {
  const view = new Container();
  const g = new Graphics();
  ln(g.poly([0, -HH * 0.9, HW * 0.9, 0, 0, HH * 0.9, -HW * 0.9, 0]).fill(0x7a4a22), 3);
  g.poly([0, -HH * 0.6, HW * 0.6, 0, 0, HH * 0.6, -HW * 0.6, 0]).stroke({ width: 2, color: 0xf2c14e, alpha: 0.7 });
  const glow = new Graphics();
  glow.poly([0, -HH * 0.7, HW * 0.7, 0, 0, HH * 0.7, -HW * 0.7, 0]).fill({ color: 0xffb347, alpha: 0.3 });
  view.addChild(g, glow);
  return { view, update: (t) => (glow.alpha = 0.4 + Math.sin(t * 3) * 0.4) };
}

// ── The Rusty Anchor: inside ────────────────────────────────────────────

export function barrel(seed: number): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 22, 9);
  ln(g.roundRect(-18, -44, 36, 44, 12).fill(seed > 0.5 ? 0x8a5a33 : 0x7a4a22), 3);
  for (const y of [-36, -12]) g.rect(-18, y, 36, 4).fill(0x3e2418);
  ln(g.ellipse(0, -44, 18, 7).fill(0xa06a38), 2.5);
  gloss(g, -8, -30, 4, 10, 0.25);
  if (seed > 0.7) ln(g.roundRect(-4, -26, 8, 6, 2).fill(0xc0c6d4), 1.5); // a tap
  view.addChild(g);
  return { view };
}

export function woodStool(): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 12, 5);
  for (const x of [-7, 7]) g.moveTo(x, 0).lineTo(x * 0.6, -18).stroke({ width: 3.5, color: 0x5a381f });
  ln(g.ellipse(0, -20, 12, 6).fill(0xa06a38), 2.5);
  view.addChild(g);
  return { view };
}

export function woodTable(seed: number): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 40, 16);
  g.rect(-4, -30, 8, 30).fill(0x5a381f);
  ln(g.ellipse(0, -32, 40, 18).fill(0x8a5a33), 3);
  g.ellipse(0, -34, 30, 12).stroke({ width: 1.5, color: 0x5a381f, alpha: 0.6 });
  // Tankards and a candle
  for (const x of [-14, 12]) {
    ln(g.roundRect(x - 6, -50, 12, 14, 3).fill(0xc0c6d4), 2);
    g.ellipse(x, -50, 6, 2.5).fill(0xfff6e5);
  }
  ln(g.roundRect(-2, -54, 5, 14, 2).fill(0xfff6e5), 1.5);
  const flame = new Graphics();
  flame.circle(0.5, -58, 8).fill({ color: 0xffb347, alpha: 0.35 });
  flame.ellipse(0.5, -58, 2.5, 4).fill(0xffe27a);
  view.addChild(g, flame);
  return { view, update: (t) => (flame.alpha = 0.8 + Math.sin(t * 11 + seed * 9) * 0.2) };
}

export function pirateKeeper(): A.Thing {
  const a = A.avatar();
  a.setLook({ hat: 'hat-pirate', outfit: 'outfit-sailor', pet: 'pet-none' });
  return { view: a.view, update: (t) => a.pose(t, false, 0) };
}

export function hearth(): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 50, 18);
  A.isoBox(g, 1.3, 0.55, 92, 0x9d9476, 0xb0a789, 0x938a6d);
  // Firebox
  ln(g.roundRect(-30, -58, 46, 44, 16).fill(0x1d1426), 3);
  ln(g.roundRect(-44, -98, 78, 12, 4).fill(0x6b4428), 2.5); // mantel
  // Mantel decor: a bottle in a ship, a candle
  ln(g.roundRect(-34, -112, 22, 14, 6).fill(0xbfe9ff), 2);
  g.poly([-28, -100, -18, -100, -23, -110]).fill(0xffffff);
  ln(g.roundRect(14, -116, 6, 18, 2).fill(0xfff6e5), 1.5);
  const fire = new Graphics();
  const glow = new Graphics();
  glow.circle(-7, -30, 60).fill({ color: 0xff8a2a, alpha: 0.22 });
  glow.blendMode = 'add';
  view.addChild(glow, g, fire);
  return {
    view,
    update: (t) => {
      fire.clear();
      for (let i = 0; i < 4; i++) {
        const x = -20 + i * 9, h = 18 + Math.sin(t * 9 + i * 1.7) * 6 + (i % 2) * 6;
        fire.poly([x - 6, -16, x + 6, -16, x + 1, -16 - h]).fill(i % 2 ? 0xff8a2a : 0xffd23f);
      }
      fire.roundRect(-26, -18, 40, 6, 3).fill(0x3e2418);
      glow.alpha = 0.8 + Math.sin(t * 7) * 0.2;
    },
  };
}

export function lantern(seed: number): A.Thing {
  const view = new Container();
  const c = new Container();
  c.y = -250;
  const g = new Graphics();
  g.moveTo(0, -150).lineTo(0, -14).stroke({ width: 2, color: 0x3e2418 });
  ln(g.roundRect(-11, -14, 22, 28, 5).fill(0xffd27a), 2.5);
  g.rect(-11, -16, 22, 5).fill(0x3e2418);
  g.rect(-11, 12, 22, 5).fill(0x3e2418);
  const glow = new Graphics();
  glow.circle(0, 0, 40).fill({ color: 0xffb347, alpha: 0.25 });
  glow.blendMode = 'add';
  c.addChild(glow, g);
  view.addChild(c);
  return {
    view,
    update: (t) => {
      c.rotation = Math.sin(t * 0.9 + seed * 6) * 0.05;
      glow.alpha = 0.75 + Math.sin(t * 8 + seed * 9) * 0.25;
    },
  };
}

export function parrotPerch(): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 14, 6);
  ln(g.roundRect(-3, -80, 6, 80, 2).fill(0x8a5a33), 2.5);
  ln(g.roundRect(-20, -84, 40, 6, 3).fill(0xa06a38), 2.5);
  const bird = A.parrot();
  bird.view.position.set(4, -86);
  view.addChild(g, bird.view);
  return {
    view,
    update: (t) => {
      bird.flap.scale.y = Math.sin(t * 3) > 0.92 ? Math.sin(t * 22) : 0.2;
      bird.view.rotation = Math.sin(t * 0.8) * 0.06;
    },
  };
}

/** The tavern's walls: rum shelves behind the bar, the sign, a ship's wheel, portholes, crossed cutlasses, a map. */
export function tavernDecor(k: WallKit): (t: number) => void {
  // Rum shelves above the bar (left wall).
  const shelf = k.onLeft(23, 150);
  const bg = new Graphics();
  const span = 5 * HW;
  for (const sy of [36, 84]) {
    for (let i = 0; i < 9; i++) {
      const bx = 10 + i * (span - 20) / 8, h = 20 + ((i * 5) % 3) * 6;
      ln(bg.roundRect(bx - 6, sy - h, 12, h, 5).fill([0x7a3b1f, 0x2f7a3a, 0x8a5a33, 0x5a2a6e][(i + sy) % 4]), 2);
      bg.rect(bx - 2, sy - h - 6, 4, 6).fill(OUT);
    }
    ln(bg.roundRect(0, sy, span, 7, 3).fill(0x5a381f), 2.5);
  }
  shelf.addChild(bg);
  // The painted sign on the left wall.
  const signC = k.onLeft(27, 150);
  const sg = new Graphics();
  ln(sg.roundRect(0, 0, 4 * HW, 40, 10).fill(0x3e2418), 3);
  sg.roundRect(5, 5, 4 * HW - 10, 30, 7).stroke({ width: 2, color: 0xf2c14e });
  const st = text('THE RUSTY ANCHOR', 18, 0xffe27a);
  st.position.set(2 * HW, 20);
  signC.addChild(sg, st);
  // Portholes along the right wall, with the sea rocking in them.
  const seas: Graphics[] = [];
  for (const gx of [19, 22, 28]) {
    const p = k.onRight(gx, 150);
    const pg = new Graphics();
    ln(pg.circle(HW / 2, 22, 24).fill(0xc0c6d4), 3);
    pg.circle(HW / 2, 22, 18).fill(0x26a9d3);
    const sea = new Graphics();
    sea.rect(HW / 2 - 18, 22, 36, 18).fill(0x1b8cc2);
    const m = new Graphics();
    m.circle(HW / 2, 22, 18).fill(0xffffff);
    sea.mask = m;
    for (let a = 0; a < 6; a++) pg.circle(HW / 2 + Math.cos(a) * 21, 22 + Math.sin(a) * 21, 2).fill(0x8a8fa3);
    p.addChild(pg, sea, m);
    seas.push(sea);
  }
  // A ship's wheel and crossed cutlasses over the hearth area.
  const wheelC = k.onRight(25, 170);
  const wheel = new Container();
  const wg = new Graphics();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    wg.moveTo(0, 0).lineTo(Math.cos(a) * 34, Math.sin(a) * 34).stroke({ width: 5, color: OUT });
    wg.moveTo(0, 0).lineTo(Math.cos(a) * 34, Math.sin(a) * 34).stroke({ width: 3, color: 0xa06a38 });
  }
  ln(wg.circle(0, 0, 24).stroke({ width: 7, color: OUT }));
  wg.circle(0, 0, 24).stroke({ width: 4, color: 0x8a5a33 });
  ln(wg.circle(0, 0, 6).fill(0xf2c14e), 2);
  wheel.addChild(wg);
  wheel.position.set(HW / 2, 10);
  wheelC.addChild(wheel);
  const swords = k.onRight(17, 170);
  const sw = new Graphics();
  for (const d of [-1, 1]) {
    sw.moveTo(20 - d * 26, 30).lineTo(20 + d * 26, -20).stroke({ width: 5, color: OUT });
    sw.moveTo(20 - d * 26, 30).lineTo(20 + d * 26, -20).stroke({ width: 3, color: 0xdfe4ee });
    ln(sw.roundRect(20 - d * 26 - 6, 24, 12, 5, 2).fill(0xf2c14e), 1.5);
  }
  ln(sw.circle(20, 5, 10).fill(0x3e2418), 2);
  swords.addChild(sw);
  // A treasure map pinned on the left wall.
  const map = k.onLeft(19, 140);
  const mg = new Graphics();
  ln(mg.roundRect(0, 0, 70, 50, 4).fill(0xf8e2b0), 2.5);
  mg.moveTo(10, 38).quadraticCurveTo(30, 10, 54, 28).stroke({ width: 2, color: 0x8a5a33, alpha: 0.8 });
  mg.moveTo(50, 22).lineTo(58, 32).moveTo(58, 22).lineTo(50, 32).stroke({ width: 3, color: 0xd6203f });
  map.addChild(mg);
  return (t) => {
    seas.forEach((s, i) => (s.y = Math.sin(t * 1.3 + i) * 4));
    wheel.rotation = Math.sin(t * 0.4) * 0.3;
  };
}

// ── The VIP Salon ───────────────────────────────────────────────────────

export function piano(): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 56, 22);
  for (const [x, y] of [[-30, -2], [26, -10], [0, 12]]) g.rect(x - 3, y - 26, 6, 26).fill(OUT);
  // Body: a rounded grand shape, lid propped open
  ln(g.poly([-50, -30, 30, -60, 54, -40, 40, -14, -10, 6, -50, -6]).fill(0x1d1426), 3);
  ln(g.poly([30, -60, 54, -40, 20, -110]).fill(0x2c1d3f), 3);
  g.moveTo(30, -60).lineTo(20, -110).stroke({ width: 2, color: 0xf2c14e });
  // Keys
  ln(g.poly([-50, -30, -10, -14, -10, -6, -50, -22]).fill(0xfff6e5), 2);
  for (let i = 0; i < 6; i++) g.moveTo(-46 + i * 6.5, -27 + i * 2.6).lineTo(-46 + i * 6.5, -20 + i * 2.6).stroke({ width: 2.5, color: OUT });
  gloss(g, 10, -40, 18, 5, 0.25);
  const notes = new Container();
  const ns: Text[] = [];
  for (let i = 0; i < 3; i++) {
    const n = text(i % 2 ? '♫' : '♪', 18, 0xffe27a);
    notes.addChild(n);
    ns.push(n);
  }
  view.addChild(g, notes);
  return {
    view,
    update: (t) => ns.forEach((n, i) => {
      const k = (t * 0.4 + i / 3) % 1;
      n.position.set(-20 + Math.sin(k * 6 + i) * 14, -50 - k * 90);
      n.alpha = Math.sin(k * Math.PI);
    }),
  };
}

export function champagneTower(): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 36, 14);
  ln(g.ellipse(0, -10, 32, 12).fill(0xf2c14e), 2.5);
  g.rect(-4, -24, 8, 14).fill(0xf2c14e);
  ln(g.ellipse(0, -26, 34, 12).fill(0xf6efe6), 2.5);
  // A pyramid of glasses, 4-3-2-1
  const rows = [4, 3, 2, 1];
  rows.forEach((n, r) => {
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * 15, y = -34 - r * 17;
      g.poly([x - 7, y - 14, x + 7, y - 14, x + 2, y - 3, x - 2, y - 3]).fill({ color: 0xffe27a, alpha: 0.9 });
      g.poly([x - 7, y - 14, x + 7, y - 14, x + 2, y - 3, x - 2, y - 3]).stroke({ width: 1.5, color: OUT });
      g.moveTo(x, y - 3).lineTo(x, y).stroke({ width: 1.5, color: OUT });
    }
  });
  const bubbles = new Graphics();
  view.addChild(g, bubbles);
  return {
    view,
    update: (t) => {
      bubbles.clear();
      for (let i = 0; i < 10; i++) {
        const k = (t * 0.5 + i * 0.37) % 1;
        bubbles.circle(Math.sin(i * 3.1) * 24, -40 - k * 70, 1.6).fill({ color: 0xffffff, alpha: 1 - k });
      }
    },
  };
}

/** The VIP Salon's walls: a night window over the island, neon, gold-framed portraits. */
export function vipDecor(k: WallKit): (t: number) => void {
  // The big window on the right wall: night sky, moon, the island's silhouette with the volcano glowing.
  const win = k.onRight(18, 186);
  const ww = 9 * HW, wh = 120;
  const frame = new Graphics();
  ln(frame.roundRect(-8, -8, ww + 16, wh + 16, 12).fill(0xf2c14e), 4);
  const sky = new Graphics();
  sky.roundRect(0, 0, ww, wh, 6).fill(0x1a1440);
  sky.rect(0, wh * 0.55, ww, wh * 0.45).fill(0x15304f);
  sky.circle(ww * 0.8, 28, 16).fill(0xfff6c2);
  sky.circle(ww * 0.8 + 6, 24, 14).fill(0x1a1440);
  // Island silhouette, volcano, palm
  sky.poly([ww * 0.1, wh * 0.62, ww * 0.25, wh * 0.48, ww * 0.38, wh * 0.52, ww * 0.5, wh * 0.3, ww * 0.6, wh * 0.52, ww * 0.82, wh * 0.6, ww * 0.9, wh * 0.66, ww * 0.1, wh * 0.66]).fill(0x0d0a22);
  const lava = new Graphics();
  lava.circle(ww * 0.5, wh * 0.3, 14).fill({ color: 0xff5a1f, alpha: 0.5 });
  lava.circle(ww * 0.5, wh * 0.3, 5).fill(0xff8a2a);
  const stars = new Graphics();
  const pts: [number, number][] = [];
  for (let i = 0; i < 26; i++) pts.push([((i * 73) % 97) / 97 * ww, ((i * 41) % 53) / 53 * wh * 0.45]);
  const shimmer = new Graphics();
  for (let i = 0; i < 6; i++) shimmer.rect(ww * 0.15 + i * ww * 0.12, wh * 0.75 + (i % 2) * 10, 30, 2).fill({ color: 0xfff6c2, alpha: 0.4 });
  // Mullions
  const mull = new Graphics();
  for (let i = 1; i < 3; i++) mull.rect((ww / 3) * i - 3, 0, 6, wh).fill(0xf2c14e);
  mull.rect(0, wh / 2 - 3, ww, 6).fill(0xf2c14e);
  win.addChild(frame, sky, lava, stars, shimmer, mull);

  // Neon on the left wall.
  const ns = k.onLeft(26, 160);
  const nt = neon('VIP SALON', 32, 0xff4fb0);
  nt.position.set(4, 0);
  ns.addChild(nt);
  const hr = k.onLeft(21, 106);
  const ht = neon('♦ HIGH ROLLERS ♦', 20, 0x4fc3ff);
  hr.addChild(ht);
  // Gold-framed portraits on the left wall: Polly and the volcano.
  for (const [gy, kind] of [[30, 'parrot'], [17, 'volcano']] as const) {
    const p = k.onLeft(gy, 150);
    const pg = new Graphics();
    ln(pg.roundRect(0, 0, 54, 64, 6).fill(0xf2c14e), 3);
    pg.roundRect(6, 6, 42, 52, 4).fill(kind === 'parrot' ? 0x2fc36f : 0x4b3f40);
    if (kind === 'parrot') {
      ln(pg.circle(27, 28, 12).fill(0xff3b4e), 2);
      pg.poly([35, 26, 44, 30, 35, 33]).fill(0xffd23f);
      pg.circle(30, 25, 2).fill(OUT);
    } else {
      pg.poly([10, 54, 27, 22, 44, 54]).fill(0x7b6868);
      pg.circle(27, 22, 6).fill(0xff5a1f);
    }
    p.addChild(pg);
  }
  return (t) => {
    stars.clear();
    pts.forEach(([x, y], i) => stars.circle(x, y, 1.4).fill({ color: 0xffffff, alpha: 0.4 + Math.max(0, Math.sin(t * 2 + i * 1.7)) * 0.6 }));
    lava.alpha = 0.7 + Math.sin(t * 2.2) * 0.3;
    shimmer.x = Math.sin(t * 0.8) * 6;
    nt.alpha = Math.sin(t * 6) > -0.92 ? 1 : 0.35;
  };
}

// ── Doorways between rooms ──────────────────────────────────────────────

/** Gold stairs up to the VIP Salon, against the casino's back wall. */
export function stairsUp(): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 56, 22);
  for (let s = 0; s < 6; s++) {
    const y = -s * 18, w = 50 - s * 2;
    ln(g.poly([-w, y - 10 - s * 6, 0, y + 14 - s * 6, w, y - 10 - s * 6, 0, y - 34 - s * 6]).fill(s % 2 ? 0xb03a8c : 0xc0479c), 2.5);
    g.poly([-w, y - 10 - s * 6, 0, y + 14 - s * 6, 0, y + 20 - s * 6, -w, y - 4 - s * 6]).fill(0xf2c14e);
  }
  // Gold banisters
  for (const d of [-1, 1]) {
    g.moveTo(d * 52, -6).lineTo(d * 42, -150).stroke({ width: 5, color: OUT });
    g.moveTo(d * 52, -6).lineTo(d * 42, -150).stroke({ width: 3, color: 0xf2c14e });
    ln(g.circle(d * 52, -10, 6).fill(0xf6cf5e), 2);
  }
  const sign = neon('VIP ↑', 20, 0xff4fb0);
  sign.anchor.set(0.5);
  sign.position.set(0, -188);
  const glow = new Graphics();
  glow.ellipse(0, -150, 70, 26).fill({ color: 0xff9bd8, alpha: 0.25 });
  glow.blendMode = 'add';
  view.addChild(glow, g, sign);
  return { view, update: (t) => { glow.alpha = 0.6 + Math.sin(t * 2) * 0.4; sign.alpha = Math.sin(t * 5) > -0.9 ? 1 : 0.4; } };
}

/** The VIP Salon's way down: a gold balustrade and the top of the stairs on the front edge. */
export function stairsDown(): A.Thing {
  const view = new Container();
  const g = new Graphics();
  for (let s = 0; s < 3; s++) {
    const y = s * 10;
    ln(g.poly([-44 + s * 4, y, 0, y + 22, 44 - s * 4, y, 0, y - 22]).fill(s % 2 ? 0xb03a8c : 0xc0479c), 2);
  }
  for (const d of [-1, 1]) {
    for (let i = 0; i < 4; i++) ln(g.roundRect(d * (30 + i * 6) - 2, -40 + i * 8, 4, 34, 2).fill(0xf2c14e), 1.5);
    ln(g.roundRect(d * 30 - (d < 0 ? 22 : 0), -46, 22, 6, 3).fill(0xf6cf5e), 2);
  }
  const t = A.label('DOWN ↓', 14, 0xffe27a);
  t.position.set(0, -62);
  view.addChild(g, t);
  return { view };
}

/** The tavern's way out: a wooden door frame on the front edge, daylight behind it. */
export function tavernExit(): A.Thing {
  const view = new Container();
  const glow = new Graphics();
  glow.ellipse(0, 6, 56, 20).fill({ color: 0xfff3b0, alpha: 0.35 });
  const a = new Graphics();
  ln(a.roundRect(-40, -118, 80, 118, 12).fill(0x5a381f), 3.5);
  a.roundRect(-30, -108, 60, 108, 8).fill(0xfff6d6);
  a.roundRect(-30, -108, 60, 108, 8).fill({ color: 0x9ad8ff, alpha: 0.35 });
  ln(a.roundRect(-34, -140, 68, 22, 6).fill(0x3e2418), 3);
  const t = text('HARBOUR', 14, 0xffe27a);
  t.position.set(0, -129);
  view.addChild(glow, a, t);
  return { view, update: (tt) => (glow.alpha = 0.7 + Math.sin(tt * 2.5) * 0.3) };
}

// ── Playable tables and machines ────────────────────────────────────────

/** An Island Reels machine: taller than the decor slots, with a marquee; golden in the VIP Salon. */
export function reelsMachine(seed: number, gold = false): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 34, 13);
  const [body, side] = gold ? [0xf2c14e, 0xc99a2e] : [0x14b8c4, 0x0e8f99];
  A.isoBox(g, 0.7, 0.55, 96, gold ? 0xfff3b0 : 0xf2c14e, body, side);
  ln(g.roundRect(-30, -84, 40, 28, 6).fill(0x1a0f24), 2.5);
  const reels: Text[] = [];
  const syms = ['🐚', '🥥', '7'];
  for (let i = 0; i < 3; i++) {
    g.roundRect(-28 + i * 12.5, -81, 11, 22, 2).fill(0xfffdf2);
    const t = text(syms[(i + Math.floor(seed * 3)) % 3], 11, i === 2 ? 0xff3b4e : OUT);
    t.position.set(-22.5 + i * 12.5, -70);
    reels.push(t);
  }
  g.moveTo(16, -66).lineTo(26, -94).stroke({ width: 3, color: 0xc0c6d4 });
  ln(g.circle(26, -96, 5.5).fill(0xff3b4e), 2);
  // Marquee
  ln(g.roundRect(-34, -128, 54, 22, 8).fill(gold ? 0x2c1d3f : 0xff4fb0), 2.5);
  const m = text(gold ? 'GOLD' : 'REELS', 11, 0xfff3b0);
  m.position.set(-7, -117);
  gloss(g, -20, -100, 8, 3, 0.4);
  const bulbs: Graphics[] = [];
  for (let i = 0; i < 6; i++) {
    const b = new Graphics();
    b.circle(-30 + i * 9.2, -131, 2.6).fill(0xfff6c2);
    bulbs.push(b);
  }
  view.addChild(g, ...reels, m, ...bulbs);
  return {
    view,
    update: (t) => {
      bulbs.forEach((b, i) => (b.alpha = (Math.floor(t * 5 + seed * 7) + i) % 2 ? 1 : 0.3));
      reels.forEach((r, i) => (r.y = -70 + (Math.sin(t * 0.7 + i + seed * 9) > 0.97 ? Math.sin(t * 40) * 2 : 0)));
    },
  };
}

/** A Dragon Tiger table: a half-moon of felt with the two card boxes, a dealer's shoe and chips. */
export function dragonTigerTable(gold = false): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 62, 24);
  g.rect(-4, -30, 8, 30).fill(0x6b4428);
  ln(g.ellipse(0, -32, 60, 27).fill(gold ? 0xf2c14e : 0x6b4428), 3);
  g.ellipse(0, -35, 51, 21).fill(0x8a1f2d);
  // Dragon (red) and Tiger (blue) boxes, the tie strip
  ln(g.roundRect(-36, -46, 26, 16, 4).fill(0xd6203f), 1.5);
  ln(g.roundRect(10, -46, 26, 16, 4).fill(0x2a6fd0), 1.5);
  g.roundRect(-10, -30, 20, 8, 3).fill(0x2fc36f);
  // Cards
  for (const x of [-23, 23]) ln(g.roundRect(x - 5, -44, 10, 13, 2).fill(0xffffff), 1.2);
  // Shoe and chip stacks
  ln(g.roundRect(-8, -60, 16, 10, 3).fill(0x1d1426), 2);
  for (const [x, c] of [[44, 0xffd23f], [-44, 0xff4f5e]] as const) for (let k = 0; k < 3; k++) ln(g.ellipse(x, -36 - k * 3, 6, 3).fill(c), 1.5);
  view.addChild(g);
  const sign = text('龍 DRAGON · TIGER 虎', 11, 0xffe27a);
  sign.position.set(0, -70);
  view.addChild(sign);
  return { view };
}

/** A Pirate Dice table: a barrel-top table with a dice cup, three dice and the six-face board. */
export function diceTable(seed: number): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 48, 19);
  ln(g.roundRect(-14, -34, 28, 34, 10).fill(0x8a5a33), 3);
  for (const y of [-28, -10]) g.rect(-14, y, 28, 3).fill(0x3e2418);
  ln(g.ellipse(0, -36, 48, 21).fill(0xa06a38), 3);
  g.ellipse(0, -38, 40, 16).fill(0x2f7a3a);
  // The face board: 6 squares
  const faces = ['⚓', '☠', '🦜', '⛵', '💰', '🧭'];
  for (let i = 0; i < 6; i++) {
    const x = -26 + (i % 3) * 13, y = -44 + Math.floor(i / 3) * 10;
    g.roundRect(x - 6, y - 4, 12, 9, 2).fill({ color: 0xfff6e5, alpha: 0.9 });
  }
  const icons: Text[] = faces.map((f, i) => {
    const t = text(f, 7, OUT);
    t.position.set(-26 + (i % 3) * 13, -44 + Math.floor(i / 3) * 10 + 0.5);
    return t;
  });
  // Dice cup and dice
  ln(g.poly([16, -40, 34, -40, 31, -64, 19, -64]).fill(0x5a381f), 2.5);
  g.ellipse(25, -64, 6, 2.5).fill(0x3e2418);
  const dice = new Graphics();
  for (const [x, y] of [[14, -34], [26, -30], [36, -36]]) {
    ln(dice.roundRect(x - 4, y - 4, 8, 8, 2).fill(0xfff6e5), 1.5);
    dice.circle(x, y, 1.2).fill(OUT);
  }
  view.addChild(g, ...icons, dice);
  return { view, update: (t) => (dice.y = Math.sin(t * 2 + seed * 9) > 0.98 ? -2 : 0) };
}

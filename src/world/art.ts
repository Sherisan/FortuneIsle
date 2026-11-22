import { Container, Graphics, Text } from 'pixi.js';
import type { GameKey } from '../api/types.ts';
import { TH, TW } from './map.ts';

/*
 * All of Fortune Isle's art is drawn here with Pixi Graphics: chunky rounded shapes, a dark plum outline and a white
 * gloss highlight on everything (modern mobile cartoon, never pixel art). No image files to download.
 * Every builder returns a Thing: a container whose (0, 0) is the object's foot on the ground, plus an optional
 * per-frame update for ambient motion (swaying palms, bobbing boats, twinkling lights).
 */

export const OUT = 0x2c1d3f;
const W = 3; // outline width
export interface Thing {
  view: Container;
  update?: (t: number) => void;
  /** A tap/interaction: the thing plays its little show (balloons pop, a boat sails off, the gem flares). It returns a
   *  secret's id when the tap reveals one (the third tap on the yeti's pine, the fifth on the moon…). */
  poke?: (t: number) => unknown;
  /** Where a palm's crown is (for the falling coconut). */
  top?: { x: number; y: number };
}

export interface FerrisThing extends Thing {
  setSpeed(radPerSec: number): void;
  rot(): number;
  cabins: Container[];
  R: number;
  H: number;
}

const HW = TW / 2, HH = TH / 2;

const ln = (g: Graphics, w = W, color = OUT) => g.stroke({ width: w, color, join: 'round', cap: 'round' });
const shadow = (g: Graphics, rx: number, ry: number, x = 0, y = 0) => g.ellipse(x, y, rx, ry).fill({ color: 0x1b1030, alpha: 0.22 });
const gloss = (g: Graphics, x: number, y: number, rx: number, ry: number, a = 0.45) => g.ellipse(x, y, rx, ry).fill({ color: 0xffffff, alpha: a });

export function label(text: string, size = 16, color = 0xffffff, stroke = OUT): Text {
  const t = new Text({
    text,
    style: { fontFamily: 'Fredoka', fontWeight: '700', fontSize: size, fill: color, stroke: { color: stroke, width: Math.max(3, size / 4), join: 'round' }, align: 'center' },
  });
  t.resolution = 2;
  t.anchor.set(0.5);
  return t;
}

/** Iso box footprint corners for a box a tiles (gx) × b tiles (gy), centred on (0, 0). */
function corners(a: number, b: number) {
  return {
    n: [(-a / 2 + b / 2) * HW, (-a / 2 - b / 2) * HH],
    e: [(a / 2 + b / 2) * HW, (a / 2 - b / 2) * HH],
    s: [(a / 2 - b / 2) * HW, (a / 2 + b / 2) * HH],
    w: [(-a / 2 - b / 2) * HW, (-a / 2 + b / 2) * HH],
  };
}

/** A box standing on the ground: left face, right face, top. y0 lifts the whole box. */
export function isoBox(g: Graphics, a: number, b: number, h: number, top: number, left: number, right: number, y0 = 0) {
  const { n, e, s, w } = corners(a, b);
  const up = (p: number[], dy: number) => [p[0], p[1] - dy - y0];
  const L = [w, s, up(s, h), up(w, h)].map((p, i) => (i < 2 ? up(p, 0) : p)).flat();
  const R = [s, e, up(e, h), up(s, h)].map((p, i) => (i < 2 ? up(p, 0) : p)).flat();
  const T = [up(n, h), up(e, h), up(s, h), up(w, h)].flat();
  ln(g.poly(L).fill(left));
  ln(g.poly(R).fill(right));
  ln(g.poly(T).fill(top));
  return { n: up(n, h), e: up(e, h), s: up(s, h), w: up(w, h) };
}

function leaf(g: Graphics, len: number, angle: number, droop: number, width: number, color: number) {
  const ex = Math.cos(angle) * len, ey = Math.sin(angle) * len * 0.6 + droop;
  const px = -Math.sin(angle) * width, py = Math.cos(angle) * width * 0.6;
  g.moveTo(0, 0)
    .quadraticCurveTo(ex * 0.5 + px, ey * 0.5 + py - droop * 0.3, ex, ey)
    .quadraticCurveTo(ex * 0.5 - px, ey * 0.5 - py - droop * 0.3, 0, 0)
    .fill(color);
  ln(g, 2.5);
  g.moveTo(0, 0).quadraticCurveTo(ex * 0.5, ey * 0.5 - droop * 0.3, ex, ey).stroke({ width: 1.5, color: 0x1f6e33, alpha: 0.6 });
}

// ── Nature ──────────────────────────────────────────────────────────────

export function palm(seed: number): Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 30, 11, 6, 2);
  const h = 82 + seed * 34;
  const lean = (seed - 0.5) * 40;
  const segs = 7;
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs, t1 = (i + 1) / segs;
    const x0 = lean * t0 * t0, x1 = lean * t1 * t1;
    const w0 = 8 - t0 * 3, w1 = 8 - t1 * 3;
    ln(g.poly([x0 - w0, -h * t0, x0 + w0, -h * t0, x1 + w1, -h * t1 - 2, x1 - w1, -h * t1 - 2]).fill(i % 2 ? 0xb07a45 : 0x9c6a3b), 2.5);
  }
  view.addChild(g);
  const top = new Container();
  top.position.set(lean, -h);
  const f = new Graphics();
  const greens = [0x3fbf5a, 0x34ad4f, 0x4ccc63];
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + seed;
    leaf(f, 52 + (k % 2) * 10, a, 16, 11, greens[k % 3]);
  }
  for (const [x, y] of [[-6, 4], [5, 5], [0, -1]]) ln(f.circle(x, y, 6).fill(0x7a4a22), 2.5);
  gloss(f, -3, 2, 3, 2, 0.5);
  top.addChild(f);
  view.addChild(top);
  // Poked: the crown shakes hard for a moment (the engine drops the coconut).
  let shook = -100;
  return {
    view,
    top: { x: lean, y: -h },
    update: (t) => {
      const k = t - shook;
      top.rotation = Math.sin(t * 1.1 + seed * 12) * 0.07 + (k < 0.8 ? Math.sin(k * 40) * 0.12 * (1 - k / 0.8) : 0);
    },
    poke: (t) => (shook = t),
  };
}

export function jungleTree(seed: number): Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 38, 14);
  ln(g.poly([-9, 0, 9, 0, 6, -50, -6, -50]).fill(0x6b4428));
  const s = 0.9 + seed * 0.35;
  const blobs: [number, number, number, number][] = [[-22, -62, 24, 0x2f8a3e], [20, -64, 24, 0x2f8a3e], [0, -82, 28, 0x37994a], [-12, -96, 20, 0x3fa653], [14, -94, 20, 0x3fa653]];
  for (const [x, y, r, c] of blobs) ln(g.circle(x * s, y * s, r * s).fill(c));
  gloss(g, -8 * s, -100 * s, 9 * s, 5 * s, 0.35);
  // Vines
  g.moveTo(-18 * s, -50 * s).quadraticCurveTo(-24 * s, -30 * s, -16 * s, -18 * s).stroke({ width: 3, color: 0x2b7a35 });
  view.addChild(g);
  return { view, update: (t) => (view.skew.x = Math.sin(t * 0.8 + seed * 9) * 0.02) };
}

export function tree(seed: number): Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 28, 10);
  ln(g.poly([-7, 0, 7, 0, 5, -36, -5, -36]).fill(0x8a5a33));
  ln(g.circle(0, -60, 30).fill(0x6fcf55));
  ln(g.circle(-16, -46, 16).fill(0x62c24b));
  ln(g.circle(16, -48, 16).fill(0x62c24b));
  gloss(g, -8, -74, 11, 6, 0.45);
  for (let i = 0; i < 4; i++) g.circle(-14 + i * 10, -55 + (i % 2) * 12, 3.5).fill(seed > 0.5 ? 0xff5b6e : 0xffd23f);
  view.addChild(g);
  return { view };
}

export function bush(seed: number, hedge = false): Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 24, 9);
  if (hedge) {
    isoBox(g, 0.8, 0.8, 26, 0x4fb04a, 0x3c9a3a, 0x358934);
    gloss(g, -6, -36, 8, 4, 0.3);
  } else {
    ln(g.circle(-10, -12, 13).fill(0x4fb85a));
    ln(g.circle(10, -12, 13).fill(0x4fb85a));
    ln(g.circle(0, -22, 15).fill(0x5cc766));
    gloss(g, -4, -28, 6, 3, 0.4);
    if (seed > 0.5) for (const [x, y] of [[-8, -16], [6, -24], [12, -10]]) g.circle(x, y, 3).fill(0xff6fa5);
  }
  view.addChild(g);
  return { view };
}

export function flowers(seed: number): Thing {
  const view = new Container();
  const g = new Graphics();
  const cols = [0xff6fa5, 0xffd23f, 0xffffff, 0xff8a3d, 0xb07cff];
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * 12 + (seed - 0.5) * 8, y = ((i * 7) % 5) - 2;
    g.moveTo(x, y).lineTo(x, y - 10).stroke({ width: 2, color: 0x2f8a3e });
    const c = cols[Math.floor(seed * 10 + i) % cols.length];
    for (let k = 0; k < 5; k++) g.circle(x + Math.cos((k / 5) * 6.28) * 4, y - 12 + Math.sin((k / 5) * 6.28) * 3, 3.2).fill(c);
    g.circle(x, y - 12, 2.2).fill(0xffb02e);
  }
  view.addChild(g);
  return { view };
}

export function shell(seed: number): Thing {
  const view = new Container();
  const g = new Graphics();
  ln(g.ellipse(0, -3, 9, 6).fill(seed > 0.5 ? 0xffb3c7 : 0xfff0d6), 2);
  for (let i = -1; i <= 1; i++) g.moveTo(i * 4, -8).lineTo(i * 2, 1).stroke({ width: 1.5, color: OUT, alpha: 0.5 });
  view.addChild(g);
  return { view };
}

export function fern(seed: number): Thing {
  const view = new Container();
  const g = new Graphics();
  for (let k = 0; k < 5; k++) leaf(g, 26, -Math.PI / 2 + (k - 2) * 0.55, 6, 6, k % 2 ? 0x2f9e45 : 0x3aae52);
  view.addChild(g);
  return { view, update: (t) => (view.rotation = Math.sin(t * 1.5 + seed * 7) * 0.04) };
}

export function pillar(seed: number): Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 20, 8);
  const h = 34 + seed * 30;
  ln(g.roundRect(-12, -h, 24, h, 4).fill(0xc9c0a0));
  g.rect(-12, -h, 7, h).fill({ color: 0xffffff, alpha: 0.2 });
  ln(g.poly([-14, -h, 14, -h, 10, -h - 8, -4, -h - 4]).fill(0xb3aa8a));
  g.moveTo(-10, -h + 6).quadraticCurveTo(4, -h / 2, -6, -4).stroke({ width: 3, color: 0x2f8a3e });
  for (const y of [-h + 10, -h / 2, -10]) g.circle(-4, y, 4).fill(0x3aae52);
  view.addChild(g);
  return { view };
}

export function boulder(seed: number): Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 26, 9);
  const s = 0.8 + seed * 0.5;
  ln(g.poly([-24 * s, 0, -20 * s, -18 * s, -6 * s, -28 * s, 14 * s, -24 * s, 24 * s, -8 * s, 18 * s, 2]).fill(0x5d4c4d));
  ln(g.poly([-6 * s, -28 * s, 14 * s, -24 * s, 24 * s, -8 * s, 4 * s, -10 * s]).fill(0x6e5c5d));
  gloss(g, -8 * s, -20 * s, 6 * s, 3 * s, 0.25);
  view.addChild(g);
  return { view };
}

export function deadTree(seed: number): Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 18, 7);
  const c = 0x3b2b2a;
  g.moveTo(0, 0).lineTo(2, -46).stroke({ width: 8, color: c, cap: 'round' });
  g.moveTo(1, -26).lineTo(-16, -40).stroke({ width: 5, color: c, cap: 'round' });
  g.moveTo(2, -36).lineTo(18, -52 - seed * 8).stroke({ width: 4, color: c, cap: 'round' });
  g.moveTo(2, -46).lineTo(-4, -60).stroke({ width: 3, color: c, cap: 'round' });
  view.addChild(g);
  return { view };
}

export function lavaPool(seed: number): Thing {
  const view = new Container();
  const g = new Graphics();
  ln(g.ellipse(0, 0, 34, 15).fill(0x3d2f30));
  const glow = new Graphics();
  glow.ellipse(0, 0, 28, 11).fill(0xff5a1f);
  glow.ellipse(-4, -1, 18, 6).fill(0xffa63d);
  glow.ellipse(-8, -3, 6, 2).fill(0xfff1a8);
  view.addChild(g, glow);
  return { view, update: (t) => (glow.alpha = 0.8 + Math.sin(t * 2.4 + seed * 10) * 0.2) };
}

function smoke(view: Container, x: number, y: number, n: number, scale: number, seed: number, color = 0x8a7e86) {
  const puffs: Graphics[] = [];
  for (let i = 0; i < n; i++) {
    const p = new Graphics();
    p.circle(0, 0, 10 * scale).fill({ color, alpha: 0.55 });
    p.circle(6 * scale, -4 * scale, 7 * scale).fill({ color: 0xffffff, alpha: 0.15 });
    view.addChild(p);
    puffs.push(p);
  }
  return (t: number) =>
    puffs.forEach((p, i) => {
      const k = (t * 0.25 + i / n + seed) % 1;
      p.position.set(x + Math.sin(k * 6 + i) * 10 * scale, y - k * 90 * scale);
      p.scale.set(0.5 + k * 1.6);
      p.alpha = Math.sin(k * Math.PI) * 0.9;
    });
}

export function vent(seed: number): Thing {
  const view = new Container();
  const g = new Graphics();
  ln(g.ellipse(0, 0, 12, 5).fill(0x2a2122), 2);
  g.ellipse(0, 0, 6, 2).fill(0xff7a2a);
  view.addChild(g);
  const upd = smoke(view, 0, -4, 3, 0.6, seed);
  return { view, update: upd };
}

export function balloons(seed: number): Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 10, 4);
  const top = new Container();
  const b = new Graphics();
  const cols = [0xff5b6e, 0xffd23f, 0x4fc3ff];
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 14, y = -70 - (i % 2) * 12;
    g.moveTo(0, 0).lineTo(x, y + 14).stroke({ width: 1.5, color: OUT });
    ln(b.ellipse(x, y, 12, 15).fill(cols[(i + Math.floor(seed * 3)) % 3]), 2.5);
    gloss(b, x - 4, y - 6, 3, 5, 0.6);
  }
  top.addChild(b);
  view.addChild(g, top);
  // Poked: the bunch slips its string and floats away; a fresh bunch is tied on 12 s later.
  let gone = -100;
  return {
    view,
    update: (t) => {
      const k = t - gone;
      if (k < 12) {
        top.y = -k * 120;
        top.x = Math.sin(k * 2) * 12;
        top.alpha = Math.max(0, 1 - k / 3);
      } else {
        top.alpha = Math.min(1, k - 12);
        top.x = 0;
        top.y = Math.sin(t * 1.6 + seed * 8) * 3;
      }
    },
    poke: (t) => {
      if (t - gone > 12) gone = t;
    },
  };
}

export function lamp(seed: number, torch = false): Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 12, 5);
  const glow = new Graphics();
  if (torch) {
    ln(g.poly([-4, 0, 4, 0, 3, -52, -3, -52]).fill(0x8a5a33), 2.5);
    ln(g.poly([-9, -52, 9, -52, 6, -64, -6, -64]).fill(0x6b4428), 2.5);
    glow.circle(0, -72, 16).fill({ color: 0xffb347, alpha: 0.25 });
    glow.poly([-7, -64, 7, -64, 0, -86]).fill(0xff8a2a);
    glow.poly([-4, -64, 4, -64, 0, -78]).fill(0xffe27a);
  } else {
    ln(g.roundRect(-3.5, -64, 7, 64, 3).fill(0x3d2d5c), 2.5);
    ln(g.roundRect(-9, -4, 18, 6, 3).fill(0x3d2d5c), 2.5);
    glow.circle(0, -72, 22).fill({ color: 0xffe27a, alpha: 0.22 });
    glow.circle(0, -72, 9).fill(0xfff3b0);
    ln(glow.circle(0, -72, 9), 2.5);
  }
  view.addChild(g, glow);
  return { view, update: (t) => (glow.alpha = torch ? 0.85 + Math.sin(t * 13 + seed * 20) * 0.15 : 0.8 + Math.sin(t * 3 + seed * 20) * 0.2) };
}

export function boat(seed: number): Thing {
  const view = new Container();
  const body = new Container();
  const g = new Graphics();
  g.ellipse(0, 4, 40, 10).fill({ color: 0xffffff, alpha: 0.25 });
  ln(g.poly([-38, -10, 38, -10, 26, 6, -26, 6]).fill(seed > 0.5 ? 0xff6b5b : 0x4fa3ff));
  g.rect(-34, -10, 68, 5).fill({ color: 0xffffff, alpha: 0.5 });
  g.moveTo(0, -10).lineTo(0, -78).stroke({ width: 4, color: 0x6b4428 });
  ln(g.poly([3, -74, 3, -18, 34, -22]).fill(0xfffaf0));
  ln(g.poly([-3, -64, -3, -20, -24, -22]).fill(0xfff0d6));
  g.poly([3, -76, 18, -70, 3, -66]).fill(0xffd23f);
  body.addChild(g);
  const wake = new Graphics();
  wake.ellipse(0, 6, 54, 12).fill({ color: 0xffffff, alpha: 0.45 });
  wake.alpha = 0;
  view.addChild(wake, body);
  // Poked: a lap around its mooring (an ellipse out to sea and back, 7 s) with a white wake.
  let sail = -100;
  return {
    view,
    update: (t) => {
      const k = (t - sail) / 7;
      const lap = k >= 0 && k < 1 ? Math.sin(k * Math.PI) : 0;
      const a = k * Math.PI * 2;
      body.x = lap ? Math.sin(a) * 150 : 0;
      body.y = (lap ? (1 - Math.cos(a)) * 60 : 0) + Math.sin(t * 1.3 + seed * 9) * 3;
      body.scale.x = lap && Math.cos(a) < 0 ? -1 : 1;
      body.rotation = Math.sin(t * 1.1 + seed * 5) * (lap ? 0.09 : 0.04);
      wake.position.set(body.x, body.y);
      wake.alpha = lap * 0.9;
    },
    poke: (t) => {
      if (t - sail > 7) sail = t;
    },
  };
}

export function seaRock(seed: number): Thing {
  const view = new Container();
  const g = new Graphics();
  const foam = new Graphics();
  foam.ellipse(0, 0, 30, 11).fill({ color: 0xffffff, alpha: 0.55 });
  ln(g.poly([-20, 2, -14, -14, 2, -22, 18, -12, 22, 2]).fill(0x7f8a99));
  gloss(g, -4, -14, 6, 3, 0.35);
  view.addChild(foam, g);
  return { view, update: (t) => foam.scale.set(1 + Math.sin(t * 2 + seed * 10) * 0.08) };
}

export function post(): Thing {
  const view = new Container();
  const g = new Graphics();
  ln(g.roundRect(-5, -26, 10, 34, 4).fill(0x8a5a33), 2.5);
  g.ellipse(0, 8, 9, 3).fill({ color: 0xffffff, alpha: 0.4 });
  view.addChild(g);
  return { view };
}

// ── Landmarks ───────────────────────────────────────────────────────────

export function lighthouse(): Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 56, 20);
  ln(g.ellipse(0, 0, 44, 18).fill(0x9a9fae));
  for (let i = 0; i < 6; i++) {
    const y0 = -i * 30, y1 = -(i + 1) * 30;
    const w0 = 30 - i * 2.5, w1 = 30 - (i + 1) * 2.5;
    ln(g.poly([-w0, y0, w0, y0, w1, y1, -w1, y1]).fill(i % 2 ? 0xffffff : 0xff4f5e));
  }
  g.rect(-24, -180, 10, 175).fill({ color: 0xffffff, alpha: 0.25 });
  ln(g.roundRect(-24, -192, 48, 14, 4).fill(0x3d2d5c));
  ln(g.roundRect(-16, -222, 32, 32, 6).fill(0xfff3b0));
  ln(g.poly([-22, -222, 22, -222, 0, -246]).fill(0xff4f5e));
  const glow = new Graphics();
  glow.circle(0, 0, 34).fill({ color: 0xfff6c2, alpha: 0.35 });
  glow.circle(0, 0, 20).fill({ color: 0xffffff, alpha: 0.5 });
  glow.position.set(0, -206);
  view.addChild(g, glow);
  // Poked (the beacon is lit): the lamp blazes for 14 s.
  let lit = -100;
  return {
    view,
    update: (t) => {
      const on = t - lit < 14;
      glow.alpha = on ? 1 : 0.55 + Math.max(0, Math.sin(t * 1.6)) * 0.45;
      glow.scale.set(on ? 1.6 + Math.sin(t * 6) * 0.1 : 1);
    },
    poke: (t) => (lit = t),
  };
}

export function ferris(): FerrisThing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 80, 26);
  const H = 170, R = 120;
  for (const s of [-1, 1]) {
    ln(g.poly([s * 70, 0, s * 82, 0, s * 8, -H, -s * 2, -H]).fill(0x7b5cd6));
  }
  view.addChild(g);
  const wheel = new Container();
  wheel.position.set(0, -H);
  const w = new Graphics();
  ln(w.circle(0, 0, R).stroke({ width: 10, color: 0xff5b9e }), 3);
  w.circle(0, 0, R).stroke({ width: 3, color: OUT });
  w.circle(0, 0, R - 10).stroke({ width: 3, color: OUT });
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    w.moveTo(0, 0).lineTo(Math.cos(a) * R, Math.sin(a) * R).stroke({ width: 3, color: 0xffe3f0 });
    w.circle(Math.cos(a) * (R - 5), Math.sin(a) * (R - 5), 4).fill(0xfff3b0);
  }
  ln(w.circle(0, 0, 14).fill(0xffd23f));
  wheel.addChild(w);
  const cabins: Container[] = [];
  const cols = [0xff5b6e, 0x4fc3ff, 0xffd23f, 0x5fd38a, 0xb07cff, 0xff8a3d];
  for (let k = 0; k < 8; k++) {
    const c = new Container();
    const cg = new Graphics();
    cg.moveTo(0, 0).lineTo(0, 10).stroke({ width: 3, color: OUT });
    ln(cg.roundRect(-17, 10, 34, 26, 8).fill(cols[k % cols.length]));
    cg.roundRect(-12, 14, 24, 9, 3).fill(0xdff6ff);
    gloss(cg, -8, 30, 6, 2, 0.4);
    c.addChild(cg);
    view.addChild(c);
    cabins.push(c);
  }
  view.addChildAt(wheel, 1);
  // Rotation is integrated, so the speed can change smoothly (it speeds up while the player rides).
  let rot = 0, speed = 0.18, target = 0.18, last = -1;
  return {
    view,
    cabins,
    R,
    H,
    rot: () => rot,
    setSpeed: (s) => (target = s),
    update: (t) => {
      const dt = last < 0 ? 0 : Math.min(0.1, t - last);
      last = t;
      speed += (target - speed) * Math.min(1, dt * 2);
      rot += speed * dt;
      wheel.rotation = rot;
      cabins.forEach((c, k) => {
        const a = rot + (k / 8) * Math.PI * 2;
        c.position.set(Math.cos(a) * R, -H + Math.sin(a) * R);
        c.rotation = Math.sin(t * 2 + k) * 0.05;
      });
    },
  };
}

export function casino(): Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 190, 70);
  isoBox(g, 3.6, 3.6, 30, 0xf2c14e, 0xc99a2e, 0xb0841f);
  const top = isoBox(g, 3.2, 3.2, 120, 0x8f62d6, 0x6d44b8, 0x5a35a0, 30);
  // Gold trim and windows
  for (let i = 0; i < 4; i++) {
    const t = 0.2 + i * 0.2;
    const lx = -153 * (1 - t) + 0 * t, ly = 0 * (1 - t) + 77 * t - 30;
    ln(g.roundRect(lx - 9, ly - 80, 18, 34, 8).fill(0xffe27a), 2.5);
    ln(g.roundRect(-lx - 9, ly - 80, 18, 34, 8).fill(0xffe27a), 2.5);
  }
  // Door
  ln(g.roundRect(-20, 50, 40, 52, 18).fill(0x2c1d3f));
  // Dome
  ln(g.ellipse(top.s[0] * 0 + 0, top.n[1] + 76, 80, 40).fill(0xf2c14e));
  ln(g.circle(0, top.n[1] + 40, 54).fill(0xf6cf5e));
  g.rect(-56, top.n[1] + 40, 112, 42).fill(0xf2c14e);
  ln(g.ellipse(0, top.n[1] + 80, 56, 18).fill(0xe0ad38));
  gloss(g, -18, top.n[1] + 14, 18, 10, 0.5);
  ln(g.poly([-6, top.n[1] - 14, 6, top.n[1] - 14, 0, top.n[1] - 40]).fill(0xff5b9e));
  view.addChild(g);
  // Sign
  const sign = new Container();
  const sg = new Graphics();
  ln(sg.roundRect(-110, -22, 220, 44, 18).fill(0x2c1d3f), 4);
  sg.roundRect(-104, -16, 208, 32, 14).stroke({ width: 2, color: 0xffd23f });
  sign.addChild(sg, label('GRAND CASINO', 24, 0xffe27a, 0x2c1d3f));
  sign.position.set(0, 10);
  view.addChild(sign);
  // Marquee bulbs
  const bulbs: Graphics[] = [];
  for (let i = 0; i < 18; i++) {
    const b = new Graphics();
    b.circle(0, 0, 4.5).fill(0xfff6c2);
    b.position.set(-100 + (i / 17) * 200, i % 2 ? -14 : 34);
    sign.addChild(b);
    bulbs.push(b);
  }
  return { view, update: (t) => bulbs.forEach((b, i) => (b.alpha = (Math.floor(t * 4) + i) % 3 === 0 ? 1 : 0.35)) };
}

export function temple(): Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 170, 60);
  isoBox(g, 3.4, 3.4, 34, 0xbfb796, 0x9d9476, 0x8a8266);
  isoBox(g, 2.6, 2.6, 34, 0xc9c1a1, 0xa79e7f, 0x938a6d, 34);
  const t3 = isoBox(g, 1.8, 1.8, 34, 0xd3cbab, 0xb0a789, 0x9c9476, 68);
  isoBox(g, 1, 1, 30, 0xddd5b4, 0xbab193, 0xa59d7f, 102);
  // Doorway
  ln(g.roundRect(-26, 20, 52, 60, 24).fill(0x1d1426));
  g.roundRect(-18, 30, 36, 50, 18).fill({ color: 0x3aff9e, alpha: 0.12 });
  // Vines
  for (const [x, y, l] of [[-120, -10, 40], [-60, -40, 50], [70, -30, 45], [118, 0, 30]]) {
    g.moveTo(x, y).quadraticCurveTo(x + 8, y + l / 2, x - 4, y + l).stroke({ width: 4, color: 0x2f8a3e });
    g.circle(x - 4, y + l, 5).fill(0x3aae52);
  }
  // Gem eye on top
  const gem = new Graphics();
  ln(gem.poly([0, t3.n[1] - 52, 12, t3.n[1] - 38, 0, t3.n[1] - 24, -12, t3.n[1] - 38]).fill(0x3aff9e));
  // Poked: a pillar of green light shoots up from the gem for 9 s.
  const beam = new Graphics();
  const gy = t3.n[1] - 38;
  beam.poly([-14, gy, 14, gy, 40, gy - 900, -40, gy - 900]).fill({ color: 0x3aff9e, alpha: 0.28 });
  beam.poly([-6, gy, 6, gy, 16, gy - 900, -16, gy - 900]).fill({ color: 0xd9ffe9, alpha: 0.45 });
  beam.blendMode = 'add';
  beam.alpha = 0;
  view.addChild(g, beam, gem);
  let lit = -100;
  return {
    view,
    update: (t) => {
      const k = t - lit;
      const on = k >= 0 && k < 9 ? Math.min(1, k * 2, (9 - k) / 1.5) : 0;
      beam.alpha = on * (0.8 + Math.sin(t * 8) * 0.2);
      gem.alpha = on ? 0.85 + Math.sin(t * 14) * 0.15 : 0.75 + Math.sin(t * 2) * 0.25;
    },
    poke: (t) => (lit = t),
  };
}

export function volcano(seed: number): Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 260, 90);
  ln(g.poly([-280, 40, -90, -250, -40, -270, 40, -268, 92, -246, 280, 40, 120, 84, -120, 84]).fill(0x5e4b4c), 4);
  g.poly([-280, 40, -90, -250, -40, -270, -60, 84, -120, 84]).fill({ color: 0xffffff, alpha: 0.08 });
  g.poly([92, -246, 280, 40, 120, 84, 60, 84]).fill({ color: 0x000000, alpha: 0.12 });
  // Lava rivers
  const lava = new Graphics();
  lava.poly([-40, -262, 40, -262, 24, -240, 6, -150, 20, -60, -6, 30, -18, -70, -10, -160, -30, -238]).fill(0xff5a1f);
  lava.poly([-16, -250, 16, -250, 6, -160, 12, -80, 0, -40, -6, -100, -2, -170]).fill(0xffa63d);
  ln(g.ellipse(0, -264, 46, 14).fill(0x3d2f30), 4);
  lava.ellipse(0, -264, 36, 9).fill(0xff7a2a);
  lava.ellipse(0, -265, 18, 4).fill(0xfff1a8);
  view.addChild(g, lava);
  const upd = smoke(view, 0, -280, 6, 2.2, seed, 0x6f6470);
  // Poked: an eruption. The crater flares; the engine adds the lava bombs and the shake.
  const flare = new Graphics();
  flare.ellipse(0, -270, 90, 40).fill({ color: 0xffb347, alpha: 0.5 });
  flare.ellipse(0, -275, 50, 20).fill({ color: 0xfff1a8, alpha: 0.8 });
  flare.blendMode = 'add';
  flare.alpha = 0;
  view.addChild(flare);
  let boom = -100;
  return {
    view,
    update: (t) => {
      const k = t - boom;
      const on = k >= 0 && k < 5 ? Math.min(1, (5 - k) / 2) : 0;
      lava.alpha = on ? 1 : 0.85 + Math.sin(t * 1.8) * 0.15;
      flare.alpha = on * (0.7 + Math.sin(t * 20) * 0.3);
      upd(t + (on ? k * 2 : 0));
    },
    poke: (t) => (boom = t),
  };
}

// ── Stalls and interactables ────────────────────────────────────────────

const STALL_COLORS: Record<string, [number, number]> = {
  'coconut-shy': [0xff4f5e, 0xffffff],
  'cup-shuffle': [0x3e8ef7, 0xffffff],
  'scratch-kiosk': [0x2fc36f, 0xffe27a],
  'prize-wheel': [0x9b5cf6, 0xffd23f],
  'duck-pond': [0x14b8c4, 0xffffff],
  'high-striker': [0xff8a2a, 0xffffff],
};

function icon(g: Graphics, game: GameKey, x: number, y: number) {
  switch (game) {
    case 'coconut-shy':
      ln(g.circle(x, y, 14).fill(0x7a4a22));
      gloss(g, x - 4, y - 5, 5, 3, 0.4);
      g.circle(x - 4, y + 2, 2).fill(OUT).circle(x + 3, y + 2, 2).fill(OUT).circle(x, y + 7, 2).fill(OUT);
      break;
    case 'cup-shuffle':
      for (const dx of [-18, 0, 18]) ln(g.poly([x + dx - 9, y + 10, x + dx + 9, y + 10, x + dx + 6, y - 10, x + dx - 6, y - 10]).fill(0xff4f5e), 2.5);
      break;
    case 'scratch-kiosk':
      ln(g.roundRect(x - 16, y - 11, 32, 22, 4).fill(0xffe27a), 2.5);
      g.rect(x - 4, y - 11, 20, 22).fill(0xc0c6d4);
      break;
    case 'prize-wheel': {
      const cols = [0xff4f5e, 0xffd23f, 0x3e8ef7, 0x2fc36f];
      for (let k = 0; k < 8; k++) {
        const a0 = (k / 8) * 6.283, a1 = ((k + 1) / 8) * 6.283;
        g.moveTo(x, y).lineTo(x + Math.cos(a0) * 16, y + Math.sin(a0) * 16).arc(x, y, 16, a0, a1).lineTo(x, y).fill(cols[k % 4]);
      }
      ln(g.circle(x, y, 16));
      g.circle(x, y, 3).fill(OUT);
      break;
    }
    case 'duck-pond':
      ln(g.ellipse(x, y + 4, 15, 9).fill(0xffd23f), 2.5);
      ln(g.circle(x + 8, y - 6, 7).fill(0xffd23f), 2.5);
      g.poly([x + 14, y - 6, x + 21, y - 4, x + 14, y - 2]).fill(0xff8a2a);
      g.circle(x + 9, y - 8, 1.6).fill(OUT);
      break;
    case 'high-striker':
      ln(g.roundRect(x - 4, y - 4, 8, 24, 3).fill(0x8a5a33), 2.5);
      ln(g.roundRect(x - 14, y - 14, 28, 12, 4).fill(0xc0c6d4), 2.5);
      break;
    default:
      break;
  }
}

export function stall(game: GameKey, title: string): Thing {
  const view = new Container();
  const [c1, c2] = STALL_COLORS[game] ?? [0xff4f5e, 0xffffff];
  const g = new Graphics();
  shadow(g, 64, 24);
  // Counter
  isoBox(g, 1.15, 1.15, 34, 0xffe9c2, 0xd9a46b, 0xc48d55);
  g.poly([-55, -14, 0, 14, 0, 4, -55, -24]).fill({ color: c1, alpha: 0.85 });
  // Posts
  for (const [x, y] of [[-52, -4], [52, -4], [0, 22]]) ln(g.roundRect(x - 3.5, y - 92, 7, 92, 3).fill(0xfff6e5), 2.5);
  // Striped awning (two slopes)
  const top = -108;
  for (let i = 0; i < 6; i++) {
    const a = i / 6, b = (i + 1) / 6;
    const lerp = (p: number[], q: number[], t: number) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    const L0 = [-62, top + 30], L1 = [0, top + 60], P = [0, top - 6];
    const R1 = [62, top + 30];
    const p0 = lerp(L0, L1, a), p1 = lerp(L0, L1, b);
    g.poly([P[0], P[1], p0[0], p0[1], p1[0], p1[1]]).fill(i % 2 ? c2 : c1);
    const q0 = lerp(L1, R1, a), q1 = lerp(L1, R1, b);
    g.poly([P[0], P[1], q0[0], q0[1], q1[0], q1[1]]).fill(i % 2 ? c1 : c2);
  }
  ln(g.poly([0, top - 6, -62, top + 30, 0, top + 60, 62, top + 30]).stroke({ width: W, color: OUT }));
  // Scalloped valance
  for (let i = 0; i < 6; i++) {
    const x = -62 + i * 12.4 + 6, y = top + 30 + (i + 0.5) * 5;
    ln(g.circle(x, y + 3, 6).fill(i % 2 ? c2 : c1), 2);
    const x2 = i * 12.4 + 6, y2 = top + 60 - (i + 0.5) * 5;
    ln(g.circle(x2, y2 + 3, 6).fill(i % 2 ? c1 : c2), 2);
  }
  gloss(g, -22, top + 18, 16, 6, 0.3);
  icon(g, game, 0, -46);
  view.addChild(g);
  // Sign board, sized to its title.
  const t = label(title, 15);
  const bw = Math.max(92, t.width + 26);
  const sign = new Graphics();
  ln(sign.roundRect(-bw / 2, top - 34, bw, 30, 12).fill(c1), 3);
  sign.roundRect(-bw / 2 + 4, top - 30, bw - 8, 22, 9).stroke({ width: 2, color: 0xffffff, alpha: 0.6 });
  t.position.set(0, top - 19);
  view.addChild(sign, t);
  return { view };
}

export function rouletteTable(): Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 70, 26);
  isoBox(g, 1.5, 1.0, 30, 0x1f8f4e, 0x6b4428, 0x5a381f);
  const w = new Container();
  w.position.set(-24, -36);
  const wg = new Graphics();
  ln(wg.ellipse(0, 0, 26, 13).fill(0x6b4428));
  for (let k = 0; k < 18; k++) {
    const a0 = (k / 18) * 6.283, a1 = ((k + 1) / 18) * 6.283;
    wg.moveTo(0, 0).lineTo(Math.cos(a0) * 20, Math.sin(a0) * 10).lineTo(Math.cos(a1) * 20, Math.sin(a1) * 10).fill(k === 0 ? 0x2fc36f : k % 2 ? 0xff3b4e : 0x2c1d3f);
  }
  wg.ellipse(0, 0, 7, 3.5).fill(0xffd23f);
  w.addChild(wg);
  view.addChild(g, w);
  const chips = new Graphics();
  for (const [x, y, c] of [[16, -36, 0xff4f5e], [28, -32, 0x3e8ef7], [22, -42, 0xffd23f]] as const) {
    ln(chips.ellipse(x, y, 7, 3.5).fill(c), 2);
  }
  view.addChild(chips);
  // No title: it stands under the casino's own sign, and the prompt names it.
  return { view, update: (tt) => (chips.y = Math.sin(tt * 2) * 1.2) };
}

export function templeGate(): Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 60, 22);
  for (const x of [-44, 44]) {
    ln(g.roundRect(x - 12, -110, 24, 110, 4).fill(0xc9c1a1));
    g.rect(x - 12, -110, 8, 110).fill({ color: 0xffffff, alpha: 0.2 });
  }
  ln(g.roundRect(-62, -128, 124, 24, 6).fill(0xb3aa8a));
  for (let i = 0; i < 3; i++) ln(g.roundRect(-30 + i * 21, -96, 18, 92, 9).fill([0x8a5a33, 0x7a4a22, 0x8a5a33][i]), 2.5);
  g.circle(0, -116, 7).fill(0x3aff9e);
  view.addChild(g);
  const t = label('TEMPLE DOORS', 14, 0xdfffe9);
  t.position.set(0, -140);
  view.addChild(t);
  return { view };
}

export function lavaLookout(): Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 60, 22);
  isoBox(g, 1.2, 1.2, 22, 0x4a3f40, 0x3a3031, 0x302828);
  for (const x of [-40, 40]) ln(g.roundRect(x - 4, -90, 8, 70, 3).fill(0x6b4428), 2.5);
  ln(g.roundRect(-52, -116, 104, 30, 10).fill(0xff5a1f));
  g.roundRect(-48, -112, 96, 22, 8).stroke({ width: 2, color: 0xffe27a, alpha: 0.7 });
  // Thermometer gauge
  ln(g.roundRect(-8, -78, 16, 50, 8).fill(0xffffff), 2.5);
  const merc = new Graphics();
  merc.roundRect(-4, -74, 8, 44, 4).fill(0xff3b1f);
  view.addChild(g, merc);
  const t = label('LAVA CRASH', 15, 0xfff1a8);
  t.position.set(0, -101);
  view.addChild(t);
  return { view, update: (tt) => { const k = (Math.sin(tt * 1.2) + 1) / 2; merc.scale.y = 0.3 + k * 0.7; merc.y = (1 - merc.scale.y) * -30; } };
}

export function chest(gold = true): Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 30, 11);
  isoBox(g, 0.55, 0.4, 22, 0x8a5a33, 0x7a4a22, 0x6b4428);
  ln(g.ellipse(0, -26, 26, 14).fill(0x9a6a3b));
  g.rect(-3, -36, 6, 28).fill(gold ? 0xffd23f : 0xc0c6d4);
  ln(g.roundRect(-6, -22, 12, 12, 3).fill(gold ? 0xffd23f : 0xc0c6d4), 2.5);
  const shine = new Graphics();
  for (let k = 0; k < 4; k++) shine.poly([0, -60, 3, -48, 0, -36, -3, -48]).fill({ color: 0xfff3b0, alpha: 0.9 });
  view.addChild(g, shine);
  return { view, update: (t) => { shine.alpha = (Math.sin(t * 3) + 1) / 2; shine.rotation = Math.sin(t) * 0.2; } };
}

export function hut(kind: 'wardrobe' | 'cashier', title: string): Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 64, 24);
  isoBox(g, 1.2, 1.2, 50, 0xfff0d6, kind === 'cashier' ? 0x5fd3a0 : 0xff9bc0, kind === 'cashier' ? 0x45b886 : 0xe880a8);
  // Thatched roof
  ln(g.poly([0, -120, -74, -52, 0, -18, 74, -52]).fill(0xe8b85a), 3);
  ln(g.poly([0, -120, -74, -52, -70, -44, 0, -110]).fill(0xd6a446), 2);
  for (let i = 0; i < 6; i++) g.moveTo(-60 + i * 22, -50 + Math.abs(i - 2.7) * -4).lineTo(-55 + i * 22, -34 + Math.abs(i - 2.7) * -4).stroke({ width: 2, color: 0xb07a2e });
  ln(g.roundRect(-30, -40, 22, 34, 6).fill(0x8a5a33), 2.5);
  // Badge
  ln(g.circle(26, -36, 14).fill(kind === 'cashier' ? 0xffd23f : 0xffffff), 2.5);
  if (kind === 'cashier') view.addChild(Object.assign(label('R', 16, 0x8a5a00, 0xffffff), { x: 26, y: -36 }));
  else g.moveTo(18, -32).lineTo(26, -42).lineTo(34, -32).closePath().stroke({ width: 2.5, color: OUT });
  view.addChildAt(g, 0);
  const t = label(title, 15);
  t.position.set(0, -134);
  view.addChild(t);
  return { view };
}

export function noticeBoard(): Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 40, 14);
  for (const x of [-32, 32]) ln(g.roundRect(x - 4, -70, 8, 70, 3).fill(0x8a5a33), 2.5);
  ln(g.roundRect(-44, -96, 88, 56, 8).fill(0xc98b4f));
  const papers: [number, number, number, number][] = [[-36, -90, 0xfff6e5, -0.08], [-4, -88, 0xffe27a, 0.06], [-30, -66, 0xbfe9ff, 0.04], [6, -64, 0xffd0e0, -0.05]];
  for (const [x, y, c, r] of papers) {
    const p = new Graphics();
    ln(p.roundRect(0, 0, 30, 20, 3).fill(c), 2);
    p.position.set(x, y);
    p.rotation = r;
    view.addChild(p);
  }
  view.addChildAt(g, 0);
  const t = label('NOTICE BOARD', 14);
  t.position.set(0, -110);
  view.addChild(t);
  return { view };
}

export function signpost(): Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 18, 7);
  ln(g.roundRect(-4, -78, 8, 78, 3).fill(0x8a5a33), 2.5);
  const boards: [number, number, number][] = [[-70, 1, 0xffd23f], [-54, -1, 0x4fc3ff], [-38, 1, 0xff8a3d]];
  for (const [y, dir, c] of boards) {
    // A board with an arrow tip pointing left (dir -1) or right (dir 1).
    const pts = dir > 0 ? [-6, y - 7, 32, y - 7, 42, y, 32, y + 7, -6, y + 7] : [6, y - 7, -32, y - 7, -42, y, -32, y + 7, 6, y + 7];
    ln(g.poly(pts).fill(c), 2.5);
  }
  view.addChild(g);
  return { view };
}

export function gate(level: number): Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 40, 14);
  for (const x of [-34, 34]) ln(g.roundRect(x - 5, -50, 10, 50, 3).fill(0x8a5a33), 2.5);
  for (const y of [-40, -22]) ln(g.roundRect(-38, y, 76, 9, 4).fill(0xc98b4f), 2.5);
  ln(g.roundRect(-13, -46, 26, 22, 5).fill(0xffd23f), 2.5);
  g.moveTo(-7, -46).arc(0, -46, 7, Math.PI, 0).stroke({ width: 3.5, color: OUT });
  view.addChild(g);
  const t = label(`LV ${level}`, 13, 0xffe27a);
  t.position.set(0, -66);
  view.addChild(t);
  return { view };
}

// ── Characters ──────────────────────────────────────────────────────────

const SKIN = 0xffcfa1;
const HAIR = 0x6b3e26;

export interface Look {
  hat: string;
  outfit: string;
  pet: string;
}

export interface Avatar {
  view: Container;
  setLook(look: Look): void;
  /** dir: 0 down-right, 1 down-left, 2 up-left, 3 up-right. */
  pose(t: number, moving: boolean, dir: number): void;
}

export function avatar(): Avatar {
  const view = new Container();
  const sh = new Graphics();
  shadow(sh, 18, 7);
  const body = new Container();
  const legL = new Graphics(), legR = new Graphics(), torso = new Graphics(), armL = new Graphics(), armR = new Graphics();
  const head = new Container();
  const face = new Graphics(), back = new Graphics(), hat = new Graphics();
  head.addChild(face, back, hat);
  body.addChild(legL, legR, armL, torso, armR, head);
  view.addChild(sh, body);
  head.position.set(0, -46);

  const draw = (look: Look) => {
    const o = look.outfit;
    const pants = o === 'outfit-tux' ? 0x2c2c3a : o === 'outfit-gold' ? 0xc99a2e : o === 'outfit-explorer' ? 0x8c7a52 : o === 'outfit-sailor' ? 0xffffff : o === 'outfit-parka' ? 0x2c4a6e : 0x3e6fd6;
    for (const leg of [legL, legR]) {
      leg.clear();
      ln(leg.roundRect(-4.5, -4, 9, 16, 4).fill(pants), 2.5);
      ln(leg.ellipse(0, 12, 6, 3.5).fill(0x4a2f22), 2);
    }
    legL.position.set(-6, -14);
    legR.position.set(6, -14);
    const shirt: Record<string, number> = {
      'outfit-tee': 0xff7a59, 'outfit-hawaiian': 0x22c4b0, 'outfit-sailor': 0xffffff, 'outfit-tux': 0x2c2c3a, 'outfit-explorer': 0xc8b27a, 'outfit-gold': 0xffd23f,
      'outfit-parka': 0x3e8ef7,
    };
    torso.clear();
    ln(torso.roundRect(-14, -36, 28, 26, 10).fill(shirt[o] ?? 0xff7a59));
    if (o === 'outfit-hawaiian') for (const [x, y] of [[-7, -28], [6, -20], [-2, -16], [8, -31]]) torso.circle(x, y, 3).fill(0xffd23f).circle(x + 1, y + 1, 1.2).fill(0xff5b9e);
    if (o === 'outfit-sailor') { torso.poly([-14, -36, 14, -36, 0, -22]).fill(0x2a4fa8); torso.rect(-14, -18, 28, 3).fill(0x2a4fa8); }
    if (o === 'outfit-tux') { torso.poly([-6, -36, 6, -36, 0, -14]).fill(0xffffff); torso.poly([-6, -34, 0, -31, -6, -28]).fill(0xff3b4e).poly([6, -34, 0, -31, 6, -28]).fill(0xff3b4e); }
    if (o === 'outfit-explorer') { torso.rect(-14, -20, 28, 4).fill(0x6b4428); torso.roundRect(-10, -32, 8, 7, 2).stroke({ width: 1.5, color: 0x6b4428 }); }
    if (o === 'outfit-gold') for (const [x, y] of [[-6, -30], [5, -22]]) torso.poly([x, y - 4, x + 1.5, y, x, y + 4, x - 1.5, y]).fill(0xffffff);
    if (o === 'outfit-parka') {
      // Puffy quilting, a zip, and a fur-trimmed collar.
      for (const y of [-28, -20]) torso.moveTo(-13, y).lineTo(13, y).stroke({ width: 1.5, color: 0x2a64c0 });
      torso.rect(-1, -34, 2, 22).fill(0xdbe9f5);
      for (let k = 0; k < 5; k++) torso.circle(-12 + k * 6, -36, 3.6).fill(0xf4f8ff);
    }
    gloss(torso, -6, -31, 5, 3, 0.35);
    for (const [arm, x] of [[armL, -15], [armR, 15]] as const) {
      arm.clear();
      ln(arm.roundRect(-4, 0, 8, 15, 4).fill(shirt[o] ?? 0xff7a59), 2.5);
      ln(arm.circle(0, 16, 4.5).fill(SKIN), 2);
      arm.position.set(x, -34);
    }
    // Head (front)
    face.clear();
    ln(face.circle(0, 0, 21).fill(SKIN));
    face.poly([-21, -2, -18, -14, -8, -21, 8, -21, 18, -14, 21, -2, 14, -10, 4, -8, -6, -12, -14, -8]).fill(HAIR);
    face.ellipse(-7, 2, 3.4, 4.6).fill(OUT).ellipse(7, 2, 3.4, 4.6).fill(OUT);
    face.circle(-6, 0.5, 1.4).fill(0xffffff).circle(8, 0.5, 1.4).fill(0xffffff);
    face.ellipse(-13, 8, 4, 2.4).fill({ color: 0xff7a8a, alpha: 0.55 }).ellipse(13, 8, 4, 2.4).fill({ color: 0xff7a8a, alpha: 0.55 });
    face.moveTo(-5, 10).quadraticCurveTo(0, 15, 5, 10).stroke({ width: 2.2, color: OUT, cap: 'round' });
    gloss(face, -9, -12, 6, 3, 0.25);
    back.clear();
    ln(back.circle(0, 0, 21).fill(HAIR));
    gloss(back, -8, -10, 7, 4, 0.2);
    // Hat
    hat.clear();
    switch (look.hat) {
      case 'hat-straw':
        ln(hat.ellipse(0, -13, 30, 8).fill(0xf2cf6b));
        ln(hat.roundRect(-14, -30, 28, 18, 9).fill(0xf6da80));
        hat.rect(-14, -18, 28, 4).fill(0xff4f5e);
        break;
      case 'hat-sailor':
        ln(hat.roundRect(-18, -28, 36, 16, 8).fill(0xffffff));
        hat.rect(-18, -16, 36, 4).fill(0x2a4fa8);
        ln(hat.ellipse(0, -11, 20, 4).fill(0x2c2c3a), 2);
        break;
      case 'hat-pirate':
        ln(hat.poly([-30, -12, -18, -30, 0, -36, 18, -30, 30, -12, 0, -18]).fill(0x2c2c3a));
        hat.circle(0, -25, 4).fill(0xffffff);
        hat.rect(-30, -14, 60, 2).fill(0xffd23f);
        break;
      case 'hat-flower':
        for (let k = 0; k < 5; k++) hat.circle(14 + Math.cos(k * 1.256) * 6, -14 + Math.sin(k * 1.256) * 6, 5).fill(0xff5b9e);
        hat.circle(14, -14, 3).fill(0xffd23f);
        break;
      case 'hat-crown':
        ln(hat.poly([-16, -12, -16, -28, -8, -20, 0, -32, 8, -20, 16, -28, 16, -12]).fill(0xffd23f));
        hat.circle(0, -18, 3).fill(0xff3b4e).circle(-9, -16, 2).fill(0x4fc3ff).circle(9, -16, 2).fill(0x5fd38a);
        gloss(hat, -6, -22, 3, 2, 0.6);
        break;
      case 'hat-snorkel':
        // A mask over the eyes (drawn on the face layer's level) and a snorkel up the side.
        ln(hat.roundRect(-17, -6, 34, 15, 7).fill({ color: 0x9fe9ff, alpha: 0.75 }), 2.5);
        hat.rect(-21, -1, 4, 5).fill(0xff8a2a).rect(17, -1, 4, 5).fill(0xff8a2a);
        gloss(hat, -8, -2, 5, 2, 0.7);
        ln(hat.moveTo(20, 4).lineTo(24, -30).stroke({ width: 5, color: 0xffd23f }), 1);
        hat.moveTo(20, 4).lineTo(24, -30).stroke({ width: 3, color: 0xffd23f, cap: 'round' });
        ln(hat.roundRect(20, -36, 9, 8, 3).fill(0xff5b6e), 2);
        break;
    }
  };

  draw({ hat: 'hat-straw', outfit: 'outfit-tee', pet: 'pet-none' });

  return {
    view,
    setLook: draw,
    pose(t, moving, dir) {
      const front = dir < 2;
      face.visible = front;
      back.visible = !front;
      body.scale.x = dir === 1 || dir === 2 ? -1 : 1;
      const k = moving ? Math.sin(t * 14) : 0;
      legL.y = -14 - Math.max(0, k) * 4;
      legR.y = -14 - Math.max(0, -k) * 4;
      armL.rotation = k * 0.5;
      armR.rotation = -k * 0.5;
      body.y = moving ? -Math.abs(k) * 2.5 : Math.sin(t * 2) * 0.8;
      head.rotation = moving ? k * 0.03 : Math.sin(t * 1.3) * 0.03;
      sh.scale.set(moving ? 1 - Math.abs(k) * 0.1 : 1);
      // Draw order: arms behind when facing away.
      body.setChildIndex(armL, front ? 2 : 0);
    },
  };
}

export function pet(kind: string): Thing | null {
  if (kind === 'pet-none') return null;
  const view = new Container();
  const body = new Container();
  const g = new Graphics();
  shadow(g, 12, 5);
  const b = new Graphics();
  switch (kind) {
    case 'pet-crab':
      ln(b.ellipse(0, -10, 13, 9).fill(0xff5b4e));
      ln(b.circle(-15, -16, 5).fill(0xff5b4e), 2.5);
      ln(b.circle(15, -16, 5).fill(0xff5b4e), 2.5);
      b.circle(-4, -20, 3).fill(0xffffff).circle(4, -20, 3).fill(0xffffff).circle(-4, -20, 1.4).fill(OUT).circle(4, -20, 1.4).fill(OUT);
      break;
    case 'pet-turtle':
      ln(b.ellipse(0, -10, 15, 10).fill(0x4fb85a));
      b.poly([-6, -16, 6, -16, 9, -8, -9, -8]).fill(0x3c9a3a);
      ln(b.circle(15, -12, 6).fill(0x9be07a), 2.5);
      b.circle(17, -13, 1.4).fill(OUT);
      break;
    case 'pet-monkey':
      ln(b.circle(0, -12, 11).fill(0x8a5a33));
      ln(b.circle(0, -26, 10).fill(0x8a5a33));
      b.ellipse(0, -24, 7, 6).fill(0xf2c79a);
      b.circle(-3, -26, 1.6).fill(OUT).circle(3, -26, 1.6).fill(OUT);
      ln(b.circle(-11, -28, 4).fill(0xf2c79a), 2);
      ln(b.circle(11, -28, 4).fill(0xf2c79a), 2);
      break;
    case 'pet-penguin':
      ln(b.ellipse(0, -16, 11, 15).fill(0x2c2c3a));
      b.ellipse(0, -13, 7, 10).fill(0xffffff);
      b.poly([-3, -24, 3, -24, 0, -20]).fill(0xff8a2a);
      b.circle(-3, -27, 1.4).fill(0xffffff).circle(3, -27, 1.4).fill(0xffffff);
      break;
  }
  gloss(b, -4, -18, 4, 2, 0.35);
  body.addChild(b);
  view.addChild(g, body);
  return { view, update: (t) => (body.y = -Math.abs(Math.sin(t * 9)) * 3) };
}

export function parrot(): Thing & { flap: Container } {
  const view = new Container();
  const body = new Graphics();
  // Tail
  ln(body.poly([-4, 8, -16, 30, -8, 32, 4, 10]).fill(0x3e8ef7), 2.5);
  ln(body.poly([0, 8, -6, 32, 2, 32, 6, 10]).fill(0xffd23f), 2.5);
  ln(body.ellipse(0, 0, 11, 14).fill(0xff3b4e));
  ln(body.circle(3, -14, 10).fill(0xff3b4e));
  body.ellipse(6, -15, 5, 6).fill(0xffffff);
  body.circle(7, -15, 2.2).fill(OUT);
  ln(body.poly([11, -16, 19, -12, 12, -6]).fill(0xffe27a), 2);
  gloss(body, -2, -18, 4, 2, 0.4);
  const flap = new Container();
  const wg = new Graphics();
  ln(wg.poly([0, 0, -22, -6, -26, 4, -16, 12, -2, 10]).fill(0x2fc36f), 2.5);
  wg.poly([-22, -6, -26, 4, -18, 2]).fill(0x3e8ef7);
  flap.addChild(wg);
  flap.position.set(-2, -2);
  view.addChild(body, flap);
  return { view, flap };
}

/** A golden bobbing arrow shown over the nearby interactable. */
export function marker(): Thing {
  const view = new Container();
  const g = new Graphics();
  ln(g.poly([-12, -18, 12, -18, 12, -4, 22, -4, 0, 16, -22, -4, -12, -4]).fill(0xffd23f), 3);
  gloss(g, -4, -12, 5, 2, 0.6);
  view.addChild(g);
  return { view, update: (t) => (g.y = Math.sin(t * 5) * 6) };
}

export function tapRing(): Thing & { at(x: number, y: number, t: number): void } {
  const view = new Container();
  const g = new Graphics();
  g.ellipse(0, 0, 22, 11).stroke({ width: 4, color: 0xffffff });
  view.addChild(g);
  view.alpha = 0;
  let t0 = -10;
  return {
    view,
    at(x, y, t) {
      view.position.set(x, y);
      t0 = t;
    },
    update(t) {
      const k = (t - t0) / 0.5;
      view.alpha = k < 1 ? 1 - k : 0;
      view.scale.set(0.6 + k * 0.6);
    },
  };
}

import { Container, Graphics } from 'pixi.js';
import * as A from './art.ts';
import { TH, TW } from './map.ts';

/*
 * Art for the isles (Coral Lagoon, Frost Isle, Sky Kingdom), the Island Hopper and the VIP Salon's Diamond Wheel, in the
 * island's style: chunky shapes, plum outlines, a white gloss. Every builder returns a Thing whose (0, 0) is its foot.
 * Secrets are things whose poke() returns the secret's id once it's revealed.
 */

const OUT = A.OUT;
const HW = TW / 2, HH = TH / 2;
const ln = (g: Graphics, w = 3, color = OUT) => g.stroke({ width: w, color, join: 'round', cap: 'round' });
const shadow = (g: Graphics, rx: number, ry: number, x = 0, y = 0) => g.ellipse(x, y, rx, ry).fill({ color: 0x1b1030, alpha: 0.22 });
const gloss = (g: Graphics, x: number, y: number, rx: number, ry: number, a = 0.45) => g.ellipse(x, y, rx, ry).fill({ color: 0xffffff, alpha: a });

/** A rounded sign board with a title, centred at y. */
function sign(view: Container, title: string, y: number, color: number, text = 0xffffff) {
  const t = A.label(title, 15, text);
  const bw = Math.max(92, t.width + 26);
  const b = new Graphics();
  ln(b.roundRect(-bw / 2, y - 15, bw, 30, 12).fill(color), 3);
  b.roundRect(-bw / 2 + 4, y - 11, bw - 8, 22, 9).stroke({ width: 2, color: 0xffffff, alpha: 0.6 });
  t.position.set(0, y);
  view.addChild(b, t);
}

// ── The Island Hopper ───────────────────────────────────────────────────

/** The ferry moored at the pier (or the Sky Kingdom's airship), bobbing; a sign names it. */
export function ferry(sky = false): A.Thing {
  const view = new Container();
  const body = new Container();
  const g = new Graphics();
  if (!sky) {
    g.ellipse(0, 6, 86, 18).fill({ color: 0x0e5f86, alpha: 0.35 });
    // Hull: red below the waterline band, white above.
    ln(g.poly([-82, -30, 82, -30, 64, 6, -66, 6]).fill(0xffffff));
    g.poly([-74, -12, 74, -12, 64, 6, -66, 6]).fill(0xff4f5e);
    ln(g.poly([-82, -30, 82, -30, 64, 6, -66, 6]));
    for (const x of [-46, -16, 14, 44]) ln(g.circle(x, -21, 5).fill(0x7fd6ff), 2);
    // Cabin, funnel, flag.
    ln(g.roundRect(-50, -66, 76, 36, 8).fill(0xfff6e5));
    ln(g.poly([-56, -66, 32, -66, 26, -76, -50, -76]).fill(0x3e8ef7));
    for (const x of [-40, -20, 0]) ln(g.roundRect(x, -58, 14, 14, 4).fill(0xbfe9ff), 2);
    ln(g.roundRect(40, -86, 18, 56, 4).fill(0xffd23f));
    g.rect(40, -76, 18, 8).fill(0xff4f5e);
    ln(g.roundRect(40, -86, 18, 56, 4));
    ln(g.moveTo(-70, -30).lineTo(-70, -96).stroke({ width: 4, color: OUT }), 4);
    ln(g.poly([-70, -96, -40, -88, -70, -80]).fill(0x2fc36f), 2.5);
    gloss(g, -30, -60, 16, 4, 0.35);
  } else {
    // The Sky Ferry: a striped balloon over a wooden gondola, a propeller at the back.
    g.ellipse(0, 10, 70, 14).fill({ color: 0x5b7fae, alpha: 0.25 });
    for (const x of [-40, 40]) g.moveTo(x, -40).lineTo(x * 1.4, -108).stroke({ width: 2.5, color: 0x6b4428 });
    ln(g.poly([-70, -40, 70, -40, 54, -6, -54, -6]).fill(0xb07a45));
    g.rect(-66, -32, 132, 6).fill(0x8a5a33);
    ln(g.poly([-70, -40, 70, -40, 54, -6, -54, -6]));
    const env = new Graphics();
    ln(env.ellipse(0, -150, 104, 54).fill(0xffffff));
    for (const [x0, x1, c] of [[-70, -36, 0xff5b6e], [-12, 12, 0xffd23f], [36, 70, 0x4fc3ff]] as const)
      env.poly([x0, -194, x1, -194, x1 + 4, -104, x0 - 4, -104]).fill({ color: c, alpha: 0.9 });
    ln(env.ellipse(0, -150, 104, 54));
    gloss(env, -40, -176, 30, 10, 0.5);
    g.addChild(env);
    ln(g.circle(-76, -24, 6).fill(0xffd23f), 2);
  }
  body.addChild(g);
  const prop = new Graphics();
  if (sky) {
    ln(prop.ellipse(0, 0, 4, 22).fill(0xc0c6d4), 2);
    prop.position.set(-82, -24);
    body.addChild(prop);
  }
  view.addChild(body);
  sign(view, sky ? 'SKY FERRY' : 'ISLAND HOPPER', sky ? -226 : -118, sky ? 0x8f62d6 : 0x2ea7e8);
  return {
    view,
    update: (t) => {
      body.y = Math.sin(t * 1.6) * (sky ? 5 : 2.5);
      body.rotation = Math.sin(t * 1.1) * (sky ? 0.015 : 0.025);
      if (sky) prop.scale.y = Math.cos(t * 30);
    },
  };
}

// ── Coral Lagoon ────────────────────────────────────────────────────────

export function coralDropStall(): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 62, 22);
  A.isoBox(g, 1.15, 0.8, 26, 0xffe9c2, 0x2fb5b0, 0x23958f);
  // The upright board: a teal frame round pale water, pegs in a triangle, coloured pockets at the foot.
  ln(g.roundRect(-46, -150, 92, 122, 14).fill(0x1d8f8a));
  g.roundRect(-38, -142, 76, 100, 8).fill(0xd8fbff);
  for (let row = 0; row < 6; row++)
    for (let i = 0; i <= row; i++) g.circle((i - row / 2) * 12, -130 + row * 14, 2.6).fill(0xff7a8a);
  const pockets = [0xffd23f, 0xff8a3d, 0x4fc3ff, 0x2fc36f, 0x4fc3ff, 0xff8a3d, 0xffd23f];
  pockets.forEach((c, i) => g.roundRect(-36 + i * 10.3, -48, 9, 8, 2).fill(c));
  gloss(g, -24, -136, 10, 4, 0.5);
  view.addChild(g);
  const pearl = new Graphics();
  ln(pearl.circle(0, 0, 5).fill(0xfff6fb), 2);
  pearl.circle(-1.5, -1.5, 1.6).fill(0xffffff);
  view.addChild(pearl);
  sign(view, 'CORAL DROP', -170, 0xff6f86);
  return {
    view,
    update: (t) => {
      // The pearl bounces down the pegs on a loop.
      const k = (t * 0.45) % 1;
      const row = Math.floor(k * 7);
      const sway = Math.sin(row * 2.1 + Math.floor(t * 0.45) * 1.7) * row * 2.6;
      pearl.position.set(sway, -140 + k * 92);
    },
  };
}

export function derbyTank(): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 76, 26);
  A.isoBox(g, 1.6, 0.85, 22, 0xffe9c2, 0xd9a46b, 0xc48d55);
  // The tank: glass sides, water, five lanes.
  ln(g.roundRect(-70, -104, 140, 78, 10).fill({ color: 0x4fd0e0, alpha: 0.85 }));
  for (let i = 1; i < 5; i++) g.moveTo(-64, -104 + i * 15.6).lineTo(64, -104 + i * 15.6).stroke({ width: 1.5, color: 0xffffff, alpha: 0.45 });
  // Checked finish line.
  for (let i = 0; i < 10; i++) g.rect(52, -102 + i * 7.4, 6, 7.4).fill(i % 2 ? 0xffffff : OUT);
  gloss(g, -40, -96, 22, 5, 0.4);
  view.addChild(g);
  const riders: Graphics[] = [];
  const colours = [0xffd23f, 0xff7ab6, 0xff8a3d, 0x7fd6ff, 0xb07cff];
  colours.forEach((c, i) => {
    const s = new Graphics();
    ln(s.ellipse(0, 0, 4.5, 6).fill(c), 2);
    ln(s.circle(2, -6, 3.6).fill(c), 2);
    s.moveTo(0, 6).quadraticCurveTo(-5, 10, -1, 12).stroke({ width: 2.5, color: c });
    s.position.set(-50, -97 + i * 15.6);
    view.addChild(s);
    riders.push(s);
  });
  // Flag on a pole.
  const flag = new Graphics();
  ln(flag.moveTo(70, -26).lineTo(70, -140).stroke({ width: 4, color: OUT }), 4);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) flag.rect(70 + c * 7, -140 + r * 7, 7, 7).fill((r + c) % 2 ? 0xffffff : OUT);
  view.addChild(flag);
  sign(view, 'SEAHORSE DERBY', -126, 0x14b8c4);
  return {
    view,
    update: (t) => riders.forEach((s, i) => (s.x = -50 + ((Math.sin(t * (0.7 + i * 0.13) + i * 1.3) + 1) / 2) * 92)),
  };
}

export function mermaid(): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 70, 24);
  // The rock.
  ln(g.ellipse(0, -14, 64, 26).fill(0x9a8f9e));
  ln(g.ellipse(-20, -30, 34, 18).fill(0xb3a8b6));
  ln(g.ellipse(22, -26, 30, 15).fill(0xa69bab));
  gloss(g, -30, -38, 12, 4, 0.35);
  // Tail curling over the rock, the fin at the front.
  ln(g.moveTo(-6, -40).bezierCurveTo(-34, -46, -40, -18, -16, -14).bezierCurveTo(10, -10, 28, -22, 30, -40).lineTo(14, -44).closePath().fill(0x2fc3a0));
  ln(g.poly([26, -40, 46, -58, 50, -36, 34, -32]).fill(0x5fe0bf));
  for (const [x, y] of [[-24, -28], [-12, -24], [0, -24], [12, -30]]) g.arc(x, y, 5, 0, Math.PI).stroke({ width: 1.5, color: 0x1f8f74 });
  // Body, arms up holding a pearl, flowing hair.
  ln(g.roundRect(-14, -96, 24, 54, 10).fill(0xffcfa1));
  ln(g.poly([-14, -76, 10, -76, 10, -66, -14, -66]).fill(0xb07cff), 2);
  ln(g.moveTo(-12, -90).lineTo(-26, -130).stroke({ width: 8, color: OUT }), 1);
  g.moveTo(-12, -90).lineTo(-26, -130).stroke({ width: 5, color: 0xffcfa1, cap: 'round' });
  ln(g.moveTo(8, -90).lineTo(18, -130).stroke({ width: 8, color: OUT }), 1);
  g.moveTo(8, -90).lineTo(18, -130).stroke({ width: 5, color: 0xffcfa1, cap: 'round' });
  ln(g.poly([-22, -118, -6, -124, 10, -110, 16, -70, 4, -76, -2, -96, -20, -84]).fill(0xff5b4e));
  ln(g.circle(-2, -110, 13).fill(0xffcfa1));
  g.circle(-6, -110, 1.8).fill(OUT).circle(3, -110, 1.8).fill(OUT);
  g.arc(-2, -105, 4, 0.2, Math.PI - 0.2).stroke({ width: 1.8, color: OUT });
  ln(g.poly([-16, -116, -2, -126, 12, -116, 6, -122, -10, -122]).fill(0xff5b4e), 2);
  view.addChild(g);
  const pearl = new Graphics();
  pearl.circle(0, 0, 16).fill({ color: 0xfff0ff, alpha: 0.35 });
  ln(pearl.circle(0, 0, 9).fill(0xfff6fb), 2.5);
  gloss(pearl, -3, -3, 3, 2, 0.8);
  pearl.position.set(-4, -140);
  view.addChild(pearl);
  let sung = -100;
  return {
    view,
    update: (t) => {
      const k = t - sung;
      pearl.scale.set(1 + Math.sin(t * 2) * 0.06 + (k < 8 ? Math.sin(k * 8) * 0.12 : 0));
      pearl.alpha = 0.85 + Math.sin(t * 3) * 0.15;
    },
    poke: (t) => {
      sung = t;
    },
  };
}

export function coral(seed: number): A.Thing {
  const view = new Container();
  const g = new Graphics();
  const colours = [0xff7a8a, 0xff9d3d, 0xb07cff, 0xff5bb0];
  const c = colours[Math.floor(seed * colours.length)];
  g.ellipse(0, 2, 18, 6).fill({ color: 0x0e7f8a, alpha: 0.25 });
  for (let k = 0; k < 3; k++) {
    const a = -Math.PI / 2 + (k - 1) * 0.6 + (seed - 0.5) * 0.3;
    const len = 18 + ((seed * 7 + k) % 1) * 12;
    const x = Math.cos(a) * len, y = Math.sin(a) * len;
    g.moveTo(0, 0).quadraticCurveTo(x * 0.3, y * 0.6, x, y).stroke({ width: 9, color: OUT, cap: 'round' });
    g.moveTo(0, 0).quadraticCurveTo(x * 0.3, y * 0.6, x, y).stroke({ width: 5, color: c, cap: 'round' });
    ln(g.circle(x, y, 4).fill(c), 2);
  }
  view.addChild(g);
  return { view, update: (t) => (g.skew.x = Math.sin(t * 1.2 + seed * 9) * 0.08) };
}

export function umbrella(seed: number): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 26, 9);
  ln(g.roundRect(-20, -4, 34, 10, 3).fill(seed > 0.5 ? 0x4fc3ff : 0xff7ab6), 2);
  ln(g.moveTo(0, 2).lineTo(4, -70).stroke({ width: 3.5, color: OUT }), 3.5);
  const cols = seed > 0.5 ? [0xff5b6e, 0xffffff] : [0xffd23f, 0x2fc36f];
  for (let i = 0; i < 6; i++) {
    const a0 = Math.PI + (i / 6) * Math.PI, a1 = Math.PI + ((i + 1) / 6) * Math.PI;
    g.moveTo(4, -70).lineTo(4 + Math.cos(a0) * 38, -70 + Math.sin(a0) * 16 + 14).lineTo(4 + Math.cos(a1) * 38, -70 + Math.sin(a1) * 16 + 14).fill(cols[i % 2]);
  }
  ln(g.moveTo(-34, -56).quadraticCurveTo(4, -100, 42, -56).stroke({ width: 3, color: OUT }));
  view.addChild(g);
  return { view };
}

/** The shipwreck in the shallows. Tap it and the ghost of its captain rises (a secret). */
export function shipwreck(): A.Thing {
  const view = new Container();
  const g = new Graphics();
  g.ellipse(0, 4, 74, 16).fill({ color: 0x0e5f86, alpha: 0.3 });
  ln(g.poly([-66, -6, 40, -26, 62, -4, -50, 10]).fill(0x6b4428));
  for (let i = 0; i < 4; i++) g.moveTo(-56 + i * 26, -2 - i * 4).lineTo(-52 + i * 26, 8 - i * 4).stroke({ width: 2, color: 0x3e2418 });
  ln(g.poly([-20, -10, -6, -12, -2, -96, -14, -94]).fill(0x8a5a33));
  ln(g.poly([-4, -88, 40, -70, 30, -40, -2, -36]).fill(0xe9dcc0));
  g.poly([16, -66, 30, -60, 22, -50]).fill(0x6b4428);
  ln(g.circle(-38, -12, 6).fill(0x3e2418), 2);
  for (const x of [-60, 52]) g.moveTo(x, 6).quadraticCurveTo(x + 6, -14, x - 2, -26).stroke({ width: 3, color: 0x2fa36f, cap: 'round' });
  view.addChild(g);
  // The ghost: a pale captain with a tricorn, rising out of the wreck.
  const ghost = new Container();
  const gg = new Graphics();
  gg.circle(0, 0, 46).fill({ color: 0x9dffd0, alpha: 0.18 });
  gg.poly([-20, 30, -24, -12, -14, -34, 14, -34, 24, -12, 20, 30, 10, 22, 0, 32, -10, 22]).fill({ color: 0xd9fff0, alpha: 0.85 }).stroke({ width: 2.5, color: 0x2fa36f });
  gg.circle(-7, -14, 3.5).fill(0x1f6e4a).circle(7, -14, 3.5).fill(0x1f6e4a);
  gg.ellipse(0, -2, 5, 3).fill(0x1f6e4a);
  gg.poly([-22, -32, 0, -48, 22, -32, 0, -38]).fill({ color: 0x2c4a3e, alpha: 0.9 });
  ghost.addChild(gg);
  ghost.alpha = 0;
  view.addChild(ghost);
  let seen = -100;
  let found = false;
  return {
    view,
    update: (t) => {
      const k = t - seen;
      ghost.alpha = k < 5 ? Math.min(1, k * 2, (5 - k) * 1.2) * (0.75 + Math.sin(t * 9) * 0.15) : 0;
      ghost.position.set(Math.sin(k * 2) * 10, -60 - Math.min(1, k) * 70 + Math.sin(k * 3) * 6);
      g.rotation = Math.sin(t * 0.8) * 0.01;
    },
    poke: (t) => {
      if (t - seen < 5) return;
      seen = t;
      if (!found) {
        found = true;
        return 'ghost-ship';
      }
    },
  };
}

/** A giant clam on the beach: three taps and it opens on a glowing pearl (a secret). */
export function clam(): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 40, 13);
  ln(g.ellipse(0, -10, 36, 16).fill(0xd9a6e0));
  for (let i = -3; i <= 3; i++) g.moveTo(i * 9, -1).lineTo(i * 7, -20).stroke({ width: 2, color: 0xa86cb3 });
  view.addChild(g);
  const pearl = new Graphics();
  pearl.circle(0, 0, 18).fill({ color: 0xfff0ff, alpha: 0.4 });
  ln(pearl.circle(0, 0, 9).fill(0xfff6fb), 2.5);
  gloss(pearl, -3, -3, 3, 2, 0.8);
  pearl.position.set(0, -18);
  pearl.visible = false;
  view.addChild(pearl);
  const lid = new Container();
  const lg = new Graphics();
  ln(lg.moveTo(-36, 0).quadraticCurveTo(0, -46, 36, 0).quadraticCurveTo(0, -8, -36, 0).fill(0xe8b8ee));
  for (let i = -3; i <= 3; i++) lg.moveTo(i * 9, -3).lineTo(i * 6, -26).stroke({ width: 2, color: 0xb985c2 });
  gloss(lg, -10, -20, 10, 4, 0.4);
  lid.addChild(lg);
  lid.position.set(0, -12);
  view.addChild(lid);
  let taps = 0;
  let opened = -100;
  let found = false;
  let shook = -100;
  return {
    view,
    update: (t) => {
      const k = t - opened;
      const open = k < 6 ? Math.min(1, k * 3, (6 - k) * 2) : 0;
      lid.rotation = -open * 0.9;
      lid.y = -12 - open * 8;
      pearl.visible = open > 0.2;
      pearl.scale.set(1 + Math.sin(t * 6) * 0.08);
      const s = t - shook;
      view.rotation = s < 0.4 ? Math.sin(s * 40) * 0.05 : 0;
    },
    poke: (t) => {
      shook = t;
      if (t - opened < 6) return;
      taps++;
      if (taps < 3) return;
      taps = 0;
      opened = t;
      if (!found) {
        found = true;
        return 'clam';
      }
    },
  };
}

// ── Frost Isle ──────────────────────────────────────────────────────────

export function fishingHut(): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 64, 22);
  // The hole in the ice, in front.
  ln(g.ellipse(26, 10, 26, 11).fill(0x1d4e6b));
  g.ellipse(22, 8, 16, 6).fill({ color: 0x3f8fb8, alpha: 0.8 });
  // The hut.
  A.isoBox(g, 0.9, 0.9, 54, 0xdbe9f5, 0xc0563b, 0xa3452e, -6);
  ln(g.poly([0, -128, -58, -72, 0, -44, 58, -72]).fill(0xf4f8ff));
  g.poly([0, -128, -58, -72, -50, -66, 0, -118]).fill({ color: 0xc9d8ea, alpha: 0.9 });
  ln(g.roundRect(-30, -62, 18, 30, 5).fill(0x6b4428), 2.5);
  ln(g.roundRect(8, -62, 16, 14, 3).fill(0xffe27a), 2.5);
  // A rod over the hole, its line and bobber.
  ln(g.moveTo(-6, -20).lineTo(44, -78).stroke({ width: 3.5, color: 0x8a5a33 }), 3.5);
  g.moveTo(44, -78).lineTo(30, 6).stroke({ width: 1.2, color: OUT });
  view.addChild(g);
  const bob = new Graphics();
  ln(bob.circle(0, 0, 4.5).fill(0xff5b6e), 2);
  bob.rect(-4.5, -1, 9, 2).fill(0xffffff);
  bob.position.set(30, 6);
  view.addChild(bob);
  sign(view, 'ICE FISHING', -146, 0x2ea7e8);
  return { view, update: (t) => (bob.y = 6 + Math.max(0, Math.sin(t * 2.4)) * 3) };
}

export function iceVault(): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 66, 24);
  A.isoBox(g, 1.3, 1.0, 96, 0xe6f7ff, 0xa9def5, 0x86c9eb);
  // The vault door on the left face.
  const door = new Container();
  const d = new Graphics();
  ln(d.circle(0, 0, 30).fill(0x9aa3b5));
  ln(d.circle(0, 0, 21).fill(0xc0c6d4), 2.5);
  for (let k = 0; k < 6; k++) d.moveTo(0, 0).lineTo(Math.cos((k * Math.PI) / 3) * 18, Math.sin((k * Math.PI) / 3) * 18).stroke({ width: 3, color: 0x6c7488 });
  ln(d.circle(0, 0, 6).fill(0xffd23f), 2);
  door.addChild(d);
  door.position.set(-30, -52);
  door.scale.set(0.8, 1);
  door.skew.y = 0.45;
  view.addChild(g, door);
  // Icicles.
  const ic = new Graphics();
  for (let i = 0; i < 6; i++) ic.poly([-60 + i * 11, -96 + i * 5.5, -54 + i * 11, -93 + i * 5.5, -57 + i * 11, -80 + i * 5.5]).fill({ color: 0xffffff, alpha: 0.9 });
  view.addChild(ic);
  sign(view, 'ICE VAULT', -164, 0x5a6fd6);
  return { view, update: (t) => (d.rotation = Math.sin(t * 0.7) * 0.6) };
}

/** The aurora crystal: tall glowing spires on a snowy rock. */
export function crystal(): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 70, 24);
  ln(g.ellipse(0, -12, 64, 24).fill(0xe8f0fb));
  ln(g.ellipse(-8, -22, 40, 14).fill(0xf4f8ff), 2.5);
  view.addChild(g);
  const glow = new Graphics();
  glow.circle(0, -120, 90).fill({ color: 0x7fe9ff, alpha: 0.18 });
  glow.circle(0, -120, 50).fill({ color: 0xc8f6ff, alpha: 0.22 });
  glow.blendMode = 'add';
  view.addChild(glow);
  const c = new Graphics();
  const spire = (x: number, h: number, w: number, col: number) => {
    ln(c.poly([x - w, -20, x - w * 0.8, -20 - h * 0.8, x, -20 - h, x + w * 0.8, -20 - h * 0.8, x + w, -20]).fill(col));
    c.poly([x - w * 0.3, -24, x - w * 0.2, -20 - h * 0.75, x, -20 - h * 0.95, x, -24]).fill({ color: 0xffffff, alpha: 0.45 });
  };
  spire(-36, 70, 12, 0xb9b0ff);
  spire(34, 84, 13, 0x9fe9ff);
  spire(-14, 150, 18, 0x7fd6ff);
  spire(12, 118, 15, 0xc8f6ff);
  view.addChild(c);
  let flare = -100;
  return {
    view,
    update: (t) => {
      const k = t - flare;
      glow.alpha = 0.7 + Math.sin(t * 1.5) * 0.3 + (k < 3 ? (3 - k) * 0.6 : 0);
      c.tint = k < 1 ? 0xffffff : 0xffffff;
    },
    poke: (t) => {
      flare = t;
    },
  };
}

export function pine(seed: number, yeti = false): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 30, 11);
  ln(g.roundRect(-6, -24, 12, 24, 3).fill(0x6b4428), 2.5);
  const s = 0.85 + seed * 0.35;
  for (let i = 0; i < 3; i++) {
    const y = -20 - i * 30 * s, w = (40 - i * 9) * s, h = 44 * s;
    ln(g.poly([-w, y, 0, y - h, w, y]).fill(i % 2 ? 0x2f8a5e : 0x37996a));
    // Snow on each tier.
    g.poly([-w * 0.55, y - h * 0.45, 0, y - h, w * 0.55, y - h * 0.45, w * 0.3, y - h * 0.38, 0, y - h * 0.5, -w * 0.3, y - h * 0.38]).fill(0xf4f8ff);
  }
  view.addChild(g);
  if (!yeti) return { view, update: (t) => (view.skew.x = Math.sin(t * 0.9 + seed * 7) * 0.02) };
  // The yeti's pine: footprints lead behind it; three taps and the yeti peeks out and waves.
  const prints = new Graphics();
  for (let i = 0; i < 5; i++) prints.ellipse(40 + i * 16, 14 + i * 7 + (i % 2) * 5, 5, 2.6).fill({ color: 0xb9c9e6, alpha: 0.9 });
  view.addChildAt(prints, 0);
  const yt = new Container();
  const y = new Graphics();
  ln(y.circle(0, 0, 20).fill(0xf4f8ff));
  for (let k = 0; k < 7; k++) y.circle(Math.cos(k) * 18, Math.sin(k) * 18 - 4, 6).fill(0xffffff);
  ln(y.ellipse(0, 4, 13, 10).fill(0x9fd8ee), 2.5);
  y.circle(-5, 1, 2.2).fill(OUT).circle(5, 1, 2.2).fill(OUT);
  y.arc(0, 8, 5, 0.2, Math.PI - 0.2).stroke({ width: 2, color: OUT });
  const hand = new Graphics();
  ln(hand.circle(0, 0, 8).fill(0xf4f8ff), 2.5);
  hand.position.set(24, -6);
  yt.addChild(y, hand);
  yt.position.set(30, -60);
  yt.visible = false;
  view.addChildAt(yt, 0);
  let taps = 0;
  let peek = -100;
  let found = false;
  let shook = -100;
  return {
    view,
    update: (t) => {
      const s2 = t - shook;
      g.skew.x = Math.sin(t * 0.9) * 0.02 + (s2 < 0.6 ? Math.sin(s2 * 30) * 0.06 * (1 - s2 / 0.6) : 0);
      const k = t - peek;
      yt.visible = k < 4.5;
      if (yt.visible) {
        yt.x = 30 + Math.min(1, k * 3, (4.5 - k) * 3) * 16;
        hand.rotation = Math.sin(k * 10) * 0.6;
        hand.y = -6 - Math.abs(Math.sin(k * 10)) * 6;
      }
    },
    poke: (t) => {
      shook = t;
      if (t - peek < 4.5) return;
      if (++taps < 3) return;
      taps = 0;
      peek = t;
      if (!found) {
        found = true;
        return 'yeti';
      }
    },
  };
}

export function igloo(): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 52, 18);
  ln(g.moveTo(-48, 0).bezierCurveTo(-48, -72, 48, -72, 48, 0).closePath().fill(0xf4f8ff));
  for (const y of [-14, -30, -46]) g.moveTo(-46 + Math.abs(y) * 0.3, y).lineTo(46 - Math.abs(y) * 0.3, y).stroke({ width: 1.5, color: 0xb9c9e6 });
  for (const [x, y] of [[-20, -7], [10, -7], [-6, -22], [24, -22], [-28, -38], [6, -38]]) g.moveTo(x, y).lineTo(x, y + 8).stroke({ width: 1.5, color: 0xb9c9e6 });
  ln(g.moveTo(-18, 0).bezierCurveTo(-18, -34, 18, -34, 18, 0).closePath().fill(0x2c4a6e), 2.5);
  gloss(g, -18, -44, 14, 6, 0.6);
  view.addChild(g);
  return { view };
}

/** A snowman; a tap pops his hat up. */
export function snowman(seed: number): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 26, 9);
  ln(g.circle(0, -18, 20).fill(0xf4f8ff));
  ln(g.circle(0, -50, 15).fill(0xf4f8ff));
  ln(g.circle(0, -74, 11).fill(0xf4f8ff));
  g.circle(-4, -76, 1.8).fill(OUT).circle(4, -76, 1.8).fill(OUT);
  ln(g.poly([0, -73, 14, -70, 0, -69]).fill(0xff8a2a), 1.5);
  for (const y of [-56, -46]) g.circle(0, y, 2).fill(OUT);
  ln(g.roundRect(-14, -66, 28, 7, 3).fill(seed > 0.5 ? 0xff5b6e : 0x2fc36f), 2);
  for (const d of [-1, 1]) g.moveTo(d * 13, -54).lineTo(d * 32, -66).stroke({ width: 3, color: 0x6b4428, cap: 'round' });
  gloss(g, -8, -26, 6, 4, 0.5);
  view.addChild(g);
  const hat = new Graphics();
  ln(hat.roundRect(-11, -16, 22, 16, 3).fill(0x2c2c3a), 2.5);
  ln(hat.roundRect(-16, -2, 32, 5, 2).fill(0x2c2c3a), 2.5);
  hat.position.set(0, -82);
  view.addChild(hat);
  let pop = -100;
  return {
    view,
    update: (t) => {
      const k = t - pop;
      hat.y = -82 - (k < 0.8 ? Math.sin((k / 0.8) * Math.PI) * 34 : 0);
      hat.rotation = k < 0.8 ? Math.sin(k * 8) * 0.4 : 0;
    },
    poke: (t) => {
      pop = t;
    },
  };
}

/** A penguin; a tap sends it sliding on its belly. The engine counts the three for the parade (a secret). */
export function penguin(seed: number): A.Thing & { slide(t: number, dir: number): void } {
  const view = new Container();
  const body = new Container();
  const g = new Graphics();
  shadow(g, 14, 5);
  view.addChild(g);
  const b = new Graphics();
  ln(b.ellipse(0, -20, 14, 20).fill(0x2c2c3a));
  b.ellipse(0, -16, 9, 14).fill(0xffffff);
  ln(b.poly([-4, -32, 4, -32, 0, -26]).fill(0xff8a2a), 1.5);
  b.circle(-4, -35, 1.7).fill(0xffffff).circle(4, -35, 1.7).fill(0xffffff);
  b.circle(-4, -35, 0.9).fill(OUT).circle(4, -35, 0.9).fill(OUT);
  ln(b.ellipse(-6, 0, 6, 3).fill(0xff8a2a), 1.5);
  ln(b.ellipse(6, 0, 6, 3).fill(0xff8a2a), 1.5);
  gloss(b, -5, -30, 3, 2, 0.4);
  body.addChild(b);
  view.addChild(body);
  let t0 = -100;
  let dir = 1;
  const dur = 1.6;
  return {
    view,
    update: (t) => {
      const k = (t - t0) / dur;
      if (k >= 0 && k < 1) {
        // Belly-slide out and back.
        const out = Math.sin(k * Math.PI);
        body.rotation = dir * Math.min(1, k * 6, (1 - k) * 6) * 1.25;
        body.x = dir * out * 70;
        body.y = -out * 6;
      } else {
        body.rotation = Math.sin(t * 3 + seed * 8) * 0.06;
        body.x = 0;
        body.y = 0;
      }
    },
    poke: (t) => {
      if (t - t0 < dur) return;
      t0 = t;
      dir = Math.random() < 0.5 ? -1 : 1;
      return 'penguin';
    },
    slide: (t, d) => {
      t0 = t;
      dir = d;
    },
  };
}

export function snowRock(seed: number): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 26, 9);
  const s = 0.8 + seed * 0.4;
  ln(g.ellipse(0, -12 * s, 24 * s, 16 * s).fill(0x8a8fa3));
  g.ellipse(-2, -22 * s, 18 * s, 8 * s).fill(0xf4f8ff);
  gloss(g, -8 * s, -20 * s, 6, 3, 0.5);
  view.addChild(g);
  return { view };
}

export function iceberg(seed: number): A.Thing {
  const view = new Container();
  const g = new Graphics();
  g.ellipse(0, 4, 34, 10).fill({ color: 0x0e3f5e, alpha: 0.3 });
  const s = 0.7 + seed * 0.6;
  ln(g.poly([-30 * s, 2, -22 * s, -24 * s, -4 * s, -40 * s, 14 * s, -30 * s, 30 * s, 2]).fill(0xf4fbff));
  g.poly([-4 * s, -40 * s, 14 * s, -30 * s, 30 * s, 2, 6 * s, 2]).fill({ color: 0xbfe6f7, alpha: 0.9 });
  view.addChild(g);
  return { view, update: (t) => (g.y = Math.sin(t * 1.3 + seed * 9) * 2) };
}

// ── Sky Kingdom ─────────────────────────────────────────────────────────

export function observatory(): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 66, 24);
  ln(g.roundRect(-56, -62, 112, 62, 10).fill(0xf4f0ff));
  g.rect(-56, -14, 112, 6).fill(0xffd23f);
  ln(g.roundRect(-14, -44, 28, 44, 12).fill(0x3b2a7a), 2.5);
  ln(g.moveTo(-60, -62).bezierCurveTo(-60, -138, 60, -138, 60, -62).closePath().fill(0x2a2363));
  g.poly([-6, -124, 6, -124, 10, -64, -10, -64]).fill(0x4a3fa0);
  for (const [x, y] of [[-34, -96], [30, -104], [-18, -116], [40, -80]]) g.star(x, y, 4, 4, 1.6).fill(0xffe27a);
  gloss(g, -30, -116, 16, 6, 0.3);
  view.addChild(g);
  const scope = new Graphics();
  ln(scope.roundRect(-6, -40, 12, 44, 5).fill(0xc0c6d4), 2.5);
  ln(scope.circle(0, -40, 7).fill(0x7fd6ff), 2);
  scope.position.set(4, -102);
  view.addChild(scope);
  const twinkle = new Graphics();
  for (const [x, y] of [[-70, -150], [64, -160], [0, -190]]) twinkle.star(x, y, 4, 7, 2.5).fill(0xfff3b0);
  view.addChild(twinkle);
  sign(view, 'STAR KENO', -170, 0x4a3fa0, 0xfff3b0);
  return {
    view,
    update: (t) => {
      scope.rotation = 0.5 + Math.sin(t * 0.5) * 0.25;
      twinkle.alpha = 0.5 + Math.sin(t * 2.4) * 0.5;
    },
  };
}

export function oracleTemple(): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 70, 24);
  A.isoBox(g, 1.4, 1.1, 14, 0xfff3d0, 0xe8c27a, 0xd4ab5e);
  for (const x of [-46, -16, 16, 46]) {
    ln(g.roundRect(x - 7, -110, 14, 96, 4).fill(0xffe9a8), 2.5);
    g.rect(x - 7, -110, 4, 96).fill({ color: 0xffffff, alpha: 0.35 });
  }
  ln(g.poly([-64, -110, 0, -150, 64, -110]).fill(0xffd23f));
  ln(g.roundRect(-66, -116, 132, 10, 4).fill(0xf2b62a), 2.5);
  // Three little chests on the steps.
  for (const x of [-30, 0, 30]) {
    ln(g.roundRect(x - 9, -24, 18, 12, 3).fill(0x8a5a33), 2);
    g.rect(x - 9, -21, 18, 2.5).fill(0xffd23f);
  }
  view.addChild(g);
  const orb = new Graphics();
  orb.circle(0, 0, 26).fill({ color: 0xd9a6ff, alpha: 0.25 });
  ln(orb.circle(0, 0, 13).fill(0xb07cff), 2.5);
  gloss(orb, -4, -5, 4, 3, 0.7);
  orb.position.set(0, -70);
  view.addChild(orb);
  sign(view, 'ORACLE’S CHESTS', -176, 0x8f62d6);
  return { view, update: (t) => { orb.y = -70 + Math.sin(t * 1.8) * 6; orb.scale.set(1 + Math.sin(t * 2.6) * 0.05); } };
}

/** The sky gong: a golden disc in a frame; ringing it brings thunder and a rainbow (the engine's show). */
export function gong(): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 56, 20);
  for (const x of [-52, 52]) ln(g.roundRect(x - 7, -150, 14, 150, 4).fill(0xb3263e), 2.5);
  ln(g.roundRect(-62, -164, 124, 18, 6).fill(0xd6203f));
  g.poly([-70, -164, -62, -176, 62, -176, 70, -164]).fill(0xffd23f).stroke({ width: 3, color: OUT });
  view.addChild(g);
  const disc = new Container();
  const d = new Graphics();
  ln(d.circle(0, 0, 40).fill(0xffd23f));
  d.circle(0, 0, 30).stroke({ width: 3, color: 0xf2b62a });
  ln(d.circle(0, 0, 10).fill(0xffe9a8), 2.5);
  gloss(d, -14, -16, 10, 6, 0.6);
  for (const x of [-20, 20]) g.moveTo(x, -146).lineTo(x * 0.6, -112).stroke({ width: 2.5, color: OUT });
  disc.addChild(d);
  disc.position.set(0, -84);
  view.addChild(disc);
  let hit = -100;
  return {
    view,
    update: (t) => {
      const k = t - hit;
      disc.rotation = k < 2 ? Math.sin(k * 30) * 0.08 * (2 - k) : Math.sin(t * 0.6) * 0.02;
      disc.scale.set(k < 2 ? 1 + Math.sin(k * 50) * 0.03 * (2 - k) : 1);
    },
    poke: (t) => {
      hit = t;
    },
  };
}

export function cloudTree(seed: number): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 30, 11);
  ln(g.poly([-6, 0, 6, 0, 4, -40, -4, -40]).fill(0xc9a27a), 2.5);
  const pink = seed > 0.6;
  const s = 0.85 + seed * 0.3;
  for (const [x, y, r] of [[-18, -52, 18], [16, -54, 18], [0, -70, 22], [-8, -84, 14], [10, -82, 14]] as const)
    ln(g.circle(x * s, y * s, r * s).fill(pink ? 0xffd6ec : 0xffffff), 2.5);
  gloss(g, -8 * s, -78 * s, 8 * s, 4 * s, 0.5);
  view.addChild(g);
  return { view, update: (t) => (g.y = Math.sin(t * 1.1 + seed * 6) * 1.5) };
}

export function goldPillar(seed: number): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 18, 7);
  const h = 44 + seed * 30;
  ln(g.roundRect(-12, -10, 24, 10, 3).fill(0xf2b62a), 2.5);
  ln(g.roundRect(-9, -10 - h, 18, h, 3).fill(0xffe27a), 2.5);
  for (const x of [-4, 3]) g.moveTo(x, -12).lineTo(x, -8 - h).stroke({ width: 1.5, color: 0xf2b62a });
  ln(g.poly([-12, -10 - h, 12, -10 - h, 8, -18 - h, -4, -14 - h]).fill(0xffe9a8), 2.5);
  view.addChild(g);
  return { view };
}

/** A pot of gold at the rainbow's end (stand next to it: a secret). */
export function potOfGold(): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 26, 9);
  ln(g.ellipse(0, -18, 22, 18).fill(0x2c2c3a));
  ln(g.ellipse(0, -32, 20, 7).fill(0x3a3a4a), 2.5);
  for (const [x, y] of [[-10, -36], [0, -40], [10, -36], [-4, -44], [6, -46]]) ln(g.ellipse(x, y, 6, 3.5).fill(0xffd23f), 1.5);
  view.addChild(g);
  const sparkle = new Graphics();
  for (const [x, y] of [[-16, -58], [14, -62], [0, -72]]) sparkle.star(x, y, 4, 6, 2).fill(0xfff3b0);
  view.addChild(sparkle);
  return { view, update: (t) => { sparkle.alpha = 0.4 + Math.abs(Math.sin(t * 3)) * 0.6; sparkle.rotation = Math.sin(t) * 0.05; } };
}

/** The moon hanging in the Sky Kingdom's sky. Five taps and a flying saucer zips past (a secret). */
export function moon(): A.Thing {
  const view = new Container();
  const glow = new Graphics();
  glow.circle(0, -220, 90).fill({ color: 0xfff6c2, alpha: 0.18 });
  glow.blendMode = 'add';
  const g = new Graphics();
  ln(g.circle(0, -220, 50).fill(0xfff3b0));
  g.circle(22, -236, 46).fill(BACK_SKY);
  for (const [x, y, r] of [[-22, -210, 6], [-10, -188, 4], [-30, -236, 4]] as const) g.circle(x, y, r).fill({ color: 0xf2d66a, alpha: 0.9 });
  view.addChild(glow, g);
  // The saucer.
  const ufo = new Container();
  const u = new Graphics();
  u.poly([-12, 10, 12, 10, 40, 120, -40, 120]).fill({ color: 0xc8ffb0, alpha: 0.35 });
  ln(u.ellipse(0, 0, 36, 11).fill(0xc0c6d4));
  ln(u.ellipse(0, -8, 16, 12).fill({ color: 0x9fe9ff, alpha: 0.9 }), 2.5);
  for (const x of [-22, -8, 8, 22]) u.circle(x, 3, 2.6).fill(0xffe27a);
  ufo.addChild(u);
  ufo.visible = false;
  view.addChild(ufo);
  let taps = 0;
  let fly = -100;
  let found = false;
  let bump = -100;
  return {
    view,
    update: (t) => {
      const b = t - bump;
      g.scale.set(b < 0.3 ? 1 + Math.sin((b / 0.3) * Math.PI) * 0.06 : 1);
      const k = (t - fly) / 3.2;
      ufo.visible = k >= 0 && k < 1;
      if (ufo.visible) {
        ufo.position.set(-420 + k * 1100, -170 + Math.sin(k * 14) * 18 + (k > 0.4 && k < 0.6 ? 30 : 0));
        ufo.rotation = Math.sin(k * 20) * 0.08;
      }
    },
    poke: (t) => {
      bump = t;
      if (t - fly < 3.2) return;
      if (++taps < 5) return;
      taps = 0;
      fly = t;
      if (!found) {
        found = true;
        return 'ufo';
      }
    },
  };
}

/** The Sky Kingdom's background colour (the moon's dark side matches it). */
export const BACK_SKY = 0x8fd3ff;

// ── VIP Salon ───────────────────────────────────────────────────────────

export const GEM_COLOURS: Record<string, number> = { pearl: 0xfff6fb, sapphire: 0x3e6fd6, ruby: 0xe5394b, emerald: 0x2fc36f, diamond: 0x9fe9ff };

/** The Diamond Wheel: a tall money wheel on a gold stand, turning slowly. */
export function diamondWheelStand(segments: number[], gems: string[]): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 60, 22);
  A.isoBox(g, 1.0, 0.7, 18, 0xffe27a, 0xd4ab5e, 0xc29a4c);
  ln(g.poly([-30, -18, -8, -150, 8, -150, 30, -18]).fill(0xf2b62a));
  view.addChild(g);
  const wheel = new Container();
  const w = new Graphics();
  const n = segments.length;
  ln(w.circle(0, 0, 74).fill(0x2c1d3f));
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
    w.moveTo(0, 0).arc(0, 0, 66, a0, a1).lineTo(0, 0).fill(GEM_COLOURS[gems[segments[i]]] ?? 0xffffff);
    w.moveTo(0, 0).lineTo(Math.cos(a0) * 66, Math.sin(a0) * 66).stroke({ width: 1.5, color: OUT, alpha: 0.6 });
  }
  for (let i = 0; i < 16; i++) w.circle(Math.cos((i / 16) * Math.PI * 2) * 70, Math.sin((i / 16) * Math.PI * 2) * 70, 2.6).fill(0xffe27a);
  ln(w.circle(0, 0, 14).fill(0xffd23f), 2.5);
  w.star(0, 0, 4, 8, 3).fill(0xffffff);
  wheel.addChild(w);
  wheel.position.set(0, -160);
  view.addChild(wheel);
  const pointer = new Graphics();
  ln(pointer.poly([-10, -244, 10, -244, 0, -226]).fill(0xff3b4e), 2.5);
  view.addChild(pointer);
  return { view, update: (t) => (wheel.rotation = t * 0.25) };
}

// ── The main island's secrets ───────────────────────────────────────────

/** A message in a bottle washed up on the beach (tap it: a secret). */
export function bottle(): A.Thing {
  const view = new Container();
  const g = new Graphics();
  shadow(g, 18, 6);
  g.rotation = -0.2;
  ln(g.roundRect(-16, -12, 26, 12, 6).fill({ color: 0x8fe0c8, alpha: 0.85 }), 2.5);
  ln(g.roundRect(8, -9, 10, 6, 2).fill({ color: 0x8fe0c8, alpha: 0.85 }), 2);
  ln(g.roundRect(17, -9, 5, 6, 1).fill(0x8a5a33), 1.5);
  g.roundRect(-11, -9, 14, 6, 2).fill(0xfff6e5);
  gloss(g, -8, -10, 6, 1.5, 0.7);
  view.addChild(g);
  const glint = new Graphics();
  glint.star(0, 0, 4, 7, 2).fill(0xffffff);
  glint.position.set(-6, -18);
  view.addChild(glint);
  let found = false;
  return {
    view,
    update: (t) => { glint.alpha = Math.max(0, Math.sin(t * 2.2)) ** 6; glint.rotation = t; },
    poke: () => {
      if (!found) {
        found = true;
        return 'bottle';
      }
      return 'bottle-again';
    },
  };
}

/** Kraken tentacles rising out of the sea at (0, 0), waving, and sinking again over `life` seconds. */
export function kraken(life = 4.5): A.Thing & { done(t: number): boolean; start(t: number): void } {
  const view = new Container();
  const arms: Graphics[] = [];
  let t0 = 0;
  for (const [x, s] of [[-60, 0.9], [0, 1.2], [56, 1]] as const) {
    const a = new Graphics();
    a.position.set(x, 0);
    a.scale.set(s);
    view.addChild(a);
    arms.push(a);
  }
  const ring = new Graphics();
  ring.ellipse(0, 0, 110, 26).stroke({ width: 4, color: 0xffffff, alpha: 0.8 });
  view.addChildAt(ring, 0);
  const draw = (a: Graphics, k: number, wave: number) => {
    a.clear();
    // A tapering, curling tentacle: a chain of circles along a wave, suckers on the inside.
    const h = 150 * k;
    for (let i = 0; i <= 14; i++) {
      const f = i / 14;
      const x = Math.sin(f * 3 + wave) * 22 * f + f * f * 16;
      const y = -f * h;
      const r = 15 * (1 - f * 0.75);
      a.circle(x, y, r + 3).fill(OUT);
    }
    for (let i = 0; i <= 14; i++) {
      const f = i / 14;
      const x = Math.sin(f * 3 + wave) * 22 * f + f * f * 16;
      const y = -f * h;
      const r = 15 * (1 - f * 0.75);
      a.circle(x, y, r).fill(0xb05ad6);
      if (i % 2 === 0 && i < 12) a.circle(x - r * 0.4, y, r * 0.3).fill(0xf2c8ff);
    }
  };
  return {
    view,
    start: (t) => (t0 = t),
    done: (t) => t - t0 > life,
    update: (t) => {
      const k = t - t0;
      const up = Math.max(0, Math.min(1, k / 0.7, (life - k) / 0.8));
      arms.forEach((a, i) => draw(a, up, t * 2.4 + i * 1.7));
      ring.alpha = up * (0.5 + Math.sin(t * 6) * 0.3);
      ring.scale.set(1 + Math.sin(t * 3) * 0.05);
    },
  };
}

/** Tile size, for callers placing things between tiles. */
export const TILE = { HW, HH };

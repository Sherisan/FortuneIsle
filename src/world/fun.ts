import { Container, Graphics } from 'pixi.js';
import { OUT } from './art.ts';

/*
 * Cosmetic world effects: a small particle system (fireworks, lava bombs and their splats, smoke, a bouncing coconut,
 * splashes, fireflies) and the island's ambient life (gull flocks, jumping fish). Nothing here touches money.
 * Units are pixels and seconds.
 */

interface Particle {
  g: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  life: number;
  max: number;
  grow: number;
  spin: number;
  /** Bounces (or splats) when it falls back to this y. */
  ground?: number;
  bounces?: number;
  onLand?: (x: number, y: number) => void;
  /** Gone when it lands (a lava bomb splats). */
  vanish?: boolean;
  wander?: number;
  fadeIn?: boolean;
  /** Point along its velocity (a leaping dolphin). */
  align?: boolean;
}

export class Particles {
  readonly layer = new Container();
  private list: Particle[] = [];

  private add(g: Graphics, p: Omit<Particle, 'g' | 'max'>) {
    g.position.set(p.x, p.y);
    this.layer.addChild(g);
    this.list.push({ ...p, g, max: p.life });
  }

  /** Fireworks: a ring of sparks in one colour family, drifting down. */
  firework(x: number, y: number) {
    const families = [[0xff5b6e, 0xffd23f], [0x4fc3ff, 0xffffff], [0xb07cff, 0xff9bc8], [0x5fd38a, 0xffe27a]];
    const fam = families[Math.floor(Math.random() * families.length)];
    for (let i = 0; i < 56; i++) {
      const a = (i / 56) * Math.PI * 2, v = 260 + Math.random() * 120;
      const g = new Graphics();
      g.circle(0, 0, 9).fill({ color: fam[i % 2], alpha: 0.35 });
      g.circle(0, 0, 5).fill(fam[i % 2]);
      g.blendMode = 'add';
      this.add(g, { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, gravity: 130, life: 1.3 + Math.random() * 0.4, grow: -0.3, spin: 0 });
    }
    const flash = new Graphics();
    flash.circle(0, 0, 22).fill({ color: fam[1], alpha: 0.5 });
    flash.blendMode = 'add';
    this.add(flash, { x, y, vx: 0, vy: 0, gravity: 0, life: 0.3, grow: 1.5, spin: 0 });
  }

  /** A glowing lava bomb thrown from (x, y); it splats where it lands. */
  lavaBomb(x: number, y: number, ground: number) {
    const g = new Graphics();
    const r = 6 + Math.random() * 6;
    g.circle(0, 0, r).fill(0xff5a1f).stroke({ width: 2.5, color: OUT });
    g.circle(-r * 0.3, -r * 0.3, r * 0.4).fill(0xfff1a8);
    this.add(g, {
      x, y, vx: (Math.random() - 0.5) * 560, vy: -420 - Math.random() * 260, gravity: 900, life: 4, grow: 0, spin: (Math.random() - 0.5) * 8,
      ground, vanish: true, onLand: (lx, ly) => this.splat(lx, ly),
    });
  }

  private splat(x: number, y: number) {
    const g = new Graphics();
    g.ellipse(0, 0, 22, 9).fill({ color: 0xff7a2a, alpha: 0.9 });
    g.ellipse(-3, -1, 10, 4).fill({ color: 0xfff1a8, alpha: 0.9 });
    g.blendMode = 'add';
    this.add(g, { x, y, vx: 0, vy: 0, gravity: 0, life: 1.6, grow: 0.3, spin: 0 });
    for (let i = 0; i < 6; i++) {
      const s = new Graphics();
      s.circle(0, 0, 2.5).fill(0xffb347);
      this.add(s, { x, y, vx: (Math.random() - 0.5) * 160, vy: -80 - Math.random() * 120, gravity: 500, life: 0.6, grow: 0, spin: 0 });
    }
  }

  smoke(x: number, y: number, n: number, color = 0x6f6470) {
    for (let i = 0; i < n; i++) {
      const g = new Graphics();
      g.circle(0, 0, 22).fill({ color, alpha: 0.7 });
      g.circle(8, -6, 14).fill({ color: 0xffffff, alpha: 0.15 });
      this.add(g, { x: x + (Math.random() - 0.5) * 60, y, vx: (Math.random() - 0.5) * 70, vy: -60 - Math.random() * 90, gravity: -8, life: 2.5 + Math.random(), grow: 0.9, spin: 0 });
    }
  }

  /** A coconut dropping from a palm's crown, bouncing twice and rolling to a stop. */
  coconut(x: number, y: number, ground: number, onBonk: () => void) {
    const g = new Graphics();
    g.circle(0, 0, 7).fill(0x7a4a22).stroke({ width: 2.5, color: OUT });
    g.circle(-2, -3, 2.5).fill({ color: 0xffffff, alpha: 0.35 });
    let first = true;
    this.add(g, {
      x, y, vx: (Math.random() - 0.5) * 40, vy: 0, gravity: 1100, life: 3.4, grow: 0, spin: 3, ground, bounces: 2,
      onLand: () => {
        if (first) onBonk();
        first = false;
      },
    });
  }

  splash(x: number, y: number) {
    const ring = new Graphics();
    ring.ellipse(0, 0, 14, 5).stroke({ width: 2.5, color: 0xffffff, alpha: 0.9 });
    this.add(ring, { x, y, vx: 0, vy: 0, gravity: 0, life: 0.7, grow: 2.2, spin: 0 });
    for (let i = 0; i < 7; i++) {
      const d = new Graphics();
      d.circle(0, 0, 2.2).fill(0xffffff);
      this.add(d, { x, y, vx: (Math.random() - 0.5) * 110, vy: -110 - Math.random() * 90, gravity: 520, life: 0.55, grow: 0, spin: 0 });
    }
  }

  /** Fireflies drifting around (x, y) for a while. */
  fireflies(x: number, y: number, n: number, life: number) {
    for (let i = 0; i < n; i++) {
      const g = new Graphics();
      g.circle(0, 0, 7).fill({ color: 0xc8ff6a, alpha: 0.3 });
      g.circle(0, 0, 2.5).fill(0xf4ffc2);
      g.blendMode = 'add';
      this.add(g, {
        x: x + (Math.random() - 0.5) * 380, y: y - Math.random() * 220, vx: 0, vy: 0, gravity: 0, life: life * (0.7 + Math.random() * 0.3),
        grow: 0, spin: 0, wander: Math.random() * 10, fadeIn: true,
      });
    }
  }

  /** A dolphin leaping in an arc from (x, y) towards dir (±1), with a splash at each end. */
  dolphin(x: number, y: number, dir: number) {
    const g = new Graphics();
    const X = (v: number) => v * dir;
    g.poly([X(-22), 0, X(-38), -10, X(-35), 10]).fill(0x5d97c9).stroke({ width: 2.5, color: OUT });
    g.ellipse(0, 0, 27, 10).fill(0x6fa8d6).stroke({ width: 2.5, color: OUT });
    g.ellipse(X(4), 4, 17, 4).fill(0xdbefff);
    g.poly([X(-2), -8, X(-10), -20, X(8), -9]).fill(0x5d97c9).stroke({ width: 2.5, color: OUT });
    g.circle(X(15), -2, 1.9).fill(OUT);
    g.moveTo(X(19), 3).lineTo(X(26), 2).stroke({ width: 1.5, color: OUT });
    this.splash(x, y);
    this.add(g, { x, y, vx: dir * 200, vy: -440, gravity: 640, life: 1.7, grow: 0, spin: 0, ground: y + 1, vanish: true, align: true, onLand: (lx, ly) => this.splash(lx, ly) });
  }

  /** Bubbles rising from (x, y). */
  bubbles(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const g = new Graphics();
      const r = 3 + Math.random() * 6;
      g.circle(0, 0, r).stroke({ width: 2, color: 0xffffff, alpha: 0.9 }).circle(-r * 0.35, -r * 0.35, r * 0.25).fill({ color: 0xffffff, alpha: 0.8 });
      this.add(g, { x: x + (Math.random() - 0.5) * 120, y: y - Math.random() * 40, vx: 0, vy: -50 - Math.random() * 50, gravity: -20, life: 2 + Math.random() * 1.5, grow: 0.3, spin: 0, wander: Math.random() * 10 });
    }
  }

  /** A burst of snow (or stardust) from (x, y). */
  burst(x: number, y: number, n: number, color = 0xffffff) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 80 + Math.random() * 220;
      const g = new Graphics();
      g.circle(0, 0, 2 + Math.random() * 3).fill({ color, alpha: 0.95 });
      g.blendMode = 'add';
      this.add(g, { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, gravity: 160, life: 1.2 + Math.random() * 0.8, grow: -0.4, spin: 0 });
    }
  }

  /** A twinkling star that fades where it is (a sparkle trail). */
  sparkle(x: number, y: number, color: number) {
    const g = new Graphics();
    g.star(0, 0, 4, 8, 3).fill(color);
    g.blendMode = 'add';
    this.add(g, { x, y, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 30, gravity: 0, life: 0.9, grow: -0.6, spin: 3 });
  }

  /** A lightning bolt from (x, top) down to (x, bottom), gone in a blink. */
  bolt(x: number, top: number, bottom: number) {
    const g = new Graphics();
    const pts: number[] = [0, 0];
    let cx = 0;
    const steps = 9;
    for (let i = 1; i <= steps; i++) {
      cx += (Math.random() - 0.5) * 60;
      pts.push(cx, ((bottom - top) * i) / steps);
    }
    g.poly(pts, false).stroke({ width: 14, color: 0xb9d4ff, alpha: 0.35, join: 'round' });
    g.poly(pts, false).stroke({ width: 5, color: 0xffffff, join: 'round' });
    g.blendMode = 'add';
    this.add(g, { x, y: top, vx: 0, vy: 0, gravity: 0, life: 0.35, grow: 0, spin: 0 });
  }

  update(dt: number, t: number) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.wander !== undefined) {
        p.vx = Math.sin(t * 1.3 + p.wander) * 30;
        p.vy = Math.cos(t * 1.1 + p.wander * 1.7) * 22;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.ground !== undefined && p.y >= p.ground && p.vy > 0) {
        p.y = p.ground;
        p.onLand?.(p.x, p.y);
        if (p.vanish) p.life = 0;
        else if (p.bounces && p.bounces > 0) {
          p.bounces--;
          p.vy = -p.vy * 0.38;
          p.vx *= 0.8;
        } else {
          p.vy = 0;
          p.gravity = 0;
          p.vx *= 0.9;
          p.spin *= 0.9;
        }
      }
      const k = 1 - p.life / p.max;
      p.g.position.set(p.x, p.y);
      if (p.align) p.g.rotation = Math.atan2(p.vy, Math.abs(p.vx)) * Math.sign(p.vx || 1);
      else p.g.rotation += p.spin * dt;
      p.g.scale.set(Math.max(0.05, 1 + p.grow * k));
      p.g.alpha = Math.max(0, Math.min(1, p.life / Math.min(0.6, p.max * 0.4), p.fadeIn ? (p.max - p.life) * 2 : 1));
      if (p.life <= 0) {
        p.g.destroy();
        this.list.splice(i, 1);
      }
    }
  }
}

// ── Ambient life ────────────────────────────────────────────────────────

interface Gull {
  g: Container;
  wing: Graphics;
  vx: number;
  phase: number;
}

/**
 * Gull flocks crossing the sky now and then, and fish jumping out of the sea near the camera.
 * view() gives the camera's world rect; isSea(x, y) says whether a world point is open water.
 */
export class Ambient {
  readonly sky = new Container();
  private gulls: Gull[] = [];
  private nextFlock = 4;
  private nextFish = 2;
  private fish: { g: Graphics; x0: number; y0: number; t: number; dir: number }[] = [];

  constructor(
    private particles: Particles,
    private view: () => { x: number; y: number; w: number; h: number },
    private isSea: (x: number, y: number) => boolean,
  ) {}

  update(dt: number, t: number) {
    const v = this.view();
    // Flocks
    this.nextFlock -= dt;
    if (this.nextFlock <= 0) {
      this.nextFlock = 14 + Math.random() * 12;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const n = 3 + Math.floor(Math.random() * 3);
      const y = v.y - v.h * 0.35 + Math.random() * v.h * 0.4;
      for (let i = 0; i < n; i++) {
        const g = new Container();
        const wing = new Graphics();
        wing.moveTo(-14, -2).quadraticCurveTo(-7, -9, 0, 0).quadraticCurveTo(7, -9, 14, -2).stroke({ width: 3.5, color: 0xffffff, cap: 'round', join: 'round' });
        wing.moveTo(-14, -2).quadraticCurveTo(-7, -9, 0, 0).quadraticCurveTo(7, -9, 14, -2).stroke({ width: 1.2, color: OUT, alpha: 0.6, cap: 'round' });
        g.addChild(wing);
        g.position.set(v.x - (dir * v.w) / 2 - dir * (60 + i * 46), y + (i % 2 ? 26 : 0) + i * 8);
        g.scale.set(0.9 + Math.random() * 0.3);
        this.sky.addChild(g);
        this.gulls.push({ g, wing, vx: dir * (150 + Math.random() * 20), phase: Math.random() * 6 });
      }
    }
    for (let i = this.gulls.length - 1; i >= 0; i--) {
      const b = this.gulls[i];
      b.g.x += b.vx * dt;
      b.g.y += Math.sin(t * 2 + b.phase) * 8 * dt;
      b.wing.scale.y = 0.5 + Math.abs(Math.sin(t * 7 + b.phase)) * 0.8;
      if (Math.abs(b.g.x - v.x) > v.w) {
        b.g.destroy({ children: true });
        this.gulls.splice(i, 1);
      }
    }
    // Fish
    this.nextFish -= dt;
    if (this.nextFish <= 0) {
      this.nextFish = 2.5 + Math.random() * 4;
      for (let tries = 0; tries < 8; tries++) {
        const x = v.x + (Math.random() - 0.5) * v.w * 0.9, y = v.y + (Math.random() - 0.5) * v.h * 0.9;
        if (!this.isSea(x, y) || !this.isSea(x + 40, y)) continue;
        const g = new Graphics();
        g.ellipse(0, 0, 11, 5).fill(Math.random() < 0.5 ? 0xffa63d : 0x7fd6ff).stroke({ width: 2, color: OUT });
        g.poly([-10, 0, -18, -6, -18, 6]).fill(0xff8a2a).stroke({ width: 2, color: OUT });
        g.circle(6, -1, 1.4).fill(OUT);
        this.sky.addChild(g);
        const dir = Math.random() < 0.5 ? 1 : -1;
        this.fish.push({ g, x0: x, y0: y, t: 0, dir });
        this.particles.splash(x, y);
        break;
      }
    }
    for (let i = this.fish.length - 1; i >= 0; i--) {
      const f = this.fish[i];
      f.t += dt / 0.9;
      const k = Math.min(1, f.t);
      const x = f.x0 + f.dir * k * 46, y = f.y0 - Math.sin(k * Math.PI) * 52;
      f.g.position.set(x, y);
      f.g.scale.x = f.dir;
      f.g.rotation = f.dir * (k - 0.5) * 1.6;
      if (f.t >= 1) {
        this.particles.splash(x, f.y0);
        f.g.destroy();
        this.fish.splice(i, 1);
      }
    }
  }
}

// ── Weather for the isles ───────────────────────────────────────────────

/** Frost Isle's snowfall: flakes drifting down through the camera's view (wrapped round it as it moves). */
export class Snowfall {
  readonly layer = new Container();
  private flakes: { g: Graphics; x: number; y: number; vy: number; sway: number; phase: number }[] = [];

  constructor(private view: () => { x: number; y: number; w: number; h: number }, n = 110) {
    const v = view();
    for (let i = 0; i < n; i++) {
      const g = new Graphics();
      const r = 1.6 + Math.random() * 2.6;
      g.circle(0, 0, r).fill({ color: 0xffffff, alpha: 0.75 + Math.random() * 0.25 });
      this.layer.addChild(g);
      this.flakes.push({ g, x: v.x + (Math.random() - 0.5) * v.w, y: v.y + (Math.random() - 0.5) * v.h, vy: 30 + r * 14, sway: 10 + Math.random() * 20, phase: Math.random() * 6 });
    }
  }

  update(dt: number, t: number) {
    const v = this.view();
    const left = v.x - v.w / 2 - 40, right = v.x + v.w / 2 + 40, top = v.y - v.h / 2 - 40, bottom = v.y + v.h / 2 + 40;
    for (const f of this.flakes) {
      f.y += f.vy * dt;
      f.x += Math.sin(t * 0.9 + f.phase) * f.sway * dt;
      if (f.y > bottom) { f.y = top; f.x = left + Math.random() * (right - left); }
      if (f.y < top) f.y = bottom;
      if (f.x < left) f.x += right - left;
      if (f.x > right) f.x -= right - left;
      f.g.position.set(f.x, f.y);
    }
  }
}

/**
 * The Sky Kingdom's sky: a gradient behind everything, a sea of clouds drifting below the floating islands, and a few
 * wisps drifting over them. Coordinates are world pixels within the map's bounds.
 */
export class CloudSea {
  readonly backdrop = new Graphics();
  readonly below = new Container();
  readonly above = new Container();
  private clouds: { c: Container; vx: number }[] = [];

  constructor(private b: { minX: number; maxX: number; minY: number; maxY: number }) {
    const w = b.maxX - b.minX, h = b.maxY - b.minY;
    // The gradient: deep blue at the top to pale near the cloud sea.
    const top = [0x5fa8e8, 0x8fd3ff, 0xc9ecff, 0xfff1f8];
    const bands = 24;
    for (let i = 0; i < bands; i++) {
      const f = i / (bands - 1);
      const seg = Math.min(top.length - 2, Math.floor(f * (top.length - 1)));
      const k = f * (top.length - 1) - seg;
      this.backdrop.rect(b.minX - 2000, b.minY - 1500 + ((h + 3000) * i) / bands, w + 4000, (h + 3000) / bands + 2).fill(mix(top[seg], top[seg + 1], k));
    }
    for (let i = 0; i < 34; i++) this.puff(this.below, b.minX + Math.random() * w, b.minY + h * (0.15 + Math.random() * 0.95), 0.8 + Math.random() * 1.2, 0.9);
    // A few thin wisps drift over everything, along the top and bottom so they never hide the islands for long.
    for (let i = 0; i < 4; i++) this.puff(this.above, b.minX + Math.random() * w, b.minY + (i % 2 ? h * (0.92 + Math.random() * 0.1) : h * Math.random() * 0.08), 0.7 + Math.random() * 0.5, 0.28);
  }

  private puff(layer: Container, x: number, y: number, s: number, alpha: number) {
    const c = new Container();
    const g = new Graphics();
    const blobs: [number, number, number][] = [[-60, 0, 40], [-20, -18, 50], [30, -10, 46], [70, 4, 34], [0, 10, 44]];
    for (const [bx, by, r] of blobs) g.circle(bx, by + 12, r).fill({ color: 0xc9dcf2, alpha });
    for (const [bx, by, r] of blobs) g.circle(bx, by, r).fill({ color: 0xffffff, alpha });
    c.addChild(g);
    c.position.set(x, y);
    c.scale.set(s);
    layer.addChild(c);
    this.clouds.push({ c, vx: (6 + Math.random() * 12) * (Math.random() < 0.5 ? -1 : 1) });
  }

  update(dt: number) {
    const { minX, maxX } = this.b;
    for (const k of this.clouds) {
      k.c.x += k.vx * dt;
      if (k.c.x > maxX + 300) k.c.x = minX - 300;
      if (k.c.x < minX - 300) k.c.x = maxX + 300;
    }
  }
}

function mix(a: number, b: number, k: number) {
  const ch = (c: number, s: number) => (c >> s) & 255;
  const m = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * k) << s;
  return m(16) | m(8) | m(0);
}

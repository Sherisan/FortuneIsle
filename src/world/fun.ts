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
      p.g.rotation += p.spin * dt;
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

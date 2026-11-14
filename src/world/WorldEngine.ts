import { Application, Container, CullerPlugin, extensions, Graphics, Point } from 'pixi.js';
import type { ZoneKey } from '../api/types.ts';
import * as A from './art.ts';
import { buildGround, type GroundLayers } from './ground.ts';
import { buildMap, findPath, idx, inside, N, nearestWalkable, TH, toGrid, toScreen, TW, type Cell, type Spot, type WorldMap } from './map.ts';

extensions.add(CullerPlugin);

/*
 * WorldEngine (Pixi): the island, the camera, input and every entity. The player is one entity among others, moving
 * by move targets (path tiles), so a remote player could later be another entity driven by a MovementSync.
 * React talks to it through the callbacks and the public methods; it never touches money.
 */

export interface WorldCallbacks {
  onZone(zone: ZoneKey): void;
  onNear(spot: Spot | null): void;
  onInteract(spot: Spot): void;
  onLocked(zone: ZoneKey): void;
}

const SPEED = 4.6; // tiles per second
const NEAR = 1.75; // tiles

export class WorldEngine {
  private app = new Application();
  private world = new Container();
  private entities = new Container();
  private ground!: GroundLayers;
  private map: WorldMap = buildMap();
  private things: A.Thing[] = [];
  private gateViews: { zone: ZoneKey; view: Container }[] = [];
  private lockLabels: { zone: ZoneKey; view: Container }[] = [];
  private spotViews = new Map<string, Container>();
  private sparkles: { g: Graphics; phase: number; speed: number }[] = [];
  private open = new Set<ZoneKey>(['harbour', 'boardwalk', 'fairground']);
  private avatar = A.avatar();
  private petThing: A.Thing | null = null;
  private parrot = A.parrot();
  private markerThing = A.marker();
  private tap = A.tapRing();
  private player = { gx: 0, gy: 0, dir: 0, moving: false, path: [] as [number, number][] };
  private pet = { gx: 0, gy: 0 };
  private pendingSpot: Spot | null = null;
  private near: Spot | null = null;
  private zone: ZoneKey | null = null;
  private cam = { x: 0, y: 0, zoom: 1, target: 1 };
  private focus: { x: number; y: number; zoom: number } | null = null;
  private paused = false;
  private keys = new Set<string>();
  private pointers = new Map<number, { x: number; y: number; sx: number; sy: number }>();
  private pinch: { d: number; zoom: number } | null = null;
  private time = 0;
  private stepTimer = 0;
  private destroyed = false;
  private disposers: (() => void)[] = [];

  private constructor(
    private host: HTMLElement,
    private cb: WorldCallbacks,
  ) {}

  static async create(host: HTMLElement, cb: WorldCallbacks): Promise<WorldEngine> {
    const e = new WorldEngine(host, cb);
    await e.init();
    return e;
  }

  private async init() {
    try {
      await document.fonts.load('700 16px Fredoka');
    } catch {
      /* fall back to the default font */
    }
    await this.app.init({
      background: 0x1b8cc2,
      resizeTo: this.host,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      powerPreference: 'high-performance',
    });
    if (this.destroyed) {
      this.app.destroy(true);
      return;
    }
    this.host.appendChild(this.app.canvas);
    this.app.canvas.style.touchAction = 'none';
    this.app.stage.addChild(this.world);

    this.ground = buildGround(this.map);
    const sparkleLayer = new Container();
    this.world.addChild(this.ground.water, sparkleLayer, this.ground.foam, this.ground.land, this.ground.fog);
    this.entities.sortableChildren = true;
    this.world.addChild(this.tap.view, this.entities);
    this.things.push(this.tap);

    for (let i = 0; i < 70; i++) {
      const g = new Graphics();
      g.ellipse(0, 0, 9, 2.2).fill({ color: 0xffffff, alpha: 0.85 });
      sparkleLayer.addChild(g);
      this.sparkles.push({ g, phase: Math.random(), speed: 0.25 + Math.random() * 0.35 });
      this.placeSparkle(this.sparkles[i]);
    }
    this.foamPulse();

    for (const p of this.map.props) {
      const t = this.makeProp(p.kind, p.seed);
      if (!t) continue;
      this.add(t, p.gx, p.gy, p.size ? p.size * TH * 0.35 : 0);
    }
    for (const s of this.map.spots) {
      const t = this.makeSpot(s);
      this.add(t, s.gx, s.gy);
      this.spotViews.set(s.id, t.view);
    }
    for (const g of this.map.gates) {
      const zl = { casino: 2, jungle: 3, volcano: 4 }[g.zone as 'casino' | 'jungle' | 'volcano'] ?? 1;
      const t = A.gate(zl);
      this.add(t, g.gx, g.gy, 2);
      this.gateViews.push({ zone: g.zone, view: t.view });
    }
    for (const z of ['casino', 'jungle', 'volcano'] as ZoneKey[]) {
      const [cx, cy] = this.map.centers[z];
      const v = new Container();
      const zl = { casino: 2, jungle: 3, volcano: 4 }[z as 'casino' | 'jungle' | 'volcano'];
      const lbl = A.label(`🔒 Level ${zl}`, 26, 0xffe27a);
      v.addChild(lbl);
      const { x, y } = toScreen(cx, cy);
      v.position.set(x, y - 30);
      v.zIndex = 1e6;
      this.entities.addChild(v);
      this.lockLabels.push({ zone: z, view: v });
    }

    // Player, pet, parrot, marker.
    const { gx, gy } = this.map.spawn;
    Object.assign(this.player, { gx, gy });
    Object.assign(this.pet, { gx: gx - 0.8, gy: gy + 0.4 });
    this.entities.addChild(this.avatar.view, this.parrot.view, this.markerThing.view);
    this.markerThing.view.visible = false;
    this.things.push(this.markerThing);
    const p0 = toScreen(gx, gy);
    this.cam.x = p0.x;
    this.cam.y = p0.y - 40;
    this.cam.zoom = this.cam.target = this.defaultZoom();
    this.applyOpen();

    this.bindInput();
    this.app.ticker.add((tk) => this.update(Math.min(0.05, tk.deltaMS / 1000)));
    this.emitZone();
  }

  destroy() {
    this.destroyed = true;
    this.disposers.forEach((d) => d());
    try {
      this.app.destroy(true, { children: true });
    } catch {
      /* not initialised yet */
    }
  }

  // ── Public API ────────────────────────────────────────────────────────

  setOpenZones(zones: ZoneKey[]) {
    const next = new Set(zones);
    if ([...next].every((z) => this.open.has(z)) && next.size === this.open.size) return;
    this.open = next;
    this.applyOpen();
  }

  setLook(look: A.Look) {
    this.avatar.setLook(look);
    if (this.petThing) {
      this.petThing.view.destroy({ children: true });
      this.things = this.things.filter((t) => t !== this.petThing);
    }
    this.petThing = A.pet(look.pet);
    if (this.petThing) {
      this.entities.addChild(this.petThing.view);
      this.things.push(this.petThing);
    }
  }

  setPaused(p: boolean) {
    this.paused = p;
    this.keys.clear();
    if (p) this.player.path = [];
    this.app.ticker.maxFPS = p ? 30 : 0;
  }

  /** Ease the camera in on a spot (a game opening) or back out (null). */
  focusOn(spot: Spot | null) {
    if (!spot) {
      this.focus = null;
      return;
    }
    const { x, y } = toScreen(spot.gx, spot.gy);
    this.focus = { x, y: y - 50, zoom: Math.min(1.7, this.defaultZoom() * 1.45) };
  }

  /** Fast travel: the player appears at the zone's signpost. */
  travel(zone: ZoneKey) {
    const sign = this.map.spots.find((s) => s.kind === 'travel' && s.zone === zone);
    const [gx, gy] = sign ? [sign.ax, sign.ay] : this.map.centers[zone];
    Object.assign(this.player, { gx, gy, path: [], moving: false });
    Object.assign(this.pet, { gx: gx - 0.6, gy: gy + 0.4 });
    this.pendingSpot = null;
    const p = toScreen(gx, gy);
    this.cam.x = p.x;
    this.cam.y = p.y - 40;
    this.emitZone();
  }

  interactNear() {
    if (this.near && !this.paused) this.cb.onInteract(this.near);
  }

  spot(id: string) {
    return this.map.spots.find((s) => s.id === id) ?? null;
  }

  // ── Building ──────────────────────────────────────────────────────────

  private add(t: A.Thing, gx: number, gy: number, zBias = 0) {
    const { x, y } = toScreen(gx, gy);
    t.view.position.set(x, y);
    t.view.zIndex = y + zBias;
    t.view.cullable = true;
    this.entities.addChild(t.view);
    if (t.update) this.things.push(t);
  }

  private makeProp(kind: string, seed: number): A.Thing | null {
    switch (kind) {
      case 'palm': return A.palm(seed);
      case 'jtree': return A.jungleTree(seed);
      case 'tree': return A.tree(seed);
      case 'bush': return A.bush(seed);
      case 'hedge': return A.bush(seed, true);
      case 'flowers': return A.flowers(seed);
      case 'shell': return A.shell(seed);
      case 'fern': return A.fern(seed);
      case 'pillar': return A.pillar(seed);
      case 'boulder': return A.boulder(seed);
      case 'deadtree': return A.deadTree(seed);
      case 'lavapool': return A.lavaPool(seed);
      case 'vent': return A.vent(seed);
      case 'balloons': return A.balloons(seed);
      case 'lamp': return A.lamp(seed);
      case 'torch': return A.lamp(seed, true);
      case 'boat': return A.boat(seed);
      case 'searock': return A.seaRock(seed);
      case 'post': return A.post();
      case 'lighthouse': return A.lighthouse();
      case 'ferris': return A.ferris();
      case 'casino': return A.casino();
      case 'temple': return A.temple();
      case 'volcano': return A.volcano(seed);
      default: return null;
    }
  }

  private makeSpot(s: Spot): A.Thing {
    switch (s.kind) {
      case 'game':
        if (s.game === 'roulette') return A.rouletteTable();
        if (s.game === 'temple-doors') return A.templeGate();
        if (s.game === 'lava-crash') return A.lavaLookout();
        return A.stall(s.game!, s.label);
      case 'travel': return A.signpost();
      case 'daily': return A.chest(true);
      case 'chest': return A.chest(false);
      case 'wardrobe': return A.hut('wardrobe', 'WARDROBE');
      case 'cashier': return A.hut('cashier', 'CASHIER');
      case 'board': return A.noticeBoard();
    }
  }

  private applyOpen() {
    this.ground.redrawFog(this.open);
    for (const g of this.gateViews) g.view.visible = !this.open.has(g.zone);
    for (const l of this.lockLabels) l.view.visible = !this.open.has(l.zone);
  }

  private foamPulse() {
    this.things.push({ view: this.ground.foam, update: (t) => (this.ground.foam.alpha = 0.55 + Math.sin(t * 1.4) * 0.3) });
  }

  private placeSparkle(s: { g: Graphics; phase: number }) {
    // Somewhere on the water near the camera.
    for (let tries = 0; tries < 10; tries++) {
      const x = this.cam.x + (Math.random() - 0.5) * 1600, y = this.cam.y + (Math.random() - 0.5) * 1100;
      const { gx, gy } = toGrid(x, y);
      const c = this.cell(Math.round(gx), Math.round(gy));
      if (!c || !c.land) {
        s.g.position.set(x, y);
        return;
      }
    }
  }

  // ── Input ─────────────────────────────────────────────────────────────

  private bindInput() {
    const el = this.app.canvas;
    const on = <K extends keyof HTMLElementEventMap>(t: EventTarget, type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      t.addEventListener(type, fn as EventListener, opts);
      this.disposers.push(() => t.removeEventListener(type, fn as EventListener));
    };
    on(el, 'pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.cam.target };
      }
    });
    on(el, 'pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX;
      p.y = e.clientY;
      if (this.pinch && this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.cam.target = clamp(this.pinch.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / this.pinch.d), 0.5, 1.7);
      }
    });
    const up = (e: PointerEvent) => {
      const p = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      if (!p) return;
      const wasPinch = this.pinch != null;
      if (this.pointers.size < 2) this.pinch = null;
      if (wasPinch || Math.hypot(p.x - p.sx, p.y - p.sy) > 10 || e.type === 'pointercancel') return;
      const r = el.getBoundingClientRect();
      this.onTap(e.clientX - r.left, e.clientY - r.top);
    };
    on(el, 'pointerup', up);
    on(el, 'pointercancel', up);
    on(el, 'wheel', (e) => {
      e.preventDefault();
      this.cam.target = clamp(this.cam.target * Math.exp(-e.deltaY * 0.0012), 0.5, 1.7);
    }, { passive: false });
    on(window, 'keydown', (e) => {
      if ((e.target as HTMLElement)?.closest?.('input, textarea, select')) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        this.keys.add(k);
        if (!this.paused) {
          this.player.path = [];
          this.pendingSpot = null;
        }
        e.preventDefault();
      }
      if ((k === 'e' || k === 'enter' || k === ' ') && !this.paused && this.near) {
        e.preventDefault();
        this.interactNear();
      }
    });
    on(window, 'keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    on(window, 'blur', () => this.keys.clear());
  }

  private walkable = (c: Cell) => c.land && !c.blocked && c.zone != null && this.open.has(c.zone);

  private cell(gx: number, gy: number) {
    return inside(gx, gy) ? this.map.cells[idx(gx, gy)] : undefined;
  }

  private onTap(sx: number, sy: number) {
    if (this.paused) return;
    const local = this.world.toLocal(new Point(sx, sy));
    // A stall or sign under the tap (their art stands up from the foot tile).
    let hit: Spot | null = null;
    let best = Infinity;
    for (const s of this.map.spots) {
      const { x, y } = toScreen(s.gx, s.gy);
      if (Math.abs(local.x - x) < 62 && local.y < y + 26 && local.y > y - 140) {
        const d = Math.abs(local.y - (y - 50)) + Math.abs(local.x - x);
        if (d < best) { best = d; hit = s; }
      }
    }
    const pg = toGrid(local.x, local.y);
    const tx = Math.round(pg.gx), ty = Math.round(pg.gy);
    if (hit) {
      if (!this.open.has(hit.zone)) return this.cb.onLocked(hit.zone);
      this.tap.at(toScreen(hit.ax, hit.ay).x, toScreen(hit.ax, hit.ay).y, this.time);
      if (this.near?.id === hit.id) return this.cb.onInteract(hit);
      this.pendingSpot = hit;
      this.walkTo(hit.ax, hit.ay);
      return;
    }
    const c = this.cell(tx, ty);
    if (c?.land && c.zone && !this.open.has(c.zone)) return this.cb.onLocked(c.zone);
    const goal = c && this.walkable(c) ? [tx, ty] : nearestWalkable(this.map, this.walkable, tx, ty);
    if (!goal) return;
    this.pendingSpot = null;
    const p = toScreen(goal[0], goal[1]);
    this.tap.at(p.x, p.y, this.time);
    this.walkTo(goal[0], goal[1]);
  }

  private walkTo(tx: number, ty: number) {
    const sx = Math.round(this.player.gx), sy = Math.round(this.player.gy);
    const start = this.cell(sx, sy) && this.walkable(this.cell(sx, sy)!) ? [sx, sy] : nearestWalkable(this.map, this.walkable, sx, sy);
    if (!start) return;
    const path = findPath(this.map, this.walkable, start[0], start[1], tx, ty);
    if (path) this.player.path = path.length ? path : [[tx, ty]];
  }

  // ── Frame ─────────────────────────────────────────────────────────────

  private defaultZoom() {
    const w = this.host.clientWidth;
    return w < 520 ? 0.72 : w < 900 ? 0.85 : 1;
  }

  private update(dt: number) {
    this.time += dt;
    const t = this.time;
    const pl = this.player;

    // Movement: keyboard (continuous) or path (tap).
    let vx = 0, vy = 0;
    if (!this.paused) {
      const k = this.keys;
      const up = k.has('w') || k.has('arrowup'), down = k.has('s') || k.has('arrowdown');
      const left = k.has('a') || k.has('arrowleft'), right = k.has('d') || k.has('arrowright');
      // Screen directions → grid: up = (-1,-1), down = (1,1), left = (-1,1), right = (1,-1).
      let sx = (right ? 1 : 0) - (left ? 1 : 0), sy = (down ? 1 : 0) - (up ? 1 : 0);
      if (sx || sy) {
        const m = Math.hypot(sx, sy);
        sx /= m;
        sy /= m;
        vx = (sx + sy) / Math.SQRT2;
        vy = (sy - sx) / Math.SQRT2;
        const step = SPEED * dt;
        const nx = pl.gx + vx * step, ny = pl.gy + vy * step;
        const ok = (x: number, y: number) => {
          const c = this.cell(Math.round(x), Math.round(y));
          return c != null && this.walkable(c);
        };
        if (ok(nx, ny)) { pl.gx = nx; pl.gy = ny; }
        else if (ok(nx, pl.gy)) { pl.gx = nx; vy = 0; }
        else if (ok(pl.gx, ny)) { pl.gy = ny; vx = 0; }
        else { vx = vy = 0; }
      } else if (pl.path.length) {
        const [tx, ty] = pl.path[0];
        const dx = tx - pl.gx, dy = ty - pl.gy;
        const d = Math.hypot(dx, dy);
        const step = SPEED * dt;
        if (d <= step) {
          pl.gx = tx;
          pl.gy = ty;
          pl.path.shift();
          if (!pl.path.length && this.pendingSpot) {
            const s = this.pendingSpot;
            this.pendingSpot = null;
            this.cb.onInteract(s);
          }
        } else {
          pl.gx += (dx / d) * step;
          pl.gy += (dy / d) * step;
        }
        vx = dx;
        vy = dy;
      }
    }
    pl.moving = Math.hypot(vx, vy) > 0.01;
    if (pl.moving) {
      const sxv = vx - vy, syv = vx + vy;
      pl.dir = syv >= -0.05 ? (sxv >= 0 ? 0 : 1) : sxv >= 0 ? 3 : 2;
      this.stepTimer += dt;
    }

    const ps = toScreen(pl.gx, pl.gy);
    this.avatar.view.position.set(ps.x, ps.y);
    this.avatar.view.zIndex = ps.y + 1;
    this.avatar.pose(t, pl.moving, pl.dir);

    // Pet trails behind; Polly circles overhead.
    const pd = Math.hypot(pl.gx - this.pet.gx, pl.gy - this.pet.gy);
    if (pd > 0.9) {
      const k = Math.min(1, (pd - 0.9) * dt * 6);
      this.pet.gx += (pl.gx - this.pet.gx) * k;
      this.pet.gy += (pl.gy - this.pet.gy) * k;
    }
    if (this.petThing) {
      const q = toScreen(this.pet.gx, this.pet.gy);
      this.petThing.view.position.set(q.x, q.y);
      this.petThing.view.zIndex = q.y;
      this.petThing.view.scale.x = pl.gx - this.pet.gx - (pl.gy - this.pet.gy) >= 0 ? 1 : -1;
    }
    const orbit = t * 0.9;
    this.parrot.view.position.set(ps.x + Math.cos(orbit) * 46, ps.y - 98 + Math.sin(orbit * 2) * 10);
    this.parrot.view.scale.x = -Math.sin(orbit) >= 0 ? 1 : -1;
    this.parrot.view.zIndex = ps.y + 2;
    this.parrot.flap.scale.y = Math.sin(t * 22);

    // Zone + nearby interactable.
    this.emitZone();
    let near: Spot | null = null;
    let nd = NEAR;
    for (const s of this.map.spots) {
      const d = Math.hypot(s.gx - pl.gx, s.gy - pl.gy);
      if (d < nd && this.open.has(s.zone)) { nd = d; near = s; }
    }
    if (near?.id !== this.near?.id) {
      this.near = near;
      this.cb.onNear(near);
      this.markerThing.view.visible = !!near;
    }
    if (near) {
      const m = toScreen(near.gx, near.gy);
      const tall = near.kind === 'game' ? 160 : near.kind === 'travel' ? 100 : near.kind === 'chest' || near.kind === 'daily' ? 80 : 160;
      this.markerThing.view.position.set(m.x, m.y - tall);
      this.markerThing.view.zIndex = 1e6;
    }

    for (const th of this.things) th.update?.(t);

    for (const s of this.sparkles) {
      const k = (t * s.speed + s.phase) % 1;
      s.g.alpha = Math.pow(Math.sin(k * Math.PI), 3) * 0.8;
      s.g.scale.set(0.5 + k);
      if (k < 0.01) this.placeSparkle(s);
    }

    // Camera.
    const target = this.focus ?? { x: ps.x, y: ps.y - 40, zoom: this.cam.target };
    const lerp = 1 - Math.exp(-dt * (this.focus ? 7 : 5));
    this.cam.x += (target.x - this.cam.x) * lerp;
    this.cam.y += (target.y - this.cam.y) * lerp;
    this.cam.zoom += (target.zoom - this.cam.zoom) * lerp;
    const vw = this.app.screen.width, vh = this.app.screen.height;
    const z = this.cam.zoom;
    const halfW = vw / 2 / z, halfH = vh / 2 / z;
    const minX = -N * (TW / 2) + halfW, maxX = N * (TW / 2) - halfW;
    const minY = halfH - 200, maxY = N * TH - halfH + 100;
    const cx = minX > maxX ? 0 : clamp(this.cam.x, minX, maxX);
    const cy = minY > maxY ? (N * TH) / 2 : clamp(this.cam.y, minY, maxY);
    this.world.scale.set(z);
    this.world.position.set(vw / 2 - cx * z, vh / 2 - cy * z);
  }

  private emitZone() {
    const c = this.cell(Math.round(this.player.gx), Math.round(this.player.gy));
    if (c?.zone && c.zone !== this.zone) {
      this.zone = c.zone;
      this.cb.onZone(c.zone);
    }
  }
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

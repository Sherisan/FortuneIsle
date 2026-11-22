import { Application, Container, CullerPlugin, extensions, Graphics, Point } from 'pixi.js';
import type { IslandZone, ZoneKey } from '../api/types.ts';
import * as A from './art.ts';
import * as C from './casinoArt.ts';
import { buildGround, type GroundLayers } from './ground.ts';
import { Ambient, CloudSea, Particles, Snowfall } from './fun.ts';
import { buildInterior, type InteriorKind } from './interior.ts';
import { buildIsle } from './isles.ts';
import * as I from './islesArt.ts';
import * as R from './roomsArt.ts';
import { sound } from '../ui/sound.ts';
import { DIAMOND_SEGMENTS, GEMS } from '../api/rules.ts';
import { buildMap, findPath, idx, inside, isIsle, nearestWalkable, TH, toGrid, toScreen, type Cell, type Prop, type SceneKey, type Spot, type WorldMap } from './map.ts';

extensions.add(CullerPlugin);

/*
 * WorldEngine (Pixi): the current map (the island, or a room: the Grand Casino, its VIP Salon, the Rusty Anchor), the
 * camera, input and every entity.
 * The player is one entity among others, moving by move targets (path tiles), so a remote player could later be another
 * entity driven by a MovementSync. React talks to it through the callbacks and the public methods; it never touches money.
 *
 * Doorways (spots of kind enter / exit) trigger by walking up to them. Each is disarmed after it fires and re-armed once
 * the player has walked away, so stepping back out of an overlay, or arriving through a door, doesn't fire it again.
 */

export interface WorldCallbacks {
  onZone(zone: ZoneKey): void;
  onNear(spot: Spot | null): void;
  onInteract(spot: Spot): void;
  onLocked(zone: ZoneKey): void;
  onScene(scene: SceneKey): void;
  /** A landmark show in progress (a caption for the HUD), or null when it ends. */
  onCinematic(caption: string | null): void;
  /** A secret found (an easter egg: nothing to do with money). */
  onSecret(id: string): void;
}

const SPEED = 4.6; // tiles per second
const NEAR = 1.75; // tiles
const DOOR_FIRE = 1.5; // walk this close to a doorway and it opens
const DOOR_REARM = 2.3;
const BACKGROUND: Record<SceneKey, number> = { island: 0x1b8cc2, casino: 0x1a0f24, vip: 0x0d0a1f, tavern: 0x1f140c, lagoon: 0x1b8cc2, frost: 0x28688c, sky: I.BACK_SKY };
/** Buildings on the island you walk into: tapping one walks to its door. Half-width and height of the tap box. */
const BUILDINGS: Record<string, [number, number]> = { casino: [190, 330], tavern: [130, 230] };
/** Things you can tap for a little show (and some hide a secret): [half-width, top, bottom] of the tap box round the foot. */
const POKE_BOX: Record<string, [number, number, number]> = {
  shipwreck: [70, -110, 16], clam: [40, -44, 10], penguin: [22, -48, 8], yetipine: [44, -130, 10], snowman: [28, -100, 8],
  moon: [70, -290, -150], bottle: [26, -30, 10],
};
/** The Konami code, for a secret. */
const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];

export class WorldEngine {
  private app = new Application();
  private world = new Container();
  private root: Container | null = null;
  private entities = new Container();
  private ground!: GroundLayers;
  private maps: Partial<Record<SceneKey, WorldMap>> = {};
  private map!: WorldMap;
  private things: A.Thing[] = [];
  private gateViews: { zone: ZoneKey; view: Container }[] = [];
  private lockLabels: { zone: ZoneKey; view: Container }[] = [];
  private sparkles: { g: Graphics; phase: number; speed: number }[] = [];
  private open = new Set<ZoneKey>(['harbour', 'boardwalk', 'fairground']);
  private avatar = A.avatar();
  private petThing: A.Thing | null = null;
  private look: A.Look | null = null;
  private parrot = A.parrot();
  private markerThing = A.marker();
  private tap = A.tapRing();
  private player = { gx: 0, gy: 0, dir: 0, moving: false, path: [] as [number, number][] };
  private pet = { gx: 0, gy: 0 };
  private pendingSpot: Spot | null = null;
  private near: Spot | null = null;
  private zone: ZoneKey | null = null;
  private armed = new Map<string, boolean>();
  /** The spot the player last used (focus the camera on the table they actually walked up to). */
  lastSpot: Spot | null = null;
  private cam = { x: 0, y: 0, zoom: 1, target: 1 };
  private focus: { x: number; y: number; zoom: number } | null = null;
  private paused = false;
  private keys = new Set<string>();
  private pointers = new Map<number, { x: number; y: number; sx: number; sy: number }>();
  private pinch: { d: number; zoom: number } | null = null;
  private time = 0;
  private destroyed = false;
  private disposers: (() => void)[] = [];
  // Landmark shows and effects (cosmetic only).
  private particles = new Particles();
  private ambient: Ambient | null = null;
  private landmarks: Partial<Record<string, { prop: Prop; thing: A.Thing }>> = {};
  private pokeables: { prop: Prop; thing: A.Thing }[] = [];
  private ride: { ferris: A.FerrisThing; k: number; start: number; mini: A.Avatar; fired: boolean } | null = null;
  private cinematic: { kind: string; until: number } | null = null;
  private night: { t0: number; layer: Container; beam: Graphics; lights: Graphics; overlay: Graphics } | null = null;
  private timers: { at: number; fn: () => void }[] = [];
  private cooldown = new Map<string, number>();
  private shakeUntil = 0;
  // The isles' weather, their shows and the secrets (all cosmetic).
  private snow: Snowfall | null = null;
  private clouds: CloudSea | null = null;
  private aurora: { t0: number; layer: Container; bands: Graphics } | null = null;
  private rainbowArc: { t0: number; g: Graphics } | null = null;
  private krakens: ReturnType<typeof I.kraken>[] = [];
  private seaTaps: number[] = [];
  private penguinTaps = new Map<Prop, number>();
  private keyTrail: string[] = [];
  private rainbowParrot = -100;
  private atPot = false;

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
      background: BACKGROUND.island,
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
    this.cam.zoom = this.cam.target = this.defaultZoom();
    this.markerThing.view.visible = false;

    this.enterScene('island');
    this.bindInput();
    this.app.ticker.add((tk) => this.update(Math.min(0.05, tk.deltaMS / 1000)));
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

  // ── Scenes ────────────────────────────────────────────────────────────

  get scene(): SceneKey {
    return this.map?.kind ?? 'island';
  }

  /**
   * Builds and shows a map. Arriving through a doorway puts the player at the door that leads back where they came from
   * (out of the casino: at its red carpet; down from the VIP Salon: at the stairs); otherwise at the map's spawn, just
   * inside its exit. Any doorway the player arrives next to stays disarmed until they walk away from it.
   */
  enterScene(kind: SceneKey, at?: { gx: number; gy: number }) {
    const fromKind = this.map?.kind;
    const map = (this.maps[kind] ??= kind === 'island' ? buildMap() : isIsle(kind) ? buildIsle(kind) : buildInterior(kind as InteriorKind));

    // Keep the persistent entities; throw away the old scene.
    for (const v of [this.avatar.view, this.parrot.view, this.markerThing.view, this.tap.view, this.petThing?.view]) v?.parent?.removeChild(v);
    this.root?.destroy({ children: true });
    this.map = map;
    this.things = [];
    this.gateViews = [];
    this.lockLabels = [];
    this.sparkles = [];
    this.landmarks = {};
    this.pokeables = [];
    this.endRide(true);
    this.night = null;
    this.aurora = null;
    this.rainbowArc = null;
    this.krakens = [];
    this.seaTaps = [];
    this.penguinTaps.clear();
    this.atPot = false;
    this.snow = null;
    this.clouds = null;
    this.cinematic = null;
    this.timers = [];
    this.near = null;
    this.pendingSpot = null;
    this.markerThing.view.visible = false;
    this.cb.onNear(null);
    this.app.renderer.background.color = BACKGROUND[kind];

    const root = new Container();
    this.root = root;
    this.world.addChild(root);
    this.ground = buildGround(map);
    const sparkleLayer = new Container();
    if (kind === 'sky') {
      // Open sky: a gradient, and a sea of clouds the islands float over.
      this.clouds = new CloudSea(map.bounds);
      root.addChild(this.clouds.backdrop, this.clouds.below);
    }
    root.addChild(this.ground.water, sparkleLayer, this.ground.foam, this.ground.land, this.ground.fog);
    if (kind !== 'island' && !isIsle(kind)) {
      const walls = C.buildWalls(kind as InteriorKind);
      root.addChild(walls.view);
      this.things.push(walls);
    }
    this.entities = new Container();
    this.entities.sortableChildren = true;
    this.particles = new Particles();
    root.addChild(this.tap.view, this.entities, this.particles.layer);
    this.ambient = null;
    this.things.push(this.tap, this.markerThing);
    if (this.clouds) root.addChild(this.clouds.above);
    if (kind === 'frost') {
      this.snow = new Snowfall(() => this.viewRect());
      root.addChild(this.snow.layer);
    }

    if (kind === 'island' || kind === 'lagoon' || kind === 'frost') {
      for (let i = 0; i < 70; i++) {
        const g = new Graphics();
        g.ellipse(0, 0, 9, 2.2).fill({ color: 0xffffff, alpha: 0.85 });
        sparkleLayer.addChild(g);
        this.sparkles.push({ g, phase: Math.random(), speed: 0.25 + Math.random() * 0.35 });
      }
      this.things.push({ view: this.ground.foam, update: (t) => (this.ground.foam.alpha = 0.55 + Math.sin(t * 1.4) * 0.3) });
      this.ambient = new Ambient(this.particles, () => this.viewRect(), (x, y) => {
        const { gx, gy } = toGrid(x, y);
        const c = this.cell(Math.round(gx), Math.round(gy));
        return !!c && !c.land && c.ground !== 'void';
      });
      root.addChild(this.ambient.sky);
    }

    for (const p of map.props) {
      const t = this.makeProp(p.kind, p.seed);
      if (!t) continue;
      this.add(t, p.gx, p.gy, p.size ? p.size * TH * 0.35 : p.kind === 'chandelier' || p.kind === 'lantern' ? 1e5 : p.kind === 'moon' ? -1e5 : 0);
      if (['ferris', 'lighthouse', 'volcano', 'temple', 'mermaid', 'crystal', 'gong'].includes(p.kind)) this.landmarks[p.kind] = { prop: p, thing: t };
      if (['palm', 'balloons', 'boat'].includes(p.kind) || POKE_BOX[p.kind]) this.pokeables.push({ prop: p, thing: t });
    }
    for (const s of map.spots) this.add(this.makeSpot(s), s.gx, s.gy);
    if (kind === 'island') {
      for (const g of map.gates) {
        const t = A.gate(LEVELS[g.zone] ?? 1);
        this.add(t, g.gx, g.gy, 2);
        this.gateViews.push({ zone: g.zone, view: t.view });
      }
      for (const z of ['casino', 'jungle', 'volcano'] as IslandZone[]) {
        const [cx, cy] = map.centers[z]!;
        const v = new Container();
        v.addChild(A.label(`🔒 Level ${LEVELS[z]}`, 26, 0xffe27a));
        const { x, y } = toScreen(cx, cy);
        v.position.set(x, y - 30);
        v.zIndex = 1e6;
        this.entities.addChild(v);
        this.lockLabels.push({ zone: z, view: v });
      }
    } else {
      // A doorway further in that's still locked (the casino's stairs up to the VIP Salon).
      for (const s of map.spots) {
        if (s.kind !== 'enter' || !LEVELS[s.zone]) continue;
        const v = new Container();
        v.addChild(A.label(`🔒 Level ${LEVELS[s.zone]}`, 22, 0xffe27a));
        const { x, y } = toScreen(s.gx, s.gy);
        v.position.set(x, y - 225);
        v.zIndex = 1e6;
        this.entities.addChild(v);
        this.lockLabels.push({ zone: s.zone, view: v });
      }
    }

    // Where the player appears: by the door back to where they came from (off the ferry: on the pier).
    let spawn = at ?? map.spawn;
    if (!at && fromKind) {
      const door = map.spots.find((s) => (s.kind === 'enter' && s.to === fromKind) || (s.kind === 'ferry' && isIsle(fromKind)));
      if (door) spawn = { gx: door.ax, gy: door.ay };
    }
    Object.assign(this.player, { gx: spawn.gx, gy: spawn.gy, path: [], moving: false });
    Object.assign(this.pet, { gx: spawn.gx - 0.6, gy: spawn.gy + 0.4 });
    this.entities.addChild(this.avatar.view, this.parrot.view, this.markerThing.view);
    if (this.petThing) {
      this.entities.addChild(this.petThing.view);
      this.things.push(this.petThing);
    }
    if (this.look) this.avatar.setLook(this.look);
    this.armed.clear();
    for (const s of map.spots) if (s.kind === 'enter' || s.kind === 'exit') this.armed.set(s.id, Math.hypot(s.gx - spawn.gx, s.gy - spawn.gy) > DOOR_REARM);

    const p0 = toScreen(spawn.gx, spawn.gy);
    this.cam.x = p0.x;
    this.cam.y = p0.y - 40;
    this.focus = null;
    for (const s of this.sparkles) this.placeSparkle(s);
    this.applyOpen();
    this.zone = null;
    this.emitZone();
    if (fromKind !== kind) this.cb.onScene(kind);
  }

  // ── Public API ────────────────────────────────────────────────────────

  setOpenZones(zones: ZoneKey[]) {
    const next = new Set(zones);
    if ([...next].every((z) => this.open.has(z)) && next.size === this.open.size) return;
    this.open = next;
    this.applyOpen();
  }

  setLook(look: A.Look) {
    const petChanged = this.look?.pet !== look.pet;
    this.look = look;
    this.avatar.setLook(look);
    if (!petChanged) return;
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

  /** Fast travel: the player appears at the zone's signpost (leaving a room first if inside); the VIP Salon is a room,
   *  and the isles are maps of their own (you arrive at the ferry dock). */
  travel(zone: ZoneKey) {
    if (zone === 'vip' || isIsle(zone)) return this.enterScene(zone);
    if (this.map.kind !== 'island') this.enterScene('island');
    const sign = this.map.spots.find((s) => s.kind === 'travel' && s.zone === zone);
    const [gx, gy] = sign ? [sign.ax, sign.ay] : this.map.centers[zone] ?? [this.map.spawn.gx, this.map.spawn.gy];
    Object.assign(this.player, { gx, gy, path: [], moving: false });
    Object.assign(this.pet, { gx: gx - 0.6, gy: gy + 0.4 });
    this.pendingSpot = null;
    const p = toScreen(gx, gy);
    this.cam.x = p.x;
    this.cam.y = p.y - 40;
    this.emitZone();
  }

  interactNear() {
    if (this.near && !this.paused) this.use(this.near);
  }

  spot(id: string) {
    return this.map.spots.find((s) => s.id === id) ?? null;
  }

  private use(s: Spot) {
    this.lastSpot = s;
    if (s.kind === 'enter' || s.kind === 'exit') this.armed.set(s.id, false);
    this.cb.onInteract(s);
  }

  // ── Landmark shows (cosmetic only) ────────────────────────────────────

  /** Plays a landmark's show. False when it's busy or cooling down (the caller can say so). */
  fun(id: string): boolean {
    const kind = id.replace('fun-', '');
    const lm = this.landmarks[kind];
    if (!lm || this.cinematic || this.ride) return false;
    if ((this.cooldown.get(kind) ?? 0) > this.time) return false;
    const { x, y } = toScreen(lm.prop.gx, lm.prop.gy);
    lm.thing.poke?.(this.time);
    switch (kind) {
      case 'ferris':
        return this.startRide(lm.thing as A.FerrisThing);
      case 'lighthouse':
        this.cooldown.set(kind, this.time + 16);
        this.startNight(x, y);
        sound.play('bell');
        return true;
      case 'volcano': {
        this.cooldown.set(kind, this.time + 12);
        this.cinematic = { kind, until: this.time + 4.6 };
        this.player.path = [];
        this.focus = { x, y: y - 200, zoom: Math.max(0.5, this.defaultZoom() * 0.62) };
        this.cb.onCinematic('🌋 KABOOM!');
        sound.play('rumble');
        const crater = { x, y: y - 268 };
        this.later(0.6, () => {
          sound.play('erupt');
          this.shakeUntil = this.time + 1.8;
          for (let i = 0; i < 32; i++) this.particles.lavaBomb(crater.x, crater.y, y - 40 + Math.random() * 220);
          this.particles.smoke(crater.x, crater.y - 10, 12);
        });
        this.later(1.7, () => {
          for (let i = 0; i < 16; i++) this.particles.lavaBomb(crater.x, crater.y, y - 40 + Math.random() * 220);
          this.particles.smoke(crater.x, crater.y - 10, 6);
        });
        return true;
      }
      case 'temple':
        this.cooldown.set(kind, this.time + 10);
        sound.play('rumble');
        this.later(0.4, () => sound.play('bell'));
        this.particles.fireflies(x, y - 40, 34, 9);
        return true;
      case 'mermaid': {
        // Her song: bubbles, and dolphins leaping all round the lagoon.
        this.cooldown.set(kind, this.time + 12);
        this.cinematic = { kind, until: this.time + 6 };
        this.player.path = [];
        this.focus = { x: x + 260, y: y + 140, zoom: Math.max(0.5, this.defaultZoom() * 0.7) };
        this.cb.onCinematic('🧜‍♀️ The mermaid sings…');
        sound.play('sing');
        this.particles.bubbles(x, y - 60, 18);
        const c = toScreen(24, 24);
        for (let i = 0; i < 7; i++)
          this.later(0.5 + i * 0.6, () => {
            const a = Math.random() * Math.PI * 2;
            const px = c.x + Math.cos(a) * 140, py = c.y + Math.sin(a) * 70;
            this.particles.dolphin(px, py, Math.random() < 0.5 ? -1 : 1);
            sound.play('splash');
          });
        return true;
      }
      case 'crystal':
        this.cooldown.set(kind, this.time + 16);
        sound.play('chime');
        this.particles.burst(x, y - 130, 40, 0xc8f6ff);
        this.startAurora();
        return true;
      case 'gong': {
        // Thunder and lightning round the islands, then a rainbow over the kingdom.
        this.cooldown.set(kind, this.time + 14);
        this.cinematic = { kind, until: this.time + 5.5 };
        this.player.path = [];
        const c = toScreen(24, 24);
        this.focus = { x: c.x, y: c.y - 120, zoom: Math.max(0.5, this.defaultZoom() * 0.62) };
        this.cb.onCinematic('⚡ The sky answers!');
        sound.play('bell');
        for (let i = 0; i < 6; i++)
          this.later(0.4 + i * 0.35, () => {
            const bx = c.x + (Math.random() - 0.5) * 1100;
            this.particles.bolt(bx, c.y - 700, c.y - 60 + Math.random() * 200);
            this.shakeUntil = this.time + 0.3;
            if (i % 2 === 0) sound.play('thunder');
          });
        this.later(2.8, () => this.startRainbow());
        return true;
      }
    }
    return false;
  }

  /** Frost Isle's crystal: the aurora — dusk falls and green and violet curtains ripple across the sky. */
  private startAurora() {
    const layer = new Container();
    const overlay = new Graphics();
    overlay.rect(-6000, -3000, 12000, 9000).fill(0x2a3a7e);
    overlay.blendMode = 'multiply';
    const bands = new Graphics();
    bands.blendMode = 'add';
    layer.addChild(overlay, bands);
    layer.alpha = 0;
    this.root!.addChild(layer);
    this.aurora = { t0: this.time, layer, bands };
  }

  private updateAurora(t: number) {
    const a = this.aurora!;
    const k = t - a.t0;
    a.layer.alpha = Math.max(0, Math.min(1, k / 1.5, (13 - k) / 1.5));
    const v = this.viewRect();
    const g = a.bands;
    g.clear();
    const colours = [0x5fffb0, 0x7fd6ff, 0xc08cff];
    colours.forEach((col, j) => {
      const top: number[] = [], bottom: number[] = [];
      const y0 = v.y - v.h * (0.38 - j * 0.07);
      for (let i = 0; i <= 24; i++) {
        const x = v.x - v.w * 0.6 + (v.w * 1.2 * i) / 24;
        const wave = Math.sin(i * 0.5 + t * (0.8 + j * 0.3) + j * 2) * 40 + Math.sin(i * 0.17 + t * 0.5) * 30;
        top.push(x, y0 + wave);
        bottom.unshift(x, y0 + wave + 90 + Math.sin(i * 0.9 + t * 1.6) * 30);
      }
      g.poly([...top, ...bottom]).fill({ color: col, alpha: 0.22 });
    });
    if (k >= 13) {
      a.layer.destroy({ children: true });
      this.aurora = null;
    }
  }

  /** The Sky Kingdom's gong: a rainbow over the islands for a few seconds. */
  private startRainbow() {
    const g = new Graphics();
    const c = toScreen(24, 24);
    const colours = [0xff5b6e, 0xff9d3d, 0xffe066, 0x5fd38a, 0x4fc3ff, 0xb07cff];
    colours.forEach((col, i) => g.arc(0, 0, 640 - i * 26, Math.PI, 0).stroke({ width: 26, color: col, alpha: 0.75 }));
    g.position.set(c.x, c.y + 80);
    g.alpha = 0;
    g.zIndex = -1e5;
    this.entities.addChild(g);
    this.rainbowArc = { t0: this.time, g };
    sound.play('level');
  }

  private updateRainbow(t: number) {
    const r = this.rainbowArc!;
    const k = t - r.t0;
    r.g.alpha = Math.max(0, Math.min(1, k / 1.2, (8 - k) / 1.5)) * 0.85;
    if (k >= 8) {
      r.g.destroy();
      this.rainbowArc = null;
    }
  }

  private later(sec: number, fn: () => void) {
    this.timers.push({ at: this.time + sec, fn });
  }

  /** Ferris wheel: board the cabin nearest the bottom and ride one full turn, the camera following it. */
  private startRide(ferris: A.FerrisThing): boolean {
    const bottom = Math.PI / 2;
    let k = 0, bd = Infinity;
    ferris.cabins.forEach((_, i) => {
      const a = (((ferris.rot() + (i / 8) * Math.PI * 2 - bottom) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const d = Math.min(a, Math.PI * 2 - a);
      if (d < bd) { bd = d; k = i; }
    });
    const mini = A.avatar();
    if (this.look) mini.setLook(this.look);
    mini.view.scale.set(0.42);
    mini.view.position.set(0, 31);
    ferris.cabins[k].addChild(mini.view);
    this.avatar.view.visible = false;
    if (this.petThing) this.petThing.view.visible = false;
    ferris.setSpeed(0.72);
    this.ride = { ferris, k, start: ferris.rot(), mini, fired: false };
    this.cinematic = { kind: 'ferris', until: Infinity };
    this.player.path = [];
    this.cb.onCinematic('🎡 Enjoy the view!');
    sound.play('whoosh');
    return true;
  }

  private updateRide(t: number) {
    const r = this.ride!;
    const lm = this.landmarks.ferris!;
    const base = toScreen(lm.prop.gx, lm.prop.gy);
    const cab = r.ferris.cabins[r.k];
    const cx = base.x + cab.x, cy = base.y + cab.y + 20;
    const h = -(cab.y + r.ferris.H) / r.ferris.R; // -1 at the bottom, 1 at the top
    const z0 = this.defaultZoom() * 0.95;
    this.focus = { x: cx, y: cy + 40 * (1 - (h + 1) / 2), zoom: z0 + ((h + 1) / 2) * (0.42 - z0) };
    r.mini.pose(t, false, 0);
    this.parrot.view.position.set(cx + Math.cos(t * 1.4) * 60, cy - 40 + Math.sin(t * 2.8) * 12);
    this.parrot.view.zIndex = 1e6;
    if (!r.fired && h > 0.9) {
      r.fired = true;
      sound.play('level');
      for (let i = 0; i < 4; i++)
        this.later(i * 0.35, () => {
          this.particles.firework(cx + (Math.random() - 0.5) * 420, cy - 120 - Math.random() * 160);
          sound.play('pop');
        });
    }
    if (r.ferris.rot() - r.start >= Math.PI * 2) this.endRide();
  }

  private endRide(silent = false) {
    const r = this.ride;
    if (!r) return;
    this.ride = null;
    try {
      r.mini.view.destroy({ children: true });
    } catch {
      /* the scene was torn down */
    }
    this.avatar.view.visible = true;
    if (this.petThing) this.petThing.view.visible = true;
    if (silent) return;
    r.ferris.setSpeed(0.18);
    this.cinematic = null;
    this.focus = null;
    this.cb.onCinematic(null);
  }

  /** Lighthouse: dusk falls for 14 s; lamps, torches and lava glow and the beam sweeps across the sea. */
  private startNight(lx: number, ly: number) {
    const layer = new Container();
    const overlay = new Graphics();
    // Multiply keeps the colours (a dusk tint, not fog); the lights are added on top.
    overlay.rect(-6000, -3000, 12000, 9000).fill(0x3c4c9e);
    overlay.blendMode = 'multiply';
    const lights = new Graphics();
    lights.blendMode = 'add';
    const glow = (x: number, y: number, r: number, color: number, a = 0.35) => {
      lights.circle(x, y, r).fill({ color, alpha: a * 0.3 });
      lights.circle(x, y, r * 0.6).fill({ color, alpha: a * 0.45 });
      lights.circle(x, y, r * 0.25).fill({ color, alpha: a * 0.7 });
    };
    for (const p of this.map.props) {
      const { x, y } = toScreen(p.gx, p.gy);
      if (p.kind === 'lamp') glow(x, y - 72, 70, 0xffe27a);
      else if (p.kind === 'torch') glow(x, y - 74, 60, 0xff8a2a);
      else if (p.kind === 'lavapool') glow(x, y, 80, 0xff5a1f, 0.4);
      else if (p.kind === 'casino') glow(x, y + 20, 240, 0xffc6ff, 0.3);
      else if (p.kind === 'tavern') glow(x, y - 30, 150, 0xffb347, 0.35);
      else if (p.kind === 'ferris') glow(x, y - 170, 170, 0xff9bc8, 0.22);
      else if (p.kind === 'volcano') glow(x, y - 264, 160, 0xff5a1f, 0.45);
      else if (p.kind === 'temple') glow(x, y - 80, 120, 0x3aff9e, 0.18);
    }
    for (const s of this.map.spots) if (s.kind === 'game') { const { x, y } = toScreen(s.gx, s.gy); glow(x, y - 60, 90, 0xfff3b0, 0.22); }
    glow(lx, ly - 206, 80, 0xfff3b0, 0.7);
    const beam = new Graphics();
    beam.poly([0, 0, 1500, -150, 1500, 150]).fill({ color: 0xfff6c2, alpha: 0.18 });
    beam.poly([0, 0, 1500, -60, 1500, 60]).fill({ color: 0xffffff, alpha: 0.2 });
    beam.blendMode = 'add';
    beam.position.set(lx, ly - 206);
    layer.addChild(overlay, lights, beam);
    layer.alpha = 0;
    this.root!.addChild(layer);
    this.night = { t0: this.time, layer, beam, lights, overlay };
  }

  private updateNight(t: number) {
    const n = this.night!;
    const k = t - n.t0;
    const env = Math.max(0, Math.min(1, k / 1.5, (14 - k) / 1.5));
    n.layer.alpha = env;
    n.beam.rotation = k * 0.9;
    n.beam.scale.y = 0.5 + Math.abs(Math.sin(k * 0.9)) * 0.5; // flatter when it points along the ground
    if (k >= 14) {
      n.layer.destroy({ children: true });
      this.night = null;
    }
  }

  /** Taps on palms (a coconut drops), balloons (they float off) and boats (a lap with a horn blast). */
  private pokeAt(local: { x: number; y: number }): boolean {
    for (const { prop, thing } of this.pokeables) {
      const { x, y } = toScreen(prop.gx, prop.gy);
      const dx = local.x - x, dy = local.y - y;
      if (prop.kind === 'palm' && thing.top && Math.abs(dx - thing.top.x) < 48 && dy > thing.top.y - 50 && dy < thing.top.y + 40) {
        thing.poke?.(this.time);
        this.particles.coconut(x + thing.top.x, y + thing.top.y + 6, y + 14, () => sound.play('thud'));
        sound.play('whoosh');
        return true;
      }
      if (prop.kind === 'balloons' && Math.abs(dx) < 32 && dy > -100 && dy < -45) {
        thing.poke?.(this.time);
        sound.play('pop');
        return true;
      }
      if (prop.kind === 'boat' && Math.abs(dx) < 46 && dy > -86 && dy < 12) {
        thing.poke?.(this.time);
        sound.play('horn');
        return true;
      }
      const box = POKE_BOX[prop.kind];
      if (box && Math.abs(dx) < box[0] && dy > box[1] && dy < box[2]) {
        const found = thing.poke?.(this.time);
        this.poked(prop, typeof found === 'string' ? found : null, x, y);
        return true;
      }
    }
    return false;
  }

  /** The little show after a tap on one of the isles' things, and the secret it may reveal. */
  private poked(prop: Prop, found: string | null, x: number, y: number) {
    const t = this.time;
    switch (prop.kind) {
      case 'shipwreck':
        sound.play('ghost');
        if (found) this.cb.onSecret(found);
        break;
      case 'clam':
        sound.play(found ? 'chime' : 'pop');
        if (found) {
          for (let i = 0; i < 10; i++) this.particles.sparkle(x + (Math.random() - 0.5) * 60, y - 30 - Math.random() * 40, 0xfff0ff);
          this.cb.onSecret(found);
        }
        break;
      case 'penguin': {
        if (!found) break;
        sound.play('squeak');
        this.penguinTaps.set(prop, t);
        for (const [p, at] of this.penguinTaps) if (t - at > 12) this.penguinTaps.delete(p);
        const all = this.map.props.filter((p) => p.kind === 'penguin');
        if (this.penguinTaps.size >= all.length) {
          // All three: a belly-slide parade, one after the other.
          this.penguinTaps.clear();
          const things = this.pokeables.filter((p) => p.prop.kind === 'penguin');
          things.forEach((p, i) => this.later(1.7 + i * 0.35, () => { (p.thing as ReturnType<typeof I.penguin>).slide(this.time, 1); sound.play('squeak'); }));
          this.later(1.7, () => this.cb.onSecret('penguins'));
        }
        break;
      }
      case 'yetipine':
        if (found) {
          sound.play('roar');
          this.particles.burst(x + 20, y - 80, 24);
          this.cb.onSecret(found);
        } else sound.play('thud');
        break;
      case 'snowman':
        sound.play('pop');
        break;
      case 'moon':
        sound.play(found ? 'ufo' : 'ding');
        if (found) this.cb.onSecret(found);
        break;
      case 'bottle':
        sound.play('chime');
        this.cb.onSecret('bottle');
        break;
    }
  }

  /** Five quick taps on the open sea around the island and the kraken waves hello (a secret). */
  private seaTap(local: { x: number; y: number }) {
    const t = this.time;
    this.seaTaps = this.seaTaps.filter((s) => t - s < 4);
    this.seaTaps.push(t);
    if (this.seaTaps.length < 5 || this.krakens.length) return;
    this.seaTaps = [];
    const k = I.kraken();
    k.start(t);
    k.view.position.set(local.x, local.y);
    k.view.zIndex = local.y;
    this.entities.addChild(k.view);
    this.krakens.push(k);
    this.particles.splash(local.x, local.y);
    this.shakeUntil = t + 0.8;
    sound.play('rumble');
    this.later(0.4, () => sound.play('roar'));
    this.cb.onSecret('kraken');
  }

  /** The Konami code: Polly turns rainbow for a while and fireworks go up (a secret). */
  private konami() {
    this.rainbowParrot = this.time;
    sound.play('level');
    const p = this.parrot.view.position;
    for (let i = 0; i < 5; i++) this.later(i * 0.3, () => { this.particles.firework(p.x + (Math.random() - 0.5) * 360, p.y - 80 - Math.random() * 160); sound.play('pop'); });
    this.cb.onSecret('konami');
  }

  /** Landmark art is big: these boxes (around the foot) count as tapping it. */
  private landmarkAt(local: { x: number; y: number }): Spot | null {
    const box: Record<string, [number, number, number]> = {
      ferris: [140, -320, 40], lighthouse: [50, -250, 30], volcano: [270, -320, 70], temple: [170, -200, 60],
      mermaid: [70, -160, 30], crystal: [70, -190, 30], gong: [70, -180, 20],
    };
    for (const [kind, lm] of Object.entries(this.landmarks)) {
      const b = box[kind];
      if (!b || !lm) continue;
      const prop = lm.prop;
      const { x, y } = toScreen(prop.gx, prop.gy);
      if (Math.abs(local.x - x) < b[0] && local.y > y + b[1] && local.y < y + b[2]) return this.map.spots.find((s) => s.id === `fun-${kind}`) ?? null;
    }
    return null;
  }

  private viewRect() {
    const z = this.cam.zoom;
    return { x: this.cam.x, y: this.cam.y, w: this.app.screen.width / z, h: this.app.screen.height / z };
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
      case 'tavern': return R.tavernBuilding();
      case 'temple': return A.temple();
      case 'volcano': return A.volcano(seed);
      // Casino interior
      case 'slot': return C.slotMachine(seed);
      case 'bar': return C.barCounter();
      case 'stool': return C.stool();
      case 'bartender': return C.bartender();
      case 'chandelier': return C.chandelier(seed);
      case 'column': return C.column();
      case 'potpalm': return C.potPalm(seed);
      case 'rope-x': return C.stanchion('x');
      case 'rope-y': return C.stanchion('y');
      case 'stanchion': return C.stanchion();
      case 'cardtable': return C.cardTable(seed);
      case 'sofa': return C.sofa();
      case 'viptable': return C.vipTable();
      // VIP Salon
      case 'piano': return R.piano();
      case 'champagne': return R.champagneTower();
      // The Rusty Anchor
      case 'barrel': return R.barrel(seed);
      case 'woodstool': return R.woodStool();
      case 'woodtable': return R.woodTable(seed);
      case 'pirate': return R.pirateKeeper();
      case 'hearth': return R.hearth();
      case 'lantern': return R.lantern(seed);
      case 'perch': return R.parrotPerch();
      case 'chestdecor': return A.chest(false);
      // The isles
      case 'mermaid': return I.mermaid();
      case 'coral': return I.coral(seed);
      case 'umbrella': return I.umbrella(seed);
      case 'shipwreck': return I.shipwreck();
      case 'clam': return I.clam();
      case 'crystal': return I.crystal();
      case 'pine': return I.pine(seed);
      case 'yetipine': return I.pine(seed, true);
      case 'igloo': return I.igloo();
      case 'snowman': return I.snowman(seed);
      case 'penguin': return I.penguin(seed);
      case 'snowrock': return I.snowRock(seed);
      case 'iceberg': return I.iceberg(seed);
      case 'gong': return I.gong();
      case 'cloudtree': return I.cloudTree(seed);
      case 'goldpillar': return I.goldPillar(seed);
      case 'potofgold': return I.potOfGold();
      case 'moon': return I.moon();
      case 'bottle': return I.bottle();
      default: return null;
    }
  }

  private makeSpot(s: Spot): A.Thing {
    switch (s.kind) {
      case 'game':
        if (s.game === 'roulette') return A.rouletteTable();
        if (s.game === 'temple-doors') return A.templeGate();
        if (s.game === 'lava-crash') return A.lavaLookout();
        if (s.game === 'island-reels') return R.reelsMachine(s.gx * 0.13 + s.gy * 0.07, this.map.kind === 'vip');
        if (s.game === 'dragon-tiger') return R.dragonTigerTable(this.map.kind === 'vip');
        if (s.game === 'pirate-dice') return R.diceTable(s.gx * 0.11);
        if (s.game === 'diamond-wheel') return I.diamondWheelStand(DIAMOND_SEGMENTS, GEMS);
        if (s.game === 'coral-drop') return I.coralDropStall();
        if (s.game === 'seahorse-derby') return I.derbyTank();
        if (s.game === 'ice-fishing') return I.fishingHut();
        if (s.game === 'ice-vault') return I.iceVault();
        if (s.game === 'star-keno') return I.observatory();
        if (s.game === 'oracle-chests') return I.oracleTemple();
        return A.stall(s.game!, s.label);
      case 'ferry': return I.ferry(this.map.kind === 'sky');
      case 'travel': return A.signpost();
      case 'daily': return A.chest(true);
      case 'chest': return A.chest(false);
      case 'wardrobe': return A.hut('wardrobe', 'WARDROBE');
      case 'cashier': return A.hut('cashier', 'CASHIER');
      case 'board': return s.id === 'tables-board' ? C.tablesBoard() : A.noticeBoard();
      case 'enter': return s.to === 'tavern' ? R.tavernDoorstep() : s.to === 'vip' ? R.stairsUp() : C.casinoEntrance();
      case 'exit': return this.map.kind === 'vip' ? R.stairsDown() : this.map.kind === 'tavern' ? R.tavernExit() : C.exitArch();
      case 'fun': return { view: new Container() };
    }
  }

  private applyOpen() {
    this.ground.redrawFog(this.open);
    for (const g of this.gateViews) g.view.visible = !this.open.has(g.zone);
    for (const l of this.lockLabels) l.view.visible = !this.open.has(l.zone);
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
      this.keyTrail = [...this.keyTrail, k].slice(-KONAMI.length);
      if (this.keyTrail.join() === KONAMI.join()) {
        this.keyTrail = [];
        this.konami();
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
    if (this.paused || this.cinematic) return;
    const local = this.world.toLocal(new Point(sx, sy));
    if (this.pokeAt(local)) return;
    // A stall or sign under the tap (their art stands up from the foot tile).
    let hit: Spot | null = null;
    let best = Infinity;
    for (const s of this.map.spots) {
      if (s.kind === 'fun') continue;
      const { x, y } = toScreen(s.gx, s.gy);
      if (Math.abs(local.x - x) < 62 && local.y < y + 26 && local.y > y - 140) {
        const d = Math.abs(local.y - (y - 50)) + Math.abs(local.x - x);
        if (d < best) { best = d; hit = s; }
      }
    }
    if (!hit) hit = this.landmarkAt(local);
    // Tapping a building itself (the casino, the tavern) walks to its door.
    if (!hit && this.map.kind === 'island') {
      for (const b of this.map.props) {
        const box = BUILDINGS[b.kind];
        if (!box) continue;
        const { x, y } = toScreen(b.gx, b.gy);
        if (Math.abs(local.x - x) < box[0] && local.y > y - box[1] && local.y < y + 70) {
          hit = this.map.spots.find((s) => s.kind === 'enter' && s.to === b.kind) ?? null;
          if (hit) break;
        }
      }
    }
    const pg = toGrid(local.x, local.y);
    const tx = Math.round(pg.gx), ty = Math.round(pg.gy);
    if (hit) {
      if (!this.open.has(hit.zone)) return this.cb.onLocked(hit.zone);
      this.tap.at(toScreen(hit.ax, hit.ay).x, toScreen(hit.ax, hit.ay).y, this.time);
      if (this.near?.id === hit.id) return this.use(hit);
      this.pendingSpot = hit;
      this.walkTo(hit.ax, hit.ay);
      return;
    }
    const c = this.cell(tx, ty);
    if (this.map.kind === 'island' && c && !c.land && c.shore >= 2) this.seaTap(local);
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
    for (let i = this.timers.length - 1; i >= 0; i--) if (this.timers[i].at <= t) this.timers.splice(i, 1)[0].fn();
    if (this.cinematic && t >= this.cinematic.until) {
      this.cinematic = null;
      this.focus = null;
      this.cb.onCinematic(null);
    }

    // Movement: keyboard (continuous) or path (tap).
    let vx = 0, vy = 0;
    if (!this.paused && !this.cinematic) {
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
            this.use(s);
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
    if (this.ride) this.updateRide(t);
    else this.parrot.view.position.set(ps.x + Math.cos(orbit) * 46, ps.y - 98 + Math.sin(orbit * 2) * 10);
    this.parrot.view.scale.x = -Math.sin(orbit) >= 0 ? 1 : -1;
    this.parrot.view.zIndex = ps.y + 2;
    this.parrot.flap.scale.y = Math.sin(t * 22);
    // The Konami secret: a rainbow Polly trailing stars for 12 seconds.
    const rk = t - this.rainbowParrot;
    if (rk < 12) {
      const hue = (t * 0.6) % 1;
      this.parrot.view.tint = hsl(hue);
      if (Math.random() < dt * 24) this.particles.sparkle(this.parrot.view.x + (Math.random() - 0.5) * 20, this.parrot.view.y + 10, hsl((hue + 0.5) % 1));
    } else if (rk < 12.2) this.parrot.view.tint = 0xffffff;

    // The Sky Kingdom's pot of gold at the rainbow's end (a secret when you get there).
    if (this.map.kind === 'sky') {
      const pot = this.map.props.find((p) => p.kind === 'potofgold');
      if (pot) {
        const d = Math.hypot(pot.gx - pl.gx, pot.gy - pl.gy);
        if (d < 1.8 && !this.atPot) {
          this.atPot = true;
          const q = toScreen(pot.gx, pot.gy);
          for (let i = 0; i < 16; i++) this.later(i * 0.05, () => this.particles.sparkle(q.x + (Math.random() - 0.5) * 80, q.y - 40 - Math.random() * 60, [0xff5b6e, 0xffe066, 0x5fd38a, 0x4fc3ff, 0xb07cff][i % 5]));
          sound.play('chime');
          this.cb.onSecret('rainbow');
        } else if (d > 3) this.atPot = false;
      }
    }

    // Zone, nearby interactable, doorways.
    this.emitZone();
    let near: Spot | null = null;
    let nd = NEAR;
    for (const s of this.map.spots) {
      const d = s.kind === 'fun' ? Math.hypot(s.ax - pl.gx, s.ay - pl.gy) + 0.5 : Math.hypot(s.gx - pl.gx, s.gy - pl.gy);
      if (d < nd && this.open.has(s.zone) && !this.cinematic) { nd = d; near = s; }
      if (s.kind === 'enter' || s.kind === 'exit') {
        if (d > DOOR_REARM) this.armed.set(s.id, true);
        else if (d < DOOR_FIRE && this.armed.get(s.id) && !this.paused && !this.cinematic && this.open.has(s.zone)) {
          this.pendingSpot = null;
          pl.path = [];
          this.use(s);
        }
      }
    }
    if (near?.id !== this.near?.id) {
      this.near = near;
      this.cb.onNear(near);
      this.markerThing.view.visible = !!near;
    }
    if (near) {
      const m = toScreen(near.gx, near.gy);
      const funTall: Record<string, number> = { 'fun-ferris': 330, 'fun-lighthouse': 280, 'fun-volcano': 340, 'fun-temple': 200, 'fun-mermaid': 190, 'fun-crystal': 230, 'fun-gong': 210 };
      const gameTall: Record<string, number> = { 'diamond-wheel': 270, 'coral-drop': 200, 'ice-vault': 190, 'star-keno': 200, 'oracle-chests': 205, 'ice-fishing': 175 };
      const tall = near.kind === 'fun' ? funTall[near.id] ?? 200
        : near.kind === 'game' ? gameTall[near.game!] ?? 160
        : { game: 160, travel: 100, chest: 80, daily: 80, enter: near.to === 'vip' ? 225 : 110, exit: this.map.kind === 'vip' ? 90 : 190, board: 160, wardrobe: 160, cashier: 160, ferry: this.map.kind === 'sky' ? 255 : 150 }[near.kind];
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

    this.particles.update(dt, t);
    this.ambient?.update(dt, t);
    this.snow?.update(dt, t);
    this.clouds?.update(dt);
    if (this.night) this.updateNight(t);
    if (this.aurora) this.updateAurora(t);
    if (this.rainbowArc) this.updateRainbow(t);
    for (let i = this.krakens.length - 1; i >= 0; i--) {
      const k = this.krakens[i];
      k.update?.(t);
      if (k.done(t)) {
        k.view.destroy({ children: true });
        this.krakens.splice(i, 1);
      }
    }

    // Camera, kept inside the map's bounds.
    const target = this.focus ?? { x: ps.x, y: ps.y - 40, zoom: this.cam.target };
    const lerp = 1 - Math.exp(-dt * (this.focus ? 7 : 5));
    this.cam.x += (target.x - this.cam.x) * lerp;
    this.cam.y += (target.y - this.cam.y) * lerp;
    this.cam.zoom += (target.zoom - this.cam.zoom) * lerp;
    const vw = this.app.screen.width, vh = this.app.screen.height;
    const z = this.cam.zoom;
    const halfW = vw / 2 / z, halfH = vh / 2 / z;
    const b = this.map.bounds;
    const minX = b.minX + halfW, maxX = b.maxX - halfW;
    const minY = b.minY + halfH, maxY = b.maxY - halfH;
    const cx = minX > maxX ? (b.minX + b.maxX) / 2 : clamp(this.cam.x, minX, maxX);
    const cy = minY > maxY ? (b.minY + b.maxY) / 2 : clamp(this.cam.y, minY, maxY);
    this.world.scale.set(z);
    const shake = t < this.shakeUntil ? 9 * Math.min(1, (this.shakeUntil - t) / 0.6) : 0;
    this.world.position.set(vw / 2 - cx * z + (Math.random() - 0.5) * shake, vh / 2 - cy * z + (Math.random() - 0.5) * shake);
  }

  private emitZone() {
    const c = this.cell(Math.round(this.player.gx), Math.round(this.player.gy));
    if (c?.zone && c.zone !== this.zone) {
      this.zone = c.zone;
      this.cb.onZone(c.zone);
    }
  }
}

const LEVELS: Partial<Record<ZoneKey, number>> = { casino: 2, jungle: 3, volcano: 4, vip: 5, lagoon: 6, frost: 7, sky: 8 };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** A bright colour round the colour wheel (h in 0-1). */
function hsl(h: number) {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return Math.round(255 * (0.6 - 0.4 * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return (f(0) << 16) | (f(8) << 8) | f(4);
}

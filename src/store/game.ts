import { create } from 'zustand';
import { createDemoApi } from '../api/demo.ts';
import { createHttpApi } from '../api/http.ts';
import { ApiError, type BetBody, type GameKey, type GameMeta, type Info, type IslandApi, type State, type ZoneKey } from '../api/types.ts';
import { sound } from '../ui/sound.ts';

const demo = import.meta.env.VITE_DEMO === '1' || new URLSearchParams(location.search).has('demo');

export type Panel = null | 'menu' | 'wardrobe' | 'history' | 'rg' | 'fair' | 'board' | 'travel' | 'paytables';

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error' | 'win' | 'level';
}

export interface Celebration {
  id: number;
  effect: string;
  multiplier: number;
  payout: number;
  big: boolean;
}

interface Store {
  api: IslandApi;
  phase: 'loading' | 'splash' | 'play' | 'fatal';
  fatal: string | null;
  info: Info | null;
  state: State | null;
  balance: number;
  game: GameKey | null;
  panel: Panel;
  zone: ZoneKey;
  stake: number;
  busy: boolean;
  toasts: Toast[];
  polly: { id: number; text: string } | null;
  celebration: Celebration | null;
  shake: number;
  muted: boolean;
  seenZones: ZoneKey[];
  /** Which map the player is on. */
  scene: 'island' | 'casino';
  /** A doorway in progress: the casino's entrance overlay, or the walk back out. */
  doorway: null | 'enter' | 'exit';
  /** Caption while a landmark show plays (the Ferris wheel ride, the eruption). */
  cinematic: string | null;
  setScene(s: 'island' | 'casino'): void;

  boot(): Promise<void>;
  start(): void;
  /** Calls the API (busy, errors → toast). Applies the state except the balance when holdBalance. */
  run(fn: (api: IslandApi) => Promise<State>, opts?: { holdBalance?: boolean }): Promise<State | null>;
  /** Place a bet: the stake leaves the balance at once; the win is shown by finish() after the animation. */
  bet(body: BetBody): Promise<State | null>;
  /** End-of-animation: show the round's balance, celebrate the win, announce XP and level-ups. */
  finish(s: State): void;
  apply(s: State): void;
  openGame(k: GameKey): void;
  closeGame(): void;
  setPanel(p: Panel): void;
  setStake(n: number): void;
  setZone(z: ZoneKey): void;
  toast(text: string, kind?: Toast['kind']): void;
  say(text: string): void;
  toggleMute(): void;
  meta<K extends GameKey>(k: K): GameMeta<K> | undefined;
}

let ids = 1;
let seenInside = false;

const readMuted = () => {
  try {
    return localStorage.getItem('fortune-isle:muted') === '1';
  } catch {
    return false;
  }
};

export const useGame = create<Store>((set, get) => ({
  api: demo ? createDemoApi() : createHttpApi(),
  phase: 'loading',
  fatal: null,
  info: null,
  state: null,
  balance: 0,
  game: null,
  panel: null,
  zone: 'harbour',
  stake: 5,
  busy: false,
  toasts: [],
  polly: null,
  celebration: null,
  shake: 0,
  muted: readMuted(),
  seenZones: [],
  scene: 'island',
  doorway: null,
  cinematic: null,
  setScene(s) {
    if (get().scene === s) return;
    const first = s === 'casino' && !seenInside;
    if (first) seenInside = true;
    set({ scene: s });
    sound.ambience(true, s);
    if (first) get().say('Ooh, fancy! The roulette tables are on the left — and mind the velvet ropes, the VIP lounge is members only.');
  },

  async boot() {
    const { api } = get();
    try {
      const [info, balance, state] = await Promise.all([api.info(), api.balance(), api.state()]);
      const stake = info.chips.includes(5) ? 5 : info.chips[0] ?? info.minBet;
      set({ info, balance, state, stake, phase: 'splash' });
    } catch (e) {
      set({ phase: 'fatal', fatal: e instanceof Error ? e.message : String(e) });
    }
  },

  start() {
    sound.unlock();
    sound.setMuted(get().muted);
    sound.ambience(true, get().scene);
    set({ phase: 'play' });
    const s = get().state;
    // Disconnect recovery: an unfinished Temple Doors or Lava Crash round reopens its game.
    if (s?.round?.status === 'live') {
      set({ game: s.round.game });
      get().say('Squawk! You left a round running — let’s finish it!');
    } else if ((s?.session.rounds ?? 0) === 0 && (s?.player.xp ?? 0) === 0) {
      get().say('Welcome to Fortune Isle! Tap the ground to walk. The Boardwalk stalls are just up the path →');
    } else {
      get().say('Welcome back, matey! The island missed you.');
    }
  },

  async run(fn, opts) {
    if (get().busy) return null;
    set({ busy: true });
    try {
      const s = await fn(get().api);
      if (opts?.holdBalance) set({ state: s });
      else get().apply(s);
      return s;
    } catch (e) {
      const msg = e instanceof ApiError || e instanceof Error ? e.message : String(e);
      get().toast(msg, 'error');
      sound.play('error');
      if (e instanceof ApiError && e.code === 'SESSION') set({ phase: 'fatal', fatal: msg });
      return null;
    } finally {
      set({ busy: false });
    }
  },

  async bet(body) {
    const stake = body.game === 'roulette' ? (body.bets ?? []).reduce((s, b) => s + b.amount, 0) : body.stake;
    const s = await get().run((api) => api.bet(body), { holdBalance: true });
    if (!s) return null;
    sound.play('chip');
    set({ balance: Math.round((get().balance - stake) * 100) / 100 });
    if (s.round?.status === 'live' && s.round.balance != null) set({ balance: s.round.balance });
    return s;
  },

  finish(s) {
    const r = s.round;
    if (!r) return;
    if (r.balance != null) set({ balance: r.balance });
    // Only a payout above the stake is celebrated; ×0.5 or ×1 is a partial or full refund, not a win.
    if (r.payout > 0 && r.multiplier <= 1) sound.play('coin');
    else if (r.payout > 0) {
      const big = r.multiplier >= 10;
      set({
        celebration: { id: ids++, effect: s.player.equipped.effect, multiplier: r.multiplier, payout: r.payout, big },
        shake: big ? get().shake + 1 : get().shake,
      });
      sound.play(big ? 'bigwin' : r.multiplier >= 2 ? 'win' : 'smallwin');
      if (big) get().say(`SQUAWK!! ×${r.multiplier} — that’s a treasure haul!`);
      else if (r.multiplier >= 3 && Math.random() < 0.6) get().say(['Shiver me timbers, a winner!', 'Pieces of eight! Pieces of eight!', 'Polly wants a payout — and got one!'][Math.floor(Math.random() * 3)]);
    } else {
      sound.play('lose');
      if (Math.random() < 0.15) get().say(['Ooh, so close! Polly believes in you.', 'Not this time, matey.', 'The sea gives, the sea takes!'][Math.floor(Math.random() * 3)]);
    }
    if (r.winPending) get().toast('Your win is being credited — it will show in your balance shortly.', 'info');
    if (r.levelUp > 0) {
      get().toast(`Level ${s.player.level}! +${r.levelUp} key${r.levelUp > 1 ? 's' : ''}`, 'level');
      sound.play('level');
      const unlocked = get().info?.zones.find((z) => z.level === s.player.level);
      if (unlocked) get().say(`Level ${s.player.level}! The ${unlocked.name} is open — use a signpost to fast-travel there!`);
    }
  },

  apply(s) {
    set({ state: s });
    if (s.round?.balance != null) set({ balance: s.round.balance });
  },

  openGame(k) {
    sound.play('open');
    set({ game: k, panel: null });
  },
  closeGame() {
    if (get().state?.round?.status === 'live') {
      get().toast('Finish the round in play first.', 'info');
      return;
    }
    sound.play('close');
    set({ game: null });
  },
  setPanel(p) {
    if (p) sound.play('open');
    set({ panel: p });
  },
  setStake(n) {
    sound.play('tick');
    set({ stake: n });
  },
  setZone(z) {
    if (get().zone === z) return;
    const first = !get().seenZones.includes(z);
    set({ zone: z, seenZones: first ? [...get().seenZones, z] : get().seenZones });
    if (!first) return;
    const lines: Record<ZoneKey, string> = {
      harbour: 'The Harbour! Grab your daily chest and check the notice board.',
      boardwalk: 'The Boardwalk — Coconut Shy, Cup Shuffle and the Scratch Kiosk. Easy does it!',
      fairground: 'Roll up, roll up! The Fairground has the Prize Wheel, Duck Pond and High Striker.',
      casino: 'The Grand Casino! Walk up the red carpet to the doors to go inside.',
      jungle: 'The Jungle Ruins… mind the traps behind the Temple Doors! There’s a treasure chest hidden somewhere too.',
      volcano: 'Volcano Summit! The lava climbs and climbs — cash out before it erupts!',
    };
    get().say(lines[z]);
  },
  toast(text, kind = 'info') {
    const id = ids++;
    set({ toasts: [...get().toasts.slice(-3), { id, text, kind }] });
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), kind === 'error' ? 4200 : 3000);
  },
  say(text) {
    const id = ids++;
    set({ polly: { id, text } });
    sound.play('squawk');
    setTimeout(() => {
      if (get().polly?.id === id) set({ polly: null });
    }, 5200);
  },
  toggleMute() {
    const muted = !get().muted;
    try {
      localStorage.setItem('fortune-isle:muted', muted ? '1' : '0');
    } catch {
      /* private mode */
    }
    sound.setMuted(muted);
    set({ muted });
  },
  meta<K extends GameKey>(k: K) {
    return get().info?.games.find((g) => g.key === k) as GameMeta<K> | undefined;
  },
}));

export const money = (n: number, currency = 'ZAR') =>
  (currency === 'ZAR' ? 'R' : `${currency} `) + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

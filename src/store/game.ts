import { create } from 'zustand';
import { createDemoApi } from '../api/demo.ts';
import { createHttpApi } from '../api/http.ts';
import { ApiError, type BetBody, type FreePlay, type GameKey, type GameMeta, type Info, type IslandApi, type PromoOutcome, type PromoState, type State, type ZoneKey } from '../api/types.ts';
import { BOTTLE_NOTE, loadSecrets, saveSecrets, SECRETS } from '../ui/secrets.ts';
import { sound } from '../ui/sound.ts';
import { isIsle, type SceneKey } from '../world/map.ts';

const demo = import.meta.env.VITE_DEMO === '1' || new URLSearchParams(location.search).has('demo');

export type Panel = null | 'menu' | 'wardrobe' | 'history' | 'rg' | 'fair' | 'board' | 'travel' | 'paytables' | 'promos' | 'secrets';

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
  scene: SceneKey;
  /** A doorway in progress: a building's entrance overlay going in (to = the room), the quick fade going out, or the
   *  ferry's sailing chart (to = where the player is now). */
  doorway: null | { kind: 'enter' | 'exit' | 'ferry'; to: SceneKey };
  /** Secrets found on this device (easter eggs). */
  secrets: string[];
  findSecret(id: string): void;
  /** Caption while a landmark show plays (the Ferris wheel ride, the eruption). */
  cinematic: string | null;
  setScene(s: SceneKey): void;

  /** Promotions for this game (live promotions, the player's free plays, recent rewards); null until loaded. */
  promos: PromoState | null;
  /** The player chose to use a free play for the next round of the open game. */
  useFree: boolean;
  /** Reloads the promotions. Rewards that weren't already shown (rain, leaderboard prizes, grants…) are toasted;
   *  skipRound: the round whose rewards finish() just showed. */
  loadPromos(skipRound?: string): Promise<void>;
  setUseFree(on: boolean): void;
  /** Free plays usable at this attraction, soonest to expire first. */
  freePlaysFor(k: GameKey | null): FreePlay[];

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
const seenScenes = new Set<SceneKey>(['island']);
/** Reward ids already shown (or there before the game opened). */
const seenAwards = new Set<string>();
let promosLoaded = false;

/** A toast for what a play earned. Progress is only shown when it's news (a new symbol, one play to go). */
function promoToast(o: PromoOutcome, currency: string): { text: string; kind: Toast['kind'] } | null {
  if (o.kind === 'Cash') return { text: `🎁 ${o.promotion}: ${o.message} +${money(o.amount, currency)}`, kind: 'win' };
  if (o.kind === 'FreeBet') return { text: `🎁 ${o.promotion}: ${o.message} You earned a ${money(o.amount, currency)} free play.`, kind: 'win' };
  if (o.type === 'CollectionMission' && o.progress?.isNew) return { text: `🧭 ${o.message}`, kind: 'info' };
  if (o.type === 'StreakMission' && o.progress && o.progress.target - o.progress.streak === 1) return { text: `🔥 ${o.promotion}: one more play for the reward!`, kind: 'info' };
  if (o.type === 'BuyXGetFree' && o.progress && o.progress.buy - o.progress.count === 1) return { text: `🎟️ ${o.promotion}: one more for a free play!`, kind: 'info' };
  return null;
}

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
  promos: null,
  useFree: false,
  secrets: loadSecrets(),

  findSecret(id) {
    const s = SECRETS.find((x) => x.id === id);
    if (!s) return;
    if (id === 'bottle') get().say(BOTTLE_NOTE);
    if (get().secrets.includes(id)) {
      if (s.line) get().say(s.line);
      return;
    }
    const secrets = [...get().secrets, id];
    saveSecrets(secrets);
    set({ secrets });
    sound.play('secret');
    get().toast(`🗝️ Secret found: ${s.name} (${secrets.length}/${SECRETS.length})`, 'level');
    if (s.line) get().say(s.line);
    if (secrets.length === SECRETS.length)
      setTimeout(() => {
        get().toast('🏆 Every secret on the isles found!', 'level');
        get().say('Every single secret! You’re a true island explorer, matey. Squawk!');
        sound.play('bigwin');
      }, 3000);
  },

  async loadPromos(skipRound) {
    let p: PromoState;
    try {
      p = await get().api.promotions();
    } catch {
      return; // promotions are extras: the game plays on without them
    }
    const currency = get().info?.currency ?? 'ZAR';
    let cash = false;
    for (const a of [...p.recentAwards].reverse()) {
      if (seenAwards.has(a.awardId)) continue;
      seenAwards.add(a.awardId);
      if (!promosLoaded || (skipRound && a.roundId === skipRound) || a.reason === 'Free bet win') continue;
      if (a.kind === 'Cash') {
        cash = true;
        get().toast(`🎁 ${a.promotion ?? 'Promotion'}: ${a.reason} +${money(a.amount, currency)}`, 'win');
        sound.play('coin');
      } else get().toast(`🎁 ${a.promotion ?? 'Promotion'}: a ${money(a.amount, currency)} free play is yours!`, 'win');
    }
    promosLoaded = true;
    set({ promos: p });
    if (get().useFree && get().freePlaysFor(get().game).length === 0) set({ useFree: false });
    // Cash from rain, leaderboards or cashback changes the balance outside a round.
    if (cash && get().state?.round?.status !== 'live') get().api.balance().then((b) => set({ balance: b })).catch(() => {});
  },
  setUseFree(on) {
    sound.play('tick');
    set({ useFree: on && get().freePlaysFor(get().game).length > 0 });
  },
  freePlaysFor(k) {
    return freePlaysIn(get().promos, k);
  },

  setScene(s) {
    if (get().scene === s) return;
    const first = !seenScenes.has(s);
    seenScenes.add(s);
    set({ scene: s });
    sound.ambience(true, s);
    const lines: Partial<Record<SceneKey, string>> = {
      casino: 'Ooh, fancy! Roulette on the left, Island Reels under the big screen, Dragon Tiger at the card tables — and the VIP Salon is up the stairs past the ropes.',
      vip: 'The VIP Salon! Back a gem on the Diamond Wheel — or try the golden reels, private roulette and Dragon Tiger.',
      tavern: 'Arr, the Rusty Anchor! Pick a face at the Pirate Dice tables — three of yours pays ×12.36!',
      lagoon: 'The Coral Lagoon! Drop a pearl at Coral Drop, or back a seahorse in the Derby. Psst — that shipwreck looks spooky…',
      frost: 'Brrr, Frost Isle! Ice Fishing on the frozen lake, the Ice Vault in the rocks. Touch the crystal for the northern lights!',
      sky: 'The Sky Kingdom! Star Keno in the observatory, the Oracle’s Chests in her temple — and mind the rainbows, they’re bridges.',
    };
    if (first && lines[s]) get().say(lines[s]);
  },

  async boot() {
    const { api } = get();
    try {
      const [info, balance, state] = await Promise.all([api.info(), api.balance(), api.state()]);
      const stake = info.chips.includes(5) ? 5 : info.chips[0] ?? info.minBet;
      set({ info, balance, state, stake, phase: 'splash' });
      await get().loadPromos();
      // Rewards while away (rain, leaderboard prizes, cashback) are checked every 30 seconds.
      setInterval(() => {
        if (get().phase === 'play' && !document.hidden) void get().loadPromos();
      }, 30_000);
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
    const p = get().promos;
    if (p && (p.promotions.length > 0 || p.freeBets.length > 0) && s?.round?.status !== 'live') {
      const free = p.freeBets.length;
      const n = p.promotions.length;
      setTimeout(() => get().say(free > 0
        ? `Squawk! You’ve got ${free} free play${free > 1 ? 's' : ''} — tap 🎁 at the top, or the gift by the stake chips.`
        : `There ${n === 1 ? 'is a promotion' : `are ${n} promotions`} on the island today — tap 🎁 or read the Harbour notice board!`), 5600);
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
    // A free play: chosen with the gift toggle, available here, and (roulette) the table adds up to its value.
    const free = get().useFree ? get().freePlaysFor(body.game)[0] : undefined;
    if (free && body.game === 'roulette') {
      const total = (body.bets ?? []).reduce((s, b) => s + b.amount, 0);
      if (Math.abs(total - free.amount) > 0.001) {
        get().toast(`Your free play is worth ${money(free.amount, get().info?.currency)} — place exactly that on the table.`, 'info');
        return null;
      }
    }
    const req = free ? { ...body, freeBet: true } : body;
    const stake = free ? 0 : body.game === 'roulette' ? (body.bets ?? []).reduce((s, b) => s + b.amount, 0) : body.stake;
    const s = await get().run((api) => api.bet(req), { holdBalance: true });
    if (!s) {
      if (free) void get().loadPromos();
      return null;
    }
    sound.play('chip');
    if (free) {
      // The free play is used up: drop it now so the toggle and counts update straight away.
      const promos = get().promos;
      if (promos) set({ promos: { ...promos, freeBets: promos.freeBets.filter((f) => f.awardId !== free.awardId) } });
      if (get().freePlaysFor(body.game).length === 0) set({ useFree: false });
    }
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
    const currency = get().info?.currency ?? 'ZAR';
    for (const o of r.promos ?? []) {
      const t = promoToast(o, currency);
      if (t) get().toast(t.text, t.kind);
      if (o.kind !== 'Progress') sound.play('coin');
    }
    if (r.free) get().toast(r.payout > 0 ? `Free play: ${money(r.payout, currency)} paid by the promotion.` : 'Free play used — better luck next time!', 'info');
    void get().loadPromos(r.id);
    if (r.levelUp > 0) {
      get().toast(`Level ${s.player.level}! +${r.levelUp} key${r.levelUp > 1 ? 's' : ''}`, 'level');
      sound.play('level');
      const unlocked = get().info?.zones.find((z) => z.level === s.player.level);
      if (unlocked && isIsle(unlocked.key)) get().say(`Level ${s.player.level}! The ${unlocked.name} is open — take the Island Hopper from the end of the Harbour pier!`);
      else if (unlocked) get().say(`Level ${s.player.level}! The ${unlocked.name} is open — use a signpost to fast-travel there!`);
    }
  },

  apply(s) {
    set({ state: s });
    if (s.round?.balance != null) set({ balance: s.round.balance });
  },

  openGame(k) {
    sound.play('open');
    set({ game: k, panel: null, useFree: false });
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
      harbour: 'The Harbour! Grab your daily chest, check the notice board — and the Rusty Anchor tavern has Pirate Dice.',
      boardwalk: 'The Boardwalk — Coconut Shy, Cup Shuffle and the Scratch Kiosk. Easy does it!',
      fairground: 'Roll up, roll up! The Fairground has the Prize Wheel, Duck Pond and High Striker.',
      casino: 'The Grand Casino! Walk up the red carpet to the doors to go inside.',
      jungle: 'The Jungle Ruins… mind the traps behind the Temple Doors! There’s a treasure chest hidden somewhere too.',
      volcano: 'Volcano Summit! The lava climbs and climbs — cash out before it erupts!',
      // Rooms and isles: their own greeting (setScene) covers them.
      vip: '', lagoon: '', frost: '', sky: '',
    };
    if (lines[z]) get().say(lines[z]);
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

/** Free plays usable at this attraction (empty subGames = anywhere). Pure, so components can call it on selected state. */
export function freePlaysIn(promos: PromoState | null, k: GameKey | null): FreePlay[] {
  if (!k) return [];
  return (promos?.freeBets ?? []).filter((f) => f.subGames.length === 0 || f.subGames.includes(k));
}

export const money = (n: number, currency = 'ZAR') =>
  (currency === 'ZAR' ? 'R' : `${currency} `) + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

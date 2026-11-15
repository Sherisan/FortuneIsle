import * as R from './rules.ts';
import { DemoPromos } from './demoPromos.ts';
import { ApiError, type BetBody, type FreePlay, type GameKey, type HistoryEntry, type IslandApi, type LimitsBody, type RoundView, type State } from './types.ts';

/*
 * Offline demo engine (?demo or VITE_DEMO=1): the same rules as IslandService, played in the browser with
 * crypto.getRandomValues and fun money. Not provably fair (no committed seed) — the real game is.
 * ?unlock starts at level 6 with every zone open.
 */

const rand = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
const pick = (n: number) => Math.floor(rand() * n);
const weighted = (table: { weight: number }[]) => {
  let roll = pick(table.reduce((s, x) => s + x.weight, 0));
  for (let i = 0; i < table.length; i++) {
    if (roll < table[i].weight) return i;
    roll -= table[i].weight;
  }
  return table.length - 1;
};
const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('');
const floor2 = (x: number) => Math.floor(x * 100 + 1e-9) / 100;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface DemoRound extends RoundView {
  crash: number;
  startedAt: number;
  level: number;
  picks: { level: number; door: number; trap: number | null }[];
  ended: Promise<void>;
  end: () => void;
  /** The free play this round uses (promotions pay it), or null. */
  freePlay: FreePlay | null;
  golden: boolean;
}

export function createDemoApi(): IslandApi {
  const unlock = new URLSearchParams(location.search).has('unlock');
  let balance = 10000;
  let xp = unlock ? R.xpFor(6) : 0;
  let keys = unlock ? 3 : 0;
  const owned = new Set(R.COSMETICS.filter((c) => c.level === 1 || (unlock && c.level > 0 && c.level <= 6)).map((c) => c.id));
  const equipped = { hat: 'hat-straw', outfit: 'outfit-tee', pet: 'pet-none', effect: 'fx-confetti' } as State['player']['equipped'];
  let lastDaily = '';
  let nonce = 0;
  let clientSeed = hex(8);
  let nextSeed = hex(32);
  let open: DemoRound | null = null;
  const history: HistoryEntry[] = [];
  const session = { startedAt: Date.now(), staked: 0, won: 0, rounds: 0 };
  const limits: State['limits'] = { lossLimit: { value: null, pending: null }, sessionMinutes: { value: null, pending: null }, realityCheckMinutes: 30 };

  const level = () => R.levelOf(xp);
  const promos = new DemoPromos();

  /** The attraction's top result, as IslandService.IsHit has it. */
  const isHit = (r: DemoRound, m: number) => {
    if (m <= 0) return false;
    switch (r.game) {
      case 'coconut-shy': return m === (r.golden ? Math.max(...R.COCONUT_GOLDEN.map((t) => t.multiplier)) : R.COCONUT_CLASSIC);
      case 'cup-shuffle': return true;
      case 'prize-wheel': return m === Math.max(...R.WHEEL);
      case 'duck-pond': return m === Math.max(...R.DUCK_TABLE.map((t) => t.multiplier));
      case 'high-striker': return m === Math.max(...R.STRIKER_TABLE.map((t) => t.multiplier));
      case 'scratch-kiosk': return m === Math.max(...R.SCRATCH_TABLE.map((t) => t.multiplier));
      case 'temple-doors': return r.level === R.TEMPLE_LEVELS;
      case 'lava-crash': return m >= 10;
      case 'roulette': return (r.choice?.bets ?? []).some((b: { type: string; numbers: number[] }) => b.type === 'straight' && b.numbers[0] === r.outcome?.pocket);
    }
  };

  const addXp = (n: number) => {
    const before = level();
    xp += n;
    const after = level();
    if (after > before) {
      keys += after - before;
      R.COSMETICS.filter((c) => c.level > 0 && c.level <= after).forEach((c) => owned.add(c.id));
    }
  };

  const view = (r: DemoRound | null): RoundView | null => {
    if (!r) return null;
    const { crash, startedAt, level: lv, picks: _p, ended: _e, end: _n, freePlay, golden: _g, ...rest } = r;
    void _p; void _e; void _n; void _g;
    return {
      ...rest,
      free: freePlay != null,
      temple: r.game === 'temple-doors' ? { level: lv, now: R.templeMultiplier(lv), next: lv < R.TEMPLE_LEVELS ? R.templeMultiplier(lv + 1) : null } : null,
      lava: r.game === 'lava-crash' ? { elapsedMs: Date.now() - startedAt, auto: r.lava?.auto ?? null, crash: r.status === 'live' ? null : crash } : null,
      serverSeed: r.status === 'live' ? null : r.serverSeed,
    };
  };

  const state = (withHistory = false): State => {
    const lv = level();
    return {
      round: view(open),
      player: {
        level: lv, xp, levelXp: R.xpFor(lv), nextXp: R.xpFor(lv + 1), keys,
        zones: R.ZONES.filter((z) => lv >= z.level).map((z) => z.key),
        owned: [...owned].sort(), equipped: { ...equipped }, dailyReady: lastDaily !== new Date().toISOString().slice(0, 10),
      },
      session: { ...session },
      limits: structuredClone(limits),
      fairness: { serverSeedHash: nextSeed.slice(0, 64), clientSeed, nonce: nonce + 1 },
      history: withHistory ? [...history] : null,
      serverTime: Date.now(),
    };
  };

  const settle = (r: DemoRound, status: RoundView['status'], m: number) => {
    r.status = status;
    r.multiplier = m;
    const gross = m > 0 ? Math.min(floor2(r.stake * m), 250000) : 0;
    const credit = (x: number) => (balance = Math.round((balance + x) * 100) / 100);
    if (r.freePlay) {
      r.payout = promos.settleFree(r.freePlay, r.id, gross);
      credit(r.payout);
    } else {
      r.payout = gross;
      credit(gross);
      session.won += gross;
      const pocket: number | undefined = r.game === 'roulette' ? r.outcome?.pocket : undefined;
      const straight: Record<number, number> = {};
      for (const b of r.choice?.bets ?? []) if (b.type === 'straight') straight[b.numbers[0]] = (straight[b.numbers[0]] ?? 0) + b.amount;
      r.promos = promos.played({ id: r.id, game: r.game, stake: r.stake, multiplier: m, payout: gross, hit: !!isHit(r, m), pocket, straight }, credit);
    }
    r.balance = balance;
    const before = level();
    addXp(R.XP_PER_ROUND);
    r.xpGained = R.XP_PER_ROUND;
    r.levelUp = level() - before;
    if (r.game === 'lava-crash') r.outcome = { crash: r.crash, at: status === 'lost' ? r.crash : m };
    r.end();
    history.unshift({
      id: r.id, time: Date.now(), game: r.game, stake: r.stake, multiplier: m, payout: r.payout, status,
      choice: r.choice, outcome: r.outcome, serverSeed: r.serverSeed!, serverSeedHash: '(demo)', clientSeed, nonce: r.nonce,
    });
    if (history.length > 50) history.pop();
  };

  const lavaDue = (r: DemoRound) => {
    const auto = r.lava?.auto;
    if (auto != null && auto <= r.crash) return r.startedAt + R.lavaTimeTo(auto) * 1000;
    if (r.crash >= R.LAVA_MAX) return r.startedAt + R.lavaTimeTo(R.LAVA_MAX) * 1000;
    return r.crash <= 0 ? r.startedAt : r.startedAt + R.lavaTimeTo(r.crash + 0.01) * 1000;
  };
  const resolveLava = () => {
    const r = open;
    if (!r || r.status !== 'live' || r.game !== 'lava-crash' || Date.now() < lavaDue(r)) return;
    const auto = r.lava?.auto;
    if (auto != null && auto <= r.crash) settle(r, 'cashed', auto);
    else if (r.crash >= R.LAVA_MAX) settle(r, 'cashed', R.LAVA_MAX);
    else settle(r, 'lost', 0);
  };
  setInterval(resolveLava, 250);

  const fail = (msg: string, code = 'BAD') => Promise.reject(new ApiError(msg, code));
  const lag = async <T>(v: () => T) => { await sleep(120); return v(); };

  const instant = (game: GameKey, body: BetBody): [number, unknown, unknown] => {
    switch (game) {
      case 'coconut-shy': {
        const golden = body.mode === 'golden';
        const ch = body.choice!;
        if (!golden) {
          const at = pick(5);
          return [at === ch ? R.COCONUT_CLASSIC : 0, { coconut: ch, mode: 'classic' }, { prizeAt: at, tier: at === ch ? 'prize' : 'miss' }];
        }
        const tier = weighted(R.COCONUT_GOLDEN);
        const at = tier > 0 ? ch : (ch + 1 + pick(4)) % 5;
        return [R.COCONUT_GOLDEN[tier].multiplier, { coconut: ch, mode: 'golden' }, { prizeAt: at, tier: R.COCONUT_GOLDEN[tier].key }];
      }
      case 'cup-shuffle': {
        const at = pick(3);
        return [at === body.choice ? R.CUP_PAYS : 0, { cup: body.choice }, { ballUnder: at }];
      }
      case 'prize-wheel': {
        const seg = pick(20);
        return [R.WHEEL[seg], null, { segment: seg }];
      }
      case 'duck-pond': {
        const ducks = Array.from({ length: 12 }, () => R.DUCK_TABLE[weighted(R.DUCK_TABLE)].multiplier);
        return [ducks[body.choice!], { duck: body.choice }, { ducks }];
      }
      case 'high-striker': {
        const tier = weighted(R.STRIKER_TABLE);
        return [R.STRIKER_TABLE[tier].multiplier, null, { tier, key: R.STRIKER_TABLE[tier].key }];
      }
      case 'scratch-kiosk': {
        const tier = weighted(R.SCRATCH_TABLE);
        const card: (string | null)[] = Array(9).fill(null);
        const counts: Record<string, number> = Object.fromEntries(R.SCRATCH_SYMBOLS.map((s) => [s, 0]));
        if (tier > 0) {
          const win = R.SCRATCH_TABLE[tier].key;
          for (let k = 0; k < 3; k++) {
            const empty = card.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0);
            card[empty[pick(empty.length)]] = win;
          }
          counts[win] = 3;
        }
        for (let i = 0; i < 9; i++) {
          if (card[i]) continue;
          const openS = R.SCRATCH_SYMBOLS.filter((s) => counts[s] < 2);
          const s = openS[pick(openS.length)];
          card[i] = s;
          counts[s]++;
        }
        return [R.SCRATCH_TABLE[tier].multiplier, null, { card, symbol: tier > 0 ? R.SCRATCH_TABLE[tier].key : null }];
      }
      case 'roulette': {
        const pocket = pick(37);
        const bets = body.bets ?? [];
        const win = bets.filter((b) => b.numbers.includes(pocket)).reduce((s, b) => s + b.amount * (R.ROULETTE_PAYOUTS[b.type] + 1), 0);
        const stake = bets.reduce((s, b) => s + b.amount, 0);
        return [stake > 0 ? win / stake : 0, { bets }, { pocket, color: R.colorOf(pocket), win }];
      }
      default:
        throw new Error('not instant');
    }
  };

  return {
    demo: true,
    info: async () => R.demoInfo(),
    balance: async () => balance,
    state: () => lag(() => { resolveLava(); return state(true); }),
    async bet(body) {
      await sleep(150);
      resolveLava();
      if (open?.status === 'live') return fail('Finish your round in play first.', 'ROUND_IN_PLAY');
      const meta = R.GAMES.find((g) => g.key === body.game);
      if (!meta) return fail('Unknown game.');
      const zone = R.ZONES.find((z) => z.key === meta.zone)!;
      if (level() < zone.level) return fail(`${meta.name} unlocks at level ${zone.level}.`, 'ZONE_LOCKED');
      let stake = body.game === 'roulette' ? (body.bets ?? []).reduce((s, b) => s + b.amount, 0) : body.stake;
      let freePlay: FreePlay | null = null;
      if (body.freeBet) {
        freePlay = promos.claim(body.game);
        if (!freePlay) return fail(`You have no free play for ${meta.name}.`, 'NO_FREE_BET');
        if (body.game === 'roulette' && stake !== freePlay.amount) {
          promos.release(freePlay);
          return fail(`Your free play is worth ${freePlay.amount.toFixed(2)} — place exactly that on the table.`, 'FREE_BET_AMOUNT');
        }
        stake = freePlay.amount;
      } else {
        if (!(stake >= 1 && stake <= 500)) return fail('The stake must be between 1.00 and 500.00.', 'INVALID_AMOUNT');
        if (stake > balance) return fail('Insufficient balance.', 'INSUFFICIENT_FUNDS');
        const lost = session.staked - session.won;
        if (limits.lossLimit.value != null && lost + stake > limits.lossLimit.value)
          return fail(`This bet would take you past your session loss limit of ${limits.lossLimit.value.toFixed(2)}.`, 'LOSS_LIMIT');
        balance = Math.round((balance - stake) * 100) / 100;
        session.staked += stake;
      }
      session.rounds++;
      nonce++;
      let end = () => {};
      const ended = new Promise<void>((r) => (end = r));
      const r: DemoRound = {
        id: hex(8), game: body.game, stake, choice: null, outcome: null, status: 'live', multiplier: 0, payout: 0, balance,
        winPending: false, xpGained: 0, levelUp: 0, temple: null, lava: null, serverSeed: nextSeed, clientSeed, nonce,
        crash: 0, startedAt: Date.now(), level: 0, picks: [], ended, end, freePlay, golden: body.mode === 'golden', promos: [],
      };
      nextSeed = hex(32);
      open = r;
      if (body.game === 'temple-doors') r.outcome = { level: 0, picks: r.picks };
      else if (body.game === 'lava-crash') {
        r.crash = R.lavaCrashPoint(rand());
        r.lava = { elapsedMs: 0, auto: body.auto ?? null, crash: null };
        r.choice = { auto: body.auto ?? null };
        resolveLava();
      } else {
        const [m, choice, outcome] = instant(body.game, body);
        r.choice = choice;
        r.outcome = outcome;
        settle(r, m > 0 ? 'won' : 'lost', m);
      }
      return state();
    },
    async action(action, door) {
      await sleep(120);
      resolveLava();
      const r = open;
      if (!r || r.status !== 'live') return action === 'cashout' && r ? state() : fail('There is no round in play.', 'NO_ROUND');
      if (r.game === 'temple-doors') {
        if (action === 'pick') {
          const trap = pick(3);
          r.picks.push({ level: r.level, door: door!, trap: door === trap ? trap : null });
          if (door === trap) { r.outcome = { level: r.level, picks: r.picks, trapAt: trap }; settle(r, 'lost', 0); }
          else {
            r.level++;
            r.outcome = { level: r.level, picks: r.picks };
            if (r.level === R.TEMPLE_LEVELS) settle(r, 'won', R.templeMultiplier(r.level));
          }
        } else {
          if (r.level === 0) return fail('Open at least one door first.', 'NOT_ALLOWED');
          settle(r, 'cashed', R.templeMultiplier(r.level));
        }
      } else {
        settle(r, 'cashed', R.lavaAt((Date.now() - r.startedAt) / 1000));
      }
      return state();
    },
    async watch() {
      resolveLava();
      const r = open;
      if (r && r.status === 'live' && r.game === 'lava-crash') {
        await Promise.race([r.ended, sleep(Math.max(0, lavaDue(r) - Date.now()) + 30)]);
        resolveLava();
      }
      return state();
    },
    seed: (s) => lag(() => { clientSeed = s; return state(); }),
    equip: (id) => lag(() => {
      const item = R.COSMETICS.find((c) => c.id === id);
      if (!item || !owned.has(id)) throw new ApiError('You haven’t unlocked that yet.', 'NOT_OWNED');
      equipped[item.kind] = id;
      return state();
    }),
    daily: () => lag(() => {
      const today = new Date().toISOString().slice(0, 10);
      if (lastDaily === today) throw new ApiError('Today’s reward is claimed — come back tomorrow.', 'ALREADY_CLAIMED');
      lastDaily = today;
      keys++;
      addXp(R.XP_DAILY);
      return state();
    }),
    chest: () => lag(() => {
      if (keys <= 0) throw new ApiError('You need a key — earn one each level and from the daily reward.', 'NO_KEYS');
      keys--;
      const left = R.COSMETICS.filter((c) => c.level === 0 && !owned.has(c.id));
      if (left.length === 0) addXp(50);
      else owned.add(left[pick(left.length)].id);
      return state();
    }),
    promotions: () => lag(() => promos.state()),
    limits: (b: LimitsBody) => lag(() => {
      limits.lossLimit.value = b.lossLimit;
      limits.sessionMinutes.value = b.sessionMinutes;
      limits.realityCheckMinutes = b.realityCheckMinutes;
      return state();
    }),
  };
}

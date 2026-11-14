import type { Cosmetic, GameKey, GameMeta, Info, Tier, Zone, ZoneKey } from './types.ts';

/*
 * Mirror of FeedingFranzeeAPI Domain/Island/Island.cs (IslandRules). The server is the authority; this copy powers the
 * offline demo engine (?demo) and scripts/rtp-check.ts. Keep the two in lockstep.
 */

export const RTP = 0.96;

const t = (key: string, multiplier: number, weight: number): Tier => ({ key, multiplier, weight });

export const COCONUTS = 5;
export const COCONUT_CLASSIC = 4.8;
export const COCONUT_GOLDEN: Tier[] = [t('miss', 0, 820), t('prize', 3.5, 160), t('golden', 20, 20)];

export const CUPS = 3;
export const CUP_PAYS = 2.88;

export const WHEEL = [0, 1, 0, 1.5, 0, 1, 0, 3, 0, 1.5, 1, 0, 1.5, 0, 1, 0, 5.2, 0, 1.5, 1];

export const DUCKS = 12;
export const DUCK_TABLE: Tier[] = [t('0', 0, 493), t('0.5', 0.5, 150), t('1', 1, 150), t('2', 2, 110), t('3', 3, 60), t('5', 5, 27), t('20', 20, 10)];

export const STRIKER_TABLE: Tier[] = [t('0', 0, 268), t('0.5', 0.5, 380), t('1', 1, 200), t('2', 2, 110), t('5', 5, 30), t('10', 10, 10), t('bell', 50, 2)];

export const SCRATCH_TABLE: Tier[] = [
  t('lose', 0, 575),
  t('shell', 1, 250),
  t('starfish', 2, 120),
  t('coconut', 5, 40),
  t('parrot', 10, 12),
  t('pearl', 25, 2),
  t('treasure', 100, 1),
];
export const SCRATCH_SYMBOLS = SCRATCH_TABLE.slice(1).map((x) => x.key);

export const TEMPLE_LEVELS = 8;
export const TEMPLE_DOORS = 3;
/** 0.96 × 1.5^level floored to 2 dp. */
export function templeMultiplier(level: number): number {
  if (level <= 0) return 1;
  // Exact in integers: 96 × 3^n / 2^n hundredths.
  const num = 96 * 3 ** level;
  const den = 2 ** level;
  return Math.floor(num / den) / 100;
}
export const TEMPLE_LADDER = Array.from({ length: TEMPLE_LEVELS }, (_, i) => templeMultiplier(i + 1));

export const LAVA_GROWTH = 0.2;
export const LAVA_MAX = 500;
export const LAVA_MIN_AUTO = 1.01;
/** e^(0.2 t) floored to 2 dp, capped at 500. */
export function lavaAt(seconds: number): number {
  if (seconds <= 0) return 1;
  const m = Math.exp(LAVA_GROWTH * seconds);
  if (m >= LAVA_MAX) return LAVA_MAX;
  return Math.floor(m * 100 + 1e-9) / 100;
}
export const lavaTimeTo = (m: number) => (m <= 1 ? 0 : Math.log(m) / LAVA_GROWTH);
export function lavaCrashPoint(u: number): number {
  const raw = RTP / (1 - u);
  if (raw < 1) return 0;
  if (raw >= LAVA_MAX) return LAVA_MAX;
  return Math.floor(raw * 100) / 100;
}

export const ROULETTE_PAYOUTS: Record<string, number> = {
  straight: 35, split: 17, street: 11, trio: 11, corner: 8, four: 8, line: 5, column: 2, dozen: 2, evenMoney: 1,
};
export const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const colorOf = (n: number) => (n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black');

export const expected = (table: Tier[]) => table.reduce((s, x) => s + x.multiplier * x.weight, 0) / table.reduce((s, x) => s + x.weight, 0);

export const XP_PER_ROUND = 10;
export const XP_DAILY = 20;
export const xpFor = (level: number) => 25 * level * (level - 1);
export function levelOf(xp: number): number {
  let level = 1;
  while (xpFor(level + 1) <= xp) level++;
  return level;
}

export const ZONES: Zone[] = [
  { key: 'harbour', name: 'Harbour', level: 1 },
  { key: 'boardwalk', name: 'Boardwalk', level: 1 },
  { key: 'fairground', name: 'Fairground', level: 1 },
  { key: 'casino', name: 'Grand Casino', level: 2 },
  { key: 'jungle', name: 'Jungle Ruins', level: 3 },
  { key: 'volcano', name: 'Volcano Summit', level: 4 },
];

const c = (id: string, kind: Cosmetic['kind'], name: string, level: number): Cosmetic => ({ id, kind, name, level });
export const COSMETICS: Cosmetic[] = [
  c('hat-none', 'hat', 'No hat', 1),
  c('hat-straw', 'hat', 'Straw hat', 1),
  c('hat-sailor', 'hat', 'Sailor cap', 2),
  c('hat-pirate', 'hat', 'Pirate hat', 4),
  c('hat-flower', 'hat', 'Hibiscus', 0),
  c('hat-crown', 'hat', 'Golden crown', 0),
  c('outfit-tee', 'outfit', 'Island tee', 1),
  c('outfit-hawaiian', 'outfit', 'Hawaiian shirt', 2),
  c('outfit-sailor', 'outfit', 'Sailor suit', 3),
  c('outfit-tux', 'outfit', 'Casino tux', 5),
  c('outfit-explorer', 'outfit', 'Explorer kit', 0),
  c('outfit-gold', 'outfit', 'Gold suit', 0),
  c('pet-none', 'pet', 'No pet', 1),
  c('pet-crab', 'pet', 'Crab', 3),
  c('pet-turtle', 'pet', 'Turtle', 5),
  c('pet-monkey', 'pet', 'Monkey', 0),
  c('pet-penguin', 'pet', 'Penguin', 0),
  c('fx-confetti', 'effect', 'Confetti', 1),
  c('fx-coins', 'effect', 'Coin shower', 2),
  c('fx-fireworks', 'effect', 'Fireworks', 5),
  c('fx-hearts', 'effect', 'Hearts', 0),
];

export const GAMES: { key: GameKey; name: string; zone: ZoneKey; kind: GameMeta['kind'] }[] = [
  { key: 'coconut-shy', name: 'Coconut Shy', zone: 'boardwalk', kind: 'instant' },
  { key: 'cup-shuffle', name: 'Cup Shuffle', zone: 'boardwalk', kind: 'instant' },
  { key: 'scratch-kiosk', name: 'Scratch Kiosk', zone: 'boardwalk', kind: 'instant' },
  { key: 'prize-wheel', name: 'Prize Wheel', zone: 'fairground', kind: 'instant' },
  { key: 'duck-pond', name: 'Duck Pond', zone: 'fairground', kind: 'instant' },
  { key: 'high-striker', name: 'High Striker', zone: 'fairground', kind: 'instant' },
  { key: 'roulette', name: 'Roulette', zone: 'casino', kind: 'instant' },
  { key: 'temple-doors', name: 'Temple Doors', zone: 'jungle', kind: 'steps' },
  { key: 'lava-crash', name: 'Lava Crash', zone: 'volcano', kind: 'crash' },
];

/** The info a real API returns, built from these rules (demo engine). */
export function demoInfo(): Info {
  const paytable = (k: GameKey) => {
    switch (k) {
      case 'coconut-shy': return { coconuts: COCONUTS, classic: COCONUT_CLASSIC, golden: COCONUT_GOLDEN };
      case 'cup-shuffle': return { cups: CUPS, pays: CUP_PAYS };
      case 'prize-wheel': return { segments: WHEEL };
      case 'duck-pond': return { ducks: DUCKS, tiers: DUCK_TABLE };
      case 'high-striker': return { tiers: STRIKER_TABLE };
      case 'scratch-kiosk': return { tiers: SCRATCH_TABLE };
      case 'temple-doors': return { levels: TEMPLE_LEVELS, doors: TEMPLE_DOORS, ladder: TEMPLE_LADDER };
      case 'lava-crash': return { growth: LAVA_GROWTH, max: LAVA_MAX, minAuto: LAVA_MIN_AUTO };
      case 'roulette': return { payouts: ROULETTE_PAYOUTS, maxBets: 30 };
    }
  };
  return {
    gameId: 'fortune-isle',
    name: 'Fortune Isle',
    minBet: 1,
    maxBet: 500,
    maxWin: 250000,
    currency: 'ZAR',
    chips: [1, 5, 10, 50, 100],
    zones: ZONES,
    cosmetics: COSMETICS,
    xp: { xpPerRound: XP_PER_ROUND, xpDaily: XP_DAILY },
    games: GAMES.map((g) => ({ ...g, rtp: g.key === 'roulette' ? 0.973 : RTP, paytable: paytable(g.key) }) as GameMeta),
  };
}

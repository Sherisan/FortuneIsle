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

/** Island Reels (Grand Casino slots): the line's tier is drawn, then the reels are dealt to show it. */
export const REELS_TABLE: Tier[] = [
  t('lose', 0, 517),
  t('shell', 1, 300),
  t('starfish', 2, 120),
  t('coconut', 4, 50),
  t('parrot', 10, 10),
  t('pearl', 25, 2),
  t('seven', 70, 1),
];
export const REEL_SYMBOLS = REELS_TABLE.slice(1).map((x) => x.key);

/** Dragon Tiger: one card each from an infinite deck, ranks 0 (ace) … 12 (king). */
export const CARD_RANKS = 13;
export const DT_SIDES = ['dragon', 'tiger', 'tie'] as const;
export const DT_PAYS = 2.08;
export const DT_TIE = 12.48;
export function dtMultiplier(choice: number, dragon: number, tiger: number) {
  if (choice === 0) return dragon > tiger ? DT_PAYS : 0;
  if (choice === 1) return tiger > dragon ? DT_PAYS : 0;
  return dragon === tiger ? DT_TIE : 0;
}

/** Pirate Dice (crown and anchor): pick a face, roll three dice; pays by matches 0..3. */
export const DICE_FACES = ['anchor', 'skull', 'parrot', 'ship', 'chest', 'compass'];
export const DICE_COUNT = 3;
export const DICE_PAYS = [0, 2, 3, 12.36];

/** Diamond Wheel (VIP Salon): 24 segments, back a gem; it pays 0.96 × 24 / its segments. */
export const GEMS = ['pearl', 'sapphire', 'ruby', 'emerald', 'diamond'];
export const DIAMOND_SEGMENTS = [0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3];
export const GEM_PAYS = [1.92, 3.84, 7.68, 11.52, 23.04];

/** Coral Drop (plinko): 8 rows of coral; the pocket is the number of right bounces. */
export const CORAL_ROWS = 8;
export const CORAL_MODES = ['calm', 'wild'] as const;
export const CORAL_POCKETS = [
  [5.38, 2, 1.2, 0.9, 0.5, 0.9, 1.2, 2, 5.38],
  [29.08, 3.5, 1.5, 0.3, 0.2, 0.3, 1.5, 3.5, 29.08],
];

/** Seahorse Derby: racer i wins with weight i (of 100) and pays 96 / weight. */
export const DERBY_RACERS = ['Bubbles', 'Coral', 'Marina', 'Finn', 'Sir Squiggles'];
export const DERBY_ODDS: Tier[] = [t('bubbles', 2.4, 40), t('coral', 3.84, 25), t('marina', 4.8, 20), t('finn', 9.6, 10), t('squiggles', 19.2, 5)];

/** Ice Fishing: a catch table per hole (low, medium, high volatility). */
export const FISHING_HOLES = ['shallow', 'deep', 'abyss'];
export const FISHING_TABLES: Tier[][] = [
  [t('boot', 0, 286), t('sardine', 0.5, 250), t('perch', 1, 200), t('trout', 1.5, 150), t('salmon', 3, 80), t('tuna', 5, 34)],
  [t('boot', 0, 601), t('cod', 1, 200), t('snapper', 2, 130), t('swordfish', 5, 50), t('shark', 10, 15), t('whale', 25, 4)],
  [t('boot', 0, 1972), t('eel', 2, 350), t('angler', 5, 150), t('squid', 20, 25), t('kraken', 100, 2), t('narwhal', 250, 1)],
];

/** Ice Vault: pays by digits in the right place (0-3). */
export const VAULT_DIGITS = 3;
export const VAULT_PAYS = [0, 2, 12, 150];

/** Star Keno: 16 stars, 4 shooting stars; KENO_PAYS[n − 1][k] pays k hits with n picks. */
export const KENO_STARS = 16;
export const KENO_DRAWS = 4;
export const KENO_MAX_PICKS = 4;
export const KENO_PAYS = [
  [0, 3.84],
  [0, 1.2, 9.6],
  [0, 0.5, 4, 29.4],
  [0, 0, 2.6, 12, 141.6],
];

/** Oracle's Chests: staying wins 1/3 at ×2.88, switching wins 2/3 at ×1.44. */
export const ORACLE_CHESTS = 3;
export const ORACLE_STAY = 2.88;
export const ORACLE_SWITCH = 1.44;

/** n choose k. */
export const choose = (n: number, k: number) => {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return r;
};

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
  { key: 'vip', name: 'VIP Salon', level: 5 },
  { key: 'lagoon', name: 'Coral Lagoon', level: 6 },
  { key: 'frost', name: 'Frost Isle', level: 7 },
  { key: 'sky', name: 'Sky Kingdom', level: 8 },
];
/** The highest level a zone opens at (?unlock starts there). */
export const TOP_LEVEL = Math.max(...ZONES.map((z) => z.level));

const c = (id: string, kind: Cosmetic['kind'], name: string, level: number): Cosmetic => ({ id, kind, name, level });
export const COSMETICS: Cosmetic[] = [
  c('hat-none', 'hat', 'No hat', 1),
  c('hat-straw', 'hat', 'Straw hat', 1),
  c('hat-sailor', 'hat', 'Sailor cap', 2),
  c('hat-pirate', 'hat', 'Pirate hat', 4),
  c('hat-flower', 'hat', 'Hibiscus', 0),
  c('hat-crown', 'hat', 'Golden crown', 0),
  c('hat-snorkel', 'hat', 'Snorkel mask', 6),
  c('outfit-tee', 'outfit', 'Island tee', 1),
  c('outfit-hawaiian', 'outfit', 'Hawaiian shirt', 2),
  c('outfit-sailor', 'outfit', 'Sailor suit', 3),
  c('outfit-tux', 'outfit', 'Casino tux', 5),
  c('outfit-explorer', 'outfit', 'Explorer kit', 0),
  c('outfit-gold', 'outfit', 'Gold suit', 0),
  c('outfit-parka', 'outfit', 'Snow parka', 7),
  c('pet-none', 'pet', 'No pet', 1),
  c('pet-crab', 'pet', 'Crab', 3),
  c('pet-turtle', 'pet', 'Turtle', 5),
  c('pet-monkey', 'pet', 'Monkey', 0),
  c('pet-penguin', 'pet', 'Penguin', 0),
  c('fx-confetti', 'effect', 'Confetti', 1),
  c('fx-coins', 'effect', 'Coin shower', 2),
  c('fx-fireworks', 'effect', 'Fireworks', 5),
  c('fx-hearts', 'effect', 'Hearts', 0),
  c('fx-stars', 'effect', 'Shooting stars', 8),
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
  { key: 'island-reels', name: 'Island Reels', zone: 'casino', kind: 'instant' },
  { key: 'dragon-tiger', name: 'Dragon Tiger', zone: 'casino', kind: 'instant' },
  { key: 'pirate-dice', name: 'Pirate Dice', zone: 'harbour', kind: 'instant' },
  { key: 'diamond-wheel', name: 'Diamond Wheel', zone: 'vip', kind: 'instant' },
  { key: 'coral-drop', name: 'Coral Drop', zone: 'lagoon', kind: 'instant' },
  { key: 'seahorse-derby', name: 'Seahorse Derby', zone: 'lagoon', kind: 'instant' },
  { key: 'ice-fishing', name: 'Ice Fishing', zone: 'frost', kind: 'instant' },
  { key: 'ice-vault', name: 'Ice Vault', zone: 'frost', kind: 'instant' },
  { key: 'star-keno', name: 'Star Keno', zone: 'sky', kind: 'instant' },
  { key: 'oracle-chests', name: 'Oracle’s Chests', zone: 'sky', kind: 'steps' },
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
      case 'island-reels': return { tiers: REELS_TABLE };
      case 'dragon-tiger': return { ranks: CARD_RANKS, pays: DT_PAYS, tie: DT_TIE };
      case 'pirate-dice': return { faces: DICE_FACES, dice: DICE_COUNT, pays: DICE_PAYS };
      case 'diamond-wheel': return { gems: GEMS, segments: DIAMOND_SEGMENTS, pays: GEM_PAYS };
      case 'coral-drop': return { rows: CORAL_ROWS, modes: [...CORAL_MODES], pockets: CORAL_POCKETS };
      case 'seahorse-derby': return { racers: DERBY_RACERS, odds: DERBY_ODDS };
      case 'ice-fishing': return { holes: FISHING_HOLES, tables: FISHING_TABLES };
      case 'ice-vault': return { digits: VAULT_DIGITS, pays: VAULT_PAYS };
      case 'star-keno': return { stars: KENO_STARS, draws: KENO_DRAWS, maxPicks: KENO_MAX_PICKS, pays: KENO_PAYS };
      case 'oracle-chests': return { chests: ORACLE_CHESTS, stay: ORACLE_STAY, switch: ORACLE_SWITCH };
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

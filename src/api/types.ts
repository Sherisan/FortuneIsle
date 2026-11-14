/* Shapes of FeedingFranzeeAPI's api/island (IslandController / IslandService). */

export type GameKey =
  | 'coconut-shy'
  | 'cup-shuffle'
  | 'scratch-kiosk'
  | 'prize-wheel'
  | 'duck-pond'
  | 'high-striker'
  | 'roulette'
  | 'temple-doors'
  | 'lava-crash';

export type ZoneKey = 'harbour' | 'boardwalk' | 'fairground' | 'casino' | 'jungle' | 'volcano';

export interface Tier {
  key: string;
  multiplier: number;
  weight: number;
}

export interface Zone {
  key: ZoneKey;
  name: string;
  level: number;
}

export interface Cosmetic {
  id: string;
  kind: 'hat' | 'outfit' | 'pet' | 'effect';
  name: string;
  /** > 0: unlocked at that level. 0: found in treasure chests. */
  level: number;
}

export interface Paytables {
  'coconut-shy': { coconuts: number; classic: number; golden: Tier[] };
  'cup-shuffle': { cups: number; pays: number };
  'prize-wheel': { segments: number[] };
  'duck-pond': { ducks: number; tiers: Tier[] };
  'high-striker': { tiers: Tier[] };
  'scratch-kiosk': { tiers: Tier[] };
  'temple-doors': { levels: number; doors: number; ladder: number[] };
  'lava-crash': { growth: number; max: number; minAuto: number };
  roulette: { payouts: Record<string, number>; maxBets: number };
}

export interface GameMeta<K extends GameKey = GameKey> {
  key: K;
  name: string;
  zone: ZoneKey;
  kind: 'instant' | 'steps' | 'crash';
  rtp: number;
  paytable: Paytables[K];
}

export interface Info {
  gameId: string;
  name: string;
  minBet: number;
  maxBet: number;
  maxWin: number;
  currency: string;
  chips: number[];
  zones: Zone[];
  cosmetics: Cosmetic[];
  xp: { xpPerRound: number; xpDaily: number };
  games: GameMeta[];
}

export interface RouletteBet {
  type: string;
  numbers: number[];
  amount: number;
}

export interface BetBody {
  game: GameKey;
  stake: number;
  choice?: number;
  mode?: 'classic' | 'golden';
  auto?: number;
  bets?: RouletteBet[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface RoundView {
  id: string;
  game: GameKey;
  stake: number;
  choice: any;
  outcome: any;
  status: 'live' | 'won' | 'lost' | 'cashed';
  multiplier: number;
  payout: number;
  balance: number | null;
  winPending: boolean;
  xpGained: number;
  levelUp: number;
  temple: { level: number; now: number; next: number | null } | null;
  lava: { elapsedMs: number; auto: number | null; crash: number | null } | null;
  serverSeed: string | null;
  clientSeed: string;
  nonce: number;
}

export interface Limit {
  value: number | null;
  pending: { value: number | null; at: number } | null;
}

export interface HistoryEntry {
  id: string;
  time: number;
  game: GameKey;
  stake: number;
  multiplier: number;
  payout: number;
  status: string;
  choice: any;
  outcome: any;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

export interface PlayerView {
  level: number;
  xp: number;
  levelXp: number;
  nextXp: number;
  keys: number;
  zones: ZoneKey[];
  owned: string[];
  equipped: Record<'hat' | 'outfit' | 'pet' | 'effect', string>;
  dailyReady: boolean;
}

export interface State {
  round: RoundView | null;
  player: PlayerView;
  session: { startedAt: number; staked: number; won: number; rounds: number };
  limits: { lossLimit: Limit; sessionMinutes: Limit; realityCheckMinutes: number | null };
  fairness: { serverSeedHash: string; clientSeed: string; nonce: number };
  history: HistoryEntry[] | null;
  serverTime: number;
}

export interface LimitsBody {
  lossLimit: number | null;
  sessionMinutes: number | null;
  realityCheckMinutes: number | null;
}

export interface IslandApi {
  readonly demo: boolean;
  info(): Promise<Info>;
  balance(): Promise<number>;
  state(): Promise<State>;
  bet(body: BetBody): Promise<State>;
  action(action: 'pick' | 'cashout', door?: number): Promise<State>;
  watch(): Promise<State>;
  seed(clientSeed: string): Promise<State>;
  equip(id: string): Promise<State>;
  daily(): Promise<State>;
  chest(): Promise<State>;
  limits(body: LimitsBody): Promise<State>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

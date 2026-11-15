import type { FreePlay, GameKey, LivePromo, PromoOutcome, PromoState, RecentAward } from './types.ts';

/*
 * Promotions for the offline demo (?demo): a small stand-in for FeedingFranzeeAPI's PromoEngine with the same shapes,
 * so the free-play toggle, reward toasts and the Promotions panel can be tried without the API. Fun money only.
 */

const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('');
const rand = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
const endOfDay = () => {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.toISOString();
};
const BOARDWALK: GameKey[] = ['coconut-shy', 'cup-shuffle', 'scratch-kiosk'];

export interface DemoPlay {
  id: string;
  game: GameKey;
  stake: number;
  multiplier: number;
  payout: number;
  hit: boolean;
  pocket?: number;
  straight?: Record<number, number>;
}

export class DemoPromos {
  private free: (FreePlay & { used?: boolean })[] = [
    { awardId: hex(8), amount: 5, expiresAt: new Date(Date.now() + 7 * 864e5).toISOString(), promotion: 'Welcome to the island', betTypes: [], subGames: [], stakeReturned: true },
    { awardId: hex(8), amount: 5, expiresAt: new Date(Date.now() + 7 * 864e5).toISOString(), promotion: 'Welcome to the island', betTypes: [], subGames: [], stakeReturned: true },
  ];
  private awards: RecentAward[] = [];
  private streak = 0;
  private lastAt = 0;
  private raceLeft = 6;
  private raceWon = false;
  private luckyPaid = false;
  private hits = 0;
  private rivals = [
    { player: 'ma***ty', score: 7 },
    { player: 'co***ss', score: 5 },
    { player: 'pa***ot', score: 3 },
    { player: 'sk***er', score: 2 },
  ];

  state(): PromoState {
    const top = [...this.rivals, ...(this.hits > 0 ? [{ player: 'you', score: this.hits }] : [])]
      .sort((a, b) => b.score - a.score)
      .map((r, i) => ({ rank: i + 1, player: r.player, score: r.score, gameId: 'fortune-isle' }));
    const me = top.find((r) => r.player === 'you');
    const live: LivePromo[] = [
      {
        promotionId: 1, name: 'Island Hit Parade', type: 'MultiplierLeaderboard', terms: 'Daily. Top prizes on every attraction count as hits.',
        minStake: 1, endsAt: null, subGames: [],
        details: { period: 'Daily', metric: 'Hits', periodEndsAt: endOfDay(), prizes: [100, 50, 25], top: top.slice(0, 10), me: me ? { rank: me.rank, score: me.score } : null },
      },
      {
        promotionId: 2, name: 'Race to the Summit', type: 'MultiplierRace', terms: 'The first 10 players to cash out Lava Crash at ×20 or more win R50.',
        minStake: 1, endsAt: null, subGames: ['lava-crash'], details: { targetMultiplier: 20, prize: 50, winners: 10, remaining: this.raceLeft },
      },
      {
        promotionId: 3, name: 'Boardwalk Regular', type: 'StreakMission', terms: '5 plays in a row on the Boardwalk earn a R5 free play.',
        minStake: 1, endsAt: null, subGames: BOARDWALK,
        details: { counts: 'Plays', target: 5, streak: Date.now() - this.lastAt < 10 * 60e3 ? this.streak : 0, reward: 5, prize: 'FreeBet', maxGapMinutes: 10, rewardsLeftToday: 3 },
      },
      {
        promotionId: 4, name: 'Lucky 17', type: 'LuckyNumber', terms: 'A straight-up win on 17 at the Grand Casino pays R25 extra, once a day.',
        minStake: 1, endsAt: null, subGames: ['roulette'], details: { number: 17, prize: 25, daily: false },
      },
      {
        promotionId: 5, name: 'Welcome to the island', type: 'FreeBet', terms: 'Two R5 free plays for any attraction.',
        minStake: 0, endsAt: null, subGames: [], details: { stake: 5, stakeReturned: true, betTypes: [] },
      },
    ];
    return {
      serverTime: new Date().toISOString(),
      promotions: live,
      freeBets: this.free.filter((f) => !f.used).map(({ used: _u, ...f }) => (void _u, f)),
      recentAwards: [...this.awards],
    };
  }

  /** Takes a free play usable at this attraction. */
  claim(game: GameKey): FreePlay | null {
    const f = this.free.find((x) => !x.used && (x.subGames.length === 0 || x.subGames.includes(game)));
    if (!f) return null;
    f.used = true;
    return f;
  }

  release(f: FreePlay) {
    const x = this.free.find((y) => y.awardId === f.awardId);
    if (x) x.used = false;
  }

  /** What a free play pays: the whole return, or what's above its value. */
  settleFree(f: FreePlay, roundId: string, gross: number): number {
    const paid = Math.floor((f.stakeReturned ? gross : Math.max(0, gross - f.amount)) * 100) / 100;
    if (paid > 0) this.award('Cash', paid, 'Free bet win', roundId, f.promotion);
    return paid;
  }

  /** Runs the demo promotions against a finished real-money play; cash goes to the balance via credit(). */
  played(p: DemoPlay, credit: (amount: number) => void): PromoOutcome[] {
    const out: PromoOutcome[] = [];
    if (p.hit) this.hits++;
    if (rand() < 0.3) this.rivals[Math.floor(rand() * this.rivals.length)].score++;

    if (BOARDWALK.includes(p.game)) {
      if (Date.now() - this.lastAt > 10 * 60e3) this.streak = 0;
      this.lastAt = Date.now();
      this.streak++;
      if (this.streak >= 5) {
        this.streak = 0;
        this.free.push({ awardId: hex(8), amount: 5, expiresAt: new Date(Date.now() + 7 * 864e5).toISOString(), promotion: 'Boardwalk Regular', betTypes: [], subGames: [], stakeReturned: true });
        this.award('FreeBet', 5, '5 plays in a row', p.id, 'Boardwalk Regular');
        out.push({ promotionId: 3, promotion: 'Boardwalk Regular', type: 'StreakMission', kind: 'FreeBet', amount: 5, message: 'Streak complete — 5 in a row!', progress: { streak: 0, target: 5 } });
      } else {
        out.push({ promotionId: 3, promotion: 'Boardwalk Regular', type: 'StreakMission', kind: 'Progress', amount: 0, message: `Streak ${this.streak} of 5`, progress: { streak: this.streak, target: 5 } });
      }
    }
    if (p.game === 'lava-crash' && !this.raceWon && this.raceLeft > 0 && p.payout / p.stake >= 20) {
      this.raceWon = true;
      const place = 11 - this.raceLeft--;
      credit(50);
      this.award('Cash', 50, `Race to 20× — place ${place}`, p.id, 'Race to the Summit');
      out.push({ promotionId: 2, promotion: 'Race to the Summit', type: 'MultiplierRace', kind: 'Cash', amount: 50, message: `You took place ${place} in the race to 20×!` });
    }
    if (p.game === 'roulette' && p.pocket === 17 && (p.straight?.[17] ?? 0) >= 1 && !this.luckyPaid) {
      this.luckyPaid = true;
      credit(25);
      this.award('Cash', 25, 'Lucky number 17', p.id, 'Lucky 17');
      out.push({ promotionId: 4, promotion: 'Lucky 17', type: 'LuckyNumber', kind: 'Cash', amount: 25, message: 'Lucky number 17 hit!' });
    }
    return out;
  }

  private award(kind: 'Cash' | 'FreeBet', amount: number, reason: string, roundId: string | null, promotion: string | null) {
    this.awards.unshift({ awardId: hex(8), kind, amount, reason, createdAt: new Date().toISOString(), gameId: 'fortune-isle', roundId, promotion });
    this.awards.length = Math.min(this.awards.length, 20);
  }
}

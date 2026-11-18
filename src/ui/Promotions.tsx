import { useEffect, useState } from 'react';
import type { GameKey, LivePromo, PromoType } from '../api/types.ts';
import { money, useGame } from '../store/game.ts';
import { GAME_ICON } from './Panels.tsx';

/*
 * The Promotions panel (🎁 in the top bar, and the top of the Harbour notice board): what's running on the island, the
 * player's free plays and progress, and what they won lately. Everything comes from GET api/promotions/state.
 */

const TYPE_LABEL: Record<PromoType, string> = {
  FreeBet: 'Free plays', Rain: 'Rain', MultiplierLeaderboard: 'Leaderboard', MultiplierRace: 'Race', Cashback: 'Cashback',
  StreakMission: 'Streak', MysteryPrize: 'Mystery prize', BuyXGetFree: 'Play X, get one free', CollectionMission: 'Collection',
  LuckyNumber: 'Lucky number', BoostedPayout: 'Boosted numbers', RoundDrop: 'Drops', CommunityJackpot: 'Jackpot',
  HandBonus: 'Hand bonus', HandJackpot: 'Hand jackpot',
};
const TYPE_ICON: Record<PromoType, string> = {
  FreeBet: '🎁', Rain: '🌧️', MultiplierLeaderboard: '🏆', MultiplierRace: '🏁', Cashback: '💸', StreakMission: '🔥',
  MysteryPrize: '❓', BuyXGetFree: '🎟️', CollectionMission: '🧭', LuckyNumber: '🍀', BoostedPayout: '⚡', RoundDrop: '🎈',
  CommunityJackpot: '💰', HandBonus: '🃏', HandJackpot: '🃏',
};
const METRIC: Record<string, string> = {
  BestMultiple: 'best win multiple', BestWin: 'biggest win', TotalWagered: 'total staked', TotalWon: 'total won',
  RoundsPlayed: 'rounds played', Hits: 'top prizes hit',
};

/** "2h 14m" until an ISO time. */
function useCountdown(iso: string | null | undefined) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!iso) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [iso]);
  if (!iso) return null;
  const ms = Date.parse(iso) - now;
  if (ms <= 0) return 'ending now';
  const m = Math.floor(ms / 60000);
  const d = Math.floor(m / 1440);
  if (d > 0) return `${d}d ${Math.floor((m % 1440) / 60)}h`;
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

export function Promotions({ compact }: { compact?: boolean }) {
  const promos = useGame((s) => s.promos);
  const loadPromos = useGame((s) => s.loadPromos);
  const currency = useGame((s) => s.info?.currency ?? 'ZAR');
  const setPanel = useGame((s) => s.setPanel);
  useEffect(() => {
    void loadPromos();
  }, [loadPromos]);

  if (!promos) return <p className="hint">Loading promotions…</p>;
  const live = promos.promotions.filter((p) => !(p.type === 'FreeBet' && compact));
  if (compact) {
    if (live.length === 0 && promos.freeBets.length === 0) return null;
    return (
      <section className="promo-strip">
        <h3>🎁 On the island today</h3>
        <ul>
          {promos.freeBets.length > 0 && (
            <li><span>🎁 Your free plays</span><b>{promos.freeBets.length}</b></li>
          )}
          {live.map((p) => (
            <li key={p.promotionId}><span>{TYPE_ICON[p.type]} {p.name}</span><b>{TYPE_LABEL[p.type]}</b></li>
          ))}
        </ul>
        <button className="btn btn-gold btn-wide" onClick={() => setPanel('promos')}>See promotions</button>
      </section>
    );
  }

  return (
    <div className="promos">
      {promos.freeBets.length > 0 && (
        <section className="promo-card free">
          <h3>🎁 Your free plays</h3>
          <p className="hint">Open an attraction and switch on “Use a free play” next to the stake. It plays at its value and risks none of your balance.</p>
          <ul className="free-list">
            {promos.freeBets.map((f) => (
              <li key={f.awardId}>
                <b>{money(f.amount, currency)}</b>
                <span>
                  {f.subGames.length ? f.subGames.map((g) => GAME_ICON[g]).join(' ') : 'Any attraction'}
                  {f.betTypes.length > 0 && <small> · roulette: {f.betTypes.join(', ')}</small>}
                </span>
                <small>{f.expiresAt ? `until ${new Date(f.expiresAt).toLocaleDateString()}` : ''}</small>
              </li>
            ))}
          </ul>
        </section>
      )}

      {live.length === 0 && <p className="hint">No promotions are running right now — check back soon!</p>}
      {live.map((p) => (
        <PromoCard key={p.promotionId} p={p} currency={currency} />
      ))}

      {promos.recentAwards.length > 0 && (
        <section className="promo-card">
          <h3>🪙 Your recent rewards</h3>
          <ul className="award-list">
            {promos.recentAwards.slice(0, 8).map((a) => (
              <li key={a.awardId}>
                <span>{a.reason}<small>{a.promotion}</small></span>
                <b>{a.kind === 'FreeBet' ? `free play ${money(a.amount, currency)}` : `+${money(a.amount, currency)}`}</b>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="hint">Promotion prizes are paid from each promotion’s own budget — they never change the games’ odds. Free plays don’t count towards promotions.</p>
    </div>
  );
}

function Where({ games }: { games: GameKey[] }) {
  const info = useGame((s) => s.info);
  if (!games.length) return <span className="where">Every attraction</span>;
  return (
    <span className="where">
      {games.map((g) => (
        <i key={g}>{GAME_ICON[g]} {info?.games.find((x) => x.key === g)?.name ?? g}</i>
      ))}
    </span>
  );
}

function PromoCard({ p, currency }: { p: LivePromo; currency: string }) {
  const d = p.details ?? {};
  const ends = useCountdown(p.type === 'MultiplierLeaderboard' ? d.periodEndsAt ?? p.endsAt : p.endsAt);
  const m = (x: number) => money(x, currency);
  return (
    <section className={`promo-card t-${p.type}`}>
      <header>
        <span className="pc-icon">{TYPE_ICON[p.type]}</span>
        <span>
          <h3>{p.name}</h3>
          <small>{TYPE_LABEL[p.type]}{ends ? ` · ends in ${ends}` : ''}{p.minStake > 0 && p.type !== 'FreeBet' ? ` · min stake ${m(p.minStake)}` : ''}</small>
        </span>
      </header>
      <Where games={p.subGames} />
      {p.terms && <p className="terms">{p.terms}</p>}
      <PromoBody p={p} m={m} />
    </section>
  );
}

function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <div className="pbar">
      <i style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%` }} />
      <span>{label}</span>
    </div>
  );
}

function PromoBody({ p, m }: { p: LivePromo; m: (x: number) => string }) {
  const d = p.details ?? {};
  switch (p.type) {
    case 'MultiplierLeaderboard':
      return (
        <>
          <p className="pc-line">Ranked by {METRIC[d.metric] ?? d.metric} · {d.period?.toLowerCase()} · prizes {(d.prizes ?? []).slice(0, 3).map(m).join(' / ')}{(d.prizes?.length ?? 0) > 3 ? ' …' : ''}</p>
          <ol className="lb">
            {(d.top ?? []).slice(0, 5).map((r: { rank: number; player: string; score: number }) => (
              <li key={r.rank} className={d.me?.rank === r.rank ? 'me' : ''}>
                <span>{r.rank}. {d.me?.rank === r.rank ? 'You' : r.player}</span>
                <b>{scoreText(d.metric, r.score, m)}</b>
              </li>
            ))}
            {(d.top ?? []).length === 0 && <li className="empty">Be the first on the board!</li>}
          </ol>
          {d.me && d.me.rank > 5 && <p className="pc-line">You: #{d.me.rank} · {scoreText(d.metric, d.me.score, m)}</p>}
        </>
      );
    case 'MultiplierRace':
      return <Progress value={d.winners - d.remaining} max={d.winners} label={`First ${d.winners} to win ×${d.targetMultiplier} get ${m(d.prize)} — ${d.remaining} place${d.remaining === 1 ? '' : 's'} left`} />;
    case 'StreakMission':
      return <Progress value={d.streak} max={d.target} label={`${d.streak} / ${d.target} ${d.counts === 'Wins' ? 'wins' : 'plays'} in a row → ${d.prize === 'FreeBet' ? 'free play' : ''} ${m(d.reward)}`} />;
    case 'BuyXGetFree':
      return <Progress value={d.count} max={d.buy} label={`${d.count} / ${d.buy} plays towards a free play`} />;
    case 'CollectionMission':
      return (
        <div className="collect">
          {(d.symbols ?? []).map((s: string) => (
            <span key={s} className={(d.collected ?? []).includes(s) ? 'got' : ''}>{s}</span>
          ))}
          <p className="pc-line">Collect them all for {d.prize === 'FreeBet' ? 'a free play of ' : ''}{m(d.reward)}{d.completed ? ` · sets done: ${d.completed}` : ''}</p>
        </div>
      );
    case 'Cashback':
      return (
        <p className="pc-line">
          {d.percent}% of net losses back {d.period === 'Weekly' ? 'weekly' : 'daily'}{d.days?.length ? ` (${d.days.map((x: string) => x.slice(0, 3)).join(', ')})` : ''}, up to {m(d.maxPerPlayer)}.
          {d.due > 0 ? ` So far: ${m(d.due)} due.` : ''}
        </p>
      );
    case 'Rain':
      return <p className="pc-line">Every so often {m(d.pool)} rains on up to {d.recipients} players who played in the last {d.activeWithinMinutes} minutes.</p>;
    case 'MysteryPrize':
      return <p className="pc-line">Each qualifying play has a {(d.chance * 100).toFixed(d.chance < 0.01 ? 1 : 0)}% chance of a hidden {d.prize === 'FreeBet' ? 'free play' : 'prize'} of {m(d.amount)}.</p>;
    case 'LuckyNumber':
      return <p className="pc-line">Today’s lucky number is <b className="lucky-n">{d.number}</b> — a straight-up win on it pays {m(d.prize)} extra.</p>;
    case 'BoostedPayout':
      return <p className="pc-line">Straight-up wins on <b>{(d.numbers ?? []).join(', ')}</b> pay {d.payout} to 1 (up to {m(d.maxBoostedStake)} a number).</p>;
    case 'FreeBet':
      return <p className="pc-line">{m(d.stake)} free plays{d.stakeReturned ? ' — a win pays the whole return' : ' — a win pays what’s above the stake'}.</p>;
    default:
      return null;
  }
}

function scoreText(metric: string, score: number, m: (x: number) => string) {
  if (metric === 'BestMultiple') return `×${score}`;
  if (metric === 'BestWin' || metric === 'TotalWagered' || metric === 'TotalWon') return m(score);
  return String(score);
}

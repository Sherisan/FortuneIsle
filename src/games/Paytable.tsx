import { choose } from '../api/rules.ts';
import type { GameKey, Tier } from '../api/types.ts';
import { useGame } from '../store/game.ts';
import { GEM_ICON, GEM_NAME } from './DiamondWheel.tsx';
import { FISH } from './IceFishing.tsx';
import { DICE_ICON } from './PirateDice.tsx';
import { REEL_ICON } from './IslandReels.tsx';
import { SCRATCH_ICON } from './ScratchKiosk.tsx';

const pct = (w: number, total: number) => `${((w / total) * 100).toFixed(w / total < 0.01 ? 2 : 1)}%`;
const total = (t: Tier[]) => t.reduce((s, x) => s + x.weight, 0);

function TierTable({ tiers, name = (t: Tier) => `×${t.multiplier}` }: { tiers: Tier[]; name?: (t: Tier) => string }) {
  const sum = total(tiers);
  return (
    <table className="pay">
      <thead>
        <tr><th>Result</th><th>Pays</th><th>Chance</th></tr>
      </thead>
      <tbody>
        {[...tiers].reverse().map((t) => (
          <tr key={t.key}>
            <td>{name(t)}</td>
            <td>{t.multiplier > 0 ? `×${t.multiplier}` : '—'}</td>
            <td>{pct(t.weight, sum)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Rules and odds for one game, from the paytable the server sent (api/island/info). */
export function Paytable({ game }: { game: GameKey }) {
  const meta = useGame((s) => s.meta(game));
  const info = useGame((s) => s.info);
  if (!meta || !info) return null;
  const p = meta.paytable as never as Record<string, unknown>;
  const common = (
    <p className="small">
      Stakes {info.currency === 'ZAR' ? 'R' : ''}{info.minBet}–{info.maxBet}. Max win per round {info.maxWin.toLocaleString()}. Outcomes are drawn by the server’s
      provably-fair RNG; nothing you tap, time or watch changes them.
    </p>
  );
  switch (game) {
    case 'coconut-shy': {
      const pt = meta.paytable as { coconuts: number; classic: number; golden: Tier[] };
      return (
        <div className="paytable">
          <p><b>Classic:</b> one of {pt.coconuts} coconuts hides the prize. Pick one and throw — hit it and win <b>×{pt.classic}</b>. Chance 1 in {pt.coconuts}.</p>
          <p><b>Golden Coconut:</b> the coconut you pick wins ×3.5 or, rarely, the Golden Coconut ×20.</p>
          <TierTable tiers={pt.golden} name={(t) => (t.key === 'golden' ? '🌟 Golden coconut' : t.key === 'prize' ? '🥥 Prize' : 'Miss')} />
          {common}
        </div>
      );
    }
    case 'cup-shuffle': {
      const pt = meta.paytable as { cups: number; pays: number };
      return (
        <div className="paytable">
          <p>Watch the shuffle, then pick a cup. Find the ball and win <b>×{pt.pays}</b>. Chance 1 in {pt.cups}.</p>
          <p><b>The shuffle is decorative.</b> The server places the ball after you pick, so following the cups doesn’t help (or hurt).</p>
          {common}
        </div>
      );
    }
    case 'prize-wheel': {
      const segs = (meta.paytable as { segments: number[] }).segments;
      const counts = new Map<number, number>();
      segs.forEach((m) => counts.set(m, (counts.get(m) ?? 0) + 1));
      const tiers = [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([m, n]) => ({ key: String(m), multiplier: m, weight: n }));
      return (
        <div className="paytable">
          <p>Spin the {segs.length}-segment wheel. Every segment is equally likely, so the wheel shows the real odds.</p>
          <TierTable tiers={tiers} name={(t) => `${t.weight} segment${t.weight > 1 ? 's' : ''}`} />
          {common}
        </div>
      );
    }
    case 'duck-pond': {
      const pt = meta.paytable as { ducks: number; tiers: Tier[] };
      return (
        <div className="paytable">
          <p>Hook one of the {pt.ducks} ducks. The number under it is your multiplier. Which duck you pick doesn’t matter — the prize is drawn from this table.</p>
          <TierTable tiers={pt.tiers} />
          {common}
        </div>
      );
    }
    case 'high-striker': {
      const pt = meta.paytable as { tiers: Tier[] };
      return (
        <div className="paytable">
          <p>Swing the hammer; the puck stops at a prize. Ring the bell for ×50! Tap timing is just for fun — it never changes the result.</p>
          <TierTable tiers={pt.tiers} name={(t) => (t.key === 'bell' ? '🔔 Bell' : `Tier ×${t.multiplier}`)} />
          {common}
        </div>
      );
    }
    case 'scratch-kiosk': {
      const pt = meta.paytable as { tiers: Tier[] };
      return (
        <div className="paytable">
          <p>Scratch the 3×3 card. Three matching symbols win that symbol’s prize. A card never shows more than one three-of-a-kind.</p>
          <TierTable tiers={pt.tiers} name={(t) => (t.key === 'lose' ? 'No match' : `${SCRATCH_ICON[t.key]} ×3`)} />
          {common}
        </div>
      );
    }
    case 'temple-doors': {
      const pt = meta.paytable as { levels: number; doors: number; ladder: number[] };
      return (
        <div className="paytable">
          <p>Up to {pt.levels} levels, each with {pt.doors} doors: 2 safe, 1 trap. Open a safe door to climb; cash out any time. Hit the trap and lose the stake. The trap is placed after you choose.</p>
          <table className="pay">
            <thead><tr><th>Level</th><th>Cash out pays</th><th>Chance to get there</th></tr></thead>
            <tbody>
              {pt.ladder.map((m, i) => (
                <tr key={i}><td>{i + 1}</td><td>×{m}</td><td>{((2 / 3) ** (i + 1) * 100).toFixed(2)}%</td></tr>
              ))}
            </tbody>
          </table>
          {common}
        </div>
      );
    }
    case 'lava-crash': {
      const pt = meta.paytable as { growth: number; max: number; minAuto: number };
      return (
        <div className="paytable">
          <p>The lava climbs from ×1.00. Cash out before the volcano erupts — or set an auto cash-out. Reach ×{pt.max} and you cash out automatically.</p>
          <p>The table shows the chance the lava reaches each cash-out point before the volcano erupts.</p>
          <table className="pay">
            <thead><tr><th>Cash out at</th><th>Chance</th></tr></thead>
            <tbody>
              {[1.5, 2, 5, 10, 100, pt.max].map((x) => (
                <tr key={x}><td>×{x}</td><td>{((0.96 / x) * 100).toFixed(x >= 100 ? 3 : 1)}%</td></tr>
              ))}
            </tbody>
          </table>
          {common}
        </div>
      );
    }
    case 'island-reels': {
      const pt = meta.paytable as { tiers: Tier[] };
      return (
        <div className="paytable">
          <p>One line, three reels. Three of a kind on the line wins that symbol’s prize. The prize is drawn first and the reels are dealt to show it, so the spin is only the reveal — a losing spin never shows three of a kind.</p>
          <TierTable tiers={pt.tiers} name={(t) => (t.key === 'lose' ? 'No match' : `${REEL_ICON[t.key]} ×3`)} />
          {common}
        </div>
      );
    }
    case 'dragon-tiger': {
      const pt = meta.paytable as { ranks: number; pays: number; tie: number };
      const r = pt.ranks;
      const side = (r * (r - 1)) / 2 / (r * r), tie = 1 / r;
      return (
        <div className="paytable">
          <p>One card is dealt to the Dragon and one to the Tiger from an endless deck. Back the higher card, or a tie. Ace is low, king is high; suits don’t count. A tie loses Dragon and Tiger bets.</p>
          <table className="pay">
            <thead><tr><th>Bet</th><th>Pays</th><th>Chance</th></tr></thead>
            <tbody>
              <tr><td>🐉 Dragon higher</td><td>×{pt.pays}</td><td>{(side * 100).toFixed(2)}%</td></tr>
              <tr><td>🐯 Tiger higher</td><td>×{pt.pays}</td><td>{(side * 100).toFixed(2)}%</td></tr>
              <tr><td>🤝 Tie</td><td>×{pt.tie}</td><td>{(tie * 100).toFixed(2)}%</td></tr>
            </tbody>
          </table>
          {common}
        </div>
      );
    }
    case 'pirate-dice': {
      const pt = meta.paytable as { faces: string[]; dice: number; pays: number[] };
      const f = pt.faces.length;
      const n = pt.dice;
      const choose = (k: number) => [1, 3, 3, 1][k] ?? 1; // C(3, k)
      const chance = (k: number) => (choose(k) * (f - 1) ** (n - k)) / f ** n;
      return (
        <div className="paytable">
          <p>Crown and anchor, pirate style. Pick one of the {f} faces ({pt.faces.map((x) => DICE_ICON[x]).join(' ')}), then {n} fair dice are rolled. You’re paid by how many show your face.</p>
          <table className="pay">
            <thead><tr><th>Your face shows</th><th>Pays</th><th>Chance</th></tr></thead>
            <tbody>
              {[3, 2, 1, 0].map((k) => (
                <tr key={k}><td>{k === 0 ? 'None' : `${k} of ${n}`}</td><td>{pt.pays[k] > 0 ? `×${pt.pays[k]}` : '—'}</td><td>{(chance(k) * 100).toFixed(2)}%</td></tr>
              ))}
            </tbody>
          </table>
          {common}
        </div>
      );
    }
    case 'diamond-wheel': {
      const pt = meta.paytable as { gems: string[]; segments: number[]; pays: number[] };
      const n = pt.segments.length;
      return (
        <div className="paytable">
          <p>A {n}-segment wheel of gems. Back one gem, then spin: if the pointer stops on your gem you win its price. Every segment is equally likely, so the fewer segments a gem has, the more it pays.</p>
          <table className="pay">
            <thead><tr><th>Gem</th><th>Segments</th><th>Pays</th><th>Chance</th></tr></thead>
            <tbody>
              {pt.gems.map((g, i) => {
                const c = pt.segments.filter((x) => x === i).length;
                return <tr key={g}><td>{GEM_ICON[g]} {GEM_NAME[g]}</td><td>{c}</td><td>×{pt.pays[i]}</td><td>{pct(c, n)}</td></tr>;
              }).reverse()}
            </tbody>
          </table>
          {common}
        </div>
      );
    }
    case 'coral-drop': {
      const pt = meta.paytable as { rows: number; modes: string[]; pockets: number[][] };
      const ways = 2 ** pt.rows;
      return (
        <div className="paytable">
          <p>A pearl drops through {pt.rows} rows of coral and bounces left or right off each, at random. Where it lands — the pocket counted by its bounces to the right — sets your prize. The middle is most likely; the edges are rare.</p>
          <table className="pay">
            <thead><tr><th>Pocket</th><th>Calm</th><th>Wild</th><th>Chance</th></tr></thead>
            <tbody>
              {pt.pockets[0].slice(0, Math.ceil((pt.rows + 1) / 2)).map((_, k) => (
                <tr key={k}>
                  <td>{k === pt.rows - k ? 'Middle' : k === 0 ? 'The two edges' : `${k} in from the edges`}</td>
                  <td>×{pt.pockets[0][k]}</td>
                  <td>×{pt.pockets[1][k]}</td>
                  <td>{pct(choose(pt.rows, k) * (k === pt.rows - k ? 1 : 2), ways)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {common}
        </div>
      );
    }
    case 'seahorse-derby': {
      const pt = meta.paytable as { racers: string[]; odds: Tier[] };
      const sum = total(pt.odds);
      return (
        <div className="paytable">
          <p>Five seahorses race. Back one: if it wins, you’re paid its odds. The winner is drawn by the server with exactly these chances — the race is the reveal — and every seahorse returns the same over time.</p>
          <table className="pay">
            <thead><tr><th>Seahorse</th><th>Pays</th><th>Wins</th></tr></thead>
            <tbody>
              {pt.racers.map((r, i) => <tr key={r}><td>{r}</td><td>×{pt.odds[i].multiplier}</td><td>{pct(pt.odds[i].weight, sum)}</td></tr>)}
            </tbody>
          </table>
          {common}
        </div>
      );
    }
    case 'ice-fishing': {
      const pt = meta.paytable as { holes: string[]; tables: Tier[][] };
      const names: Record<string, string> = { shallow: 'Shallow hole', deep: 'Deep hole', abyss: 'The Abyss' };
      return (
        <div className="paytable">
          <p>Pick a hole in the ice and cast. Your catch is drawn from that hole’s table: shallow holes bite often with small fish, the abyss rarely bites — but holds the golden narwhal.</p>
          {pt.holes.map((h, i) => (
            <div key={h}>
              <h4 className="pay-sub">{names[h] ?? h}</h4>
              <TierTable tiers={pt.tables[i]} name={(t) => `${FISH[t.key]?.icon ?? '🐟'} ${FISH[t.key]?.name ?? t.key}`} />
            </div>
          ))}
          {common}
        </div>
      );
    }
    case 'ice-vault': {
      const pt = meta.paytable as { digits: number; pays: number[] };
      const n = pt.digits;
      const chance = (k: number) => (choose(n, k) * 9 ** (n - k)) / 10 ** n;
      return (
        <div className="paytable">
          <p>Dial a {n}-digit code. The vault’s code is {n} fair digits; each digit of yours in the right place counts.</p>
          <table className="pay">
            <thead><tr><th>Right digits</th><th>Pays</th><th>Chance</th></tr></thead>
            <tbody>
              {[3, 2, 1, 0].map((k) => <tr key={k}><td>{k === 0 ? 'None' : `${k} of ${n}`}</td><td>{pt.pays[k] > 0 ? `×${pt.pays[k]}` : '—'}</td><td>{(chance(k) * 100).toFixed(k === 3 ? 1 : 1)}%</td></tr>)}
            </tbody>
          </table>
          {common}
        </div>
      );
    }
    case 'star-keno': {
      const pt = meta.paytable as { stars: number; draws: number; maxPicks: number; pays: number[][] };
      const all = choose(pt.stars, pt.draws);
      return (
        <div className="paytable">
          <p>Pick 1 to {pt.maxPicks} of the {pt.stars} stars. {pt.draws} shooting stars fall, each on a different star; you’re paid by how many of yours they hit.</p>
          <table className="pay">
            <thead><tr><th>Picked</th><th>Hits</th><th>Pays</th><th>Chance</th></tr></thead>
            <tbody>
              {pt.pays.flatMap((row, n0) => row.map((m, k) => ({ n: n0 + 1, k, m }))).filter((x) => x.m > 0).map((x) => (
                <tr key={`${x.n}-${x.k}`}><td>{x.n}</td><td>{x.k}</td><td>×{x.m}</td><td>{pct(choose(x.n, x.k) * choose(pt.stars - x.n, pt.draws - x.k), all)}</td></tr>
              ))}
            </tbody>
          </table>
          {common}
        </div>
      );
    }
    case 'oracle-chests': {
      const pt = meta.paytable as { chests: number; stay: number; switch: number };
      return (
        <div className="paytable">
          <p>One of {pt.chests} chests holds the treasure. Pick one; the Oracle, who knows where it is, opens an empty chest from the other two. Then stay with yours, or switch to the last closed chest.</p>
          <table className="pay">
            <thead><tr><th>You…</th><th>Pays</th><th>Chance</th></tr></thead>
            <tbody>
              <tr><td>Stay</td><td>×{pt.stay}</td><td>33.3%</td></tr>
              <tr><td>Switch</td><td>×{pt.switch}</td><td>66.7%</td></tr>
            </tbody>
          </table>
          <p className="small">Switching wins twice as often because the Oracle never opens your chest or the treasure. Both choices return the same over time.</p>
          {common}
        </div>
      );
    }
    case 'roulette': {
      const pt = p as { payouts: Record<string, number> };
      const names: Record<string, string> = { straight: 'Straight (1 number)', column: 'Column', dozen: 'Dozen', evenMoney: 'Red/black, odd/even, 1–18/19–36' };
      return (
        <div className="paytable">
          <p>European single-zero roulette. Place chips, then spin.</p>
          <table className="pay">
            <thead><tr><th>Bet</th><th>Pays</th></tr></thead>
            <tbody>
              {Object.entries(names).map(([k, n]) => (
                <tr key={k}><td>{n}</td><td>{pt.payouts[k]} to 1</td></tr>
              ))}
            </tbody>
          </table>
          {common}
        </div>
      );
    }
  }
}

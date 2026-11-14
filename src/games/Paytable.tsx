import type { GameKey, Tier } from '../api/types.ts';
import { useGame } from '../store/game.ts';
import { SCRATCH_ICON } from './ScratchKiosk.tsx';

const pct = (w: number, total: number) => `${((w / total) * 100).toFixed(w / total < 0.01 ? 2 : 1)}%`;
const total = (t: Tier[]) => t.reduce((s, x) => s + x.weight, 0);

function TierTable({ tiers, name = (t: Tier) => `×${t.multiplier}` }: { tiers: Tier[]; name?: (t: Tier) => string }) {
  const sum = total(tiers);
  const rtp = tiers.reduce((s, t) => s + t.multiplier * t.weight, 0) / sum;
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
      <tfoot>
        <tr><td colSpan={3}>Return to player: Σ chance × pays = {(rtp * 100).toFixed(2)}%</td></tr>
      </tfoot>
    </table>
  );
}

/** Rules, odds and RTP for one game, from the paytable the server sent (api/island/info). */
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
          <p><b>Classic:</b> one of {pt.coconuts} coconuts hides the prize. Pick one and throw — hit it and win <b>×{pt.classic}</b>. Chance 1 in {pt.coconuts}. RTP {((pt.classic / pt.coconuts) * 100).toFixed(0)}%.</p>
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
          <p>Watch the shuffle, then pick a cup. Find the ball and win <b>×{pt.pays}</b>. Chance 1 in {pt.cups}. RTP {((pt.pays / pt.cups) * 100).toFixed(0)}%.</p>
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
            <tfoot><tr><td colSpan={3}>Level n pays 0.96 × 1.5ⁿ, so every cash-out point returns 96%.</td></tr></tfoot>
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
          <p>The eruption point is drawn so the chance it reaches ×x is 0.96 ÷ x (4% of climbs erupt at once). Every cash-out target returns 96%.</p>
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
    case 'roulette': {
      const pt = p as { payouts: Record<string, number> };
      const names: Record<string, string> = { straight: 'Straight (1 number)', column: 'Column', dozen: 'Dozen', evenMoney: 'Red/black, odd/even, 1–18/19–36' };
      return (
        <div className="paytable">
          <p>European single-zero roulette. Place chips, then spin. RTP 97.3% (36/37) on every bet.</p>
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

import { useEffect, useRef, useState } from 'react';
import { KENO_DRAWS, KENO_MAX_PICKS, KENO_PAYS, KENO_STARS } from '../api/rules.ts';
import type { RoundView } from '../api/types.ts';
import { useGame } from '../store/game.ts';
import { sound } from '../ui/sound.ts';
import { Result, Shell, StakePicker, wait } from './GameOverlay.tsx';

/**
 * Star Keno (Sky Kingdom's observatory): pick 1 to 4 of the 16 stars, then 4 shooting stars fall, each on a different
 * star (drawn by the server). You're paid by how many of your stars they hit; each pick count has its own table.
 */
export function StarKeno() {
  const pt = useGame((s) => s.meta('star-keno')?.paytable);
  const stars = pt?.stars ?? KENO_STARS;
  const draws = pt?.draws ?? KENO_DRAWS;
  const maxPicks = pt?.maxPicks ?? KENO_MAX_PICKS;
  const pays = pt?.pays ?? KENO_PAYS;
  const stake = useGame((s) => s.stake);
  const busy = useGame((s) => s.busy);
  const bet = useGame((s) => s.bet);
  const finish = useGame((s) => s.finish);
  const [picks, setPicks] = useState<number[]>([2, 7, 9]);
  const [drawn, setDrawn] = useState<number[]>([]);
  const [comet, setComet] = useState<{ star: number; k: number } | null>(null);
  const [watching, setWatching] = useState(false);
  const [round, setRound] = useState<RoundView | null>(null);
  const seq = useRef(0);
  useEffect(() => () => void (seq.current = -1), []);
  const cols = 4;

  const toggle = (i: number) => {
    if (watching) return;
    sound.play('tick');
    setRound(null);
    setDrawn([]);
    setPicks((p) => (p.includes(i) ? p.filter((x) => x !== i) : p.length >= maxPicks ? [...p.slice(1), i] : [...p, i]));
  };
  const quick = () => {
    if (watching) return;
    sound.play('magic');
    setRound(null);
    setDrawn([]);
    const n = Math.max(1, picks.length);
    const all = Array.from({ length: stars }, (_, i) => i).sort(() => Math.random() - 0.5);
    setPicks(all.slice(0, n));
  };

  const watch = async () => {
    if (watching || busy || picks.length === 0) return;
    const my = ++seq.current;
    setRound(null);
    setDrawn([]);
    const s = await bet({ game: 'star-keno', stake, picks });
    if (!s?.round || my !== seq.current) return;
    const fall: number[] = s.round.outcome.stars;
    setWatching(true);
    for (let k = 0; k < fall.length; k++) {
      setComet({ star: fall[k], k });
      sound.play('whoosh');
      await wait(560);
      if (my !== seq.current) return;
      setComet(null);
      setDrawn((d) => [...d, fall[k]]);
      sound.play(picks.includes(fall[k]) ? 'chime' : 'tick');
      await wait(240);
    }
    if (my !== seq.current) return;
    setWatching(false);
    setRound(s.round);
    finish(s);
  };

  const n = picks.length;
  const hits = drawn.filter((d) => picks.includes(d)).length;
  const table = n > 0 ? pays[n - 1] : [];
  const pos = (i: number) => ({ x: ((i % cols) + 0.5) * (100 / cols), y: (Math.floor(i / cols) + 0.5) * (100 / (stars / cols)) });

  return (
    <Shell
      game="star-keno"
      live={watching}
      footer={
        <>
          <StakePicker disabled={watching} />
          <div className="row vault-row">
            <button className="btn btn-plain" disabled={watching} onClick={quick}>✨ Quick pick</button>
            <button className="btn btn-gold vault-go" disabled={watching || busy || n === 0} onClick={() => void watch()}>
              {watching ? 'Look up!' : n === 0 ? 'Pick some stars' : `Watch the sky (${n} star${n > 1 ? 's' : ''})`}
            </button>
          </div>
        </>
      }
    >
      <div className="keno">
        <div className="sky-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: stars }, (_, i) => {
            const mine = picks.includes(i), fell = drawn.includes(i);
            return (
              <button key={i} className={`star${mine ? ' mine' : ''}${fell ? (mine ? ' hit' : ' fell') : ''}`} disabled={watching} onClick={() => toggle(i)} aria-pressed={mine} aria-label={`Star ${i + 1}`}>
                <span>★</span>
              </button>
            );
          })}
          {comet && <i key={`${comet.k}`} className="comet" style={{ ['--tx' as string]: `${pos(comet.star).x}%`, ['--ty' as string]: `${pos(comet.star).y}%` }} />}
        </div>
        <div className="keno-pays">
          <h4>{n === 0 ? `Pick up to ${maxPicks} stars` : `${n} star${n > 1 ? 's' : ''} picked · ${draws} fall`}</h4>
          {table.map((m, k) => (m > 0 ? (
            <span key={k} className={round && hits === k ? 'hit' : ''}>
              {k} hit{k > 1 ? 's' : ''} <b>×{m}</b>
            </span>
          ) : null)).reverse()}
        </div>
      </div>
      <Result round={round} text={watching ? `${hits} of your stars hit so far…` : 'Tap stars to pick them (up to 4)'} />
    </Shell>
  );
}

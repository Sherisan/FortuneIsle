import { useRef, useState } from 'react';
import type { RoundView, Tier } from '../api/types.ts';
import { useGame } from '../store/game.ts';
import { sound } from '../ui/sound.ts';
import { Result, Shell, StakePicker, wait } from './GameOverlay.tsx';

/** High Striker (Fairground): swing the hammer; the puck climbs to the tier the server drew; the top rings the ×50 bell. */
export function HighStriker() {
  const tiers = useGame((s) => (s.meta('high-striker')?.paytable.tiers ?? []) as Tier[]);
  const stake = useGame((s) => s.stake);
  const busy = useGame((s) => s.busy);
  const bet = useGame((s) => s.bet);
  const finish = useGame((s) => s.finish);
  const [phase, setPhase] = useState<'idle' | 'swing' | 'rise' | 'done'>('idle');
  const [tier, setTier] = useState<number | null>(null);
  const [round, setRound] = useState<RoundView | null>(null);
  // After each result the puck drops back to the base. Each swing gets a number, so an earlier swing's drop can't fire
  // in the middle of a later one (you can swing again before the puck has come down).
  const [dropped, setDropped] = useState(false);
  const seq = useRef(0);
  const n = tiers.length || 7;
  const heightOf = (t: number) => 6 + (t / (n - 1)) * 86;

  const swing = async () => {
    if (busy || phase === 'swing' || phase === 'rise') return;
    const my = ++seq.current;
    setRound(null);
    setTier(null);
    setDropped(false);
    setPhase('swing');
    const [s] = await Promise.all([bet({ game: 'high-striker', stake }), wait(420)]);
    if (!s?.round) {
      setPhase('idle');
      return;
    }
    sound.play('thud');
    setTier(s.round.outcome.tier);
    setPhase('rise');
    await wait(1050);
    if (s.round.outcome.key === 'bell') sound.play('bell');
    else if (s.round.multiplier > 0) sound.play('ding');
    setRound(s.round);
    setPhase('done');
    finish(s);
    // Let the result sink in (and the bell finish ringing), then the puck slides back down for the next swing.
    await wait(s.round.outcome.key === 'bell' ? 1500 : 900);
    if (my === seq.current) setDropped(true);
  };

  const reached = heightOf(tier ?? 0);
  const up = phase === 'rise' || (phase === 'done' && !dropped);

  return (
    <Shell
      game="high-striker"
      live={phase === 'swing' || phase === 'rise'}
      footer={
        <>
          <StakePicker disabled={phase === 'swing' || phase === 'rise'} />
          <button className="btn btn-gold btn-wide" disabled={busy || phase === 'swing' || phase === 'rise'} onClick={() => void swing()}>
            Swing! 🔨
          </button>
        </>
      }
    >
      <div className="striker">
        <div className="tower">
          <div className={`bell${phase === 'done' && round?.outcome?.key === 'bell' ? ' ring' : ''}`}>🔔</div>
          {tiers.map((t, i) => (
            <div key={t.key} className={`tier${tier === i && phase === 'done' ? ' lit' : ''}`} style={{ bottom: `${heightOf(i)}%` }}>
              <span>{t.key === 'bell' ? 'BELL ×50' : t.multiplier === 0 ? 'TRY AGAIN' : `×${t.multiplier}`}</span>
            </div>
          ))}
          {/* The rise and the reset are transitions; the drop after a result is the .fall animation (from the height it
              reached, bouncing once at the base), timed so a short drop doesn't crawl. */}
          <div
            className={`puck${dropped ? ' fall' : ''}`}
            style={{
              bottom: `${up ? reached : 2}%`,
              transition: phase === 'rise' ? 'bottom 1s cubic-bezier(.2,.9,.3,1)' : dropped ? 'none' : 'bottom .4s ease-in',
              ['--from' as string]: `${reached}%`,
              ['--bounce' as string]: `${2 + Math.min(4, (reached - 2) / 3)}%`,
              animationDuration: `${0.35 + ((reached - 2) / 90) * 0.5}s`,
            }}
          />
        </div>
        <div className={`hammer${phase === 'swing' ? ' swing' : phase === 'rise' ? ' down' : ''}`} />
        <div className={`pad${phase === 'rise' ? ' hit' : ''}`} />
      </div>
      <Result round={phase === 'done' ? round : null} text={phase === 'idle' ? 'Ring the bell for ×50' : undefined} />
    </Shell>
  );
}

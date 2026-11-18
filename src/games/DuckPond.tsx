import { useEffect, useRef, useState } from 'react';
import type { RoundView } from '../api/types.ts';
import { useGame } from '../store/game.ts';
import { sound } from '../ui/sound.ts';
import { Result, Shell, StakePicker, wait } from './GameOverlay.tsx';

const DUCKS = 12;
const COLORS = ['#ffd23f', '#ffd23f', '#ff9bc0', '#ffd23f', '#7fe0ff', '#ffd23f'];

/** Duck Pond (Fairground): 12 ducks circle the pond; hook one and its base shows the multiplier the server drew. */
export function DuckPond() {
  const stake = useGame((s) => s.stake);
  const busy = useGame((s) => s.busy);
  const bet = useGame((s) => s.bet);
  const finish = useGame((s) => s.finish);
  const [phase, setPhase] = useState<'swim' | 'hook' | 'reveal'>('swim');
  const [picked, setPicked] = useState<number | null>(null);
  const [values, setValues] = useState<number[] | null>(null);
  const [round, setRound] = useState<RoundView | null>(null);
  const els = useRef<(HTMLButtonElement | null)[]>([]);
  const angle = useRef(0);
  const moving = useRef(true);
  const seq = useRef(0);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (moving.current) angle.current += dt * 0.35;
      els.current.forEach((el, i) => {
        if (!el) return;
        const a = angle.current + (i / DUCKS) * Math.PI * 2;
        // The orbit sits a little low so a duck at the back still has room above it for its tag.
        const x = 50 + Math.cos(a) * 40, y = 55 + Math.sin(a) * 28;
        const depth = (Math.sin(a) + 1) / 2;
        const bob = Math.sin(now / 300 + i) * 3;
        el.style.left = `${x}%`;
        el.style.top = `${y}%`;
        el.style.transform = `translate(-50%, calc(-50% + ${bob}px)) scale(${0.72 + depth * 0.4}) scaleX(${Math.cos(a) > 0 ? -1 : 1})`;
        el.style.zIndex = String(Math.round(depth * 100));
        el.style.setProperty('--flip', Math.cos(a) > 0 ? '-1' : '1'); // keeps the tag's text readable

      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const hook = async (i: number) => {
    if (phase === 'hook' || busy) return;
    // Each hook gets a number, so a previous round's timers can't restart the ducks in the middle of a new one.
    const my = ++seq.current;
    setValues(null);
    setRound(null);
    moving.current = false;
    setPicked(i);
    setPhase('hook');
    sound.play('whoosh');
    const [s] = await Promise.all([bet({ game: 'duck-pond', stake, choice: i }), wait(700)]);
    if (my !== seq.current) return;
    if (!s?.round) {
      setPhase('swim');
      setPicked(null);
      moving.current = true;
      return;
    }
    sound.play('pop');
    setValues(s.round.outcome.ducks);
    setRound(s.round);
    setPhase('reveal');
    await wait(400);
    finish(s);
    await wait(1400);
    if (my !== seq.current) return;
    // Put the multipliers away first, then let the ducks swim on (the result line stays up).
    setValues(null);
    setPicked(null);
    setPhase('swim');
    await wait(350);
    if (my !== seq.current) return;
    moving.current = true;
  };

  return (
    <Shell
      game="duck-pond"
      live={phase === 'hook'}
      footer={
        <>
          <StakePicker disabled={phase === 'hook'} />
          <p className="foot-hint">Tap a duck to hook it.</p>
        </>
      }
    >
      <div className="pond">
        <div className="pond-water" />
        {Array.from({ length: DUCKS }, (_, i) => {
          const isPicked = picked === i && phase !== 'swim';
          const v = values?.[i];
          return (
            <button
              key={i}
              ref={(el) => (els.current[i] = el)}
              className={`duck${isPicked ? ' picked' : ''}${values && !isPicked ? ' other' : ''}`}
              style={{ ['--duck' as string]: COLORS[i % COLORS.length] }}
              onClick={() => void hook(i)}
              aria-label={`Duck ${i + 1}`}
            >
              <i className="duck-body" />
              {v !== undefined && phase === 'reveal' && <b className={`duck-tag${v >= 5 ? ' hot' : v === 0 ? ' zero' : ''}`}>{v === 0 ? '✕' : `×${v}`}</b>}
            </button>
          );
        })}
      </div>
      <Result round={phase === 'hook' ? null : round} text={phase === 'hook' ? 'Hooked one…' : 'Up to ×20 under a duck'} />
    </Shell>
  );
}

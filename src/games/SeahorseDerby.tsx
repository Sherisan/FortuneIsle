import { useEffect, useRef, useState } from 'react';
import { DERBY_ODDS, DERBY_RACERS } from '../api/rules.ts';
import type { RoundView } from '../api/types.ts';
import { useGame } from '../store/game.ts';
import { sound } from '../ui/sound.ts';
import { Result, Shell, StakePicker, wait } from './GameOverlay.tsx';

const COLOURS = ['#ffd23f', '#ff7ab6', '#ff8a3d', '#7fd6ff', '#b07cff'];
/** Easing curves for the swim: different ones make the field swap places on the way (the finish order is the server's). */
const CURVES = ['cubic-bezier(.62,.04,.38,1)', 'cubic-bezier(.2,.55,.45,1)', 'cubic-bezier(.45,.15,.25,1)', 'cubic-bezier(.75,0,.3,1)', 'cubic-bezier(.3,.3,.6,1)'];
const PLACES = ['1st', '2nd', '3rd', '4th', '5th'];

/**
 * Seahorse Derby (Coral Lagoon): five seahorses with posted odds. Back one; the winner is drawn by the server with
 * exactly those odds (the favourite most often), and every pick returns the same 96%. The race is the reveal.
 */
export function SeahorseDerby() {
  const pt = useGame((s) => s.meta('seahorse-derby')?.paytable);
  const names = pt?.racers ?? DERBY_RACERS;
  const odds = pt?.odds ?? DERBY_ODDS;
  const stake = useGame((s) => s.stake);
  const busy = useGame((s) => s.busy);
  const bet = useGame((s) => s.bet);
  const finish = useGame((s) => s.finish);
  const [pick, setPick] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'gate' | 'race' | 'done'>('idle');
  const [order, setOrder] = useState<number[] | null>(null);
  const [round, setRound] = useState<RoundView | null>(null);
  const [curves, setCurves] = useState<string[]>(CURVES);
  const seq = useRef(0);
  useEffect(() => () => void (seq.current = -1), []);
  const total = odds.reduce((s, x) => s + x.weight, 0);
  const racing = phase === 'gate' || phase === 'race';

  const race = async () => {
    if (racing || busy) return;
    const my = ++seq.current;
    setRound(null);
    const s = await bet({ game: 'seahorse-derby', stake, choice: pick });
    if (!s?.round || my !== seq.current) return;
    setOrder(s.round.outcome.order);
    setCurves([...CURVES].sort(() => Math.random() - 0.5));
    setPhase('gate');
    sound.play('horn');
    await wait(80);
    setPhase('race');
    const tick = window.setInterval(() => sound.play('reel'), 260);
    await wait(4900);
    clearInterval(tick);
    if (my !== seq.current) return;
    setPhase('done');
    setRound(s.round);
    sound.play('splash');
    finish(s);
  };

  // The winner arrives at 4.0 s, the rest a beat apart in the server's order.
  const place = (i: number) => (order ? order.indexOf(i) : -1);
  const duration = (i: number) => 4 + place(i) * 0.2;

  return (
    <Shell
      game="seahorse-derby"
      live={racing}
      footer={
        <>
          <StakePicker disabled={racing} />
          <button className="btn btn-gold btn-wide" disabled={racing || busy} onClick={() => void race()}>
            {racing ? 'They’re off!' : `Back ${names[pick]} · ×${odds[pick].multiplier}`}
          </button>
        </>
      }
    >
      <div className="derby">
        <div className="derby-track">
          {names.map((n, i) => {
            const at = phase === 'race' || phase === 'done' ? 1 : 0;
            const p = place(i);
            return (
              <div key={n} className={`lane${pick === i ? ' mine' : ''}${phase === 'done' && p === 0 ? ' won' : ''}`}>
                <span
                  className="racer"
                  style={{
                    left: `calc(${at * 86}% + 2px)`,
                    transition: phase === 'race' ? `left ${duration(i)}s ${curves[i]}` : 'none',
                    ['--c' as string]: COLOURS[i],
                  }}
                >
                  <i />
                </span>
                {phase === 'done' && p >= 0 && <em className="place">{PLACES[p]}</em>}
              </div>
            );
          })}
          <i className="finish" />
        </div>
        <div className="derby-card" role="radiogroup" aria-label="Your seahorse">
          {names.map((n, i) => (
            <button
              key={n}
              role="radio"
              aria-checked={pick === i}
              className={`runner${pick === i ? ' on' : ''}`}
              style={{ ['--c' as string]: COLOURS[i] }}
              disabled={racing}
              onClick={() => {
                sound.play('chip');
                setPick(i);
              }}
            >
              <span className="dot" />
              <b>{n}</b>
              <small>wins {Math.round((odds[i].weight / total) * 100)}%</small>
              <em>×{odds[i].multiplier}</em>
            </button>
          ))}
        </div>
      </div>
      <Result
        round={round}
        text={racing ? 'Neck and neck… fin and fin!' : 'Favourites win more often, long shots pay more'}
      />
    </Shell>
  );
}

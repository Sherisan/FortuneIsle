import { useRef, useState } from 'react';
import type { RoundView } from '../api/types.ts';
import { useGame } from '../store/game.ts';
import { sound } from '../ui/sound.ts';
import { Result, Shell, StakePicker, wait } from './GameOverlay.tsx';

const SPEEDS = { slow: 520, normal: 330, turbo: 170 } as const;

/**
 * Cup Shuffle (Boardwalk): the ball is shown, the cups shuffle (cosmetic), then the player picks a slot. The server
 * places the ball after the pick, as the paytable says.
 */
export function CupShuffle() {
  const stake = useGame((s) => s.stake);
  const busy = useGame((s) => s.busy);
  const bet = useGame((s) => s.bet);
  const finish = useGame((s) => s.finish);
  const [speed, setSpeed] = useState<keyof typeof SPEEDS>('normal');
  const [phase, setPhase] = useState<'ready' | 'show' | 'shuffle' | 'pick' | 'reveal'>('ready');
  // order[slot] = which cup sits in that slot (cups keep identity so CSS can slide them).
  const [order, setOrder] = useState([0, 1, 2]);
  const [lifted, setLifted] = useState<number[]>([]);
  const [ballSlot, setBallSlot] = useState<number | null>(1);
  const [round, setRound] = useState<RoundView | null>(null);
  // The two cups swapping this step: one hops over, one ducks under (the class name alternates to restart the animation).
  const [moving, setMoving] = useState<{ hop: number; dip: number; k: number } | null>(null);
  const run = useRef(0);

  const shuffle = async () => {
    const id = ++run.current;
    setRound(null);
    setBallSlot(1);
    setPhase('show');
    setLifted([1]);
    sound.play('pop');
    await wait(700);
    setLifted([]);
    await wait(350);
    setBallSlot(null);
    setPhase('shuffle');
    const ms = SPEEDS[speed];
    let o = [0, 1, 2];
    for (let k = 0; k < 9; k++) {
      if (run.current !== id) return;
      const a = Math.floor(Math.random() * 3);
      const b = (a + 1 + Math.floor(Math.random() * 2)) % 3;
      o = [...o];
      setMoving({ hop: o[a], dip: o[b], k });
      [o[a], o[b]] = [o[b], o[a]];
      setOrder(o);
      sound.play('spin');
      await wait(ms);
    }
    setMoving(null);
    setPhase('pick');
  };

  const pick = async (slot: number) => {
    if (phase !== 'pick' || busy) return;
    setPhase('reveal');
    const s = await bet({ game: 'cup-shuffle', stake, choice: slot });
    if (!s?.round) {
      setPhase('pick');
      return;
    }
    const at: number = s.round.outcome.ballUnder;
    setRound(null);
    setBallSlot(at);
    setLifted([slot]);
    sound.play(at === slot ? 'ding' : 'pop');
    await wait(700);
    if (at !== slot) setLifted([slot, at]);
    setRound(s.round);
    await wait(300);
    finish(s);
  };

  const slotOfCup = (cup: number) => order.indexOf(cup);

  return (
    <Shell
      game="cup-shuffle"
      live={phase === 'shuffle'}
      footer={
        <>
          <div className="seg">
            {(Object.keys(SPEEDS) as (keyof typeof SPEEDS)[]).map((k) => (
              <button key={k} className={speed === k ? 'on' : ''} disabled={phase === 'shuffle' || phase === 'show'} onClick={() => setSpeed(k)}>
                {k[0].toUpperCase() + k.slice(1)}
              </button>
            ))}
          </div>
          <StakePicker disabled={phase === 'shuffle' || phase === 'show'} />
          <button className="btn btn-gold btn-wide" disabled={phase === 'shuffle' || phase === 'show' || phase === 'pick' || busy} onClick={() => void shuffle()}>
            {phase === 'pick' ? 'Pick a cup!' : 'Shuffle'}
          </button>
        </>
      }
    >
      <div className={`cups ${phase}`}>
        <div className="table-felt" />
        {[0, 1, 2].map((cup) => {
          const slot = slotOfCup(cup);
          return (
            <button
              key={cup}
              className={`cup${lifted.includes(slot) ? ' up' : ''}${phase === 'pick' ? ' pickable' : ''}${moving?.hop === cup ? ` hop${moving.k % 2}` : moving?.dip === cup ? ` dip${moving.k % 2}` : ''}`}
              style={{ left: `${18 + slot * 32}%`, transitionDuration: `${SPEEDS[speed] * 0.9}ms, 250ms`, animationDuration: `${SPEEDS[speed] * 0.9}ms` }}
              onClick={() => void pick(slot)}
              aria-label={`Cup ${slot + 1}`}
            >
              <i />
            </button>
          );
        })}
        {ballSlot != null && <span className="cup-ball" style={{ left: `${18 + ballSlot * 32}%` }} />}
      </div>
      <Result round={round} text={phase === 'pick' ? 'Which cup hides the ball?' : phase === 'ready' ? 'Find the ball: ×2.88 · 1 in 3' : undefined} />
      <p className="note">The shuffle is just for show — the ball is placed fairly by the server after you pick.</p>
    </Shell>
  );
}

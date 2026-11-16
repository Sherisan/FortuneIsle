import { useState } from 'react';
import { DICE_FACES, DICE_PAYS } from '../api/rules.ts';
import type { RoundView } from '../api/types.ts';
import { useGame } from '../store/game.ts';
import { sound } from '../ui/sound.ts';
import { Result, Shell, StakePicker, wait } from './GameOverlay.tsx';

export const DICE_ICON: Record<string, string> = { anchor: '⚓', skull: '☠️', parrot: '🦜', ship: '⛵', chest: '💰', compass: '🧭' };
const NAMES: Record<string, string> = { anchor: 'Anchor', skull: 'Skull', parrot: 'Parrot', ship: 'Ship', chest: 'Chest', compass: 'Compass' };

/**
 * Pirate Dice (the Rusty Anchor): crown-and-anchor. Pick a face, the landlord rolls three dice: one of yours pays ×2, two
 * pay ×3, all three pay ×12.36. The roll is the server's; the cup shake is only the reveal.
 */
export function PirateDice() {
  const stake = useGame((s) => s.stake);
  const busy = useGame((s) => s.busy);
  const bet = useGame((s) => s.bet);
  const finish = useGame((s) => s.finish);
  const PAYS = useGame((s) => s.meta('pirate-dice')?.paytable.pays) ?? DICE_PAYS;
  const [face, setFace] = useState(0);
  const [dice, setDice] = useState<string[]>(['anchor', 'parrot', 'chest']);
  const [rolling, setRolling] = useState(false);
  const [round, setRound] = useState<RoundView | null>(null);

  const roll = async () => {
    if (busy || rolling) return;
    setRolling(true);
    setRound(null);
    sound.play('rumble');
    const tumble = setInterval(() => {
      setDice(() => [0, 1, 2].map(() => DICE_FACES[Math.floor(Math.random() * 6)]));
      sound.play('tick');
    }, 90);
    const [s] = await Promise.all([bet({ game: 'pirate-dice', stake, choice: face }), wait(900)]);
    clearInterval(tumble);
    if (!s?.round) {
      setRolling(false);
      return;
    }
    setDice(s.round.outcome.dice);
    sound.play('thud');
    await wait(350);
    setRound(s.round);
    setRolling(false);
    finish(s);
  };

  const mine = DICE_FACES[face];
  const matches: number = round?.outcome?.matches ?? 0;

  return (
    <Shell
      game="pirate-dice"
      live={rolling}
      footer={
        <>
          <StakePicker disabled={rolling} />
          <button className="btn btn-gold btn-wide" disabled={busy || rolling} onClick={() => void roll()}>
            {rolling ? 'Rolling…' : `Roll on the ${NAMES[mine]}`}
          </button>
        </>
      }
    >
      <div className="pd-table">
        <div className="pd-board" role="radiogroup" aria-label="Your face">
          {DICE_FACES.map((f, i) => (
            <button
              key={f}
              role="radio"
              aria-checked={face === i}
              className={`pd-face${face === i ? ' on' : ''}${round && round.outcome.dice.includes(f) && f === mine ? ' hit' : ''}`}
              disabled={rolling}
              onClick={() => {
                sound.play('chip');
                setFace(i);
              }}
            >
              <span>{DICE_ICON[f]}</span>
              <small>{NAMES[f]}</small>
            </button>
          ))}
        </div>
        <div className={`pd-dice${rolling ? ' rolling' : ''}`}>
          {dice.map((d, i) => (
            <div key={i} className={`pd-die${!rolling && round && d === mine ? ' match' : ''}`} style={{ animationDelay: `${i * 60}ms` }}>
              {DICE_ICON[d]}
            </div>
          ))}
        </div>
        <div className="pd-pays">
          {[1, 2, 3].map((n) => (
            <span key={n} className={round && matches === n ? 'hit' : ''}>
              {n} × {DICE_ICON[mine]} pays <b>×{PAYS[n]}</b>
            </span>
          ))}
        </div>
      </div>
      <Result round={round} text={rolling ? 'The dice are tumbling…' : `Pick your face — ${NAMES[mine]} it is!`} />
      <p className="note">Each die is fair and rolled by the server; the shake is just for show.</p>
    </Shell>
  );
}

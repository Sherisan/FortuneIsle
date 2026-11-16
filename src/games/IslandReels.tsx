import { useEffect, useRef, useState } from 'react';
import { REEL_SYMBOLS, REELS_TABLE } from '../api/rules.ts';
import type { RoundView } from '../api/types.ts';
import { useGame } from '../store/game.ts';
import { sound } from '../ui/sound.ts';
import { Result, Shell, StakePicker, wait } from './GameOverlay.tsx';

export const REEL_ICON: Record<string, string> = { shell: '🐚', starfish: '⭐', coconut: '🥥', parrot: '🦜', pearl: '🫧', seven: '7' };

/**
 * Island Reels (the Grand Casino's slots): one line, three reels. The server draws the prize first and deals the reels to
 * show it (3 of a kind = that symbol's prize); the spin is just the reveal, and the reels stop in order at a fixed pace
 * (no slowed-down "near miss" teases).
 */
export function IslandReels() {
  const stake = useGame((s) => s.stake);
  const busy = useGame((s) => s.busy);
  const bet = useGame((s) => s.bet);
  const finish = useGame((s) => s.finish);
  const vip = useGame((s) => s.scene === 'vip');
  // The server's paytable (the rules mirror if it's missing).
  const tiers = useGame((s) => s.meta('island-reels')?.paytable.tiers) ?? REELS_TABLE;
  const pays = (k: string) => tiers.find((t) => t.key === k)?.multiplier ?? 0;
  const [shown, setShown] = useState(['seven', 'coconut', 'shell']);
  const [spinning, setSpinning] = useState([false, false, false]);
  const [round, setRound] = useState<RoundView | null>(null);
  const [lever, setLever] = useState(false);
  const spinRef = useRef(spinning);
  spinRef.current = spinning;

  // While a reel spins, flick its symbol every 70 ms.
  useEffect(() => {
    if (!spinning.some(Boolean)) return;
    const id = setInterval(() => {
      setShown((s) => s.map((v, i) => (spinRef.current[i] ? REEL_SYMBOLS[Math.floor(Math.random() * REEL_SYMBOLS.length)] : v)));
      sound.play('spin');
    }, 70);
    return () => clearInterval(id);
  }, [spinning]);

  const spin = async () => {
    if (busy || spinning.some(Boolean)) return;
    setRound(null);
    setLever(true);
    setTimeout(() => setLever(false), 300);
    setSpinning([true, true, true]);
    const s = await bet({ game: 'island-reels', stake });
    if (!s?.round) {
      setSpinning([false, false, false]);
      return;
    }
    const reels: string[] = s.round.outcome.reels;
    for (let i = 0; i < 3; i++) {
      await wait(i === 0 ? 520 : 320);
      setShown((v) => v.map((x, k) => (k === i ? reels[i] : x)));
      setSpinning((v) => v.map((x, k) => (k === i ? false : x)));
      sound.play('thud');
    }
    setRound(s.round);
    await wait(200);
    finish(s);
  };

  const live = spinning.some(Boolean);
  const winSym: string | null = round?.outcome?.symbol ?? null;

  return (
    <Shell
      game="island-reels"
      live={live}
      footer={
        <>
          <StakePicker disabled={live} />
          <button className="btn btn-gold btn-wide" disabled={busy || live} onClick={() => void spin()}>
            {live ? 'Spinning…' : 'Spin'}
          </button>
        </>
      }
    >
      <div className={`reels-cab${vip ? ' gold' : ''}`}>
        <div className="reels-marquee">{vip ? '✨ GOLDEN REELS ✨' : '🌴 ISLAND REELS 🌴'}</div>
        <div className={`reels-window${winSym ? ' win' : ''}`}>
          {shown.map((sym, i) => (
            <div key={i} className={`reel${spinning[i] ? ' spinning' : ' stopped'}`}>
              <span className={`sym s-${sym}`}>{REEL_ICON[sym]}</span>
            </div>
          ))}
          <i className="payline" />
        </div>
        <button className={`reels-lever${lever ? ' pull' : ''}`} onClick={() => void spin()} disabled={busy || live} aria-label="Pull the lever" />
        <div className="reels-pay">
          {[...REEL_SYMBOLS].reverse().map((k) => (
            <span key={k} className={winSym === k ? 'hit' : ''}>
              <i className={`sym s-${k}`}>{REEL_ICON[k]}</i>×3 = ×{pays(k)}
            </span>
          ))}
        </div>
      </div>
      <Result round={round} text={live ? 'Good luck!' : `Three of a kind on the line wins — up to ×${pays('seven')}`} />
    </Shell>
  );
}


import { useEffect, useRef, useState } from 'react';
import { VAULT_PAYS } from '../api/rules.ts';
import type { RoundView } from '../api/types.ts';
import { useGame } from '../store/game.ts';
import { sound } from '../ui/sound.ts';
import { Result, Shell, StakePicker, wait } from './GameOverlay.tsx';

/**
 * Ice Vault (Frost Isle): dial a 3-digit code. The vault's code is three fair digits drawn by the server; every digit
 * in the right place counts: 1 pays ×2, 2 pay ×12, all three crack the vault for ×150. The dials spinning to a stop is
 * the reveal.
 */
export function IceVault() {
  const pays = (useGame((s) => s.meta('ice-vault')?.paytable.pays) ?? VAULT_PAYS) as number[];
  const stake = useGame((s) => s.stake);
  const busy = useGame((s) => s.busy);
  const bet = useGame((s) => s.bet);
  const finish = useGame((s) => s.finish);
  const [code, setCode] = useState([1, 2, 3]);
  const [shown, setShown] = useState<(number | null)[]>([null, null, null]);
  const [spinning, setSpinning] = useState<boolean[]>([false, false, false]);
  const [cracking, setCracking] = useState(false);
  const [round, setRound] = useState<RoundView | null>(null);
  const seq = useRef(0);
  useEffect(() => () => void (seq.current = -1), []);

  const turn = (i: number, d: number) => {
    sound.play('click');
    setRound(null);
    setShown([null, null, null]);
    setCode(code.map((v, k) => (k === i ? (v + d + 10) % 10 : v)));
  };

  const crack = async () => {
    if (cracking || busy) return;
    const my = ++seq.current;
    setRound(null);
    setShown([null, null, null]);
    const s = await bet({ game: 'ice-vault', stake, choice: code[0] * 100 + code[1] * 10 + code[2] });
    if (!s?.round || my !== seq.current) return;
    const vault: number[] = s.round.outcome.code;
    setCracking(true);
    setSpinning([true, true, true]);
    const tick = window.setInterval(() => sound.play('click'), 90);
    for (let i = 0; i < 3; i++) {
      await wait(i === 0 ? 900 : 650);
      if (my !== seq.current) return clearInterval(tick);
      setSpinning((sp) => sp.map((v, k) => (k === i ? false : v)));
      setShown((sh) => sh.map((v, k) => (k === i ? vault[i] : v)));
      sound.play(vault[i] === code[i] ? 'ding' : 'thud');
    }
    clearInterval(tick);
    await wait(500);
    if (my !== seq.current) return;
    setCracking(false);
    setRound(s.round);
    if (s.round.outcome.matches === 3) sound.play('door');
    finish(s);
  };

  const matches: number = round?.outcome?.matches ?? 0;
  const open = round != null && matches === 3;
  return (
    <Shell
      game="ice-vault"
      live={cracking}
      footer={
        <>
          <StakePicker disabled={cracking} />
          <div className="row vault-row">
            <button className="btn btn-plain" disabled={cracking} onClick={() => { sound.play('tick'); setRound(null); setShown([null, null, null]); setCode([0, 1, 2].map(() => Math.floor(Math.random() * 10))); }}>
              🎲 Random
            </button>
            <button className="btn btn-gold vault-go" disabled={cracking || busy} onClick={() => void crack()}>
              {cracking ? 'Cracking…' : `Crack ${code.join('')}`}
            </button>
          </div>
        </>
      }
    >
      <div className={`vault${open ? ' open' : ''}`}>
        <div className="vault-door">
          <div className="dials">
            {code.map((d, i) => {
              const v = shown[i];
              const state = v == null ? '' : v === d ? ' right' : ' wrong';
              return (
                <div key={i} className={`dial${state}${spinning[i] ? ' spin' : ''}`}>
                  <button className="up" disabled={cracking} onClick={() => turn(i, 1)} aria-label={`Digit ${i + 1} up`}>▲</button>
                  <div className="digits">
                    <b>{d}</b>
                    <span className="theirs">{spinning[i] ? <i className="roll">0123456789</i> : v ?? '·'}</span>
                  </div>
                  <button className="down" disabled={cracking} onClick={() => turn(i, -1)} aria-label={`Digit ${i + 1} down`}>▼</button>
                </div>
              );
            })}
          </div>
          <p className="vault-key">Your code above · the vault’s below</p>
        </div>
        <div className="vault-pays">
          {[1, 2, 3].map((n) => (
            <span key={n} className={round && matches === n ? 'hit' : ''}>
              {n} right <b>×{pays[n]}</b>
            </span>
          ))}
        </div>
      </div>
      <Result round={round} text={cracking ? 'Click… click… click…' : 'Each digit in the right place counts'} />
    </Shell>
  );
}

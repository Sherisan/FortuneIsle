import { useEffect, useRef, useState } from 'react';
import { CORAL_POCKETS, CORAL_ROWS } from '../api/rules.ts';
import type { RoundView } from '../api/types.ts';
import { useGame } from '../store/game.ts';
import { sound } from '../ui/sound.ts';
import { fmtX, Result, Shell, StakePicker, wait } from './GameOverlay.tsx';

/**
 * Coral Drop (Coral Lagoon): plinko. A pearl falls through 8 rows of coral; at each it bounces left or right (the
 * server's draws) and lands in the pocket matching its number of rights. Calm waters pay steadily; wild waters pay big
 * at the edges. The animation follows the server's path exactly.
 */
export function CoralDrop() {
  const pt = useGame((s) => s.meta('coral-drop')?.paytable);
  const rows = pt?.rows ?? CORAL_ROWS;
  const pockets = pt?.pockets ?? CORAL_POCKETS;
  const stake = useGame((s) => s.stake);
  const busy = useGame((s) => s.busy);
  const bet = useGame((s) => s.bet);
  const finish = useGame((s) => s.finish);
  const [mode, setMode] = useState<'calm' | 'wild'>('calm');
  const [dropping, setDropping] = useState(false);
  const [round, setRound] = useState<RoundView | null>(null);
  /** The pearl: row (−1 above the board … rows = in a pocket) and its column offset (the rights so far). */
  const [pearl, setPearl] = useState<{ row: number; rights: number; hop: number } | null>(null);
  const [lit, setLit] = useState<number | null>(null);
  const [glow, setGlow] = useState<string | null>(null);
  const seq = useRef(0);
  useEffect(() => () => void (seq.current = -1), []);
  const table = pockets[mode === 'wild' ? 1 : 0];

  const drop = async () => {
    if (dropping || busy) return;
    const my = ++seq.current;
    setRound(null);
    setLit(null);
    setGlow(null);
    const s = await bet({ game: 'coral-drop', stake, mode });
    if (!s?.round || my !== seq.current) return;
    const path: number[] = s.round.outcome.path;
    setDropping(true);
    setPearl({ row: -1, rights: 0, hop: 0 });
    await wait(260);
    let rights = 0;
    for (let row = 0; row < rows; row++) {
      if (my !== seq.current) return;
      setPearl({ row, rights, hop: row });
      setGlow(`${row}:${rights}`);
      sound.play('tick');
      await wait(230);
      rights += path[row];
    }
    if (my !== seq.current) return;
    setPearl({ row: rows, rights, hop: rows });
    await wait(260);
    setLit(rights);
    setDropping(false);
    setRound(s.round);
    sound.play('splash');
    finish(s);
  };

  // Board geometry (in % of the board box): row r has r + 1 pegs (row 0 = 1 peg … rows − 1 = rows pegs); pockets below.
  const W = 100 / (rows + 1);
  const pegX = (row: number, i: number) => 50 + (i - row / 2) * W;
  const rowY = (row: number) => 8 + row * (78 / rows);
  const pocketX = (k: number) => 50 + (k - rows / 2) * W;
  // The pearl sits just above the peg it's about to hit (or in its pocket).
  const pearlXY = pearl
    ? pearl.row < 0
      ? { x: 50, y: 0 }
      : pearl.row >= rows
        ? { x: pocketX(pearl.rights), y: 93 }
        : { x: pegX(pearl.row, pearl.rights), y: rowY(pearl.row) - 4.5 }
    : null;

  return (
    <Shell
      game="coral-drop"
      live={dropping}
      footer={
        <>
          <div className="seg" role="radiogroup" aria-label="Waters">
            {(['calm', 'wild'] as const).map((m) => (
              <button key={m} role="radio" aria-checked={mode === m} className={mode === m ? 'on' : ''} disabled={dropping} onClick={() => { sound.play('tick'); setMode(m); }}>
                {m === 'calm' ? '🌊 Calm waters' : '🌪️ Wild waters'}
              </button>
            ))}
          </div>
          <StakePicker disabled={dropping} />
          <button className="btn btn-gold btn-wide" disabled={dropping || busy} onClick={() => void drop()}>
            {dropping ? 'Bouncing…' : 'Drop the pearl'}
          </button>
        </>
      }
    >
      <div className={`cd-board ${mode}`}>
        {Array.from({ length: rows }, (_, row) =>
          Array.from({ length: row + 1 }, (_, i) => (
            <i key={`${row}-${i}`} className={`cd-peg${glow === `${row}:${i}` ? ' hit' : ''}`} style={{ left: `${pegX(row, i)}%`, top: `${rowY(row)}%` }} />
          )),
        )}
        {pearlXY && <span className="cd-pearl" style={{ left: `${pearlXY.x}%`, top: `${pearlXY.y}%` }} />}
        <div className="cd-pockets">
          {table.map((m, k) => (
            <span key={k} className={`cd-pocket${lit === k ? ' lit' : ''}${m >= 5 ? ' top' : m >= 1.5 ? ' good' : m < 1 ? ' low' : ''}`}>
              {fmtX(m).replace('×', '')}
            </span>
          ))}
        </div>
        <i className="cd-weed w1" />
        <i className="cd-weed w2" />
      </div>
      <Result round={round} text={dropping ? 'Boing… boing…' : mode === 'calm' ? `Calm: steady pays, edges ×${table[0]}` : `Wild: mostly small, edges ×${table[0]}!`} />
    </Shell>
  );
}

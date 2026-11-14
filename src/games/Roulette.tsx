import { useState } from 'react';
import { colorOf } from '../api/rules.ts';
import type { RouletteBet, RoundView } from '../api/types.ts';
import { money, useGame } from '../store/game.ts';
import { sound } from '../ui/sound.ts';
import { Result, Shell, wait } from './GameOverlay.tsx';

/** European wheel order, clockwise from zero. */
const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const ALL = range(1, 36);

interface Spot {
  key: string;
  type: string;
  numbers: number[];
  label: string;
}

const OUTSIDE: Spot[] = [
  { key: 'low', type: 'evenMoney', numbers: range(1, 18), label: '1–18' },
  { key: 'even', type: 'evenMoney', numbers: ALL.filter((n) => n % 2 === 0), label: 'EVEN' },
  { key: 'red', type: 'evenMoney', numbers: ALL.filter((n) => colorOf(n) === 'red'), label: '◆' },
  { key: 'black', type: 'evenMoney', numbers: ALL.filter((n) => colorOf(n) === 'black'), label: '◆' },
  { key: 'odd', type: 'evenMoney', numbers: ALL.filter((n) => n % 2 === 1), label: 'ODD' },
  { key: 'high', type: 'evenMoney', numbers: range(19, 36), label: '19–36' },
];
const DOZENS: Spot[] = [0, 1, 2].map((k) => ({ key: `d${k}`, type: 'dozen', numbers: range(12 * k + 1, 12 * k + 12), label: `${['1st', '2nd', '3rd'][k]} 12` }));
const COLUMNS: Spot[] = [3, 2, 1].map((r) => ({ key: `c${r}`, type: 'column', numbers: ALL.filter((n) => n % 3 === r % 3), label: '2:1' }));
const straight = (n: number): Spot => ({ key: `n${n}`, type: 'straight', numbers: [n], label: String(n) });

/** Roulette (Grand Casino): European single zero; straight, column, dozen and even-money bets. */
export function Roulette() {
  const info = useGame((s) => s.info)!;
  const busy = useGame((s) => s.busy);
  const balance = useGame((s) => s.balance);
  const bet = useGame((s) => s.bet);
  const finish = useGame((s) => s.finish);
  const [chip, setChip] = useState(info.chips[1] ?? info.chips[0]);
  const [bets, setBets] = useState<Record<string, { spot: Spot; amount: number }>>({});
  const [history, setHistory] = useState<string[]>([]);
  const [rot, setRot] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [round, setRound] = useState<RoundView | null>(null);
  const [last, setLast] = useState<Record<string, { spot: Spot; amount: number }> | null>(null);
  const total = Object.values(bets).reduce((s, b) => s + b.amount, 0);
  const pocket: number | null = round?.outcome?.pocket ?? null;

  const place = (spot: Spot) => {
    if (spinning) return;
    if (round) setRound(null);
    if (total + chip > info.maxBet) return useGame.getState().toast(`The table limit is ${money(info.maxBet, info.currency)} per spin.`, 'info');
    if (!bets[spot.key] && Object.keys(bets).length >= 30) return;
    sound.play('chip');
    setBets((b) => ({ ...b, [spot.key]: { spot, amount: (b[spot.key]?.amount ?? 0) + chip } }));
    setHistory((h) => [...h, spot.key]);
  };
  const undo = () => {
    const k = history[history.length - 1];
    if (!k) return;
    setHistory((h) => h.slice(0, -1));
    setBets((b) => {
      const next = { ...b };
      const a = next[k].amount - chip;
      if (a <= 0) delete next[k];
      else next[k] = { ...next[k], amount: a };
      return next;
    });
  };

  const spin = async () => {
    if (spinning || busy || total <= 0) return;
    const list: RouletteBet[] = Object.values(bets).map((b) => ({ type: b.spot.type, numbers: b.spot.numbers, amount: b.amount }));
    setRound(null);
    const s = await bet({ game: 'roulette', stake: total, bets: list });
    if (!s?.round) return;
    const p: number = s.round.outcome.pocket;
    setSpinning(true);
    const step = 360 / 37;
    const want = 360 - ORDER.indexOf(p) * step;
    const next = rot - (rot % 360) + 360 * 5 + (((want % 360) + 360) % 360);
    setRot(next);
    await wait(4200);
    sound.play('ding');
    setSpinning(false);
    setRound(s.round);
    setLast(bets);
    setBets({});
    setHistory([]);
    finish(s);
  };

  const cell = (spot: Spot, cls = '') => {
    const b = bets[spot.key];
    const won = pocket != null && last?.[spot.key] && spot.numbers.includes(pocket);
    return (
      <button key={spot.key} className={`rc ${cls}${won ? ' won' : ''}${pocket != null && spot.type === 'straight' && spot.numbers[0] === pocket ? ' hit' : ''}`} onClick={() => place(spot)} disabled={spinning}>
        {spot.label}
        {b && <span className="stack">{b.amount}</span>}
      </button>
    );
  };

  const R = 120;
  return (
    <Shell
      game="roulette"
      live={spinning}
      footer={
        <div className="roul-foot">
          <div className="chips">
            {info.chips.map((c) => (
              <button key={c} className={`chip c${c}${chip === c ? ' on' : ''}`} onClick={() => setChip(c)} disabled={spinning}>
                {c}
              </button>
            ))}
          </div>
          <div className="row">
            <button className="btn btn-plain" disabled={spinning || !history.length} onClick={undo}>Undo</button>
            <button className="btn btn-plain" disabled={spinning || !total} onClick={() => { setBets({}); setHistory([]); }}>Clear</button>
            <button className="btn btn-plain" disabled={spinning || !last || total > 0} onClick={() => last && setBets(last)}>Rebet</button>
            <button className="btn btn-gold" disabled={spinning || busy || !total || total > balance} onClick={() => void spin()}>
              Spin {total > 0 ? money(total, info.currency) : ''}
            </button>
          </div>
        </div>
      }
    >
      <div className="roulette">
        <div className="rwheel-wrap">
          <div className="rball" />
          <svg className="rwheel" viewBox="-130 -130 260 260" style={{ transform: `rotate(${rot}deg)`, transition: spinning ? 'transform 4s cubic-bezier(.15,.65,.1,1)' : 'none' }}>
            <circle r="128" fill="#6b4428" stroke="#2c1d3f" strokeWidth="4" />
            {ORDER.map((n, i) => {
              const step = (Math.PI * 2) / 37;
              const a0 = i * step - Math.PI / 2 - step / 2, a1 = a0 + step;
              const am = (a0 + a1) / 2;
              const c = colorOf(n);
              return (
                <g key={n}>
                  <path d={`M0 0 L${Math.cos(a0) * R} ${Math.sin(a0) * R} A${R} ${R} 0 0 1 ${Math.cos(a1) * R} ${Math.sin(a1) * R} Z`} fill={c === 'green' ? '#2fc36f' : c === 'red' ? '#e5394b' : '#2c1d3f'} stroke="#f2c14e" strokeWidth="1" />
                  <text x={Math.cos(am) * 106} y={Math.sin(am) * 106} transform={`rotate(${(am * 180) / Math.PI + 90} ${Math.cos(am) * 106} ${Math.sin(am) * 106})`} textAnchor="middle" dominantBaseline="middle" className="rnum">
                    {n}
                  </text>
                </g>
              );
            })}
            <circle r="62" fill="#8a5a33" stroke="#2c1d3f" strokeWidth="3" />
            <circle r="24" fill="#f2c14e" stroke="#2c1d3f" strokeWidth="3" />
          </svg>
          {pocket != null && !spinning && <div className={`rresult ${colorOf(pocket)}`}>{pocket}</div>}
        </div>
        <div className="rboard">
          <div className="rgrid">
            <button className={`rc zero${pocket === 0 && !spinning ? ' hit' : ''}`} onClick={() => place(straight(0))} disabled={spinning}>
              0{bets.n0 && <span className="stack">{bets.n0.amount}</span>}
            </button>
            {[3, 2, 1].map((row) => (
              <div key={row} className="rrow">
                {range(0, 11).map((c) => {
                  const n = c * 3 + row;
                  return cell(straight(n), colorOf(n));
                })}
                {cell(COLUMNS[3 - row], 'col')}
              </div>
            ))}
          </div>
          <div className="rdozens">{DOZENS.map((d) => cell(d, 'out'))}</div>
          <div className="routside">{OUTSIDE.map((o) => cell(o, `out ${o.key}`))}</div>
        </div>
      </div>
      <Result round={round} text={spinning ? 'No more bets!' : total ? `Total bet ${money(total, info.currency)}` : 'Tap the table to place chips'} />
    </Shell>
  );
}

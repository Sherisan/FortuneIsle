import { useRef, useState } from 'react';
import { DIAMOND_SEGMENTS, GEM_PAYS, GEMS } from '../api/rules.ts';
import type { RoundView } from '../api/types.ts';
import { useGame } from '../store/game.ts';
import { sound } from '../ui/sound.ts';
import { Result, Shell, StakePicker, wait } from './GameOverlay.tsx';

export const GEM_ICON: Record<string, string> = { pearl: '⚪', sapphire: '🔷', ruby: '❤️', emerald: '💚', diamond: '💎' };
export const GEM_NAME: Record<string, string> = { pearl: 'Pearl', sapphire: 'Sapphire', ruby: 'Ruby', emerald: 'Emerald', diamond: 'Diamond' };
const GEM_FILL: Record<string, string> = { pearl: '#fff6fb', sapphire: '#3e6fd6', ruby: '#e5394b', emerald: '#2fc36f', diamond: '#9fe9ff' };

/**
 * Diamond Wheel (the VIP Salon): a 24-segment money wheel of gems. Back a gem; if the pointer stops on it you win its
 * price: the fewer segments a gem has, the more it pays (every gem returns the same 96%).
 */
export function DiamondWheel() {
  const pt = useGame((s) => s.meta('diamond-wheel')?.paytable);
  const segs = pt?.segments ?? DIAMOND_SEGMENTS;
  const gems = pt?.gems ?? GEMS;
  const pays = pt?.pays ?? GEM_PAYS;
  const stake = useGame((s) => s.stake);
  const busy = useGame((s) => s.busy);
  const bet = useGame((s) => s.bet);
  const finish = useGame((s) => s.finish);
  const [gem, setGem] = useState(0);
  const [rot, setRot] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [round, setRound] = useState<RoundView | null>(null);
  const [hit, setHit] = useState<number | null>(null);
  const ticker = useRef<number | null>(null);
  const n = segs.length;
  const step = 360 / n;
  const count = (g: number) => segs.filter((x) => x === g).length;

  const spin = async () => {
    if (spinning || busy) return;
    setRound(null);
    setHit(null);
    const s = await bet({ game: 'diamond-wheel', stake, choice: gem });
    if (!s?.round) return;
    const seg: number = s.round.outcome.segment;
    setSpinning(true);
    const jitter = (Math.random() - 0.5) * step * 0.5;
    const want = 360 - (seg * step + step / 2) + jitter;
    const base = rot - (rot % 360);
    setRot(base + 360 * 7 + (((want % 360) + 360) % 360));
    let gap = 35;
    const tick = () => {
      sound.play('click');
      gap *= 1.11;
      if (gap < 650) ticker.current = window.setTimeout(tick, gap);
    };
    tick();
    await wait(4600);
    if (ticker.current) clearTimeout(ticker.current);
    setSpinning(false);
    setHit(seg);
    setRound(s.round);
    if (s.round.payout > 0) sound.play('chime');
    finish(s);
  };

  const r = 140;
  const landed: string | undefined = round?.outcome?.gem;
  return (
    <Shell
      game="diamond-wheel"
      live={spinning}
      footer={
        <>
          <StakePicker disabled={spinning} />
          <button className="btn btn-gold btn-wide" disabled={spinning || busy} onClick={() => void spin()}>
            {spinning ? 'Spinning…' : `Spin on the ${GEM_NAME[gems[gem]]}`}
          </button>
        </>
      }
    >
      <div className="dw">
        <div className="dw-gems" role="radiogroup" aria-label="Your gem">
          {gems.map((g, i) => (
            <button
              key={g}
              role="radio"
              aria-checked={gem === i}
              className={`dw-gem${gem === i ? ' on' : ''}${landed === g && round ? ' landed' : ''}`}
              disabled={spinning}
              onClick={() => {
                sound.play('chip');
                setGem(i);
              }}
            >
              <span>{GEM_ICON[g]}</span>
              <b>×{pays[i]}</b>
              <small>{count(i)} of {n}</small>
            </button>
          ))}
        </div>
        <div className="wheel-wrap dw-wheel">
          <div className="wheel-pointer" />
          <div className="wheel-clip">
            <svg className="wheel" viewBox="-160 -160 320 320" style={{ transform: `rotate(${rot}deg)`, transition: spinning ? 'transform 4.5s cubic-bezier(.12,.7,.1,1)' : 'none' }}>
              <circle r="156" fill="#2c1d3f" />
              {segs.map((g, i) => {
                const a0 = ((i * step - 90) * Math.PI) / 180, a1 = (((i + 1) * step - 90) * Math.PI) / 180;
                const am = (a0 + a1) / 2;
                const key = gems[g];
                return (
                  <g key={i} className={`${hit === i ? 'hit' : ''}${g === gem ? ' mine' : ''}`}>
                    <path d={`M0 0 L${Math.cos(a0) * r} ${Math.sin(a0) * r} A${r} ${r} 0 0 1 ${Math.cos(a1) * r} ${Math.sin(a1) * r} Z`} fill={GEM_FILL[key]} stroke="#2c1d3f" strokeWidth="3" />
                    <text x={Math.cos(am) * r * 0.74} y={Math.sin(am) * r * 0.74} textAnchor="middle" dominantBaseline="middle" fontSize="17">
                      {GEM_ICON[key]}
                    </text>
                  </g>
                );
              })}
              {Array.from({ length: n }, (_, i) => {
                const a = ((i * step - 90) * Math.PI) / 180;
                return <circle key={i} cx={Math.cos(a) * 148} cy={Math.sin(a) * 148} r="3.5" fill="#ffe27a" />;
              })}
              <circle r="30" fill="#ffd23f" stroke="#2c1d3f" strokeWidth="4" />
              <text textAnchor="middle" dominantBaseline="middle" fontSize="26">💎</text>
            </svg>
          </div>
        </div>
      </div>
      <Result round={round} text={spinning ? 'The gems are a blur…' : `${GEM_NAME[gems[gem]]}: ${count(gem)} of ${n} segments · pays ×${pays[gem]}`} />
    </Shell>
  );
}

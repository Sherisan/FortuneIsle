import { useRef, useState } from 'react';
import type { RoundView } from '../api/types.ts';
import { useGame } from '../store/game.ts';
import { sound } from '../ui/sound.ts';
import { Result, Shell, StakePicker, wait } from './GameOverlay.tsx';

const COLORS: Record<string, string> = { '0': '#5b3d8f', '1': '#3e8ef7', '1.5': '#2fc36f', '3': '#ff8a2a', '5.2': '#ffd23f' };
const colorFor = (m: number) => COLORS[String(m)] ?? (m >= 5 ? '#ffd23f' : m >= 2 ? '#ff8a2a' : m > 0 ? '#3e8ef7' : '#5b3d8f');

/** Prize Wheel (Fairground): 20 equal segments; the wheel lands where the server's draw says. */
export function PrizeWheel() {
  const segs = useGame((s) => (s.meta('prize-wheel')?.paytable.segments ?? []) as number[]);
  const stake = useGame((s) => s.stake);
  const busy = useGame((s) => s.busy);
  const bet = useGame((s) => s.bet);
  const finish = useGame((s) => s.finish);
  const [rot, setRot] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [round, setRound] = useState<RoundView | null>(null);
  const [hit, setHit] = useState<number | null>(null);
  const ticker = useRef<number | null>(null);
  const n = segs.length || 20;
  const step = 360 / n;

  const spin = async () => {
    if (spinning || busy) return;
    setRound(null);
    setHit(null);
    const s = await bet({ game: 'prize-wheel', stake });
    if (!s?.round) return;
    const seg: number = s.round.outcome.segment;
    setSpinning(true);
    // Segment i is centred at i·step + step/2 clockwise from the top; turn so it ends under the pointer.
    const jitter = (Math.random() - 0.5) * step * 0.6;
    const want = 360 - (seg * step + step / 2) + jitter;
    const base = rot - (rot % 360);
    const next = base + 360 * 6 + ((want % 360) + 360) % 360;
    setRot(next);
    let gap = 40;
    const tick = () => {
      sound.play('spin');
      gap *= 1.12;
      if (gap < 600) ticker.current = window.setTimeout(tick, gap);
    };
    tick();
    await wait(4300);
    if (ticker.current) clearTimeout(ticker.current);
    setSpinning(false);
    setHit(seg);
    setRound(s.round);
    finish(s);
  };

  const r = 140;
  return (
    <Shell
      game="prize-wheel"
      live={spinning}
      footer={
        <>
          <StakePicker disabled={spinning} />
          <button className="btn btn-gold btn-wide" disabled={spinning || busy} onClick={() => void spin()}>
            Spin!
          </button>
        </>
      }
    >
      <div className="wheel-wrap">
        <div className="wheel-pointer" />
        {/* The clip keeps the turning square's corners from overflowing the stage (which flashed a scrollbar and shifted the wheel). */}
        <div className="wheel-clip">
        <svg className="wheel" viewBox="-160 -160 320 320" style={{ transform: `rotate(${rot}deg)`, transition: spinning ? 'transform 4.2s cubic-bezier(.12,.7,.1,1)' : 'none' }}>
          <circle r="156" fill="#2c1d3f" />
          {segs.map((m, i) => {
            const a0 = ((i * step - 90) * Math.PI) / 180, a1 = (((i + 1) * step - 90) * Math.PI) / 180;
            const am = (a0 + a1) / 2;
            return (
              <g key={i} className={hit === i ? 'hit' : ''}>
                <path d={`M0 0 L${Math.cos(a0) * r} ${Math.sin(a0) * r} A${r} ${r} 0 0 1 ${Math.cos(a1) * r} ${Math.sin(a1) * r} Z`} fill={colorFor(m)} stroke="#2c1d3f" strokeWidth="3" />
                <text
                  x={Math.cos(am) * r * 0.7}
                  y={Math.sin(am) * r * 0.7}
                  transform={`rotate(${(am * 180) / Math.PI + 90} ${Math.cos(am) * r * 0.7} ${Math.sin(am) * r * 0.7})`}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="wheel-label"
                  fill={m >= 5 ? '#2c1d3f' : '#fff'}
                >
                  {m === 0 ? '✕' : `×${m}`}
                </text>
              </g>
            );
          })}
          {Array.from({ length: n }, (_, i) => {
            const a = ((i * step - 90) * Math.PI) / 180;
            return <circle key={i} cx={Math.cos(a) * 148} cy={Math.sin(a) * 148} r="4" fill="#fff3b0" />;
          })}
          <circle r="26" fill="#ffd23f" stroke="#2c1d3f" strokeWidth="4" />
          <circle r="9" fill="#ff5b6e" stroke="#2c1d3f" strokeWidth="3" />
        </svg>
        </div>
      </div>
      <Result round={round} text={spinning ? 'Round and round…' : 'Every segment is equally likely · top prize ×5.2'} />
    </Shell>
  );
}

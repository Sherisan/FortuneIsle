import { useEffect, useRef, useState } from 'react';
import type { RoundView, State } from '../api/types.ts';
import { useGame } from '../store/game.ts';
import { sound } from '../ui/sound.ts';
import { Result, Shell, StakePicker } from './GameOverlay.tsx';

export const SCRATCH_ICON: Record<string, string> = { shell: '🐚', starfish: '⭐', coconut: '🥥', parrot: '🦜', pearl: '🫧', treasure: '💰' };

/** Scratch Kiosk (Boardwalk): buy a card, scratch the foil (or Reveal all); three of a kind wins that symbol's prize. */
export function ScratchKiosk() {
  const stake = useGame((s) => s.stake);
  const busy = useGame((s) => s.busy);
  const bet = useGame((s) => s.bet);
  const finish = useGame((s) => s.finish);
  const [state, setState] = useState<State | null>(null);
  const [revealed, setRevealed] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const done = useRef(false);
  const round: RoundView | null = state?.round ?? null;
  const card: string[] | null = round?.outcome?.card ?? null;
  const winSymbol: string | null = round?.outcome?.symbol ?? null;

  const buy = async () => {
    if (busy || (state && !revealed)) return;
    setRevealed(false);
    done.current = false;
    const s = await bet({ game: 'scratch-kiosk', stake });
    if (s?.round) setState(s);
  };

  const reveal = () => {
    if (!state || done.current) return;
    done.current = true;
    setRevealed(true);
    finish(state);
  };

  // Foil layer.
  useEffect(() => {
    if (!card) return;
    const cv = canvas.current!;
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = r.width * dpr;
    cv.height = r.height * dpr;
    const ctx = cv.getContext('2d')!;
    ctx.scale(dpr, dpr);
    const g = ctx.createLinearGradient(0, 0, r.width, r.height);
    g.addColorStop(0, '#d9dee8');
    g.addColorStop(0.5, '#f4f6fb');
    g.addColorStop(1, '#b9c0cf');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, r.width, r.height);
    ctx.fillStyle = 'rgba(44,29,63,.18)';
    ctx.font = '700 14px Fredoka, sans-serif';
    for (let y = 18; y < r.height; y += 34) for (let x = (y / 34) % 2 ? 10 : 40; x < r.width; x += 70) ctx.fillText('SCRATCH', x, y);
    ctx.globalCompositeOperation = 'destination-out';
    let down = false;
    let last: [number, number] | null = null;
    let scratched = 0;
    const pos = (e: PointerEvent): [number, number] => {
      const b = cv.getBoundingClientRect();
      return [e.clientX - b.left, e.clientY - b.top];
    };
    const draw = (p: [number, number]) => {
      ctx.lineCap = 'round';
      ctx.lineWidth = 34;
      ctx.beginPath();
      ctx.moveTo(...(last ?? p));
      ctx.lineTo(...p);
      ctx.stroke();
      last = p;
      scratched++;
      if (scratched % 6 === 0) sound.play('scratch');
      if (scratched % 10 === 0) {
        // Sample how much foil is gone.
        const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
        let clear = 0, total = 0;
        for (let i = 3; i < data.length; i += 4 * 97) { total++; if (data[i] === 0) clear++; }
        if (clear / total > 0.62) reveal();
      }
    };
    const onDown = (e: PointerEvent) => { down = true; last = null; cv.setPointerCapture(e.pointerId); draw(pos(e)); };
    const onMove = (e: PointerEvent) => down && draw(pos(e));
    const onUp = () => { down = false; last = null; };
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    return () => {
      cv.removeEventListener('pointerdown', onDown);
      cv.removeEventListener('pointermove', onMove);
      cv.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round?.id]);

  const scratching = !!state && !revealed;

  return (
    <Shell
      game="scratch-kiosk"
      live={busy}
      footer={
        <>
          <StakePicker disabled={scratching} />
          {scratching ? (
            <button className="btn btn-sky btn-wide" onClick={reveal}>Reveal all</button>
          ) : (
            <button className="btn btn-gold btn-wide" disabled={busy} onClick={() => void buy()}>
              Buy a card
            </button>
          )}
        </>
      }
    >
      <div className="scratch">
        <div className="ticket">
          <div className="ticket-head">ISLAND TREASURE · match 3</div>
          <div className="grid">
            {(card ?? Array(9).fill(null)).map((sym, i) => (
              <div key={i} className={`cell${revealed && sym === winSymbol ? ' win' : ''}`}>
                {sym ? SCRATCH_ICON[sym] : '?'}
              </div>
            ))}
            {card && !revealed && <canvas ref={canvas} className="foil" />}
            {!card && <div className="ticket-empty">Buy a card to play</div>}
          </div>
          <div className="ticket-pay">🐚1 ⭐2 🥥5 🦜10 🫧25 💰100</div>
        </div>
      </div>
      <Result round={revealed ? round : null} text={scratching ? 'Scratch the foil!' : 'Three of a kind wins — up to ×100'} />
    </Shell>
  );
}

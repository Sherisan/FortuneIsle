import { useEffect, useRef, useState } from 'react';
import { money, useGame } from '../store/game.ts';
import { sound } from './sound.ts';

/*
 * Win juice: particles in the player's chosen win effect (confetti, coin shower, fireworks, hearts), coins flying
 * into the balance pill, and a BIG WIN banner from ×10.
 */

interface P {
  x: number; y: number; vx: number; vy: number; r: number; rot: number; vr: number; c: string; life: number; kind: string;
}

const COLORS = ['#ff5b6e', '#ffd23f', '#4fc3ff', '#2fc36f', '#b07cff', '#ff8a3d'];

export function Celebration() {
  const c = useGame((s) => s.celebration);
  const currency = useGame((s) => s.info?.currency ?? 'ZAR');
  const canvas = useRef<HTMLCanvasElement>(null);
  const [coins, setCoins] = useState<{ id: number; x: number; y: number; dx: number; dy: number; delay: number }[]>([]);
  const [banner, setBanner] = useState<{ id: number; big: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!c) return;
    const cv = canvas.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = innerWidth * dpr;
    cv.height = innerHeight * dpr;
    const ctx = cv.getContext('2d')!;
    ctx.scale(dpr, dpr);
    const W = innerWidth, H = innerHeight;
    const parts: P[] = [];
    const kind = c.effect.replace('fx-', '');
    const n = Math.round((c.big ? 160 : 60) * (c.multiplier >= 3 ? 1.3 : 1));
    const burst = (x: number, y: number, count: number, speed: number) => {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random());
        parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (kind === 'fireworks' ? 0 : 4), r: 4 + Math.random() * 5, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, c: COLORS[i % COLORS.length], life: 1, kind });
      }
    };
    if (kind === 'fireworks') {
      for (let k = 0; k < (c.big ? 6 : 3); k++) setTimeout(() => { burst(W * (0.2 + Math.random() * 0.6), H * (0.2 + Math.random() * 0.3), 50, 7); sound.play('pop'); }, k * 280);
    } else burst(W / 2, H * 0.45, n, kind === 'coins' ? 9 : 11);
    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.vy += kind === 'fireworks' ? 0.12 : 0.28;
        p.vx *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= kind === 'fireworks' ? 0.012 : 0.006;
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5));
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        if (p.kind === 'coins') {
          ctx.fillStyle = '#ffd23f';
          ctx.strokeStyle = '#8a5a00';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.r + 3, (p.r + 3) * Math.abs(Math.cos(p.rot * 2)) + 1, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (p.kind === 'hearts') {
          ctx.fillStyle = p.c === '#ffd23f' ? '#ff9bc0' : '#ff5b9e';
          const s = p.r / 5;
          ctx.beginPath();
          ctx.moveTo(0, 3 * s);
          ctx.bezierCurveTo(-8 * s, -3 * s, -4 * s, -9 * s, 0, -4 * s);
          ctx.bezierCurveTo(4 * s, -9 * s, 8 * s, -3 * s, 0, 3 * s);
          ctx.fill();
        } else if (p.kind === 'fireworks') {
          ctx.fillStyle = p.c;
          ctx.beginPath();
          ctx.arc(0, 0, p.r * 0.6, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = p.c;
          ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
        }
        ctx.restore();
      }
      for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0 || parts[i].y > H + 40) parts.splice(i, 1);
      if (parts.length || performance.now() - t0 < 2000) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, W, H);
    };
    const t0 = performance.now();
    raf = requestAnimationFrame(tick);

    // Coins into the wallet.
    const pill = document.getElementById('balance-pill')?.getBoundingClientRect();
    if (pill) {
      const tx = pill.left + 22, ty = pill.top + pill.height / 2;
      const count = c.big ? 16 : Math.min(10, 4 + Math.round(c.multiplier));
      setCoins(Array.from({ length: count }, (_, i) => {
        const x = W / 2 + (Math.random() - 0.5) * 160, y = H * 0.5 + (Math.random() - 0.5) * 120;
        return { id: c.id * 100 + i, x, y, dx: tx - x, dy: ty - y, delay: i * 45 };
      }));
      for (let i = 0; i < Math.min(count, 8); i++) setTimeout(() => sound.play('coin'), 600 + i * 60);
      setTimeout(() => setCoins([]), 1600 + count * 45);
    }
    setBanner({ id: c.id, big: c.big, text: `${c.big ? 'BIG WIN!' : 'WIN!'} ${money(c.payout, currency)}` });
    const bt = setTimeout(() => setBanner(null), c.big ? 2600 : 1500);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(bt);
    };
  }, [c, currency]);

  return (
    <>
      <canvas ref={canvas} className="fx-canvas" />
      {coins.map((k) => (
        <span key={k.id} className="fly-coin" style={{ left: k.x, top: k.y, ['--dx' as string]: `${k.dx}px`, ['--dy' as string]: `${k.dy}px`, animationDelay: `${k.delay}ms` }} />
      ))}
      {banner && (
        <div key={banner.id} className={`win-banner${banner.big ? ' big' : ''}`}>
          {banner.text}
        </div>
      )}
    </>
  );
}

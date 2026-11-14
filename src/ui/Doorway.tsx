import { useEffect, useState } from 'react';
import { useGame } from '../store/game.ts';
import { world } from '../world/WorldView.tsx';
import { sound } from './sound.ts';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The doorway between the island and the Grand Casino: the entrance overlay going in, a quick fade coming out. */
export function Doorway() {
  const doorway = useGame((s) => s.doorway);
  if (doorway === 'enter') return <CasinoEntrance />;
  if (doorway === 'exit') return <ExitFade />;
  return null;
}

function CasinoEntrance() {
  const [phase, setPhase] = useState<'ask' | 'open' | 'through'>('ask');
  const close = () => useGame.setState({ doorway: null });

  const stepInside = async () => {
    if (phase !== 'ask') return;
    setPhase('open');
    sound.play('door');
    await wait(950);
    setPhase('through');
    sound.play('whoosh');
    await wait(520);
    world.engine?.enterScene('casino');
    await wait(480);
    close();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase === 'ask') close();
      if (e.key === 'Enter' && phase === 'ask') void stepInside();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className={`doorway ${phase}`} role="dialog" aria-label="Grand Casino entrance">
      <div className="facade">
        <div className="marquee">
          <span>GRAND CASINO</span>
        </div>
        <div className="arch">
          <div className="door-light">
            <i className="chand" />
          </div>
          <div className="door-l">
            <b />
          </div>
          <div className="door-r">
            <b />
          </div>
        </div>
        <div className="carpet" />
      </div>
      <div className="door-card">
        <h2>Welcome to the Grand Casino</h2>
        <p className="door-sub">European roulette · single zero · RTP 97.3%</p>
        <ul>
          <li>🎰 Two roulette tables</li>
          <li>🍸 The bar &amp; slot lounge</li>
          <li>💎 VIP lounge</li>
        </ul>
        <p className="door-legal"><b>18+</b> Play responsibly — your limits apply inside too.</p>
        <div className="row">
          <button className="btn btn-gold btn-big" onClick={() => void stepInside()} autoFocus>
            Step inside
          </button>
          <button className="btn btn-plain" onClick={close}>
            Not now
          </button>
        </div>
      </div>
      <div className="flash" />
    </div>
  );
}

function ExitFade() {
  const [phase, setPhase] = useState<'in' | 'out'>('in');
  useEffect(() => {
    let alive = true;
    void (async () => {
      sound.play('door');
      await wait(380);
      if (!alive) return;
      world.engine?.enterScene('island');
      setPhase('out');
      await wait(420);
      if (alive) useGame.setState({ doorway: null });
    })();
    return () => {
      alive = false;
    };
  }, []);
  return (
    <div className={`exit-fade ${phase}`}>
      <span>☀️ Back to the island…</span>
    </div>
  );
}

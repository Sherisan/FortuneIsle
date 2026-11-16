import { useEffect, useState, type ReactNode } from 'react';
import { useGame } from '../store/game.ts';
import { world } from '../world/WorldView.tsx';
import type { SceneKey } from '../world/map.ts';
import { sound } from './sound.ts';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** What each room's entrance overlay says. The facade is styled per room (.doorway.d-casino / d-vip / d-tavern). */
const ENTRANCES: Partial<Record<SceneKey, { marquee: string; title: string; sub: string; items: ReactNode[]; go: string }>> = {
  casino: {
    marquee: 'GRAND CASINO',
    title: 'Welcome to the Grand Casino',
    sub: 'Roulette 97.3% · Dragon Tiger & Island Reels 96%',
    items: ['🎰 Two roulette tables', '🍒 Island Reels', '🐉 Dragon Tiger', '💎 VIP Salon upstairs'],
    go: 'Step inside',
  },
  vip: {
    marquee: 'VIP SALON',
    title: 'Up to the VIP Salon',
    sub: 'Members from level 5 · same fair odds as the casino floor',
    items: ['✨ Golden reels', '🎰 Private roulette', '🐉 Dragon Tiger', '🥂 Champagne & piano'],
    go: 'Climb the stairs',
  },
  tavern: {
    marquee: '⚓ RUSTY ANCHOR',
    title: 'The Rusty Anchor',
    sub: 'Pirate Dice · crown & anchor · RTP 96%',
    items: ['🎲 Two Pirate Dice tables', '🍺 The bar', '🔥 A roaring hearth', '📜 Notice board'],
    go: 'Push the door',
  },
};

/** The doorway between two places: the building's entrance overlay going in, a quick fade coming out. */
export function Doorway() {
  const doorway = useGame((s) => s.doorway);
  if (!doorway) return null;
  if (doorway.kind === 'enter') return <Entrance to={doorway.to} />;
  return <ExitFade to={doorway.to} />;
}

function Entrance({ to }: { to: SceneKey }) {
  const [phase, setPhase] = useState<'ask' | 'open' | 'through'>('ask');
  const close = () => useGame.setState({ doorway: null });
  const e = ENTRANCES[to] ?? ENTRANCES.casino!;

  const stepInside = async () => {
    if (phase !== 'ask') return;
    setPhase('open');
    sound.play('door');
    await wait(950);
    setPhase('through');
    sound.play('whoosh');
    await wait(520);
    world.engine?.enterScene(to);
    await wait(480);
    close();
  };

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' && phase === 'ask') close();
      if (ev.key === 'Enter' && phase === 'ask') void stepInside();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className={`doorway d-${to} ${phase}`} role="dialog" aria-label={`${e.title} entrance`}>
      <div className="facade">
        <div className="marquee">
          <span>{e.marquee}</span>
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
        <h2>{e.title}</h2>
        <p className="door-sub">{e.sub}</p>
        <ul>
          {e.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
        <p className="door-legal"><b>18+</b> Play responsibly — your limits apply inside too.</p>
        <div className="row">
          <button className="btn btn-gold btn-big" onClick={() => void stepInside()} autoFocus>
            {e.go}
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

const EXIT_TEXT: Partial<Record<SceneKey, string>> = {
  island: '☀️ Back to the island…',
  casino: '🎰 Down to the casino floor…',
};

function ExitFade({ to }: { to: SceneKey }) {
  const [phase, setPhase] = useState<'in' | 'out'>('in');
  useEffect(() => {
    let alive = true;
    void (async () => {
      sound.play('door');
      await wait(380);
      if (!alive) return;
      world.engine?.enterScene(to);
      setPhase('out');
      await wait(420);
      if (alive) useGame.setState({ doorway: null });
    })();
    return () => {
      alive = false;
    };
  }, [to]);
  return (
    <div className={`exit-fade to-${to} ${phase}`}>
      <span>{EXIT_TEXT[to] ?? '…'}</span>
    </div>
  );
}

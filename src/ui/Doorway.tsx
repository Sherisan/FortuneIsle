import { useEffect, useState, type ReactNode } from 'react';
import type { ZoneKey } from '../api/types.ts';
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
    sub: 'Roulette · Dragon Tiger · Island Reels',
    items: ['🎰 Two roulette tables', '🍒 Island Reels', '🐉 Dragon Tiger', '💎 VIP Salon upstairs'],
    go: 'Step inside',
  },
  vip: {
    marquee: 'VIP SALON',
    title: 'Up to the VIP Salon',
    sub: 'Members from level 5 · home of the Diamond Wheel',
    items: ['💎 Diamond Wheel', '✨ Golden reels', '🎰 Private roulette', '🐉 Dragon Tiger', '🥂 Champagne & piano'],
    go: 'Climb the stairs',
  },
  tavern: {
    marquee: '⚓ RUSTY ANCHOR',
    title: 'The Rusty Anchor',
    sub: 'Pirate Dice · crown & anchor',
    items: ['🎲 Two Pirate Dice tables', '🍺 The bar', '🔥 A roaring hearth', '📜 Notice board'],
    go: 'Push the door',
  },
};

/** The doorway between two places: the building's entrance overlay going in, a quick fade coming out, or the ferry. */
export function Doorway() {
  const doorway = useGame((s) => s.doorway);
  if (!doorway) return null;
  if (doorway.kind === 'enter') return <Entrance to={doorway.to} />;
  if (doorway.kind === 'ferry') return <Ferry here={doorway.to} />;
  return <ExitFade to={doorway.to} />;
}

/** Where the Island Hopper goes. The isles open at their level; the Sky Kingdom is reached by airship. */
const ROUTES: { to: SceneKey; zone?: ZoneKey; name: string; icon: string; blurb: string; air?: boolean }[] = [
  { to: 'island', name: 'Fortune Isle', icon: '🏝️', blurb: 'Home: the Harbour, Boardwalk, Fairground, Grand Casino and more' },
  { to: 'lagoon', zone: 'lagoon', name: 'Coral Lagoon', icon: '🐚', blurb: 'Coral Drop · Seahorse Derby' },
  { to: 'frost', zone: 'frost', name: 'Frost Isle', icon: '❄️', blurb: 'Ice Fishing · Ice Vault' },
  { to: 'sky', zone: 'sky', name: 'Sky Kingdom', icon: '☁️', blurb: 'Star Keno · Oracle’s Chests', air: true },
];

/** The ferry's sailing chart: pick an isle, then a short voyage (by sea, or by airship to the sky) and you arrive. */
function Ferry({ here }: { here: SceneKey }) {
  const zones = useGame((s) => s.state?.player.zones ?? []);
  const info = useGame((s) => s.info);
  const [trip, setTrip] = useState<(typeof ROUTES)[number] | null>(null);
  const close = () => useGame.setState({ doorway: null });

  const sail = async (r: (typeof ROUTES)[number]) => {
    if (trip) return;
    setTrip(r);
    sound.play('horn');
    await wait(1700);
    world.engine?.enterScene(r.to);
    await wait(650);
    close();
  };

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' && !trip) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (trip) {
    return (
      <div className={`voyage${trip.air ? ' air' : ''}`} role="status">
        <div className="v-sky">
          <i className="v-cloud c1" />
          <i className="v-cloud c2" />
          <i className="v-cloud c3" />
        </div>
        {!trip.air && <div className="v-sea" />}
        <div className="v-craft">{trip.air ? '🎈' : '⛴️'}</div>
        <p className="v-caption">{trip.air ? `🎈 Floating up to the ${trip.name}…` : `⛵ Sailing to ${trip.to === 'island' ? 'Fortune Isle' : `the ${trip.name}`}…`}</p>
      </div>
    );
  }

  return (
    <div className="ferry-back" role="dialog" aria-label="Island Hopper ferry" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="ferry-chart">
        <header>
          <h2>⛴️ Island Hopper</h2>
          <p>Where to, matey? The isles open as you level up.</p>
        </header>
        <ul>
          {ROUTES.map((r) => {
            const open = !r.zone || zones.includes(r.zone);
            const level = r.zone ? info?.zones.find((z) => z.key === r.zone)?.level : undefined;
            const isHere = r.to === here;
            return (
              <li key={r.to}>
                <button className={`route${isHere ? ' here' : ''}${open ? '' : ' locked'}`} disabled={!open || isHere} onClick={() => void sail(r)}>
                  <span className="ri">{r.icon}</span>
                  <span className="rt">
                    <b>{r.name}</b>
                    <small>{r.blurb}</small>
                  </span>
                  <span className="rs">{isHere ? 'You are here' : open ? (r.air ? 'Fly ›' : 'Set sail ›') : `🔒 Level ${level ?? '?'}`}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <button className="btn btn-plain" onClick={close}>Stay here</button>
      </div>
    </div>
  );
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

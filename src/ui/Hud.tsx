import { useEffect, useState, useSyncExternalStore } from 'react';
import { money, useGame } from '../store/game.ts';
import { handleInteract, world } from '../world/WorldView.tsx';
import { PollyFace } from './Polly.tsx';

const ZONE_NAMES: Record<string, string> = {
  harbour: 'The Harbour', boardwalk: 'The Boardwalk', fairground: 'The Fairground', casino: 'Grand Casino', jungle: 'Jungle Ruins', volcano: 'Volcano Summit',
  vip: 'VIP Salon',
};
/** The banner shown on walking into a room. */
const ROOM_NAMES: Record<string, string> = { casino: 'Inside the Grand Casino', vip: '💎 The VIP Salon', tavern: '⚓ The Rusty Anchor' };

export function Hud() {
  return (
    <>
      <TopBar />
      <ZoneBanner />
      <Prompt />
      <Caption />
      <PollyBubble />
      <Toasts />
    </>
  );
}

function TopBar() {
  const balance = useGame((s) => s.balance);
  const currency = useGame((s) => s.info?.currency ?? 'ZAR');
  const p = useGame((s) => s.state?.player);
  const muted = useGame((s) => s.muted);
  const setPanel = useGame((s) => s.setPanel);
  const toggleMute = useGame((s) => s.toggleMute);
  const demo = useGame((s) => s.api.demo);
  const freePlays = useGame((s) => s.promos?.freeBets.length ?? 0);
  const livePromos = useGame((s) => s.promos?.promotions.length ?? 0);
  if (!p) return null;
  const pct = Math.max(0, Math.min(1, (p.xp - p.levelXp) / Math.max(1, p.nextXp - p.levelXp)));
  return (
    <header className="topbar">
      <button className="level" onClick={() => setPanel('wardrobe')} title="Your profile">
        <span className="level-badge">{p.level}</span>
        <span className="xp">
          <span className="xp-label">
            {p.xp - p.levelXp} / {p.nextXp - p.levelXp} XP
          </span>
          <span className="xp-bar">
            <i style={{ width: `${pct * 100}%` }} />
          </span>
        </span>
        <span className="keys" title="Keys">🗝️ {p.keys}</span>
      </button>
      <div className="balance-pill" id="balance-pill">
        <span className="coin" />
        <b>{money(balance, currency)}</b>
        {demo && <em>DEMO</em>}
      </div>
      <div className="top-actions">
        {(livePromos > 0 || freePlays > 0) && (
          <button className="icon-btn gift" onClick={() => setPanel('promos')} title={freePlays ? `Promotions — ${freePlays} free play${freePlays > 1 ? 's' : ''}` : 'Promotions'}>
            🎁{freePlays > 0 && <span className="badge">{freePlays}</span>}
          </button>
        )}
        <button className="icon-btn rg" onClick={() => setPanel('rg')} title="Responsible gambling">🛡️</button>
        <button className="icon-btn" onClick={toggleMute} title={muted ? 'Sound on' : 'Sound off'}>{muted ? '🔇' : '🔊'}</button>
        <button className="icon-btn" onClick={() => setPanel('menu')} title="Menu">☰</button>
      </div>
    </header>
  );
}

function ZoneBanner() {
  const zone = useGame((s) => s.zone);
  const scene = useGame((s) => s.scene);
  const [shown, setShown] = useState<string | null>(null);
  useEffect(() => {
    setShown(scene !== 'island' ? `room:${scene}` : zone);
    const t = setTimeout(() => setShown(null), 2600);
    return () => clearTimeout(t);
  }, [zone, scene]);
  if (!shown) return null;
  return (
    <div className={`zone-banner z-${shown.replace('room:', '')}`} key={shown}>
      {shown.startsWith('room:') ? ROOM_NAMES[shown.slice(5)] : ZONE_NAMES[shown]}
    </div>
  );
}

function useNear() {
  return useSyncExternalStore(
    (l) => {
      world.listeners.add(l);
      return () => world.listeners.delete(l);
    },
    () => world.near,
  );
}

function Prompt() {
  const near = useNear();
  const blocked = useGame((s) => s.game != null || s.panel != null || s.doorway != null || s.cinematic != null);
  if (!near || blocked) return null;
  const verb: Record<string, string> = { game: 'Play', travel: 'Fast travel', daily: 'Open', chest: 'Unlock', wardrobe: 'Open', board: 'Read', cashier: 'Visit', enter: 'Enter the', exit: '', fun: '' };
  return (
    <button className="prompt" onClick={() => handleInteract(near)}>
      <span>{verb[near.kind]}</span> <b>{near.label}</b>
      <kbd>E</kbd>
    </button>
  );
}

function Caption() {
  const caption = useGame((s) => s.cinematic);
  if (!caption) return null;
  return (
    <div className="caption" key={caption}>
      {caption}
    </div>
  );
}

function PollyBubble() {
  const polly = useGame((s) => s.polly);
  return (
    <div className={`polly${polly ? ' talking' : ''}`}>
      <PollyFace />
      {polly && (
        <div className="bubble" key={polly.id}>
          {polly.text}
        </div>
      )}
    </div>
  );
}

function Toasts() {
  const toasts = useGame((s) => s.toasts);
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

import { useEffect, useState, type ReactNode } from 'react';
import type { Cosmetic, GameKey, ZoneKey } from '../api/types.ts';
import { Paytable } from '../games/Paytable.tsx';
import { money, useGame, type Panel } from '../store/game.ts';
import { Promotions } from './Promotions.tsx';
import { SECRETS } from './secrets.ts';
import { sound } from './sound.ts';
import { world } from '../world/WorldView.tsx';

export const GAME_ICON: Record<GameKey, string> = {
  'coconut-shy': '🥥', 'cup-shuffle': '🥤', 'scratch-kiosk': '🎟️', 'prize-wheel': '🎡', 'duck-pond': '🦆', 'high-striker': '🔨',
  roulette: '🎰', 'temple-doors': '🚪', 'lava-crash': '🌋', 'island-reels': '🍒', 'dragon-tiger': '🐉', 'pirate-dice': '🎲',
  'diamond-wheel': '💎', 'coral-drop': '🐚', 'seahorse-derby': '🐠', 'ice-fishing': '🎣', 'ice-vault': '🔐', 'star-keno': '🌠', 'oracle-chests': '🔮',
};
const ZONE_ICON: Record<ZoneKey, string> = {
  harbour: '⚓', boardwalk: '🏖️', fairground: '🎪', casino: '🎰', jungle: '🌴', volcano: '🌋', vip: '💎', lagoon: '🐚', frost: '❄️', sky: '☁️',
};
/** Games played indoors: where to find them. */
const INDOORS: Partial<Record<GameKey, string>> = {
  roulette: 'inside the casino', 'island-reels': 'inside the casino', 'dragon-tiger': 'inside the casino', 'pirate-dice': 'in the Rusty Anchor tavern',
  'diamond-wheel': 'upstairs in the casino',
};
/** The isles: how to get there. */
const ISLE_NOTE: Partial<Record<ZoneKey, string>> = {
  lagoon: 'An atoll a short sail away — take the Island Hopper from the end of the Harbour pier.',
  frost: 'Snow, ice and northern lights, on the Island Hopper from the Harbour pier.',
  sky: 'Floating islands above the clouds — the Sky Ferry flies from the Harbour pier.',
};
const COSMETIC_ICON: Record<string, string> = {
  'hat-none': '🚫', 'hat-straw': '👒', 'hat-sailor': '⚓', 'hat-pirate': '🏴‍☠️', 'hat-flower': '🌺', 'hat-crown': '👑',
  'outfit-tee': '👕', 'outfit-hawaiian': '🌴', 'outfit-sailor': '🧑‍✈️', 'outfit-tux': '🤵', 'outfit-explorer': '🧭', 'outfit-gold': '✨',
  'pet-none': '🚫', 'pet-crab': '🦀', 'pet-turtle': '🐢', 'pet-monkey': '🐒', 'pet-penguin': '🐧',
  'fx-confetti': '🎉', 'fx-coins': '🪙', 'fx-fireworks': '🎆', 'fx-hearts': '💖', 'fx-stars': '🌠',
  'hat-snorkel': '🤿', 'outfit-parka': '🧥',
};

export function Panels() {
  const panel = useGame((s) => s.panel);
  const setPanel = useGame((s) => s.setPanel);
  if (!panel) return null;
  const close = () => {
    sound.play('close');
    setPanel(null);
  };
  const titles: Record<Exclude<Panel, null>, string> = {
    menu: 'Menu', wardrobe: 'Wardrobe', history: 'Cashier & history', rg: 'Responsible gambling', fair: 'Provably fair',
    board: 'Island notice board', travel: 'Fast travel', paytables: 'Paytables & rules', promos: 'Promotions',
    secrets: 'Secrets of the isles',
  };
  return (
    <div className="sheet-backdrop" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="sheet" role="dialog" aria-label={titles[panel]}>
        <header className="sheet-head">
          <h2>{titles[panel]}</h2>
          <button className="icon-btn" onClick={close} aria-label="Close">✕</button>
        </header>
        <div className="sheet-body" key={panel}>
          {panel === 'menu' && <Menu />}
          {panel === 'wardrobe' && <Wardrobe />}
          {panel === 'history' && <History />}
          {panel === 'rg' && <Rg />}
          {panel === 'fair' && <Fair />}
          {panel === 'board' && <Board />}
          {panel === 'travel' && <Travel />}
          {panel === 'paytables' && <Paytables />}
          {panel === 'promos' && <Promotions />}
          {panel === 'secrets' && <Secrets />}
        </div>
      </div>
    </div>
  );
}

function Menu() {
  const setPanel = useGame((s) => s.setPanel);
  const muted = useGame((s) => s.muted);
  const toggleMute = useGame((s) => s.toggleMute);
  const item = (icon: string, text: string, onClick: () => void, sub?: string) => (
    <button className="menu-item" onClick={onClick}>
      <span className="mi-icon">{icon}</span>
      <span>
        <b>{text}</b>
        {sub && <small>{sub}</small>}
      </span>
    </button>
  );
  const promoCount = useGame((s) => (s.promos?.promotions.length ?? 0) + (s.promos?.freeBets.length ?? 0));
  const found = useGame((s) => s.secrets.length);
  return (
    <div className="menu-list">
      {item('🎁', 'Promotions', () => setPanel('promos'), promoCount ? 'Free plays, races, leaderboards and more' : 'Nothing running right now')}
      {item('🧢', 'Wardrobe', () => setPanel('wardrobe'), 'Hats, outfits, pets and win effects')}
      {item('🧾', 'Round history', () => setPanel('history'), 'Your recent rounds and session totals')}
      {item('🗺️', 'Fast travel', () => setPanel('travel'), 'Jump to any open zone')}
      {item('📜', 'Paytables & rules', () => setPanel('paytables'), 'Every game’s odds and rules')}
      {item('🗝️', 'Secrets', () => setPanel('secrets'), `${found} of ${SECRETS.length} found — just for fun`)}
      {item('🔐', 'Provably fair', () => setPanel('fair'), 'Seeds and how to verify a round')}
      {item('🛡️', 'Responsible gambling', () => setPanel('rg'), 'Limits, reality checks, self-exclusion')}
      {item(muted ? '🔇' : '🔊', muted ? 'Sound: off' : 'Sound: on', toggleMute)}
      <p className="hint">Walk: tap the ground, or WASD / arrow keys. Use stalls: walk up and tap the button, or press E. Zoom: pinch or scroll.</p>
    </div>
  );
}

function Wardrobe() {
  const info = useGame((s) => s.info)!;
  const p = useGame((s) => s.state!.player);
  const run = useGame((s) => s.run);
  const kinds: [Cosmetic['kind'], string][] = [['hat', 'Hats'], ['outfit', 'Outfits'], ['pet', 'Pets'], ['effect', 'Win effects']];
  return (
    <div className="wardrobe">
      <p className="hint">Cosmetics never change the odds. Unlock them by levelling up, or find them in the Jungle’s treasure chest (one key each).</p>
      {kinds.map(([kind, title]) => (
        <section key={kind}>
          <h3>{title}</h3>
          <div className="cosmetic-grid">
            {info.cosmetics.filter((c) => c.kind === kind).map((c) => {
              const owned = p.owned.includes(c.id);
              const on = p.equipped[kind] === c.id;
              return (
                <button
                  key={c.id}
                  className={`cosmetic${on ? ' on' : ''}${owned ? '' : ' locked'}`}
                  disabled={!owned || on}
                  onClick={() => void run((api) => api.equip(c.id))}
                >
                  <span className="ci">{COSMETIC_ICON[c.id] ?? '❔'}</span>
                  <b>{c.name}</b>
                  <small>{on ? 'Wearing' : owned ? 'Tap to wear' : c.level > 0 ? `Level ${c.level}` : 'Treasure chest'}</small>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function History() {
  const api = useGame((s) => s.api);
  const info = useGame((s) => s.info)!;
  const balance = useGame((s) => s.balance);
  const session = useGame((s) => s.state!.session);
  const [rows, setRows] = useState<import('../api/types.ts').HistoryEntry[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    void api.state().then((s) => setRows(s.history ?? []), () => setRows([]));
  }, [api]);
  const net = session.won - session.staked;
  const name = (k: GameKey) => info.games.find((g) => g.key === k)?.name ?? k;
  return (
    <div className="history">
      <div className="stat-row">
        <Stat label="Balance" value={money(balance, info.currency)} />
        <Stat label="Session staked" value={money(session.staked, info.currency)} />
        <Stat label="Session net" value={(net >= 0 ? '+' : '−') + money(Math.abs(net), info.currency)} tone={net >= 0 ? 'good' : 'bad'} />
      </div>
      <p className="hint">Deposits and withdrawals are handled by the casino’s cashier in the lobby.</p>
      {!rows && <p className="hint">Loading…</p>}
      {rows?.length === 0 && <p className="hint">No rounds yet — the Boardwalk stalls are a good place to start.</p>}
      <ul className="rounds">
        {rows?.map((r) => (
          <li key={r.id} className={r.payout > 0 ? 'win' : 'loss'}>
            <button onClick={() => setOpen(open === r.id ? null : r.id)}>
              <span className="ri">{GAME_ICON[r.game]}</span>
              <span className="rn">
                <b>{name(r.game)}</b>
                <small>{new Date(r.time).toLocaleTimeString()}</small>
              </span>
              <span className="rs">{money(r.stake, info.currency)}</span>
              <span className="rp">{r.payout > 0 ? `+${money(r.payout, info.currency)} ×${r.multiplier}` : '—'}</span>
            </button>
            {open === r.id && (
              <div className="seeds">
                <div><span>Server seed</span><code>{r.serverSeed}</code></div>
                <div><span>Seed hash</span><code>{r.serverSeedHash}</code></div>
                <div><span>Client seed · nonce</span><code>{r.clientSeed} · {r.nonce}</code></div>
                <div><span>Outcome</span><code>{JSON.stringify(r.outcome)}</code></div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <small>{label}</small>
      <b>{value}</b>
    </div>
  );
}

function Rg() {
  const s = useGame((x) => x.state!);
  const info = useGame((x) => x.info!);
  const run = useGame((x) => x.run);
  const toast = useGame((x) => x.toast);
  const [loss, setLoss] = useState(s.limits.lossLimit.value?.toString() ?? '');
  const [mins, setMins] = useState(s.limits.sessionMinutes.value?.toString() ?? '');
  const [rc, setRc] = useState(s.limits.realityCheckMinutes?.toString() ?? '');
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const elapsed = Math.max(0, now - s.session.startedAt);
  const net = s.session.won - s.session.staked;
  const pending = (l: import('../api/types.ts').Limit) =>
    l.pending ? <small className="pending">Changes to {l.pending.value ?? 'no limit'} on {new Date(l.pending.at).toLocaleString()}</small> : null;
  const save = async () => {
    const num = (v: string) => (v.trim() === '' ? null : Number(v));
    const r = await run((api) => api.limits({ lossLimit: num(loss), sessionMinutes: num(mins), realityCheckMinutes: num(rc) }));
    if (r) toast('Limits saved. Lower limits apply now; higher ones after 24 hours.', 'info');
  };
  return (
    <div className="rg">
      <div className="stat-row">
        <Stat label="Session time" value={`${Math.floor(elapsed / 60000)}m ${Math.floor((elapsed % 60000) / 1000)}s`} />
        <Stat label="Rounds" value={String(s.session.rounds)} />
        <Stat label="Net result" value={(net >= 0 ? '+' : '−') + money(Math.abs(net), info.currency)} tone={net >= 0 ? 'good' : 'bad'} />
      </div>
      <label className="field">
        <span>Session loss limit ({info.currency})</span>
        <input inputMode="decimal" placeholder="No limit" value={loss} onChange={(e) => setLoss(e.target.value)} />
        {pending(s.limits.lossLimit)}
      </label>
      <label className="field">
        <span>Session time limit (minutes)</span>
        <input inputMode="numeric" placeholder="No limit" value={mins} onChange={(e) => setMins(e.target.value)} />
        {pending(s.limits.sessionMinutes)}
      </label>
      <label className="field">
        <span>Reality check every (minutes)</span>
        <input inputMode="numeric" placeholder="Off" value={rc} onChange={(e) => setRc(e.target.value)} />
      </label>
      <button className="btn btn-mint" onClick={() => void save()}>Save limits</button>
      <div className="rg-help">
        <p><b>18+ only.</b> Every game here has fixed odds. Over time you will lose more than you win. Power-ups, XP and cosmetics never change the odds.</p>
        <p>Need a break? Close the game, or ask the casino’s support team to self-exclude you. Free, confidential help: <a href="https://responsiblegambling.org.za" target="_blank" rel="noreferrer">South African Responsible Gambling Foundation</a> · 0800 006 008.</p>
      </div>
    </div>
  );
}

function Fair() {
  const s = useGame((x) => x.state!);
  const run = useGame((x) => x.run);
  const [seed, setSeed] = useState(s.fairness.clientSeed);
  return (
    <div className="fair">
      <p className="hint">Before every bet the server commits to a secret seed by showing its SHA-256 hash. The outcome comes from HMAC-SHA256(server seed, “client seed:nonce:k”). After the round the seed is revealed in your history, so you can check the hash and recompute the result.</p>
      <div className="seeds">
        <div><span>Next server seed hash</span><code>{s.fairness.serverSeedHash}</code></div>
        <div><span>Next nonce</span><code>{s.fairness.nonce}</code></div>
      </div>
      <label className="field">
        <span>Your client seed</span>
        <input value={seed} maxLength={64} onChange={(e) => setSeed(e.target.value)} />
      </label>
      <button className="btn btn-mint" disabled={!seed.trim() || seed === s.fairness.clientSeed} onClick={() => void run((api) => api.seed(seed.trim()))}>
        Use this seed
      </button>
    </div>
  );
}

function Board() {
  const info = useGame((s) => s.info)!;
  const p = useGame((s) => s.state!.player);
  const setPanel = useGame((s) => s.setPanel);
  return (
    <div className="board">
      <Promotions compact />
      <p className="hint">Every game is server-decided with a certified RNG. The stake, balance and an info button are in every game.</p>
      {info.zones.filter((z) => z.key === 'vip' || info.games.some((g) => g.zone === z.key)).map((z) => {
        const open = p.level >= z.level;
        return (
          <section key={z.key} className={open ? '' : 'locked'}>
            <h3>
              {ZONE_ICON[z.key]} {z.name} {!open && <small>🔒 Level {z.level}</small>}
            </h3>
            <ul>
              {info.games.filter((g) => g.zone === z.key).map((g) => (
                <li key={g.key}>
                  <span>{GAME_ICON[g.key]} {g.name} {INDOORS[g.key] && <small>· {INDOORS[g.key]}</small>}</span>
                </li>
              ))}
              {z.key === 'vip' && (
                <li>
                  <span>Upstairs in the Grand Casino — plus golden reels, private roulette and Dragon Tiger.</span>
                </li>
              )}
              {ISLE_NOTE[z.key] && (
                <li>
                  <span>{ISLE_NOTE[z.key]}</span>
                </li>
              )}
            </ul>
          </section>
        );
      })}
      <button className="btn btn-sky" onClick={() => setPanel('paytables')}>Read every paytable</button>
    </div>
  );
}

function Travel() {
  const info = useGame((s) => s.info)!;
  const p = useGame((s) => s.state!.player);
  const zone = useGame((s) => s.zone);
  const setPanel = useGame((s) => s.setPanel);
  const [fading, setFading] = useState(false);
  const go = (z: ZoneKey) => {
    setFading(true);
    sound.play('whoosh');
    setTimeout(() => {
      world.engine?.travel(z);
      setPanel(null);
    }, 350);
  };
  return (
    <div className="travel">
      {fading && <div className="fade" />}
      {info.zones.map((z) => {
        const open = p.zones.includes(z.key);
        return (
          <button key={z.key} className={`travel-item z-${z.key}`} disabled={!open || z.key === zone} onClick={() => go(z.key)}>
            <span className="ti">{ZONE_ICON[z.key]}</span>
            <b>{z.name}</b>
            <small>{z.key === zone ? 'You are here' : open ? 'Travel' : `🔒 Level ${z.level}`}</small>
          </button>
        );
      })}
    </div>
  );
}

function Paytables() {
  const info = useGame((s) => s.info)!;
  const [k, setK] = useState<GameKey>(info.games[0].key);
  return (
    <div className="paytables">
      <div className="tabs">
        {info.games.map((g) => (
          <button key={g.key} className={k === g.key ? 'on' : ''} onClick={() => setK(g.key)}>
            {GAME_ICON[g.key]} {g.name}
          </button>
        ))}
      </div>
      <Paytable game={k} />
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

/** The secrets log: found ones say what they were; hidden ones give a hint. Just for fun — they never touch money or odds. */
function Secrets() {
  const found = useGame((s) => s.secrets);
  return (
    <div className="secrets">
      <p className="hint">
        {found.length === SECRETS.length ? '🏆 You found every secret. A true island explorer!' : `${found.length} of ${SECRETS.length} found. Secrets are just for fun — they never change the games.`}
      </p>
      <div className="secret-grid">
        {SECRETS.map((x) => {
          const on = found.includes(x.id);
          return (
            <div key={x.id} className={`secret${on ? ' found' : ''}`}>
              <span className="si">{on ? x.icon : '❔'}</span>
              <b>{on ? x.name : '???'}</b>
              <small>{x.where}</small>
              <p>{on ? '✓ Found' : x.hint}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

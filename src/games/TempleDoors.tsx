import { useState } from 'react';
import type { State } from '../api/types.ts';
import { money, useGame } from '../store/game.ts';
import { sound } from '../ui/sound.ts';
import { Result, Shell, StakePicker, wait } from './GameOverlay.tsx';

/**
 * Temple Doors (Jungle Ruins): up to 8 levels of 3 doors, 1 trap each (placed after the pick). Cash out any time.
 * The round stays open on the server between picks; reopening the game resumes it.
 */
export function TempleDoors() {
  const ladder = useGame((s) => (s.meta('temple-doors')?.paytable.ladder ?? []) as number[]);
  const stake = useGame((s) => s.stake);
  const currency = useGame((s) => s.info?.currency ?? 'ZAR');
  const busy = useGame((s) => s.busy);
  const bet = useGame((s) => s.bet);
  const run = useGame((s) => s.run);
  const finish = useGame((s) => s.finish);
  const live = useGame((s) => (s.state?.round?.game === 'temple-doors' && s.state.round.status === 'live' ? s.state.round : null));
  const [opened, setOpened] = useState<{ door: number; safe: boolean } | null>(null);
  const [ended, setEnded] = useState<State | null>(null);
  const [shake, setShake] = useState(false);
  // While a door swings open the level on screen stays put (the server has already moved on).
  const [frozen, setFrozen] = useState<number | null>(null);

  const round = live ?? ended?.round ?? null;
  const level = frozen ?? round?.temple?.level ?? 0;

  const enter = async () => {
    setEnded(null);
    setOpened(null);
    const s = await bet({ game: 'temple-doors', stake });
    if (s) sound.play('door');
  };

  const pick = async (door: number) => {
    if (!live || busy || opened) return;
    setFrozen(level);
    const s = await run((api) => api.action('pick', door), { holdBalance: true });
    if (!s?.round) {
      setFrozen(null);
      return;
    }
    const r = s.round;
    const safe = r.status !== 'lost';
    setOpened({ door, safe });
    if (r.status !== 'live') setEnded(s);
    sound.play(safe ? 'door' : 'trap');
    if (!safe) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
    await wait(safe ? 650 : 900);
    setFrozen(null);
    if (r.status !== 'live') finish(s);
    else setOpened(null);
  };

  const cashOut = async () => {
    const s = await run((api) => api.action('cashout'), { holdBalance: true });
    if (!s?.round) return;
    setEnded(s);
    sound.play('ding');
    finish(s);
  };

  const trapAt: number | undefined = ended?.round?.outcome?.trapAt;
  const lost = ended?.round?.status === 'lost';

  return (
    <Shell
      game="temple-doors"
      live={!!live}
      footer={
        live ? (
          <div className="temple-actions">
            <button className="btn btn-mint btn-wide" disabled={busy || level === 0 || !!opened} onClick={() => void cashOut()}>
              {level === 0 ? 'Open a door to start winning' : `Cash out ${money(live.stake * (live.temple?.now ?? 1), currency)} (×${live.temple?.now})`}
            </button>
            <p className="foot-hint">Next door pays ×{live.temple?.next ?? '—'} · 2 of 3 doors are safe</p>
          </div>
        ) : (
          <>
            <StakePicker disabled={busy} />
            <button className="btn btn-gold btn-wide" disabled={busy} onClick={() => void enter()}>
              Enter the temple
            </button>
          </>
        )
      }
    >
      <div className={`temple${shake ? ' shake-me' : ''}`}>
        <ol className="ladder">
          {ladder.map((m, i) => (
            <li key={i} className={i + 1 === level ? 'now' : i < level ? 'past' : i === level && live ? 'next' : ''}>
              <span>{i + 1}</span>
              <b>×{m}</b>
            </li>
          )).reverse()}
        </ol>
        <div className="doors-wrap">
          <div className="level-title">{live ? `Level ${level + 1} of ${ladder.length}` : ended ? (lost ? 'Trapped!' : 'You escaped with the treasure!') : 'Pick a door, climb, cash out'}</div>
          <div className="doors">
            {[0, 1, 2].map((d) => {
              const isOpen = opened?.door === d || (lost && trapAt === d);
              const trap = (opened?.door === d && !opened.safe) || (lost && trapAt === d);
              return (
                <button key={d} className={`door${isOpen ? ' open' : ''}${trap ? ' trap' : ''}`} disabled={!live || busy || !!opened} onClick={() => void pick(d)} aria-label={`Door ${d + 1}`}>
                  <span className="door-inside">{trap ? '🐍' : '💎'}</span>
                  <span className="door-leaf">
                    <i />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <Result round={ended?.round ?? null} text={live ? (level === 0 ? 'Choose wisely…' : `Holding ×${live.temple?.now}`) : 'Each level: ×1.5 more · cash out any time'} />
    </Shell>
  );
}

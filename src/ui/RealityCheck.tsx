import { useEffect, useState } from 'react';
import { money, useGame } from '../store/game.ts';

/** A reality check every N minutes of a session (the player sets N under Responsible gambling; default 30). */
export function RealityCheck() {
  const s = useGame((x) => x.state);
  const currency = useGame((x) => x.info?.currency ?? 'ZAR');
  const setPanel = useGame((x) => x.setPanel);
  const [shownAt, setShownAt] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const every = s?.limits.realityCheckMinutes ?? null;
  const start = s?.session.startedAt ?? Date.now();

  useEffect(() => {
    if (!every) return;
    const t = setInterval(() => {
      const mins = (Date.now() - start) / 60000;
      const due = Math.floor(mins / every);
      if (due >= 1 && due !== shownAt) {
        setShownAt(due);
        setOpen(true);
      }
    }, 5000);
    return () => clearInterval(t);
  }, [every, start, shownAt]);

  if (!open || !s) return null;
  const mins = Math.floor((Date.now() - s.session.startedAt) / 60000);
  const net = s.session.won - s.session.staked;
  return (
    <div className="sheet-backdrop rc">
      <div className="sheet small" role="alertdialog" aria-label="Reality check">
        <header className="sheet-head">
          <h2>Reality check</h2>
        </header>
        <div className="sheet-body">
          <p className="rc-big">You’ve been playing for <b>{mins} minutes</b>.</p>
          <p>
            Staked {money(s.session.staked, currency)} · Won {money(s.session.won, currency)} · Net{' '}
            <b className={net >= 0 ? 'good' : 'bad'}>{(net >= 0 ? '+' : '−') + money(Math.abs(net), currency)}</b>
          </p>
          <div className="row">
            <button className="btn btn-mint" onClick={() => setOpen(false)}>Keep playing</button>
            <button className="btn btn-sky" onClick={() => { setOpen(false); setPanel('rg'); }}>Set limits</button>
            <button className="btn btn-plain" onClick={() => { setOpen(false); setPanel('history'); }}>History</button>
          </div>
        </div>
      </div>
    </div>
  );
}

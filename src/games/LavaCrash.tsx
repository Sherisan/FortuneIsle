import { useEffect, useRef, useState } from 'react';
import { lavaAt } from '../api/rules.ts';
import type { State } from '../api/types.ts';
import { money, useGame } from '../store/game.ts';
import { sound } from '../ui/sound.ts';
import { Result, Shell, StakePicker } from './GameOverlay.tsx';

/**
 * Lava Crash (Volcano Summit): the multiplier is e^(0.2 t) from the moment the server accepted the bet. The client
 * runs the same clock for the show and long-polls api/island/watch, which returns when the round ends (eruption, auto
 * cash-out, the ×500 summit, or our cash-out). The eruption point is never sent before it happens.
 */
export function LavaCrash() {
  const stake = useGame((s) => s.stake);
  const currency = useGame((s) => s.info?.currency ?? 'ZAR');
  const busy = useGame((s) => s.busy);
  const api = useGame((s) => s.api);
  const bet = useGame((s) => s.bet);
  const finish = useGame((s) => s.finish);
  const live = useGame((s) => (s.state?.round?.game === 'lava-crash' && s.state.round.status === 'live' ? s.state.round : null));
  const [autoOn, setAutoOn] = useState(false);
  const [auto, setAuto] = useState('2.00');
  const [m, setM] = useState(1);
  const [ended, setEnded] = useState<State | null>(null);
  const [cashing, setCashing] = useState(false);
  const t0 = useRef(0);
  const roundId = useRef<string | null>(null);
  const settled = useRef(false);

  const end = (s: State) => {
    if (settled.current || s.round?.id !== roundId.current || s.round?.status === 'live') return;
    settled.current = true;
    useGame.setState({ state: s });
    setEnded(s);
    const r = s.round!;
    setM(r.status === 'lost' ? Math.max(1, r.lava?.crash ?? 1) : r.multiplier);
    if (r.status === 'lost') {
      sound.play('erupt');
      useGame.setState({ shake: useGame.getState().shake + 1 });
    }
    finish(s);
  };

  // Follow a live round: run the clock, and wait for the server to say it ended.
  useEffect(() => {
    if (!live) return;
    roundId.current = live.id;
    settled.current = false;
    t0.current = performance.now() - (live.lava?.elapsedMs ?? 0);
    let raf = 0;
    let lastRumble = 0;
    const loop = (now: number) => {
      const v = lavaAt((now - t0.current) / 1000);
      setM(v);
      if (now - lastRumble > 1400) {
        sound.play('rumble');
        lastRumble = now;
      }
      if (!settled.current) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    let alive = true;
    const watch = async () => {
      while (alive && !settled.current) {
        try {
          const s = await api.watch();
          if (s.round?.id !== live.id) return; // a newer round took over
          if (s.round.status !== 'live') return end(s);
        } catch {
          await new Promise((r) => setTimeout(r, 800));
        }
      }
    };
    void watch();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live?.id]);

  const start = async () => {
    setEnded(null);
    setM(1);
    const a = autoOn ? Math.round(Number(auto) * 100) / 100 : undefined;
    const s = await bet({ game: 'lava-crash', stake, auto: a });
    if (!s?.round) return;
    roundId.current = s.round.id;
    if (s.round.status !== 'live') {
      settled.current = false;
      end(s);
    }
  };

  const cashOut = async () => {
    if (!live || cashing) return;
    setCashing(true);
    try {
      const s = await api.action('cashout');
      if (s.round?.status === 'cashed') sound.play('ding');
      end(s);
    } catch (e) {
      useGame.getState().toast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setCashing(false);
    }
  };

  const r = ended?.round;
  const erupted = r?.status === 'lost';
  const escaped = r && r.status === 'cashed';
  // Lava height: 18% at the start, rising fast, then creeping up towards the climber's ledge (at 74%).
  const level = 0.18 + 0.52 * (1 - 1 / Math.pow(m, 0.6));
  const heat = Math.min(1, Math.log(m) / Math.log(25));

  return (
    <Shell
      game="lava-crash"
      live={!!live}
      footer={
        live ? (
          <button className="btn btn-mint btn-wide btn-big" disabled={cashing} onClick={() => void cashOut()}>
            Cash out {money(Math.floor(live.stake * m * 100) / 100, currency)}
          </button>
        ) : (
          <>
            <div className="auto">
              <label>
                <input type="checkbox" checked={autoOn} onChange={(e) => setAutoOn(e.target.checked)} /> Auto cash-out at ×
              </label>
              <input className="auto-x" inputMode="decimal" value={auto} disabled={!autoOn} onChange={(e) => setAuto(e.target.value)} />
            </div>
            <StakePicker disabled={busy} />
            <button className="btn btn-gold btn-wide" disabled={busy || (autoOn && !(Number(auto) >= 1.01 && Number(auto) <= 500))} onClick={() => void start()}>
              Start the climb 🌋
            </button>
          </>
        )
      }
    >
      <div className={`lava${erupted ? ' erupted' : ''}${escaped ? ' escaped' : ''}${live ? ' live' : ''}`} style={{ ['--heat' as string]: heat }}>
        <div className="crater" />
        <div className="lava-fill" style={{ height: `${(erupted ? 1 : level) * 100}%` }}>
          <i />
        </div>
        <div className="ledge" style={{ bottom: '74%' }}>
          <span className={`explorer${escaped ? ' fly' : ''}`}>{escaped ? '🎈' : '🧗'}</span>
        </div>
        {live?.lava?.auto && <div className="auto-line">auto ×{live.lava.auto}</div>}
        <div className={`lava-m${erupted ? ' boom' : ''}`}>
          ×{m.toFixed(2)}
          {erupted && <small>ERUPTED!</small>}
          {escaped && <small>SAFE!</small>}
        </div>
        {erupted && <div className="eruption" />}
      </div>
      <Result round={r ?? null} text={live ? 'Cash out before it blows!' : 'Chance to reach ×x is 0.96 ÷ x · max ×500'} />
    </Shell>
  );
}

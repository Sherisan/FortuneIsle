import { useState, type ReactNode } from 'react';
import type { GameKey } from '../api/types.ts';
import { money, useGame } from '../store/game.ts';
import { GAME_ICON } from '../ui/Panels.tsx';
import { CoconutShy } from './CoconutShy.tsx';
import { CupShuffle } from './CupShuffle.tsx';
import { DuckPond } from './DuckPond.tsx';
import { HighStriker } from './HighStriker.tsx';
import { LavaCrash } from './LavaCrash.tsx';
import { Paytable } from './Paytable.tsx';
import { PrizeWheel } from './PrizeWheel.tsx';
import { Roulette } from './Roulette.tsx';
import { ScratchKiosk } from './ScratchKiosk.tsx';
import { TempleDoors } from './TempleDoors.tsx';

const GAMES: Record<GameKey, () => ReactNode> = {
  'coconut-shy': () => <CoconutShy />,
  'cup-shuffle': () => <CupShuffle />,
  'scratch-kiosk': () => <ScratchKiosk />,
  'prize-wheel': () => <PrizeWheel />,
  'duck-pond': () => <DuckPond />,
  'high-striker': () => <HighStriker />,
  roulette: () => <Roulette />,
  'temple-doors': () => <TempleDoors />,
  'lava-crash': () => <LavaCrash />,
};

/** The spring-animated card a stall opens; the world stays loaded (and paused) behind it. */
export function GameOverlay() {
  const game = useGame((s) => s.game);
  if (!game) return null;
  return (
    <div className="overlay-backdrop">
      <div className={`game-card g-${game}`} key={game}>
        {GAMES[game]()}
      </div>
    </div>
  );
}

/** Header (name, RTP/info, close), the stage, and the footer. Shared by every game. */
export function Shell({ game, children, footer, live }: { game: GameKey; children: ReactNode; footer?: ReactNode; live?: boolean }) {
  const meta = useGame((s) => s.meta(game));
  const close = useGame((s) => s.closeGame);
  const roundLive = useGame((s) => s.state?.round?.status === 'live');
  const [info, setInfo] = useState(false);
  const balance = useGame((s) => s.balance);
  const currency = useGame((s) => s.info?.currency ?? 'ZAR');
  const last = useGame((s) => (s.state?.round?.game === game && s.state.round.status !== 'live' ? s.state.round : null));
  return (
    <>
      <header className="game-head">
        <span className="gh-icon">{GAME_ICON[game]}</span>
        <h2>{meta?.name}</h2>
        <button className={`rtp-btn${info ? ' on' : ''}`} onClick={() => setInfo(!info)} title="Paytable and rules">
          ⓘ RTP {meta ? (meta.rtp * 100).toFixed(game === 'roulette' ? 1 : 0) : 96}%
        </button>
        <button className="icon-btn" onClick={close} disabled={live || roundLive} aria-label="Close" title={live || roundLive ? 'Finish the round first' : 'Back to the island'}>
          ✕
        </button>
      </header>
      <div className="game-meta">
        <span>Balance <b>{money(balance, currency)}</b></span>
        <span>Last win <b>{last && last.multiplier > 1 ? `${money(last.payout, currency)} (${fmtX(last.multiplier)})` : '—'}</b></span>
      </div>
      {info ? (
        <div className="game-info">
          <Paytable game={game} />
          <button className="btn btn-sky" onClick={() => setInfo(false)}>Back to the game</button>
        </div>
      ) : (
        <>
          <div className="stage">{children}</div>
          {footer && <footer className="game-foot">{footer}</footer>}
        </>
      )}
    </>
  );
}

export function StakePicker({ disabled }: { disabled?: boolean }) {
  const info = useGame((s) => s.info)!;
  const stake = useGame((s) => s.stake);
  const setStake = useGame((s) => s.setStake);
  const step = (dir: 1 | -1) => {
    const ladder = [...new Set([info.minBet, ...info.chips, 200, info.maxBet])].filter((v) => v >= info.minBet && v <= info.maxBet).sort((a, b) => a - b);
    const i = ladder.findIndex((v) => v >= stake);
    const next = ladder[Math.max(0, Math.min(ladder.length - 1, (i < 0 ? ladder.length - 1 : i) + dir))];
    setStake(next);
  };
  return (
    <div className={`stake${disabled ? ' disabled' : ''}`}>
      <button className="step" disabled={disabled || stake <= info.minBet} onClick={() => step(-1)} aria-label="Lower stake">−</button>
      <div className="chips">
        {info.chips.map((c) => (
          <button key={c} className={`chip c${c}${stake === c ? ' on' : ''}`} disabled={disabled} onClick={() => setStake(c)}>
            {c}
          </button>
        ))}
      </div>
      <button className="step" disabled={disabled || stake >= info.maxBet} onClick={() => step(1)} aria-label="Raise stake">+</button>
      <div className="stake-val">
        <small>Stake</small>
        <b>{money(stake, info.currency)}</b>
      </div>
    </div>
  );
}

/** A multiplier for display: at most 2 decimals. */
export const fmtX = (m: number) => `×${Math.round(m * 100) / 100}`;

/**
 * The result line under a stage. text is the hint shown before a round. A return below the stake is never dressed up as
 * a win: it reads "back", in a neutral colour, with no celebration (store.finish does the same).
 */
export function Result({ round, text }: { round: { payout: number; multiplier: number; stake?: number } | null; text?: string }) {
  const currency = useGame((s) => s.info?.currency ?? 'ZAR');
  if (!round) return <div className="result idle">{text ?? ' '}</div>;
  if (round.payout <= 0) return <div className="result lose">No win this time</div>;
  if (round.multiplier < 1) return <div className="result back">{money(round.payout, currency)} back <span>{fmtX(round.multiplier)}</span></div>;
  if (round.multiplier === 1) return <div className="result back">Stake back <span>×1</span></div>;
  return (
    <div className="result win">
      You win <b>{money(round.payout, currency)}</b> <span>{fmtX(round.multiplier)}</span>
    </div>
  );
}

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

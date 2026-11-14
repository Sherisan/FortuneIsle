import { useGame } from '../store/game.ts';
import { PollyFace } from './Polly.tsx';

export function Splash() {
  const phase = useGame((s) => s.phase);
  const fatal = useGame((s) => s.fatal);
  const start = useGame((s) => s.start);
  return (
    <div className="splash">
      <div className="splash-sun" />
      <div className="splash-card">
        <div className="logo">
          <span className="logo-fortune">Fortune</span>
          <span className="logo-isle">Isle</span>
        </div>
        <PollyFace size={92} />
        {phase === 'loading' && (
          <div className="loading">
            <div className="loading-bar">
              <i />
            </div>
            <p>Sailing to the island…</p>
          </div>
        )}
        {phase === 'splash' && (
          <button className="btn btn-gold btn-big" onClick={start} autoFocus>
            Tap to play
          </button>
        )}
        {phase === 'fatal' && <p className="fatal">{fatal}</p>}
        <p className="legal">
          <b>18+</b> · Real-money games with a fixed, certified return (96% · roulette 97.3%) · Play responsibly
        </p>
      </div>
    </div>
  );
}

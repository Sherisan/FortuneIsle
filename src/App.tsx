import { useEffect, useState } from 'react';
import { GameOverlay } from './games/GameOverlay.tsx';
import { useGame } from './store/game.ts';
import { Celebration } from './ui/Celebration.tsx';
import { Hud } from './ui/Hud.tsx';
import { Panels } from './ui/Panels.tsx';
import { RealityCheck } from './ui/RealityCheck.tsx';
import { Splash } from './ui/Splash.tsx';
import { WorldView } from './world/WorldView.tsx';

export default function App() {
  const phase = useGame((s) => s.phase);
  const shake = useGame((s) => s.shake);
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    void useGame.getState().boot();
  }, []);

  useEffect(() => {
    if (!shake) return;
    setShaking(true);
    const t = setTimeout(() => setShaking(false), 650);
    return () => clearTimeout(t);
  }, [shake]);

  return (
    <div className={`app${shaking ? ' shake' : ''}`}>
      {phase !== 'fatal' && <WorldView />}
      {phase === 'play' && (
        <>
          <Hud />
          <GameOverlay />
          <Panels />
          <Celebration />
          <RealityCheck />
        </>
      )}
      {(phase === 'loading' || phase === 'splash' || phase === 'fatal') && <Splash />}
    </div>
  );
}

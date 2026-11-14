import { useState } from 'react';
import type { RoundView } from '../api/types.ts';
import { useGame } from '../store/game.ts';
import { sound } from '../ui/sound.ts';
import { Result, Shell, StakePicker, wait } from './GameOverlay.tsx';

/** Coconut Shy (Boardwalk): pick 1 of 5 coconuts; the ball flies; the hit coconut tumbles to show the prize or a miss. */
export function CoconutShy() {
  const stake = useGame((s) => s.stake);
  const busy = useGame((s) => s.busy);
  const bet = useGame((s) => s.bet);
  const finish = useGame((s) => s.finish);
  const [mode, setMode] = useState<'classic' | 'golden'>('classic');
  const [target, setTarget] = useState<number | null>(null);
  const [phase, setPhase] = useState<'idle' | 'throw' | 'reveal'>('idle');
  const [round, setRound] = useState<RoundView | null>(null);

  const throwAt = async (i: number) => {
    if (busy || phase === 'throw') return;
    setRound(null);
    setTarget(i);
    setPhase('throw');
    sound.play('whoosh');
    const [s] = await Promise.all([bet({ game: 'coconut-shy', stake, choice: i, mode }), wait(650)]);
    if (!s?.round) {
      setPhase('idle');
      setTarget(null);
      return;
    }
    sound.play('thud');
    setRound(s.round);
    setPhase('reveal');
    await wait(550);
    finish(s);
  };

  const prizeAt: number | null = round?.outcome?.prizeAt ?? null;
  const tier: string | null = round?.outcome?.tier ?? null;

  return (
    <Shell
      game="coconut-shy"
      live={phase === 'throw'}
      footer={
        <>
          <div className="seg">
            <button className={mode === 'classic' ? 'on' : ''} disabled={phase === 'throw'} onClick={() => setMode('classic')}>Classic ×4.8</button>
            <button className={mode === 'golden' ? 'on' : ''} disabled={phase === 'throw'} onClick={() => setMode('golden')}>🌟 Golden ×20</button>
          </div>
          <StakePicker disabled={phase === 'throw'} />
          <p className="foot-hint">Tap a coconut to throw.</p>
        </>
      }
    >
      <div className="shy">
        <div className="shy-back" />
        <div className="shy-row">
          {Array.from({ length: 5 }, (_, i) => {
            const hit = phase === 'reveal' && target === i;
            const showPrize = phase === 'reveal' && prizeAt === i;
            return (
              <button key={i} className="shy-slot" onClick={() => void throwAt(i)} disabled={phase === 'throw'} aria-label={`Coconut ${i + 1}`}>
                <span className={`coconut${hit ? ' knocked' : ''}${mode === 'golden' ? ' gold-mode' : ''}`}>
                  <i />
                </span>
                <span className="post" />
                {showPrize && (
                  <span className={`prize-pop${tier === 'golden' ? ' golden' : ''}${target === i ? '' : ' missed'}`}>
                    {tier === 'golden' ? '🌟 ×20' : target === i ? `×${round!.multiplier}` : 'here!'}
                  </span>
                )}
                {hit && !showPrize && <span className="prize-pop empty">miss</span>}
              </button>
            );
          })}
        </div>
        {phase === 'throw' && target != null && <span className="ball" style={{ ['--tx' as string]: `${(target - 2) * 19}%` }} />}
      </div>
      <Result round={phase === 'reveal' ? round : null} text={phase === 'idle' ? `Classic: 1 in 5 pays ×4.8 · Golden: 18% win, up to ×20` : undefined} />
    </Shell>
  );
}

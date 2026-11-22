import { useEffect, useRef, useState } from 'react';
import { FISHING_HOLES, FISHING_TABLES } from '../api/rules.ts';
import type { RoundView, Tier } from '../api/types.ts';
import { useGame } from '../store/game.ts';
import { sound } from '../ui/sound.ts';
import { Result, Shell, StakePicker, wait } from './GameOverlay.tsx';

export const FISH: Record<string, { icon: string; name: string }> = {
  boot: { icon: '🥾', name: 'An old boot' },
  sardine: { icon: '🐟', name: 'Sardine' },
  perch: { icon: '🐠', name: 'Perch' },
  trout: { icon: '🐡', name: 'Trout' },
  salmon: { icon: '🐟', name: 'Salmon' },
  tuna: { icon: '🐟', name: 'Bluefin tuna' },
  cod: { icon: '🐟', name: 'Cod' },
  snapper: { icon: '🐠', name: 'Red snapper' },
  swordfish: { icon: '🐟', name: 'Swordfish' },
  shark: { icon: '🦈', name: 'Shark' },
  whale: { icon: '🐋', name: 'Whale (catch and release!)' },
  eel: { icon: '🐍', name: 'Electric eel' },
  angler: { icon: '🐡', name: 'Anglerfish' },
  squid: { icon: '🦑', name: 'Giant squid' },
  kraken: { icon: '🐙', name: 'Baby kraken' },
  narwhal: { icon: '🦄', name: 'Golden narwhal' },
};
const HOLES: Record<string, { name: string; depth: string; feel: string }> = {
  shallow: { name: 'Shallow', depth: '2 m', feel: 'Lots of nibbles' },
  deep: { name: 'Deep', depth: '40 m', feel: 'Bigger fish, fewer bites' },
  abyss: { name: 'The Abyss', depth: '???', feel: 'Rarely bites… but what bites!' },
};

/**
 * Ice Fishing (Frost Isle): pick a hole — shallow, deep or the abyss — and cast. The catch is drawn by the server from
 * that hole's table: the deeper the hole, the rarer the bites and the bigger the fish. Every hole returns 96%.
 */
export function IceFishing() {
  const pt = useGame((s) => s.meta('ice-fishing')?.paytable);
  const holes = pt?.holes ?? FISHING_HOLES;
  const tables: Tier[][] = pt?.tables ?? FISHING_TABLES;
  const stake = useGame((s) => s.stake);
  const busy = useGame((s) => s.busy);
  const bet = useGame((s) => s.bet);
  const finish = useGame((s) => s.finish);
  const [hole, setHole] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'cast' | 'bite' | 'reel' | 'done'>('idle');
  const [round, setRound] = useState<RoundView | null>(null);
  const seq = useRef(0);
  useEffect(() => () => void (seq.current = -1), []);
  const busyFishing = phase === 'cast' || phase === 'bite' || phase === 'reel';

  const cast = async () => {
    if (busyFishing || busy) return;
    const my = ++seq.current;
    setRound(null);
    const s = await bet({ game: 'ice-fishing', stake, choice: hole });
    if (!s?.round || my !== seq.current) return;
    setPhase('cast');
    sound.play('splash');
    await wait(1100 + hole * 350);
    if (my !== seq.current) return;
    setPhase('bite');
    sound.play('pop');
    await wait(500);
    if (my !== seq.current) return;
    setPhase('reel');
    const reel = window.setInterval(() => sound.play('reel'), 70);
    await wait(900);
    clearInterval(reel);
    if (my !== seq.current) return;
    setPhase('done');
    setRound(s.round);
    sound.play(s.round.payout > 0 ? 'splash' : 'thud');
    finish(s);
  };

  const fish: string | undefined = round?.outcome?.fish;
  const table = tables[hole];
  const top = table[table.length - 1];
  return (
    <Shell
      game="ice-fishing"
      live={busyFishing}
      footer={
        <>
          <StakePicker disabled={busyFishing} />
          <button className="btn btn-gold btn-wide" disabled={busyFishing || busy} onClick={() => void cast()}>
            {phase === 'cast' ? 'Waiting for a bite…' : phase === 'bite' ? 'A bite!' : phase === 'reel' ? 'Reeling in…' : `Cast into the ${HOLES[holes[hole]].name.replace('The ', '')}`}
          </button>
        </>
      }
    >
      <div className="ice">
        <div className="holes" role="radiogroup" aria-label="Your hole">
          {holes.map((h, i) => (
            <button
              key={h}
              role="radio"
              aria-checked={hole === i}
              className={`hole h-${h}${hole === i ? ' on' : ''}`}
              disabled={busyFishing}
              onClick={() => {
                sound.play('chip');
                setHole(i);
                setPhase('idle');
                setRound(null);
              }}
            >
              <span className="water" />
              <b>{HOLES[h].name}</b>
              <small>{HOLES[h].depth} · {HOLES[h].feel}</small>
              <em>up to ×{tables[i][tables[i].length - 1].multiplier}</em>
            </button>
          ))}
        </div>
        <div className={`pond-ice ${phase} d-${holes[hole]}`}>
          <i className="rod" />
          <i className="line" />
          <i className="bobber" />
          {phase === 'done' && fish && (
            <div className={`catch${round && round.payout > round.stake ? ' good' : ''}`}>
              <span>{FISH[fish]?.icon ?? '🐟'}</span>
              <b>{FISH[fish]?.name ?? fish}</b>
              {round && round.multiplier > 0 && <em>×{round.multiplier}</em>}
            </div>
          )}
          <i className="flake f1" />
          <i className="flake f2" />
          <i className="flake f3" />
        </div>
      </div>
      <Result round={round} text={busyFishing ? 'Shh… don’t scare the fish' : `${HOLES[holes[hole]].name}: top catch ${FISH[top.key]?.icon} ×${top.multiplier}`} />
    </Shell>
  );
}

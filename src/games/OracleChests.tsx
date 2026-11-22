import { useState } from 'react';
import { ORACLE_STAY, ORACLE_SWITCH } from '../api/rules.ts';
import type { State } from '../api/types.ts';
import { useGame } from '../store/game.ts';
import { sound } from '../ui/sound.ts';
import { Result, Shell, StakePicker, wait } from './GameOverlay.tsx';

/**
 * Oracle's Chests (Sky Kingdom): pick one of three chests. The Oracle — who knows where the treasure is — opens an empty
 * one of the other two, then asks: stay (wins 1 time in 3, ×2.88) or switch (wins 2 times in 3, ×1.44)? Both return
 * the same 96%; it's only how bold you feel. The round waits on the server between the two steps.
 */
export function OracleChests() {
  const pt = useGame((s) => s.meta('oracle-chests')?.paytable);
  const stayPays = pt?.stay ?? ORACLE_STAY;
  const switchPays = pt?.switch ?? ORACLE_SWITCH;
  const stake = useGame((s) => s.stake);
  const busy = useGame((s) => s.busy);
  const bet = useGame((s) => s.bet);
  const run = useGame((s) => s.run);
  const finish = useGame((s) => s.finish);
  const live = useGame((s) => (s.state?.round?.game === 'oracle-chests' && s.state.round.status === 'live' ? s.state.round : null));
  const [choice, setChoice] = useState(1);
  const [ended, setEnded] = useState<State | null>(null);
  const [opening, setOpening] = useState(false);

  const round = live ?? ended?.round ?? null;
  const o = round?.outcome as { pick: number; opened: number; final?: number; treasure?: number } | undefined;
  const pick = live ? o!.pick : ended ? o!.pick : choice;
  const other = o ? [0, 1, 2].find((c) => c !== o.pick && c !== o.opened)! : null;

  const ask = async () => {
    if (busy || live) return;
    setEnded(null);
    const s = await bet({ game: 'oracle-chests', stake, choice });
    if (s) sound.play('magic');
  };

  const decide = async (stay: boolean) => {
    if (!live || busy || opening) return;
    setOpening(true);
    const s = await run((api) => api.action(stay ? 'stay' : 'switch'), { holdBalance: true });
    if (!s?.round) {
      setOpening(false);
      return;
    }
    sound.play('door');
    setEnded(s);
    await wait(700);
    setOpening(false);
    sound.play(s.round.payout > 0 ? 'chime' : 'thud');
    finish(s);
  };

  const chestState = (c: number) => {
    if (!o) return '';
    if (ended) return c === o.treasure ? ' open gold' : ' open empty';
    if (c === o.opened) return ' open empty';
    return '';
  };
  const label = (c: number) => {
    if (!o) return c === choice ? 'Your pick' : '';
    if (ended) return c === o.final ? (c === o.treasure ? 'Yours — treasure!' : 'Yours — empty') : c === o.treasure ? 'The treasure' : '';
    if (c === o.opened) return 'Empty!';
    if (c === o.pick) return 'Your pick';
    return 'Switch here?';
  };

  return (
    <Shell
      game="oracle-chests"
      live={!!live || opening}
      footer={
        live ? (
          <div className="oracle-actions">
            <button className="btn btn-mint" disabled={busy || opening} onClick={() => void decide(true)}>
              Stay with chest {pick + 1}<small>wins 1 in 3 · ×{stayPays}</small>
            </button>
            <button className="btn btn-sky" disabled={busy || opening} onClick={() => void decide(false)}>
              Switch to chest {(other ?? 0) + 1}<small>wins 2 in 3 · ×{switchPays}</small>
            </button>
          </div>
        ) : (
          <>
            <StakePicker disabled={busy} />
            <button className="btn btn-gold btn-wide" disabled={busy} onClick={() => void ask()}>
              Choose chest {choice + 1} and ask the Oracle
            </button>
          </>
        )
      }
    >
      <div className={`oracle${live ? ' asking' : ''}`}>
        <div className="seer">
          <span className="orb">🔮</span>
          <p>
            {live
              ? `“Chest ${o!.opened + 1} is empty. Will you keep chest ${o!.pick + 1}… or switch to chest ${(other ?? 0) + 1}?”`
              : ended
                ? ended.round!.payout > 0 ? '“Fortune favours you, traveller.”' : '“The treasure hid elsewhere this time.”'
                : '“One chest holds treasure. Choose, and I shall open an empty one for you.”'}
          </p>
        </div>
        <div className="chests">
          {[0, 1, 2].map((c) => (
            <button
              key={c}
              className={`chest-b${(o ? c === pick : c === choice) ? ' mine' : ''}${chestState(c)}`}
              disabled={!!live || busy}
              onClick={() => {
                sound.play('chip');
                setEnded(null);
                setChoice(c);
              }}
              aria-label={`Chest ${c + 1}`}
            >
              <span className="lid" />
              <span className="box" />
              <span className="inside">{chestState(c).includes('gold') ? '💰' : chestState(c).includes('empty') ? '💨' : ''}</span>
              <small>{label(c) || `Chest ${c + 1}`}</small>
            </button>
          ))}
        </div>
      </div>
      <Result round={ended?.round ?? null} text={live ? 'Staying is bolder; switching wins more often' : `Stay: ×${stayPays} · Switch: ×${switchPays} — both fair`} />
    </Shell>
  );
}

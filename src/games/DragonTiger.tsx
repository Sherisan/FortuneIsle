import { useState } from 'react';
import { DT_PAYS, DT_TIE } from '../api/rules.ts';
import type { RoundView } from '../api/types.ts';
import { useGame } from '../store/game.ts';
import { sound } from '../ui/sound.ts';
import { Result, Shell, StakePicker, wait } from './GameOverlay.tsx';

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['♠', '♥', '♦', '♣'];
const SIDES = [
  { key: 'dragon', name: 'Dragon', icon: '🐉' },
  { key: 'tie', name: 'Tie', icon: '🤝' },
  { key: 'tiger', name: 'Tiger', icon: '🐯' },
] as const;
const CHOICE: Record<string, number> = { dragon: 0, tiger: 1, tie: 2 };

type Card = { rank: number; suit: number };

function CardView({ card, up, win, who }: { card: Card | null; up: boolean; win: boolean; who: string }) {
  const red = card && (card.suit === 1 || card.suit === 2);
  return (
    <div className={`dt-card${up && card ? ' up' : ''}${win ? ' win' : ''}`} aria-label={card && up ? `${who}: ${RANKS[card.rank]}${SUITS[card.suit]}` : `${who}: face down`}>
      <div className="dt-back" />
      {card && (
        <div className={`dt-face${red ? ' red' : ''}`}>
          <b>{RANKS[card.rank]}</b>
          <span>{SUITS[card.suit]}</span>
          <b className="flip">{RANKS[card.rank]}</b>
        </div>
      )}
    </div>
  );
}

/**
 * Dragon Tiger (the Grand Casino's card tables): one card to the Dragon, one to the Tiger (ace low, suits don't count).
 * Back the higher card at ×2.08 or a tie at ×12.48; a tie loses Dragon and Tiger bets. Cards come from an infinite deck.
 */
export function DragonTiger() {
  const stake = useGame((s) => s.stake);
  const busy = useGame((s) => s.busy);
  const bet = useGame((s) => s.bet);
  const finish = useGame((s) => s.finish);
  const vip = useGame((s) => s.scene === 'vip');
  const pt = useGame((s) => s.meta('dragon-tiger')?.paytable);
  const [side, setSide] = useState<'dragon' | 'tiger' | 'tie'>('dragon');
  const [cards, setCards] = useState<{ dragon: Card; tiger: Card } | null>(null);
  const [up, setUp] = useState({ dragon: false, tiger: false });
  const [round, setRound] = useState<RoundView | null>(null);
  const [dealing, setDealing] = useState(false);

  const deal = async () => {
    if (busy || dealing) return;
    setDealing(true);
    setRound(null);
    setUp({ dragon: false, tiger: false });
    setCards(null);
    const s = await bet({ game: 'dragon-tiger', stake, choice: CHOICE[side] });
    if (!s?.round) {
      setDealing(false);
      return;
    }
    const o = s.round.outcome;
    setCards({ dragon: o.dragon, tiger: o.tiger });
    sound.play('whoosh');
    await wait(450);
    setUp((u) => ({ ...u, dragon: true }));
    sound.play('pop');
    await wait(650);
    setUp({ dragon: true, tiger: true });
    sound.play('pop');
    await wait(450);
    setRound(s.round);
    setDealing(false);
    finish(s);
  };

  const winner: string | null = round?.outcome?.winner ?? null;
  const pays = (k: string) => (k === 'tie' ? pt?.tie ?? DT_TIE : pt?.pays ?? DT_PAYS);

  return (
    <Shell
      game="dragon-tiger"
      live={dealing}
      footer={
        <>
          <StakePicker disabled={dealing} />
          <button className="btn btn-gold btn-wide" disabled={busy || dealing} onClick={() => void deal()}>
            {dealing ? 'Dealing…' : `Deal — back the ${SIDES.find((x) => x.key === side)!.name}`}
          </button>
        </>
      }
    >
      <div className={`dt-table${vip ? ' gold' : ''}`}>
        <div className="dt-hands">
          {(['dragon', 'tiger'] as const).map((k) => (
            <div key={k} className={`dt-hand ${k}${winner === k ? ' won' : ''}`}>
              <h4>{k === 'dragon' ? '🐉 DRAGON' : 'TIGER 🐯'}</h4>
              <CardView card={cards?.[k] ?? null} up={up[k]} win={winner === k} who={k} />
            </div>
          ))}
          {winner === 'tie' && <div className="dt-tie">TIE!</div>}
        </div>
        <div className="dt-bets" role="radiogroup" aria-label="Your bet">
          {SIDES.map((x) => (
            <button
              key={x.key}
              role="radio"
              aria-checked={side === x.key}
              className={`dt-bet ${x.key}${side === x.key ? ' on' : ''}${winner === x.key ? ' won' : ''}`}
              disabled={dealing}
              onClick={() => {
                sound.play('chip');
                setSide(x.key);
              }}
            >
              <span>{x.icon}</span>
              <b>{x.name}</b>
              <small>pays ×{pays(x.key)}</small>
            </button>
          ))}
        </div>
      </div>
      <Result round={round} text={dealing ? 'Cards coming…' : 'Higher card wins · ace is low · a tie loses Dragon and Tiger'} />
    </Shell>
  );
}

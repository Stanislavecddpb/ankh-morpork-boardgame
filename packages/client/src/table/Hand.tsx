import { CARD_BY_ID, HIDDEN_CARD, type AMState } from '@am/engine';
import { cardImg } from './assets';

export function Hand({ G, me, canPlay, onPlay }: {
  G: AMState; me: string | null; canPlay: boolean; onPlay: (cardId: string) => void;
}) {
  const hand = me ? G.players[me]?.hand ?? [] : [];
  return (
    <div className="hand">
      {hand.filter((c) => c !== HIDDEN_CARD).map((id, i) => (
        <button key={`${id}-${i}`} className="hand-card" disabled={!canPlay} onClick={() => onPlay(id)}
          title={CARD_BY_ID[id]?.name}>
          <img src={cardImg(id)} alt={CARD_BY_ID[id]?.name ?? id} />
        </button>
      ))}
      {hand.length === 0 && <div className="hand-empty">Рука пуста</div>}
    </div>
  );
}

import { CARD_BY_ID, HIDDEN_CARD, type AMState } from '@am/engine';
import { cardImg } from './assets';

/** Рука — выдвижная панель поверх низа поля: закрыта, пока не нужна (и чтобы не подсмотрели). */
export function Hand({ G, me, open, setOpen, canPlay, onPlay }: {
  G: AMState; me: string | null; open: boolean; setOpen: (v: boolean) => void;
  canPlay: boolean; onPlay: (cardId: string) => void;
}) {
  const hand = (me ? G.players[me]?.hand ?? [] : []).filter((c) => c !== HIDDEN_CARD);
  return (
    <div className={`hand-drawer ${open ? 'open' : ''}`}>
      <button className="hand-toggle btn" onClick={() => setOpen(!open)}>
        🂠 {open ? 'Скрыть руку' : `Рука (${hand.length})`}{!open && canPlay ? ' — ваш ход' : ''}
      </button>
      {open && (
        <div className="hand">
          {hand.map((id, i) => (
            <button key={`${id}-${i}`} className="hand-card" disabled={!canPlay} onClick={() => onPlay(id)}
              title={canPlay ? `Сыграть «${CARD_BY_ID[id]?.name}»` : CARD_BY_ID[id]?.name}>
              <img src={cardImg(id)} alt={CARD_BY_ID[id]?.name ?? id} />
            </button>
          ))}
          {hand.length === 0 && <div className="hand-empty">Рука пуста</div>}
        </div>
      )}
    </div>
  );
}

import { CARD_BY_ID, EVENT_BY_ID, deckSize, eventsLeft, type AMState } from '@am/engine';
import { BACK_EVENT, BACK_PLAY, cardImg, eventImg } from './assets';

/** Колоды справа от поля, как на реальном столе: игровая и событий рубашкой вверх, сбросы лицом. */
export function Decks({ G }: { G: AMState }) {
  const top = G.discard.at(-1);
  const deck = deckSize(G);
  const events = eventsLeft(G);
  return (
    <aside className="decks">
      <figure className="deck">
        {deck > 0 ? <img src={BACK_PLAY} alt="Игровая колода" className={deck > 1 ? 'stack' : ''} /> : <div className="deck-empty" />}
        <figcaption>Колода · {deck}</figcaption>
      </figure>
      <figure className="deck">
        {top ? <img src={cardImg(top)} alt={CARD_BY_ID[top]?.name} title={CARD_BY_ID[top]?.name} /> : <div className="deck-empty" />}
        <figcaption>Сброс · {G.discard.length}</figcaption>
      </figure>
      <figure className="deck">
        {events > 0 ? <img src={BACK_EVENT} alt="События" className={events > 1 ? 'stack' : ''} /> : <div className="deck-empty" />}
        <figcaption>События · {events}</figcaption>
      </figure>
      {G.lastEvent && (
        <figure className="deck">
          <img src={eventImg(G.lastEvent)} alt={EVENT_BY_ID[G.lastEvent]?.name} title={EVENT_BY_ID[G.lastEvent]?.name} />
          <figcaption>Событие хода</figcaption>
        </figure>
      )}
    </aside>
  );
}

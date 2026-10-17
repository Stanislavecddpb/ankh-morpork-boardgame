import { useEffect, useState } from 'react';
import { EVENT_BY_ID, PERSONALITY_BY_ID, deckSize, eventsLeft, type AMState, type PersonalityId } from '@am/engine';
import { BACK_EVENT, BACK_PERSONALITY, BACK_PLAY, eventImg, personalityImg } from './assets';

/** Колоды справа от поля, как на реальном столе: игровая, сброс и события рубашкой вверх. */
export function Decks({ G, personality, flipKey }: { G: AMState; personality: PersonalityId | null; flipKey: string }) {
  // Личность лежит рубашкой вверх; переворачивается кликом и снова закрывается при смене хода/игрока.
  const [shown, setShown] = useState(false);
  useEffect(() => setShown(false), [flipKey]);
  const deck = deckSize(G);
  const events = eventsLeft(G);
  return (
    <aside className="decks">
      <figure className="deck">
        {deck > 0 ? <img src={BACK_PLAY} alt="Игровая колода" className={deck > 1 ? 'stack' : ''} /> : <div className="deck-empty" />}
        <figcaption>Колода · {deck}</figcaption>
      </figure>
      <figure className="deck">
        {G.discard.length > 0 ? <img src={BACK_PLAY} alt="Сброс" className={G.discard.length > 1 ? 'stack' : ''} /> : <div className="deck-empty" />}
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
      {personality && (
        <figure className="deck personality-card">
          <button className={`flip ${shown ? 'shown' : ''}`} onClick={() => setShown(!shown)}
            title={shown ? 'Скрыть личность' : 'Посмотреть свою личность'}>
            <img src={shown ? personalityImg(personality) : BACK_PERSONALITY}
              alt={shown ? PERSONALITY_BY_ID[personality]?.name : 'Ваша личность (скрыта)'} />
          </button>
          <figcaption>{shown ? 'Ваша личность' : 'Личность · нажмите'}</figcaption>
        </figure>
      )}
    </aside>
  );
}

import { refillHand } from '../turn';
import { defineEffects, type Effect, type EffectApi } from './run';
import { ask, cardNames, moveCards, say } from './ops';

/** Сбросить от min до max карт из своей руки; after — что дать за сброшенные. */
const discard = (min: number, max: number | undefined, text: string, after?: (api: EffectApi, n: number) => void): Effect => ({
  start: (api) => ask(api, { step: 'discard', kind: 'hand', options: [], min, max, text }),
  answer(api, _p, c) {
    const cards = c as string[];
    moveCards(api.G, api.pid, 'discard', cards);
    say(api, cards.length ? `сбрасывает ${cardNames(cards)}` : 'ничего не сбрасывает');
    after?.(api, cards.length);
    return null;
  },
});

const forMoney = (per: number) => (api: EffectApi, n: number) => {
  api.G.players[api.pid].money += per * n;
  say(api, `+$${per * n}`);
};

defineEffects({
  modo: discard(1, 1, 'Сбросьте одну карту'),
  luggage: discard(1, 1, 'Сбросьте одну карту'),
  'harry-king': discard(0, undefined, 'Сбросьте любое число карт: $2 за каждую', forMoney(2)),
  'shonky-shop': discard(0, undefined, 'Сбросьте любое число карт: $1 за каждую', forMoney(1)),
  'alchemist-guild': discard(0, 3, 'Сбросьте до трёх карт — затем доберёте руку до пяти', (api) => {
    api.lock();
    refillHand(api.G, api.pid);
    say(api, 'добирает руку до пяти');
  }),
});

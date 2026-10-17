import type { AMState, PlayerID } from './types';

export const HIDDEN_CARD = '?';

/** Что видит игрок: свою руку и личность; у остальных — только число карт; колоды — только размер. */
export function playerView({ G, playerID }: { G: AMState; playerID?: PlayerID | null }): AMState {
  const players = Object.fromEntries(
    Object.entries(G.players).map(([pid, p]) => [
      pid,
      pid === playerID || G.gameover ? p : { ...p, hand: p.hand.map(() => HIDDEN_CARD), personality: null },
    ]),
  );
  return { ...G, players, deck: [], events: [], deckCount: G.deck.length, eventsCount: G.events.length };
}

export const deckSize = (G: AMState): number => G.deckCount ?? G.deck.length;
export const eventsLeft = (G: AMState): number => G.eventsCount ?? G.events.length;

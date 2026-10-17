import type { AMState, PlayerID } from './types';

export const HIDDEN_CARD = '?';

/** Что видит игрок: свою руку и личность; у остальных — только число карт; колоды — только размер. */
export function playerView({ G, playerID }: { G: AMState; playerID?: PlayerID | null }): AMState {
  if (G.gameover) return G;
  const players = Object.fromEntries(
    Object.entries(G.players).map(([pid, p]) => [
      pid,
      pid === playerID ? p : { ...p, hand: p.hand.map(() => HIDDEN_CARD), personality: null },
    ]),
  );
  // Скрытое в вопросе видит только тот, кто отвечает.
  const prompt = G.prompt && G.prompt.actor !== playerID && (G.prompt.reveal || G.prompt.kind === 'reveal')
    ? { ...G.prompt, reveal: undefined, options: [] }
    : G.prompt;
  return {
    ...G, players, prompt,
    deck: [], events: [], spare: [],
    peek: G.peek?.player === playerID ? G.peek : null,
    deckCount: G.deck.length, eventsCount: G.events.length, spareCount: G.spare.length,
  };
}

export const deckSize = (G: AMState): number => G.deckCount ?? G.deck.length;
export const eventsLeft = (G: AMState): number => G.eventsCount ?? G.events.length;

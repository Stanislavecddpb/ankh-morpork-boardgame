import type { AMState, Choice, PlayerID } from '../types';
import { setupGame } from '../setup';
import { currentSymbol, doEvent, playCard, skipSymbol, startTurn } from '../turn';
import { answerPrompt, makeApi, startScroll, type Rnd } from './run';
import { answerOffer, isInterrupt } from './interrupts';
import './index';

/** Убрать карты-прерывания из рук (кроме тестов прерываний они только мешают): заменить картами из колоды. */
export function noInterrupts(G: AMState): void {
  G.deck = G.deck.filter((c) => !isInterrupt(c));
  for (const p of Object.values(G.players)) {
    p.hand = p.hand.map((c) => (isInterrupt(c) ? G.deck.pop()! : c));
  }
}

/** Партия на n игроков, у '0' в руке cardId, карта сыграна и доведена до свитка. */
export function scenario(cardId: string, opts: { players?: number; rolls?: number[]; setup?: (G: AMState) => void } = {}) {
  const G = setupGame(opts.players ?? 3, (a) => [...a]);
  noInterrupts(G);
  startTurn(G);
  G.players['0'].hand = [cardId];
  opts.setup?.(G);
  playCard(G, '0', cardId);
  while (G.play && currentSymbol(G)?.kind !== 'scroll') {
    if (currentSymbol(G)!.kind === 'event') doEvent(G, '0');
    else skipSymbol(G, '0');
  }
  const rolls = [...(opts.rolls ?? [])];
  const rnd: Rnd = { d12: () => rolls.shift() ?? 6, shuffle: (a) => [...a] };
  const order = Object.keys(G.players);
  return {
    G,
    start: () => startScroll(makeApi(G, '0', order, rnd)),
    answer: (pid: PlayerID, choice: Choice) => answerPrompt(makeApi(G, '0', order, rnd), pid, choice),
    prompt: () => G.prompt,
    offer: (pid: PlayerID, choice: string | number) => answerOffer(makeApi(G, '0', order, rnd), pid, choice),
  };
}

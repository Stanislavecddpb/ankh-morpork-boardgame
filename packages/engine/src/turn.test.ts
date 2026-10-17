import { describe, it, expect } from 'vitest';
import { setupGame } from './setup';
import type { AMState } from './types';
import {
  startTurn, playCard, currentSymbol, doMoney, doPlayAnother, doMinion, doEvent, skipSymbol,
  doAssassinate, canEndTurn, refillHand,
} from './turn';

function withHand(cards: string[]): AMState {
  const G = setupGame(2, (a) => [...a]);
  G.players['0'].hand = [...cards];
  startTurn(G);
  return G;
}

describe('розыгрыш карты', () => {
  it('символы по очереди; карта уходит в сброс', () => {
    const G = withHand(['pink-pussycat-club']); // $3, сыграть ещё
    expect(playCard(G, '0', 'pink-pussycat-club')).toBeNull();
    expect(G.players['0'].hand).toEqual([]);
    expect(currentSymbol(G)).toEqual({ kind: 'money', amount: 3 });
    expect(doPlayAnother(G, '0')).not.toBeNull(); // не тот символ
    expect(doMoney(G, '0')).toBeNull();
    expect(G.players['0'].money).toBe(13);
    expect(doPlayAnother(G, '0')).toBeNull();
    expect(G.play).toBeNull();
    expect(G.discard).toEqual(['pink-pussycat-club']);
    expect(G.playsLeft).toBe(1);
  });

  it('нельзя сыграть вторую карту без «сыграть ещё»', () => {
    const G = withHand(['dwarves', 'hello']);
    playCard(G, '0', 'dwarves');
    expect(playCard(G, '0', 'hello')).not.toBeNull(); // первая ещё не доиграна
    skipSymbol(G, '0');
    skipSymbol(G, '0');
    expect(G.play).toBeNull();
    expect(playCard(G, '0', 'hello')).not.toBeNull(); // лимит исчерпан
  });

  it('слуга по символу «Агент»', () => {
    const G = withHand(['dwarves']);
    playCard(G, '0', 'dwarves');
    expect(doMinion(G, '0', 9)).not.toBeNull();
    expect(doMinion(G, '0', 2)).toBeNull();
    expect(G.areas[2].minions['0']).toBe(1);
    expect(currentSymbol(G)?.kind).toBe('minion');
  });

  it('случайное событие нельзя пропустить; вытянутое событие видно', () => {
    const G = withHand(['rincewind']);
    const top = G.events[0];
    playCard(G, '0', 'rincewind');
    expect(skipSymbol(G, '0')).not.toBeNull();
    expect(doEvent(G, '0')).toBeNull();
    expect(G.lastEvent).toBe(top);
    expect(G.events).toHaveLength(11);
    expect(currentSymbol(G)?.kind).toBe('scroll');
  });

  it('убийство по черепу', () => {
    const G = withHand(['hello']);
    playCard(G, '0', 'hello');
    expect(doAssassinate(G, '0', 1, { kind: 'minion', owner: '1' })).toBeNull();
    expect(G.areas[1].minions['1']).toBe(0);
  });
});

describe('конец хода', () => {
  it('нельзя, пока карта не доиграна или ни одна не сыграна', () => {
    const G = withHand(['dwarves']);
    expect(canEndTurn(G, '0')).not.toBeNull();
    playCard(G, '0', 'dwarves');
    expect(canEndTurn(G, '0')).not.toBeNull();
    skipSymbol(G, '0');
    skipSymbol(G, '0');
    expect(canEndTurn(G, '0')).toBeNull();
  });

  it('с пустой рукой можно сразу', () => {
    const G = withHand([]);
    expect(canEndTurn(G, '0')).toBeNull();
  });

  it('добор до пяти карт', () => {
    const G = withHand(['dwarves']);
    const deck = G.deck.length;
    refillHand(G, '0');
    expect(G.players['0'].hand).toHaveLength(5);
    expect(G.deck).toHaveLength(deck - 4);
  });
});

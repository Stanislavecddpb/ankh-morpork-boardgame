import { describe, it, expect } from 'vitest';
import { setupGame } from './setup';
import type { AMState, PersonalityId } from './types';
import { hasWon, netWorth, finalScore, deckOutResult } from './victory';

function game(n: number, personalities: PersonalityId[]): AMState {
  const G = setupGame(n, (a) => [...a]);
  personalities.forEach((p, i) => (G.players[String(i)].personality = p));
  return G;
}

describe('условия победы', () => {
  it('лорд втроём: контроль 5 районов', () => {
    const G = game(3, ['lord-rust', 'lord-vetinari', 'chrysoprase']);
    for (const id of [2, 3, 4, 6]) G.areas[id].minions['0'] = 1;
    expect(hasWon(G, '0', 3)).toBe(false);
    G.areas[8].minions['0'] = 1;
    expect(hasWon(G, '0', 3)).toBe(true);
  });

  it('Витинари втроём: слуги в 10 районах', () => {
    const G = game(3, ['lord-vetinari', 'lord-rust', 'chrysoprase']);
    for (const id of [2, 3, 4, 6, 8, 9]) G.areas[id].minions['0'] = 1; // + стартовые 1, 5, 7 = 9
    expect(hasWon(G, '0', 3)).toBe(false);
    G.areas[10].minions['0'] = 1;
    expect(hasWon(G, '0', 3)).toBe(true);
  });

  it('Дракон: 8 жетонов беспорядка', () => {
    const G = game(2, ['dragon-king-of-arms', 'lord-rust']);
    for (const id of [2, 3, 4, 6]) G.areas[id].trouble = true;
    expect(hasWon(G, '0', 2)).toBe(false);
    G.areas[8].trouble = true;
    expect(hasWon(G, '0', 2)).toBe(true);
  });

  it('Хризопраз: состояние с учётом зданий и займов', () => {
    const G = game(3, ['chrysoprase', 'lord-rust', 'lord-selachii']);
    G.players['0'].money = 40;
    G.areas[2].building = '0'; // $17
    expect(netWorth(G, '0')).toBe(57);
    G.players['0'].loans = 1;
    expect(netWorth(G, '0')).toBe(45);
    expect(hasWon(G, '0', 3)).toBe(false);
  });

  it('Ваймс сам по себе не побеждает в начале хода', () => {
    const G = game(2, ['commander-vimes', 'lord-rust']);
    expect(hasWon(G, '0', 2)).toBe(false);
  });
});

describe('конец колоды', () => {
  it('есть Ваймс — он победитель', () => {
    const G = game(2, ['lord-rust', 'commander-vimes']);
    const r = deckOutResult(G);
    expect(r).toMatchObject({ winner: '1', reason: 'vimes' });
    expect(r.personalities).toEqual({ '0': 'lord-rust', '1': 'commander-vimes' });
  });

  it('подсчёт очков: слуги, здания, деньги, займы', () => {
    const G = game(2, ['lord-rust', 'lord-selachii']);
    // У каждого 3 слуги (15) + $10.
    G.areas[2].building = '0'; // +17
    G.players['0'].loans = 1; // гасит $12 из $10 не может → −15
    expect(finalScore(G, '0')).toBe(15 + 17 + 10 - 15);
    G.players['1'].money = 30;
    G.players['1'].loans = 1; // гасит: 30 − 12 = 18
    expect(finalScore(G, '1')).toBe(15 + 18);
  });

  it('ничья: побеждает владелец самого дорогого района', () => {
    const G = game(2, ['lord-rust', 'lord-selachii']);
    G.areas[1].building = '0'; // $6
    G.areas[3].building = '1'; // $12
    G.players['0'].money = 16; // 15 + 6 + 16 = 37
    G.players['1'].money = 10; // 15 + 12 + 10 = 37
    const r = deckOutResult(G);
    expect(r.scores).toEqual({ '0': 37, '1': 37 });
    expect(r.winner).toBe('1');
    expect(r.reason).toBe('score');
  });
});

import { describe, it, expect } from 'vitest';
import type { AMState } from '../types';
import { setupGame } from '../setup';
import { skipSymbol, startTurn } from '../turn';
import { applyManual } from '../manual';
import { answerPrompt, makeApi, type Rnd } from './run';
import { districtBlock, usableDistricts, useDistrict } from './districts';
import './index';

const rnd: Rnd = { d12: () => 6, shuffle: (a) => [...a] };

/** Партия на 3, у '0' здания в areas (поставлены до начала хода). */
function game(areas: number[], setup?: (G: AMState) => void) {
  const G = setupGame(3, (a) => [...a]);
  for (const id of areas) G.areas[id].building = '0';
  setup?.(G);
  startTurn(G);
  const api = () => makeApi(G, '0', ['0', '1', '2'], rnd);
  return { G, use: (area: number) => useDistrict(api(), area), answer: (c: any) => answerPrompt(api(), '0', c) };
}

describe('способности районов', () => {
  it('доход: Семеро спящих $3, Гиппо $2, Сонные холмы $1 — раз за ход', () => {
    const { G, use } = game([11, 6, 12]);
    expect(use(11)).toBeNull();
    expect(use(6)).toBeNull();
    expect(use(12)).toBeNull();
    expect(G.players['0'].money).toBe(16);
    expect(use(11)).toBe('Уже использовано в этот ход');
    expect(G.prompt).toBeNull();
  });

  it('нельзя в ход получения, с демоном, отложенную, чужую', () => {
    const { G, use } = game([3, 9]);
    G.areas[6].building = '0';
    expect(use(6)).toBe('Карточка района сейчас не работает');
    G.areas[3].demons = 1;
    expect(use(3)).toBe('Карточка района сейчас не работает');
    expect(applyManual(G, '0', { type: 'toggleDistrict', area: 9 })).toBeNull();
    expect(use(9)).toBe('Карточка района сейчас не работает');
    expect(usableDistricts(G, '0')).toEqual([]);
    startTurn(G);
    expect(usableDistricts(G, '0')).toEqual([6]);
  });

  it('Мелкие Боги без кнопки', () => {
    const { G } = game([4]);
    expect(districtBlock(G, '0', 4)).toMatch(/Мелкие Боги/);
  });

  it('Сестры Долли: $3 и слуга в район или соседний', () => {
    const { G, use, answer } = game([1]);
    expect(use(1)).toBeNull();
    expect(G.prompt!.options).toEqual([1, 2, 3, 12]);
    expect(answer(3)).toBeNull();
    expect(G.areas[3].minions['0']).toBe(1);
    expect(G.players['0'].money).toBe(7);
    expect(G.prompt).toBeNull();
  });

  it('Мраколодец: отказ возвращает способность', () => {
    const { G, use } = game([8]);
    expect(use(8)).toBeNull();
    expect(G.prompt!.options).toEqual([7, 8, 9, 10]);
    expect(skipSymbol(G, '0')).toBeNull();
    expect(G.prompt).toBeNull();
    expect(G.districtsUsed).toEqual([]);
    expect(G.players['0'].money).toBe(10);
    expect(usableDistricts(G, '0')).toEqual([8]);
  });

  it('Внедвижимость: взять и сбросить, без отмены', () => {
    const { G, use, answer } = game([2]);
    const top = G.deck[0];
    expect(use(2)).toBeNull();
    expect(G.players['0'].hand).toContain(top);
    expect(G.prompt!.locked).toBe(true);
    expect(skipSymbol(G, '0')).not.toBeNull();
    expect(answer([top])).toBeNull();
    expect(G.discard).toEqual([top]);
    expect(G.players['0'].hand).toHaveLength(5);
  });

  it('Сточный район: сбросить карту и взять $2', () => {
    const { G, use, answer } = game([5]);
    const c = G.players['0'].hand[0];
    expect(use(5)).toBeNull();
    expect(answer([c])).toBeNull();
    expect(G.discard).toEqual([c]);
    expect(G.players['0'].money).toBe(12);
  });

  it('Тени: беспорядок туда, где есть слуга и нет беспорядка', () => {
    const { G, use, answer } = game([7], (G) => { G.areas[5].trouble = false; G.areas[6].trolls = 1; });
    expect(use(7)).toBeNull();
    expect(G.prompt!.options).toEqual([5, 6]);
    expect(answer(6)).toBeNull();
    expect(G.areas[6].trouble).toBe(true);
  });

  it('Остров Богов: $2 и убрать беспорядок', () => {
    const { G, use, answer } = game([10]);
    expect(use(10)).toBeNull();
    expect(G.prompt!.options).toEqual([1, 5, 7]);
    expect(answer(1)).toBeNull();
    expect(G.areas[1].trouble).toBe(false);
    expect(G.players['0'].money).toBe(8);
  });

  it('карта на столе не двигается от способности района', () => {
    const { G, use } = game([11]);
    G.play = { cardId: 'x', queue: [{ kind: 'money', amount: 1 }] };
    expect(use(11)).toBeNull();
    expect(G.play.queue).toHaveLength(1);
  });
});

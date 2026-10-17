import { describe, it, expect } from 'vitest';
import type { AMState } from '../types';
import { setupGame } from '../setup';
import { doAssassinate, startTurn } from '../turn';
import { scenario, noInterrupts } from './testkit';
import { answerOffer, mossyLawn, offerLosses, playInterrupt, snapshot } from './interrupts';
import { makeApi } from './run';
import { startEvent } from './events';
import './index';

const give = (pid: string, ...cards: string[]) => (G: AMState) => { G.players[pid].hand.push(...cards); };

/** Партия на 3: '0' убивает в Тенях слугу '1'. */
function assassination(...cards: string[]) {
  const G = setupGame(3, (a) => [...a]);
  noInterrupts(G);
  give('1', ...cards)(G);
  startTurn(G);
  G.play = { cardId: 'x', queue: [{ kind: 'assassinate' }] };
  const snap = snapshot(G);
  expect(doAssassinate(G, '0', 7, { kind: 'minion', owner: '1' })).toBeNull();
  offerLosses(G, snap, 'assassinate', '0');
  const api = () => makeApi(G, '0', ['0', '1', '2'], { d12: () => 1, shuffle: (a) => a });
  return { G, offer: (pid: string, c: string | number) => answerOffer(api(), pid, c) };
}

describe('прерывания', () => {
  it('без карты — без предложения', () => {
    const { G } = assassination();
    expect(G.offers).toEqual([]);
  });

  it('Гаспод против убийства: слуга и беспорядок остаются', () => {
    const { G, offer } = assassination('gaspode');
    expect(G.offers[0]).toMatchObject({ player: '1', options: ['gaspode@0', 'none'] });
    expect(offer('0', 'gaspode@0')).not.toBeNull();
    expect(offer('1', 'gaspode@0')).toBeNull();
    expect(G.offers).toEqual([]);
    expect(G.areas[7].minions['1']).toBe(1);
    expect(G.areas[7].trouble).toBe(true);
    expect(G.players['1'].minionSupply).toBe(9);
    expect(G.discard).toContain('gaspode');
    expect(G.players['1'].hand).not.toContain('gaspode');
  });

  it('отказ: слуга убран, карта осталась в руке', () => {
    const { G, offer } = assassination('susan');
    expect(offer('1', 'none')).toBeNull();
    expect(G.areas[7].minions['1']).toBe(0);
    expect(G.players['1'].hand).toContain('susan');
  });

  it('Игорь: убранного слугу — в любой другой район; Сонки против убийства не работает', () => {
    const { G, offer } = assassination('igor', 'wallace-sonky');
    expect(G.offers[0].options).toEqual(['igor@0', 'none']);
    expect(offer('1', 'igor@0')).toBeNull();
    expect(G.offers[0].relocate!.options).not.toContain(7);
    expect(offer('1', 7)).not.toBeNull();
    expect(offer('1', 11)).toBeNull();
    expect(G.offers).toEqual([]);
    expect(G.areas[11].minions['1']).toBe(1);
    expect(G.areas[7].minions['1']).toBe(0);
  });

  it('пока решают — Мосси Лаун ждёт', () => {
    const { G } = assassination('gaspode');
    G.players['0'].hand.push('dr-mossy-lawn');
    expect(mossyLawn(G, '0')).not.toBeNull();
  });

  it('текст карты: Гаспод возвращает передвинутого слугу назад', () => {
    const s = scenario('duckman', { setup: give('1', 'gaspode') });
    s.start();
    s.answer('0', '1:minion:1');
    expect(s.answer('0', 2)).toBeNull();
    expect(s.G.offers[0]).toMatchObject({ player: '1', source: 'scroll', options: ['gaspode@0', 'none'] });
    expect(s.offer('1', 'gaspode@0')).toBeNull();
    expect([s.G.areas[1].minions['1'], s.G.areas[2].minions['1']]).toEqual([1, 0]);
    expect(s.G.areas[1].trouble).toBe(true);
  });

  it('текст карты: Клуб «Начни заново» после Декана', () => {
    const s = scenario('dean-of-pentacles', { setup: (G) => { G.areas[2].minions['2'] = 1; give('2', 'fresh-start-club')(G); } });
    s.start();
    s.answer('0', '2:minion:2');
    expect(s.offer('2', 'fresh-start-club@0')).toBeNull();
    expect(s.offer('2', 9)).toBeNull();
    expect(s.G.areas[9].minions['2']).toBe(1);
  });

  it('Сонки: выбранный целью отменяет текст карты', () => {
    const s = scenario('nobby-nobbs', { setup: give('2', 'wallace-sonky') });
    s.start();
    expect(s.answer('0', '2')).toBeNull();
    expect(s.G.offers[0]).toMatchObject({ player: '2', source: 'target' });
    expect(s.answer('0', '1')).not.toBeNull();
    expect(s.offer('2', 'wallace-sonky')).toBeNull();
    expect(s.G.players['2'].money).toBe(10);
    expect(s.G.prompt).toBeNull();
    expect(s.G.play?.queue[0]?.kind).not.toBe('scroll');
  });

  it('Сонки: отказ — ответ применяется', () => {
    const s = scenario('nobby-nobbs', { setup: give('2', 'wallace-sonky') });
    s.start();
    s.answer('0', '2');
    expect(s.offer('2', 'none')).toBeNull();
    expect([s.G.players['0'].money, s.G.players['2'].money]).toEqual([13, 7]);
  });

  it('событие: Сьюзан спасает от Дракона, Гаспод — нет, свой слуга тоже считается', () => {
    const G = setupGame(3, (a) => [...a]);
    noInterrupts(G);
    give('1', 'gaspode', 'susan')(G);
    give('0', 'igor')(G);
    startTurn(G);
    G.events = ['the-dragon'];
    G.play = { cardId: 'x', queue: [{ kind: 'event' }] };
    const api = () => makeApi(G, '0', ['0', '1', '2'], { d12: () => 7, shuffle: (a) => a });
    expect(startEvent(api())).toBeNull();
    expect(G.offers.map((o) => [o.player, o.options])).toEqual([['0', ['igor@0', 'none']], ['1', ['susan@0', 'none']]]);
    expect(answerOffer(api(), '0', 'none')).toBeNull();
    expect(answerOffer(api(), '1', 'susan@0')).toBeNull();
    expect(G.areas[7].minions['1']).toBe(1);
  });

  it('Доктор Мосси Лаун: недоигранная карта возвращается в руку', () => {
    const G = setupGame(3, (a) => [...a]);
    startTurn(G);
    G.players['0'].hand = ['dr-mossy-lawn'];
    G.play = { cardId: 'nobby-nobbs', queue: [{ kind: 'scroll' }] };
    expect(mossyLawn(G, '0')).toBeNull();
    expect(G.players['0'].hand).toEqual(['nobby-nobbs']);
    expect(G.discard).toEqual(['dr-mossy-lawn']);
    expect(G.play).toBeNull();
  });

  it('Доктор Мосси Лаун: доигранная карта забирается из сброса', () => {
    const G = setupGame(3, (a) => [...a]);
    startTurn(G);
    G.players['0'].hand = ['dr-mossy-lawn'];
    G.lastPlayed = 'nobby-nobbs';
    G.discard = ['nobby-nobbs'];
    expect(mossyLawn(G, '0')).toBeNull();
    expect(G.players['0'].hand).toEqual(['nobby-nobbs']);
    G.lastPlayed = null;
    G.players['0'].hand.push('dr-mossy-lawn');
    expect(mossyLawn(G, '0')).not.toBeNull();
  });

  it('любую карту-прерывание можно сбросить вручную', () => {
    const G = setupGame(3, (a) => [...a]);
    G.players['2'].hand = ['susan', 'nobby-nobbs'];
    expect(playInterrupt(G, '2', 'nobby-nobbs')).not.toBeNull();
    expect(playInterrupt(G, '2', 'susan')).toBeNull();
    expect(G.discard).toEqual(['susan']);
  });
});

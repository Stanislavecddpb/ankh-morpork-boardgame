import { describe, it, expect } from 'vitest';
import { setupGame } from './setup';
import { applyManual } from './manual';
import { playCard, skipSymbol, startTurn } from './turn';

const fresh = () => setupGame(3, (a) => [...a]);

describe('ручной режим', () => {
  it('слуга из запаса и обратно, без автоматических беспорядков', () => {
    const G = fresh();
    expect(applyManual(G, '0', { type: 'minion', area: 9, owner: '1', delta: 1 })).toBeNull();
    expect(G.areas[9].minions['1']).toBe(1);
    expect(G.players['1'].minionSupply).toBe(8);
    expect(G.areas[9].trouble).toBe(false);
    expect(applyManual(G, '0', { type: 'minion', area: 9, owner: '1', delta: -1 })).toBeNull();
    expect(applyManual(G, '0', { type: 'minion', area: 9, owner: '1', delta: -1 })).not.toBeNull();
  });

  it('здание: смена владельца возвращает старое в запас', () => {
    const G = fresh();
    applyManual(G, '0', { type: 'building', area: 4, owner: '1' });
    expect(G.players['1'].buildingSupply).toBe(5);
    applyManual(G, '0', { type: 'building', area: 4, owner: '2' });
    expect(G.players['1'].buildingSupply).toBe(6);
    expect(G.players['2'].buildingSupply).toBe(5);
    applyManual(G, '0', { type: 'building', area: 4, owner: null });
    expect(G.areas[4].building).toBeNull();
    expect(G.players['2'].buildingSupply).toBe(6);
  });

  it('демонов не больше четырёх', () => {
    const G = fresh();
    for (let i = 0; i < 4; i++) expect(applyManual(G, '0', { type: 'demon', area: 9, delta: 1 })).toBeNull();
    expect(applyManual(G, '0', { type: 'demon', area: 10, delta: 1 })).not.toBeNull();
  });

  it('деньги: банк ↔ игрок, игрок → игрок, без ухода в минус', () => {
    const G = fresh();
    expect(applyManual(G, '0', { type: 'money', from: '1', to: '0', amount: 4 })).toBeNull();
    expect(G.players['0'].money).toBe(14);
    expect(G.players['1'].money).toBe(6);
    expect(applyManual(G, '0', { type: 'money', from: '1', to: 'bank', amount: 7 })).not.toBeNull();
    expect(applyManual(G, '0', { type: 'money', from: 'bank', to: '2', amount: 5 })).toBeNull();
    expect(G.players['2'].money).toBe(15);
  });

  it('карты: сбросить, передать, взять из сброса', () => {
    const G = fresh();
    const [a, b] = G.players['0'].hand;
    expect(applyManual(G, '0', { type: 'discard', cardId: a })).toBeNull();
    expect(G.discard).toEqual([a]);
    expect(applyManual(G, '0', { type: 'give', cardId: b, to: '2' })).toBeNull();
    expect(G.players['2'].hand).toContain(b);
    expect(applyManual(G, '0', { type: 'takeDiscard', cardId: a })).toBeNull();
    expect(G.players['0'].hand).toContain(a);
    expect(G.discard).toEqual([]);
  });

  it('займы и беспорядки', () => {
    const G = fresh();
    expect(applyManual(G, '0', { type: 'loan', player: '0', delta: -1 })).not.toBeNull();
    expect(applyManual(G, '0', { type: 'loan', player: '0', delta: 1 })).toBeNull();
    expect(G.players['0'].loans).toBe(1);
    applyManual(G, '0', { type: 'trouble', area: 9, on: true });
    expect(G.areas[9].trouble).toBe(true);
  });

  it('каждое действие пишется в лог', () => {
    const G = fresh();
    applyManual(G, '0', { type: 'trouble', area: 9, on: true });
    expect(G.log.at(-1)).toContain('✋');
  });

  it('разыгрываемую карту можно отдать игроку: после розыгрыша она уйдёт ему в руку', () => {
    const G = fresh();
    G.players['0'].hand = ['fools-guild'];
    startTurn(G);
    expect(applyManual(G, '0', { type: 'givePlayed', to: '1' })).not.toBeNull(); // карта ещё не сыграна
    playCard(G, '0', 'fools-guild');
    expect(applyManual(G, '0', { type: 'givePlayed', to: '0' })).not.toBeNull(); // себе нельзя
    expect(applyManual(G, '0', { type: 'givePlayed', to: '1' })).toBeNull();
    while (G.play) skipSymbol(G, '0');
    expect(G.players['1'].hand).toContain('fools-guild');
    expect(G.discard).not.toContain('fools-guild');
  });
});

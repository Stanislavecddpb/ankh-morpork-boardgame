import { describe, it, expect } from 'vitest';
import { setupGame } from './setup';
import { applyManual, eventBack, peekSpare, swapPersonality, takeRandomCard } from './manual';
import { playCard, refillHand, skipSymbol, startTurn } from './turn';

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

  it('перемещение фишек между районами (без автоматики)', () => {
    const G = fresh();
    expect(applyManual(G, '0', { type: 'movePiece', from: 1, to: 9, piece: 'minion', owner: '1' })).toBeNull();
    expect(G.areas[1].minions['1']).toBe(0);
    expect(G.areas[9].minions['1']).toBe(1);
    expect(G.areas[1].trouble).toBe(true);
    expect(applyManual(G, '0', { type: 'movePiece', from: 1, to: 9, piece: 'trouble' })).toBeNull();
    expect([G.areas[1].trouble, G.areas[9].trouble]).toEqual([false, true]);
    expect(applyManual(G, '0', { type: 'movePiece', from: 2, to: 3, piece: 'demon' })).not.toBeNull();
    G.areas[4].building = '2';
    expect(applyManual(G, '0', { type: 'movePiece', from: 4, to: 6, piece: 'building' })).toBeNull();
    expect([G.areas[4].building, G.areas[6].building]).toEqual([null, '2']);
  });

  it('карта из руки — в колоду и перед игроком; из зоны «перед» — обратно', () => {
    const G = fresh();
    const [a, b, c] = G.players['0'].hand;
    expect(applyManual(G, '0', { type: 'returnToDeck', cardId: a, where: 'top' })).toBeNull();
    expect(G.deck[0]).toBe(a);
    expect(applyManual(G, '0', { type: 'returnToDeck', cardId: b, where: 'bottom' })).toBeNull();
    expect(G.deck.at(-1)).toBe(b);
    expect(applyManual(G, '0', { type: 'toFront', cardId: c, player: '2' })).toBeNull();
    expect(G.players['2'].front).toEqual([c]);
    expect(applyManual(G, '0', { type: 'fromFront', player: '2', cardId: c, to: 'hand' })).toBeNull();
    expect(G.players['0'].hand).toContain(c);
  });

  it('вернуть разыгрываемую карту, +1 карта, убрать событие', () => {
    const G = fresh();
    startTurn(G);
    G.players['0'].hand = ['hex'];
    playCard(G, '0', 'hex');
    expect(applyManual(G, '0', { type: 'returnPlayed' })).toBeNull();
    expect(G.play).toBeNull();
    expect(G.players['0'].hand).toContain('hex');
    expect(G.playsLeft).toBe(1);
    expect(applyManual(G, '0', { type: 'extraPlay' })).toBeNull();
    expect(G.playsLeft).toBe(2);
    G.lastEvent = 'fog';
    expect(applyManual(G, '0', { type: 'dropEvent' })).toBeNull();
    expect(G.lastEvent).toBeNull();
  });

  it('объявить конец игры: победитель или подсчёт', () => {
    const G = fresh();
    expect(applyManual(G, '0', { type: 'declareEnd', winner: '2' })).toBeNull();
    expect(G.gameover).toMatchObject({ winner: '2', reason: 'manual' });
    const H = fresh();
    applyManual(H, '0', { type: 'declareEnd', winner: null });
    expect(H.gameover?.reason).toBe('score');
  });

  it('случайная карта у игрока, событие обратно, личность, просмотр', () => {
    const G = fresh();
    const theirs = [...G.players['1'].hand];
    expect(takeRandomCard(G, '0', '1', (x) => [...x])).toBeNull();
    expect(G.players['0'].hand).toContain(theirs[0]);
    expect(G.players['1'].hand).toHaveLength(4);
    G.lastEvent = 'fog';
    expect(eventBack(G, '0', 'top', (x) => [...x])).toBeNull();
    expect(G.events[0]).toBe('fog');
    const before = G.players['0'].personality;
    expect(swapPersonality(G, '0', (x) => [...x])).toBeNull();
    expect(G.players['0'].personality).not.toBe(before);
    expect(G.spare).toContain(before);
    expect(peekSpare(G, '0')).toBeNull();
    expect(G.peek).toEqual({ player: '0', cards: G.spare });
  });

  it('Гильдия шутов «перед игроком» занимает место в руке при доборе', () => {
    const G = fresh();
    G.players['1'].hand = [];
    G.players['1'].front = ['fools-guild'];
    refillHand(G, '1');
    expect(G.players['1'].hand).toHaveLength(4);
  });
});

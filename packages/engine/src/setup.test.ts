import { describe, it, expect } from 'vitest';
import { AREAS, START_AREAS } from './data/areas';
import { CARD_BY_ID } from './data/cards';
import { setupGame, applySetColor } from './setup';

const keep = <T,>(a: T[]) => [...a];

describe('районы', () => {
  it('12 районов, соседство симметрично и без петель', () => {
    expect(AREAS).toHaveLength(12);
    AREAS.forEach((a, i) => expect(a.id).toBe(i + 1));
    for (const a of AREAS) {
      expect(a.adjacent).not.toContain(a.id);
      for (const n of a.adjacent) expect(AREAS[n - 1].adjacent).toContain(a.id);
    }
  });
});

describe('подготовка', () => {
  it('4 игрока: 5 карт, $10, запас, по слуге и беспорядку в стартовых районах', () => {
    const G = setupGame(4, keep);
    for (const p of Object.values(G.players)) {
      expect(p.hand).toHaveLength(5);
      expect(p.money).toBe(10);
      expect(p.minionSupply).toBe(9);
      expect(p.buildingSupply).toBe(6);
      expect(p.personality).not.toBeNull();
      expect(p.color).toBeNull();
    }
    for (const a of START_AREAS) {
      expect(G.areas[a].trouble).toBe(true);
      for (const pid of ['0', '1', '2', '3']) expect(G.areas[a].minions[pid]).toBe(1);
    }
    expect(G.deck).toHaveLength(101 - 20);
    expect(G.events).toHaveLength(12);
    expect(G.started).toBe(false);
  });

  it('зелёные карты лежат поверх коричневых', () => {
    const G = setupGame(2, keep);
    const decks = G.deck.map((id) => CARD_BY_ID[id].deck);
    const firstBrown = decks.indexOf('brown');
    expect(decks.slice(0, firstBrown).every((d) => d === 'green')).toBe(true);
    expect(decks.slice(firstBrown).every((d) => d === 'brown')).toBe(true);
  });

  it('вдвоём: нет Хризопраза, Хьюберта и Космо', () => {
    const G = setupGame(2, keep);
    const all = [...G.deck, ...G.players['0'].hand, ...G.players['1'].hand];
    expect(all).toHaveLength(99);
    expect(all).not.toContain('hubert');
    expect(all).not.toContain('cosmo-lavish');
    expect(Object.values(G.players).map((p) => p.personality)).not.toContain('chrysoprase');
  });

  it('личности у всех разные', () => {
    const G = setupGame(4, keep);
    const ps = Object.values(G.players).map((p) => p.personality);
    expect(new Set(ps).size).toBe(4);
  });
});

describe('выбор цвета', () => {
  it('свой цвет — любой игрок, чужой — только хост, занятый — нельзя', () => {
    const G = setupGame(3, keep);
    expect(applySetColor(G, '1', '1', 'red')).toBeNull();
    expect(G.players['1'].color).toBe('red');
    expect(applySetColor(G, '2', '2', 'red')).not.toBeNull();
    expect(applySetColor(G, '2', '0', 'blue')).not.toBeNull();
    expect(applySetColor(G, '0', '2', 'blue')).toBeNull();
    expect(applySetColor(G, '0', '0', 'purple')).not.toBeNull();
  });
});

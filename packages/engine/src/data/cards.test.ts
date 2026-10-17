import { describe, it, expect } from 'vitest';
import { CARDS, CARD_BY_ID, PERSONALITIES, EVENTS } from './cards';

const KINDS = ['minion', 'building', 'assassinate', 'removeTrouble', 'money', 'scroll', 'event', 'playAnother', 'interrupt'];

describe('каталог карт', () => {
  it('48 зелёных и 53 коричневые, id уникальны', () => {
    expect(CARDS.filter((c) => c.deck === 'green')).toHaveLength(48);
    expect(CARDS.filter((c) => c.deck === 'brown')).toHaveLength(53);
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(101);
  });

  it('7 личностей и 12 событий', () => {
    expect(PERSONALITIES.map((p) => p.id).sort()).toEqual([
      'chrysoprase', 'commander-vimes', 'dragon-king-of-arms', 'lord-de-worde', 'lord-rust', 'lord-selachii', 'lord-vetinari',
    ]);
    expect(EVENTS).toHaveLength(12);
  });

  it('символы корректны; у денег есть сумма', () => {
    for (const c of CARDS) {
      for (const s of c.symbols) {
        expect(KINDS).toContain(s.kind);
        if (s.kind === 'money') expect(s.amount).toBeGreaterThan(0);
      }
    }
  });

  it('примеры карт совпадают с оригиналом', () => {
    expect(CARD_BY_ID['moist-von-lipwig'].symbols).toEqual([
      { kind: 'minion' }, { kind: 'money', amount: 3 }, { kind: 'scroll' }, { kind: 'playAnother' },
    ]);
    expect(CARD_BY_ID['hello'].symbols.map((s) => s.kind)).toEqual(['assassinate', 'assassinate', 'building']);
    expect(CARD_BY_ID['the-peeled-nuts'].symbols).toEqual([]);
    expect(CARD_BY_ID['rincewind'].symbols.map((s) => s.kind)).toEqual(['event', 'scroll', 'playAnother']);
  });
});

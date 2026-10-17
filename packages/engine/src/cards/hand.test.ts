import { describe, it, expect } from 'vitest';
import type { AMState } from '../types';
import { scenario } from './testkit';

const withHand = (cards: string[]) => (G: AMState) => { G.players['0'].hand.push(...cards); };

describe('пачка 2: своя рука', () => {
  for (const id of ['modo', 'luggage']) {
    it(`${id}: сбросить одну`, () => {
      const s = scenario(id, { setup: withHand(['a', 'b']) });
      s.start();
      expect(s.prompt()).toMatchObject({ kind: 'hand', min: 1, max: 1 });
      expect(s.answer('0', ['b'])).toBeNull();
      expect(s.G.players['0'].hand).toEqual(['a']);
      expect(s.G.discard).toContain('b');
    });
  }

  it('гарри король: $2 за каждую сброшенную', () => {
    const s = scenario('harry-king', { setup: withHand(['a', 'b', 'c']) });
    s.start();
    s.answer('0', ['a', 'c']);
    expect(s.G.players['0'].money).toBe(14);
  });

  it('магазинчик: $1 за каждую, можно ноль', () => {
    const s = scenario('shonky-shop', { setup: withHand(['a']) });
    s.start();
    expect(s.answer('0', [])).toBeNull();
    expect(s.G.players['0'].money).toBe(10);
  });

  it('алхимики: сбросить до трёх и добрать до пяти', () => {
    const s = scenario('alchemist-guild', { setup: withHand(['a', 'b', 'c', 'd']) });
    s.start();
    expect(s.answer('0', ['a', 'b', 'c', 'd'])).not.toBeNull();
    expect(s.answer('0', ['a', 'b'])).toBeNull();
    expect(s.G.players['0'].hand).toHaveLength(5);
  });

  it('пустая рука — эффект пропускается', () => {
    const s = scenario('modo');
    expect(s.start()).toBeNull();
    expect(s.prompt()).toBeNull();
  });
});

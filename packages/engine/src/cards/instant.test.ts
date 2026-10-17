import { describe, it, expect } from 'vitest';
import { scenario } from './testkit';

const draws: [string, number][] = [
  ['leonard-of-quirm', 4], ['librarian', 4], ['hex', 3], ['sgt-cheery-littlebottom', 2],
  ['clack-towers', 2], ['lecturer-in-recent-runes', 2], ['moist-von-lipwig', 2],
];

describe('пачка 1: без выбора', () => {
  for (const [id, n] of draws) {
    it(`${id}: взять ${n}`, () => {
      const s = scenario(id);
      expect(s.start()).toBeNull();
      expect(s.G.players['0'].hand).toHaveLength(n);
    });
  }

  it('горгульи: по карте за своё здание', () => {
    const s = scenario('gargoyles', { setup: (G) => { G.areas[2].building = '0'; G.areas[3].building = '0'; G.areas[4].building = '1'; } });
    s.start();
    expect(s.G.players['0'].hand).toHaveLength(2);
  });

  for (const id of ['sacharissa-cripslock', 'otto-chriek', 'william-de-worde']) {
    it(`${id}: $1 за беспорядок`, () => {
      const s = scenario(id);
      s.start();
      expect(s.G.players['0'].money).toBe(13);
    });
  }

  for (const id of ['post-office', 'sir-charles-lavatory']) {
    it(`${id}: $1 за здание на поле`, () => {
      const s = scenario(id, { setup: (G) => { G.areas[2].building = '1'; G.areas[3].building = '2'; } });
      s.start();
      expect(s.G.players['0'].money).toBe(12);
    });
  }

  for (const id of ['dysk', 'opera-house']) {
    it(`${id}: $1 за слугу на Острове Богов`, () => {
      const s = scenario(id, { setup: (G) => { G.areas[10].minions['1'] = 2; G.areas[10].minions['2'] = 1; } });
      s.start();
      expect(s.G.players['0'].money).toBe(13);
    });
  }

  for (const id of ['mr-boggis', 'thieves-guild']) {
    it(`${id}: $2 с каждого, если есть`, () => {
      const s = scenario(id, { setup: (G) => { G.players['2'].money = 1; } });
      s.start();
      expect([s.G.players['0'].money, s.G.players['1'].money, s.G.players['2'].money]).toEqual([13, 8, 0]);
    });
  }

  for (const id of ['the-bank-of-ankh-morpork', 'mr-bent']) {
    it(`${id}: займ $10, карта ляжет перед игроком`, () => {
      const s = scenario(id);
      s.start();
      expect(s.G.players['0'].money).toBe(20);
      expect(s.G.players['0'].loans).toBe(1);
      expect(s.G.play?.toFront).toBe('0');
    });
  }

  for (const id of ['drumknott', 'ponder-stibbons']) {
    it(`${id}: ещё две карты`, () => {
      const s = scenario(id);
      s.start();
      expect(s.G.playsLeft).toBeGreaterThanOrEqual(2);
    });
  }

  it('исторические монахи: 4 карты из перемешанного сброса', () => {
    const s = scenario('history-monks', { setup: (G) => { G.discard = ['a', 'b', 'c', 'd', 'e', 'f']; } });
    s.start();
    expect(s.G.players['0'].hand).toEqual(['a', 'b', 'c', 'd']);
    expect(s.G.discard).toEqual(['e', 'f']);
  });
});

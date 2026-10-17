import { describe, it, expect } from 'vitest';
import { scenario } from './testkit';

describe('пачка 6: ответ соперника', () => {
  for (const id of ['fools-guild', 'drwhiteface']) {
    it(`${id}: заплатить $5 или получить карту`, () => {
      const pay = scenario(id);
      pay.start();
      pay.answer('0', '1');
      expect(pay.prompt()).toMatchObject({ actor: '1', kind: 'choice', options: ['pay', 'take'] });
      expect(pay.answer('0', 'pay')).not.toBeNull(); // за соперника нельзя
      pay.answer('1', 'pay');
      expect([pay.G.players['0'].money, pay.G.players['1'].money]).toEqual([15, 5]);

      const take = scenario(id, { setup: (G) => { G.players['2'].money = 3; } });
      take.start();
      take.answer('0', '2');
      expect(take.prompt()?.options).toEqual(['take']);
      take.answer('2', 'take');
      expect(take.G.play?.toFront).toBe('2');
    });
  }

  it('пожарная бригада: отказ — можно убрать его здание', () => {
    const s = scenario('fire-brigade', { setup: (G) => { G.areas[3].building = '1'; } });
    s.start();
    expect(s.prompt()?.options).toEqual(['1']);
    s.answer('0', '1');
    s.answer('1', 'refuse');
    expect(s.prompt()).toMatchObject({ actor: '0', options: ['3:building:1'] });
    s.answer('0', '3:building:1');
    expect(s.G.areas[3].building).toBeNull();
  });

  for (const id of ['queen-molly', 'beggars-guild']) {
    it(`${id}: соперник отдаёт две карты на свой выбор`, () => {
      const s = scenario(id);
      s.start();
      s.answer('0', '1');
      const hand = [...s.G.players['1'].hand];
      expect(s.prompt()).toMatchObject({ actor: '1', kind: 'hand', min: 2, max: 2 });
      s.answer('1', hand.slice(0, 2));
      expect(s.G.players['0'].hand).toEqual(hand.slice(0, 2));
    });
  }

  for (const id of ['rosie-palm', 'seamstresses-guild']) {
    it(`${id}: отдать карту, получить $2`, () => {
      const s = scenario(id, { setup: (G) => { G.players['0'].hand.push('x'); } });
      s.start();
      s.answer('0', '2');
      s.answer('0', ['x']);
      expect(s.G.players['2'].hand).toContain('x');
      expect(s.G.players['0'].money).toBe(12);
    });
  }

  it('санаторий: каждый даёт $1 или карту на свой выбор', () => {
    const s = scenario('ankh-morpork-sunshine-dragon-sanctuary');
    s.start();
    expect(s.prompt()?.actor).toBe('1');
    s.answer('1', 'money');
    expect(s.prompt()?.actor).toBe('2');
    s.answer('2', 'card');
    const card = s.G.players['2'].hand[0];
    s.answer('2', [card]);
    expect(s.G.players['0'].money).toBe(11);
    expect(s.G.players['0'].hand).toContain(card);
    expect(s.prompt()).toBeNull();
  });

  it('аудиторы: каждый другой игрок убирает своего слугу', () => {
    const s = scenario('auditors');
    s.start();
    expect(s.prompt()).toMatchObject({ actor: '1', kind: 'piece' });
    s.answer('1', '1:minion:1');
    expect(s.prompt()?.actor).toBe('2');
    s.answer('2', '5:minion:2');
    expect([s.G.areas[1].minions['1'], s.G.areas[5].minions['2']]).toEqual([0, 0]);
  });

  it('космо лэвиш: $2 игроку, он убирает не вашего слугу из района с беспорядком', () => {
    const s = scenario('cosmo-lavish');
    s.start();
    s.answer('0', '1');
    expect(s.prompt()?.actor).toBe('1');
    expect(s.prompt()?.options).not.toContain('1:minion:0');
    s.answer('1', '7:minion:2');
    expect(s.G.areas[7].minions['2']).toBe(0);
    expect(s.G.players['1'].money).toBe(12);
  });
});

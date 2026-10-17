import { describe, it, expect } from 'vitest';
import { scenario } from './testkit';

describe('пачка 4: поле', () => {
  for (const id of ['duckman', 'foul-ole-ron', 'canting-crew']) {
    it(`${id}: чужой слуга в соседний район`, () => {
      const s = scenario(id);
      s.start();
      expect(s.prompt()?.options).not.toContain('1:minion:0');
      expect(s.answer('0', '1:minion:1')).toBeNull();
      expect(s.prompt()?.options).toEqual([2, 3, 12]);
      s.answer('0', 2);
      expect([s.G.areas[1].minions['1'], s.G.areas[2].minions['1']]).toEqual([0, 1]);
      expect(s.G.areas[1].trouble).toBe(false);
    });
  }

  it('ринсвинд: свой слуга из района с беспорядком в соседний', () => {
    const s = scenario('rincewind');
    s.start();
    expect(s.prompt()?.options).toEqual(['1:minion:0', '5:minion:0', '7:minion:0']);
  });

  for (const id of ['dorfl', 'adora-belle-dearheart']) {
    it(`${id}: свой слуга в любой район`, () => {
      const s = scenario(id);
      s.start();
      s.answer('0', '5:minion:0');
      expect(s.prompt()?.options).toHaveLength(11);
      s.answer('0', 9);
      expect(s.G.areas[9].minions['0']).toBe(1);
    });
  }

  it('конюшни хобсона: $2 игроку, затем перемещение', () => {
    const s = scenario('hobson-livery-stables');
    s.start();
    s.answer('0', '1');
    expect(s.G.players['1'].money).toBe(12);
    expect(s.prompt()?.kind).toBe('piece');
  });

  for (const id of ['mr-shine', 'deep-dwarves']) {
    it(`${id}: слуга в любой район без беспорядка`, () => {
      const s = scenario(id);
      s.start();
      s.answer('0', 9);
      expect(s.G.areas[9].minions['0']).toBe(1);
      expect(s.G.areas[9].trouble).toBe(false);
    });
  }

  it('вилликинс: только район со своим зданием', () => {
    const s = scenario('willikins', { setup: (G) => { G.areas[4].building = '0'; } });
    s.start();
    expect(s.prompt()?.options).toEqual([4]);
  });

  it('дымящий гну: только район с беспорядком', () => {
    const s = scenario('smoking-gnu');
    s.start();
    expect(s.prompt()?.options).toEqual([1, 5, 7]);
  });

  it('ридкулли: двух слуг во Внедвижимость или соседний', () => {
    const s = scenario('archchancellor-ridcully');
    s.start();
    expect(s.prompt()?.options).toEqual([2, 1, 3, 4, 10, 11, 12]);
    s.answer('0', 2);
    expect(s.prompt()).not.toBeNull();
    s.answer('0', 3);
    expect([s.G.areas[2].minions['0'], s.G.areas[3].minions['0']]).toEqual([1, 1]);
  });

  it('декан: убрать слугу из Внедвижимости', () => {
    const s = scenario('dean-of-pentacles', { setup: (G) => { G.areas[2].minions['2'] = 1; } });
    s.start();
    s.answer('0', '2:minion:2');
    expect(s.G.areas[2].minions['2']).toBe(0);
  });

  it('доктор хикс и толпа: беспорядок', () => {
    const a = scenario('dr-hicks');
    a.start();
    a.answer('0', 9);
    expect(a.G.areas[9].trouble).toBe(true);
    const b = scenario('the-mob');
    b.start();
    expect(b.prompt()?.options).toEqual([2, 3, 4, 6, 8, 10, 12]);
  });

  it('казначей: поменять двух слуг местами', () => {
    const s = scenario('bursar');
    s.start();
    s.answer('0', '1:minion:1');
    s.answer('0', '5:minion:2');
    expect([s.G.areas[1].minions['2'], s.G.areas[5].minions['1']]).toEqual([2, 2]);
    expect([s.G.areas[1].minions['1'], s.G.areas[5].minions['2']]).toEqual([0, 0]);
    expect([s.G.players['1'].minionSupply, s.G.players['2'].minionSupply]).toEqual([9, 9]);
  });

  it('мистер слэнт: $2 за слугу в районе с беспорядком', () => {
    const s = scenario('mr-slant');
    s.start();
    s.answer('0', 1);
    expect(s.G.players['0'].money).toBe(16);
  });

  it('крошка безумный артур: здание за полцены', () => {
    const s = scenario('wee-mad-arthur', { setup: (G) => { G.areas[2].minions['0'] = 1; } });
    s.start();
    expect(s.prompt()?.options).toEqual([2]);
    s.answer('0', 2);
    expect([s.G.areas[2].building, s.G.players['0'].money]).toEqual(['0', 1]);
  });

  it('сибилла: замена чужого здания без беспорядка с компенсацией', () => {
    const s = scenario('sybil-vimes', { setup: (G) => { G.areas[3].building = '1'; G.players['0'].money = 20; } });
    s.start();
    s.answer('0', '3:building:1');
    expect(s.G.areas[3].building).toBe('0');
    expect([s.G.players['0'].money, s.G.players['1'].money]).toEqual([8, 22]);
  });

  it('ричер гилт: только район с беспорядком', () => {
    const s = scenario('reacher-gilt', { setup: (G) => { G.areas[3].building = '1'; G.areas[7].building = '2'; } });
    s.start();
    expect(s.prompt()?.options).toEqual(['7:building:2']);
  });

  it('бёрли и стронг: $2 игроку, затем убрать слугу', () => {
    const s = scenario('burleigh-and-stronginthearm');
    s.start();
    s.answer('0', '2');
    s.answer('0', '5:minion:1');
    expect(s.G.areas[5].minions['1']).toBe(0);
    expect(s.G.players['2'].money).toBe(12);
  });
});

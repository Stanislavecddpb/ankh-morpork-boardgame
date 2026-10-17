import { describe, it, expect } from 'vitest';
import { setupGame } from './setup';
import {
  legalMinionAreas, placeMinion, canBuildIn, buildIn, assassinationTargets, assassinate,
  removeTroubleIn, controls, troubleCount, minionLikeCount,
} from './rules';

const fresh = (n = 3) => setupGame(n, (a) => [...a]);

describe('слуги и беспорядки', () => {
  it('ставить можно в свои районы и соседние', () => {
    expect(legalMinionAreas(fresh(), '0')).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 10, 12]);
  });

  it('в пустой район — без беспорядка, в занятый — с беспорядком', () => {
    const G = fresh();
    expect(placeMinion(G, '0', 2)).toBeNull();
    expect(G.areas[2].minions['0']).toBe(1);
    expect(G.areas[2].trouble).toBe(false);
    expect(G.players['0'].minionSupply).toBe(8);
    expect(placeMinion(G, '0', 2)).toBeNull();
    expect(G.areas[2].trouble).toBe(true);
  });

  it('в недоступный район нельзя', () => {
    const G = fresh();
    expect(placeMinion(G, '0', 9)).not.toBeNull();
    expect(G.areas[9].minions['0']).toBe(0);
  });

  it('пустой запас: надо переставить своего слугу, уход снимает беспорядок', () => {
    const G = fresh();
    G.players['0'].minionSupply = 0;
    expect(placeMinion(G, '0', 2)).not.toBeNull();
    expect(placeMinion(G, '0', 2, 5)).toBeNull();
    expect(G.areas[5].minions['0']).toBe(0);
    expect(G.areas[5].trouble).toBe(false);
    expect(G.areas[2].minions['0']).toBe(1);
  });
});

describe('здания', () => {
  it('нельзя при беспорядке, без слуги, без денег', () => {
    const G = fresh();
    expect(canBuildIn(G, '0', 1)).toBe(false); // беспорядок
    expect(canBuildIn(G, '0', 9)).toBe(false); // нет слуги
    placeMinion(G, '0', 2);
    expect(canBuildIn(G, '0', 2)).toBe(false); // $18 > $10
    G.players['0'].money = 20;
    expect(buildIn(G, '0', 2)).toBeNull();
    expect(G.areas[2].building).toBe('0');
    expect(G.players['0'].money).toBe(2);
    expect(G.players['0'].buildingSupply).toBe(5);
    expect(G.areas[2].trouble).toBe(false);
  });

  it('все шесть на поле — переносим своё здание', () => {
    const G = fresh();
    placeMinion(G, '0', 2);
    placeMinion(G, '0', 3);
    G.players['0'].money = 100;
    buildIn(G, '0', 2);
    G.players['0'].buildingSupply = 0;
    expect(buildIn(G, '0', 3)).not.toBeNull();
    expect(buildIn(G, '0', 3, 2)).toBeNull();
    expect(G.areas[2].building).toBeNull();
    expect(G.areas[3].building).toBe('0');
  });
});

describe('убийство и беспорядки', () => {
  it('только чужие фишки в районе с беспорядком; беспорядок снимается', () => {
    const G = fresh();
    G.areas[1].demons = 1;
    const targets = assassinationTargets(G, '0', 1);
    expect(targets).toEqual([{ kind: 'minion', owner: '1' }, { kind: 'minion', owner: '2' }, { kind: 'demon' }]);
    expect(assassinate(G, '0', 1, { kind: 'minion', owner: '0' })).not.toBeNull();
    expect(assassinate(G, '0', 1, { kind: 'minion', owner: '1' })).toBeNull();
    expect(G.areas[1].minions['1']).toBe(0);
    expect(G.players['1'].minionSupply).toBe(10);
    expect(G.areas[1].trouble).toBe(false);
    expect(assassinationTargets(G, '0', 1)).toEqual([]);
  });

  it('снять беспорядок можно только там, где он есть', () => {
    const G = fresh();
    expect(troubleCount(G)).toBe(3);
    expect(removeTroubleIn(G, 2)).not.toBeNull();
    expect(removeTroubleIn(G, 1)).toBeNull();
    expect(troubleCount(G)).toBe(2);
  });

  it('демоны и тролли считаются как слуги', () => {
    const G = fresh();
    G.areas[9].trolls = 1;
    expect(minionLikeCount(G.areas[9])).toBe(1);
  });
});

describe('контроль', () => {
  it('большинство фишек, здание считается, демон и тролли мешают', () => {
    const G = fresh();
    expect(controls(G, '0', 1)).toBe(false); // 1:1:1
    G.areas[1].minions['0'] = 2;
    expect(controls(G, '0', 1)).toBe(true);
    G.areas[1].demons = 1;
    expect(controls(G, '0', 1)).toBe(false);
    G.areas[1].demons = 0;
    G.areas[1].trolls = 2;
    expect(controls(G, '0', 1)).toBe(false);
    G.areas[1].building = '0';
    expect(controls(G, '0', 1)).toBe(true);
  });
});

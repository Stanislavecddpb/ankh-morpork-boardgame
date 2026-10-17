import { describe, it, expect } from 'vitest';
import { scenario } from './testkit';

describe('пачка 5: кубик', () => {
  it('достабль: 7+ — $4', () => {
    const s = scenario('cmot-dibbler', { rolls: [9] });
    s.start();
    expect(s.G.players['0'].money).toBe(14);
  });

  it('достабль: 1 — $1 в банк и убрать своего слугу', () => {
    const s = scenario('cmot-dibbler', { rolls: [1] });
    s.start();
    expect(s.G.players['0'].money).toBe(9);
    expect(s.prompt()).toMatchObject({ kind: 'piece', locked: true });
    s.answer('0', '5:minion:0');
    expect(s.G.areas[5].minions['0']).toBe(0);
  });

  it('здесь-и-сейчас: 7+ — $3 у игрока', () => {
    const s = scenario('herennow', { rolls: [12] });
    s.start();
    s.answer('0', '2');
    expect(s.G.players['0'].money).toBe(13);
  });

  it('эррол: 7+ — убрать слугу из района с беспорядком', () => {
    const s = scenario('errol', { rolls: [7] });
    s.start();
    expect(s.prompt()?.options).toContain('7:minion:2');
    s.answer('0', '7:minion:2');
    expect(s.G.areas[7].minions['2']).toBe(0);
  });

  it('средний бросок — ничего', () => {
    const s = scenario('errol', { rolls: [4] });
    s.start();
    expect(s.prompt()).toBeNull();
  });

  it('карцер: из двух выпавших районов по слуге, обязательно', () => {
    const s = scenario('carcer', { rolls: [1, 9] });
    s.start();
    expect(s.prompt()).toMatchObject({ kind: 'piece', locked: true });
    s.answer('0', '1:minion:1');
    // в районе 9 никого — эффект завершён
    expect(s.prompt()).toBeNull();
    expect(s.G.areas[1].minions['1']).toBe(0);
  });
});

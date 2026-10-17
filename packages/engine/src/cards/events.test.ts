import { describe, it, expect } from 'vitest';
import type { AMState, PlayerID } from '../types';
import { setupGame } from '../setup';
import { startTurn } from '../turn';
import { finalScore, hasWon } from '../victory';
import { answerPrompt, makeApi, type Rnd } from './run';
import { startEvent } from './events';
import './index';

/** Партия на 3: setup до начала хода (здания там «старые»), на столе карта с символом события. */
function game(event: string, rolls: number[], setup?: (G: AMState) => void) {
  const G = setupGame(3, (a) => [...a]);
  setup?.(G);
  startTurn(G);
  G.events = [event];
  G.play = { cardId: 'x', queue: [{ kind: 'event' }] };
  const left = [...rolls];
  const rnd: Rnd = { d12: () => left.shift() ?? 12, shuffle: (a) => [...a] };
  const api = () => makeApi(G, '0', ['0', '1', '2'], rnd);
  const start = () => startEvent(api());
  return { G, start, answer: (pid: PlayerID, c: any) => answerPrompt(api(), pid, c), left };
}

const gods = (owner: PlayerID) => (G: AMState) => { G.areas[4].building = owner; G.players[owner].buildingSupply--; };

describe('события', () => {
  it('Дракон опустошает район, карта идёт дальше', () => {
    const { G, start } = game('the-dragon', [7], (G) => { G.areas[7].building = '1'; G.areas[7].trolls = 1; });
    expect(start()).toBeNull();
    const a = G.areas[7];
    expect([a.minions['0'], a.minions['1'], a.minions['2'], a.building, a.trolls, a.trouble]).toEqual([0, 0, 0, null, 0, false]);
    expect(G.players['1'].buildingSupply).toBe(7);
    expect(G.play).toBeNull();
    expect(G.discard).toContain('x');
    expect(G.eventRolls).toEqual([7]);
  });

  it('Дракон и Мелкие Боги: защитить здание и одного из двух слуг', () => {
    const { G, start, answer } = game('the-dragon', [7], (G) => {
      gods('1')(G);
      G.areas[7].building = '1';
      G.areas[7].minions['1'] = 2;
    });
    expect(start()).toBeNull();
    expect(G.prompt).toMatchObject({ actor: '1', step: 'guard', options: [0, 1], locked: true });
    expect(answer('0', 1)).not.toBeNull();
    expect(answer('1', 1)).toBeNull();
    expect(G.prompt!.options).toEqual([0, 1, 2]);
    expect(answer('1', 1)).toBeNull();
    expect(G.prompt).toBeNull();
    expect(G.areas[7].building).toBe('1');
    expect(G.areas[7].minions).toEqual({ 0: 0, 1: 1, 2: 0 });
    expect(G.players['1'].money).toBe(4);
  });

  it('Мелкие Боги не работают с демоном в районе', () => {
    const { G, start } = game('explosion', [7], (G) => { gods('1')(G); G.areas[4].demons = 1; G.areas[7].building = '1'; });
    expect(start()).toBeNull();
    expect(G.areas[7].building).toBeNull();
  });

  it('Взрыв и Землетрясение сносят здания', () => {
    const e = game('earthquake', [2, 3], (G) => { G.areas[2].building = '0'; G.areas[3].building = '2'; });
    expect(e.start()).toBeNull();
    expect([e.G.areas[2].building, e.G.areas[3].building]).toEqual([null, null]);
  });

  it('Пожар идёт по соседям, пока выпадают соседи со зданиями', () => {
    const { G, start } = game('fire', [1, 2, 11, 3, 12], (G) => {
      for (const id of [1, 2, 11, 12]) G.areas[id].building = '0';
    });
    expect(start()).toBeNull();
    expect([1, 2, 11, 12].map((id) => G.areas[id].building)).toEqual([null, null, null, '0']);
    expect(G.eventRolls).toEqual([1, 2, 11, 3]);
  });

  it('Пожар не начался — здания в районе нет', () => {
    const { G, start } = game('fire', [3, 2], (G) => { G.areas[2].building = '0'; });
    expect(start()).toBeNull();
    expect(G.areas[2].building).toBe('0');
    expect(G.eventRolls).toEqual([3]);
  });

  it('Туман сбрасывает 5 карт', () => {
    const { G, start } = game('fog', []);
    const top = G.deck.slice(0, 5);
    expect(start()).toBeNull();
    expect(G.discard.slice(0, 5)).toEqual(top);
  });

  it('Бунты: меньше 8 беспорядков — ничего, 8 — конец игры', () => {
    const a = game('riots', []);
    expect(a.start()).toBeNull();
    expect(a.G.gameover).toBeNull();
    const b = game('riots', [], (G) => { for (let i = 1; i <= 8; i++) G.areas[i].trouble = true; G.players['2'].personality = 'commander-vimes'; });
    expect(b.start()).toBeNull();
    expect(b.G.gameover).toMatchObject({ reason: 'riots' });
    expect(b.G.gameover!.scores).toBeDefined();
  });

  it('Демоны: демон и беспорядок даже в пустой район', () => {
    const { G, start } = game('demons-from-dungeon-dimensions', [3, 3, 9, 7]);
    expect(start()).toBeNull();
    expect([G.areas[3].demons, G.areas[9].demons, G.areas[7].demons]).toEqual([2, 1, 1]);
    expect(G.areas[3].trouble && G.areas[9].trouble).toBe(true);
  });

  it('Демоны: Мелкие Боги не пускают демона к своим фишкам', () => {
    const { G, start, answer } = game('demons-from-dungeon-dimensions', [1, 3, 3, 9], gods('0'));
    expect(start()).toBeNull();
    expect(G.prompt).toMatchObject({ actor: '0', step: 'guard' });
    expect(answer('0', 1)).toBeNull();
    expect(G.areas[1].demons).toBe(0);
    expect(G.areas[3].demons).toBe(2);
  });

  it('Демоны: в районе с демоном нет очков и Ветинари его не считает', () => {
    const G = setupGame(3, (a) => [...a]);
    G.areas[2].building = '0';
    const before = finalScore(G, '0');
    G.areas[2].demons = 1;
    G.areas[1].demons = 1;
    expect(finalScore(G, '0')).toBe(before - 17 - 5);
    G.players['0'].personality = 'lord-vetinari';
    for (const id of [2, 3, 4, 6, 8, 9, 10]) G.areas[id].minions['0'] = 1;
    expect(hasWon(G, '0', 3)).toBe(false);
    G.areas[1].demons = 0;
    G.areas[2].demons = 0;
    expect(hasWon(G, '0', 3)).toBe(true);
  });

  it('Тролли: беспорядок только если там уже кто-то есть; запас ограничен', () => {
    const { G, start } = game('trolls', [3, 3, 7], (G) => { G.areas[7].trouble = false; });
    expect(start()).toBeNull();
    expect([G.areas[3].trolls, G.areas[3].trouble, G.areas[7].trolls, G.areas[7].trouble]).toEqual([2, true, 1, true]);
    const b = game('trolls', [2, 2, 2], (G) => { G.areas[9].trolls = 2; });
    expect(b.start()).toBeNull();
    expect(b.G.areas[2].trolls).toBe(1);
  });

  it('Тупица Джонсон: карточка отложена, владелец теряет слугу', () => {
    const { G, start } = game('bloody-stupid-johnson', [1], (G) => { G.areas[1].building = '1'; });
    expect(start()).toBeNull();
    expect(G.disabledDistricts).toEqual([1]);
    expect(G.areas[1].minions['1']).toBe(0);
    expect(G.areas[1].building).toBe('1');
  });

  it('Обрушение: кто не может платить — сносит здания на выбор', () => {
    const { G, start, answer } = game('subsidence', [], (G) => {
      for (const id of [2, 3]) G.areas[id].building = '0';
      for (const id of [9, 10, 11]) G.areas[id].building = '1';
      G.players['1'].money = 3;
    });
    expect(start()).toBeNull();
    expect(G.players['0'].money).toBe(6);
    expect(G.prompt).toMatchObject({ actor: '1', options: [9, 10, 11] });
    expect(answer('1', 10)).toBeNull();
    expect(G.prompt).toMatchObject({ actor: '1', options: [9, 11] });
    expect(answer('1', 9)).toBeNull();
    expect(G.prompt).toBeNull();
    expect(G.players['1'].money).toBe(1);
    expect(G.areas[11].building).toBe('1');
  });

  it('Наводнение: каждый уводит слуг в соседний незатопленный район', () => {
    const { G, start, answer } = game('flood', [5, 3], (G) => { G.areas[5].minions['0'] = 2; });
    expect(start()).toBeNull();
    expect(G.prompt).toMatchObject({ actor: '0', options: [4, 6, 7, 10] });
    expect(answer('0', 4)).toBeNull();
    expect(answer('0', 6)).toBeNull();
    expect(G.prompt).toMatchObject({ actor: '1' });
    expect(answer('1', 7)).toBeNull();
    expect(answer('2', 10)).toBeNull();
    expect(G.prompt).toBeNull();
    expect(G.areas[5].minions).toEqual({ 0: 0, 1: 0, 2: 0 });
    expect(G.areas[5].trouble).toBe(false);
    expect([G.areas[4].minions['0'], G.areas[6].minions['0']]).toEqual([1, 1]);
  });

  it('Таинственные убийства: каждый бросает и выбирает жертву', () => {
    const { G, start, answer } = game('mysterious-murders', [1, 3, 5], (G) => { G.areas[5].minions['1'] = 0; });
    expect(start()).toBeNull();
    expect(G.prompt).toMatchObject({ actor: '0', options: ['0', '1', '2'] });
    expect(answer('0', '2')).toBeNull();
    // У '1' выпал пустой район, у '2' — Сточный, где только слуги '0' и '2'.
    expect(G.prompt).toMatchObject({ actor: '2', options: ['0', '2'] });
    expect(answer('2', '0')).toBeNull();
    expect(G.prompt).toBeNull();
    expect(G.areas[1].minions['2']).toBe(0);
    expect(G.areas[5].minions['0']).toBe(0);
  });

  it('Таинственные убийства: Мелкие Боги спасают слугу', () => {
    const { G, start, answer } = game('mysterious-murders', [3, 3, 3], (G) => { gods('1')(G); G.areas[3].minions['1'] = 2; });
    expect(start()).toBeNull();
    expect(G.prompt).toMatchObject({ actor: '1', step: 'mguard' });
    expect(answer('1', 1)).toBeNull();
    expect(G.prompt).toMatchObject({ actor: '1', step: 'mguard' });
    expect(answer('1', 0)).toBeNull();
    expect(G.prompt).toMatchObject({ actor: '1', step: 'mguard' });
    expect(answer('1', 1)).toBeNull();
    expect(G.areas[3].minions['1']).toBe(1);
    expect(G.players['1'].money).toBe(4);
  });
});

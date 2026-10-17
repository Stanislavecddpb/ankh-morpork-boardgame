// Способности карточек районов: раз за ход, в свой ход, без открытого вопроса.
import type { AMState, AreaId, PlayerID } from '../types';
import { AREA_IDS, areaDef } from '../data/areas';
import { drawCards } from '../helpers';
import { minionLikeCount, troubleAreas } from '../rules';
import { ask, cardNames, moveCards, putMinion, say } from './ops';
import { defineEffects, runEffect, type Effect, type EffectApi } from './run';

/** Мелкие Боги — пассивная способность (защита от событий), кнопки у неё нет. */
export const SMALL_GODS = 4;

/** Карточка района работает у pid: здание его с начала хода, карточка не отложена, демонов нет. */
export function districtActive(G: AMState, area: AreaId, pid: PlayerID): boolean {
  const a = G.areas[area];
  return a.building === pid && G.startOwners[area] === pid && !G.disabledDistricts.includes(area) && a.demons === 0;
}

const shadesTargets = (G: AMState) =>
  [7, ...areaDef(7).adjacent].filter((id) => !G.areas[id].trouble && minionLikeCount(G.areas[id]) > 0).sort((a, b) => a - b);
const dollyTargets = (area: AreaId) => [area, ...areaDef(area).adjacent].sort((a, b) => a - b);

/** Почему способностью района сейчас нельзя воспользоваться (null — можно). */
export function districtBlock(G: AMState, pid: PlayerID, area: AreaId): string | null {
  const p = G.players[pid];
  if (area === SMALL_GODS) return 'Мелкие Боги срабатывают сами при событиях';
  if (!districtActive(G, area, pid)) return 'Карточка района сейчас не работает';
  if (G.districtsUsed.includes(area)) return 'Уже использовано в этот ход';
  if (G.prompt) return 'Сначала ответьте на вопрос';
  switch (area) {
    case 1: case 8: return p.money < 3 ? 'Нужно $3' : p.minionSupply < 1 ? 'Нет слуг в запасе' : null;
    case 2: return G.deck.length === 0 ? 'Колода пуста' : null;
    case 5: return p.hand.length === 0 ? 'Нет карт в руке' : null;
    case 7: return shadesTargets(G).length === 0 ? 'Некуда положить беспорядок' : null;
    case 10: return p.money < 2 ? 'Нужно $2' : troubleAreas(G).length === 0 ? 'Нет беспорядков' : null;
    default: return null;
  }
}

export const usableDistricts = (G: AMState, pid: PlayerID): AreaId[] =>
  AREA_IDS.filter((id) => !districtBlock(G, pid, id));

const income = (amount: number): Effect => ({
  start: (api) => { api.G.players[api.pid].money += amount; say(api, `берёт $${amount}`); return null; },
});

const placeMinion = (area: AreaId): Effect => ({
  start: (api) => ask(api, { step: 'area', kind: 'area', options: dollyTargets(area), text: 'Заплатите $3: куда поставить слугу?' }),
  answer: (api, _p, c) => {
    const area = Number(c);
    api.G.players[api.pid].money -= 3;
    putMinion(api.G, api.pid, area);
    say(api, `платит $3 и ставит слугу: ${areaDef(area).name}`);
    return null;
  },
});

defineEffects({
  'district:1': placeMinion(1),
  'district:8': placeMinion(8),
  'district:2': {
    start: (api) => {
      drawCards(api.G, api.pid, 1);
      api.lock();
      say(api, 'берёт карту');
      return ask(api, { step: 'discard', kind: 'hand', options: [], min: 1, max: 1, text: 'Сбросьте карту', locked: true });
    },
    answer: (api, _p, c) => {
      moveCards(api.G, api.pid, 'discard', c as string[]);
      say(api, `сбрасывает ${cardNames(c as string[])}`);
      return null;
    },
  },
  'district:3': income(2),
  'district:6': income(2),
  'district:5': {
    start: (api) => ask(api, { step: 'discard', kind: 'hand', options: [], min: 1, max: 1, text: 'Сбросьте карту и получите $2' }),
    answer: (api, _p, c) => {
      moveCards(api.G, api.pid, 'discard', c as string[]);
      api.G.players[api.pid].money += 2;
      say(api, `сбрасывает ${cardNames(c as string[])} и берёт $2`);
      return null;
    },
  },
  'district:7': {
    start: (api) => ask(api, { step: 'area', kind: 'area', options: shadesTargets(api.G), text: 'Куда положить беспорядок?' }),
    answer: (api, _p, c) => {
      api.G.areas[Number(c)].trouble = true;
      say(api, `кладёт беспорядок: ${areaDef(Number(c)).name}`);
      return null;
    },
  },
  'district:9': income(1),
  'district:12': income(1),
  'district:10': {
    start: (api) => ask(api, { step: 'area', kind: 'area', options: troubleAreas(api.G), text: 'Заплатите $2: какой беспорядок убрать?' }),
    answer: (api, _p, c) => {
      api.G.players[api.pid].money -= 2;
      api.G.areas[Number(c)].trouble = false;
      say(api, `платит $2 и убирает беспорядок: ${areaDef(Number(c)).name}`);
      return null;
    },
  },
  'district:11': income(3),
});

/** Ход «способность района». */
export function useDistrict(api: EffectApi, area: AreaId): string | null {
  const { G, pid } = api;
  if (G.gameover) return 'Игра окончена';
  const block = districtBlock(G, pid, area);
  if (block) return block;
  G.districtsUsed.push(area);
  return runEffect(api, `district:${area}`, 'district', (eff) => eff.start(api));
}

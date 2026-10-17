import type { AMState, AreaId, PlayerID } from './types';
import { MAX_DEMONS, MAX_TROLLS } from './types';
import { AREA_IDS, areaDef } from './data/areas';
import { CARD_BY_ID } from './data/cards';
import { log, nameOf } from './helpers';

export type ManualAction =
  | { type: 'minion'; area: AreaId; owner: PlayerID; delta: 1 | -1 }
  | { type: 'building'; area: AreaId; owner: PlayerID | null }
  | { type: 'trouble'; area: AreaId; on: boolean }
  | { type: 'demon'; area: AreaId; delta: 1 | -1 }
  | { type: 'troll'; area: AreaId; delta: 1 | -1 }
  | { type: 'money'; from: PlayerID | 'bank'; to: PlayerID | 'bank'; amount: number }
  | { type: 'loan'; player: PlayerID; delta: 1 | -1 }
  | { type: 'discard'; cardId: string }
  | { type: 'give'; cardId: string; to: PlayerID }
  | { type: 'takeDiscard'; cardId: string };

const sign = (d: number) => (d > 0 ? '+' : '−');

/** Ручная правка состояния (для текстов карт и событий, которые пока не автоматизированы). */
export function applyManual(G: AMState, pid: PlayerID, a: ManualAction): string | null {
  const who = `✋ ${nameOf(G, pid)}`;
  const holder = (p: PlayerID | 'bank') => (p === 'bank' ? 'банк' : nameOf(G, p));

  switch (a.type) {
    case 'minion': {
      const area = G.areas[a.area];
      const owner = G.players[a.owner];
      if (!area || !owner) return 'Нет такого района или игрока';
      if (a.delta > 0) {
        if (owner.minionSupply < 1) return 'Нет слуг в запасе';
        owner.minionSupply--;
        area.minions[a.owner]++;
      } else {
        if (area.minions[a.owner] < 1) return 'Там нет такого слуги';
        area.minions[a.owner]--;
        owner.minionSupply++;
      }
      log(G, `${who}: ${sign(a.delta)}слуга ${nameOf(G, a.owner)}, ${areaDef(a.area).name}`);
      return null;
    }
    case 'building': {
      const area = G.areas[a.area];
      if (!area) return 'Нет такого района';
      if (area.building === a.owner) return 'Ничего не меняется';
      if (a.owner !== null) {
        const owner = G.players[a.owner];
        if (!owner || owner.buildingSupply < 1) return 'Нет зданий в запасе';
        owner.buildingSupply--;
      }
      if (area.building !== null) G.players[area.building].buildingSupply++;
      area.building = a.owner;
      log(G, `${who}: здание в «${areaDef(a.area).name}» — ${a.owner === null ? 'убрано' : nameOf(G, a.owner)}`);
      return null;
    }
    case 'trouble': {
      if (!G.areas[a.area]) return 'Нет такого района';
      G.areas[a.area].trouble = a.on;
      log(G, `${who}: беспорядок ${a.on ? 'положен' : 'убран'}, ${areaDef(a.area).name}`);
      return null;
    }
    case 'demon':
    case 'troll': {
      const area = G.areas[a.area];
      if (!area) return 'Нет такого района';
      const key = a.type === 'demon' ? 'demons' : 'trolls';
      const max = a.type === 'demon' ? MAX_DEMONS : MAX_TROLLS;
      const onBoard = AREA_IDS.reduce((s, id) => s + G.areas[id][key], 0);
      if (a.delta > 0 && onBoard >= max) return 'Все такие фишки уже на поле';
      if (a.delta < 0 && area[key] < 1) return 'Здесь их нет';
      area[key] += a.delta;
      log(G, `${who}: ${sign(a.delta)}${a.type === 'demon' ? 'демон' : 'тролль'}, ${areaDef(a.area).name}`);
      return null;
    }
    case 'money': {
      if (!Number.isInteger(a.amount) || a.amount <= 0) return 'Неверная сумма';
      if (a.from === a.to) return 'Отправитель и получатель совпадают';
      if (a.from !== 'bank') {
        const from = G.players[a.from];
        if (!from) return 'Нет такого игрока';
        if (from.money < a.amount) return 'Не хватает денег';
        from.money -= a.amount;
      }
      if (a.to !== 'bank') {
        if (!G.players[a.to]) return 'Нет такого игрока';
        G.players[a.to].money += a.amount;
      }
      log(G, `${who}: $${a.amount} ${holder(a.from)} → ${holder(a.to)}`);
      return null;
    }
    case 'loan': {
      const p = G.players[a.player];
      if (!p) return 'Нет такого игрока';
      if (a.delta < 0 && p.loans < 1) return 'Займов нет';
      p.loans += a.delta;
      log(G, `${who}: ${a.delta > 0 ? 'займ взят' : 'займ погашен'} — ${nameOf(G, a.player)}`);
      return null;
    }
    case 'discard': {
      const hand = G.players[pid].hand;
      const i = hand.indexOf(a.cardId);
      if (i < 0) return 'Такой карты нет в руке';
      hand.splice(i, 1);
      G.discard.push(a.cardId);
      log(G, `${who}: сбрасывает «${CARD_BY_ID[a.cardId]?.name ?? a.cardId}»`);
      return null;
    }
    case 'give': {
      const hand = G.players[pid].hand;
      const i = hand.indexOf(a.cardId);
      if (i < 0) return 'Такой карты нет в руке';
      if (!G.players[a.to] || a.to === pid) return 'Некому передать';
      hand.splice(i, 1);
      G.players[a.to].hand.push(a.cardId);
      log(G, `${who}: передаёт карту игроку ${nameOf(G, a.to)}`);
      return null;
    }
    case 'takeDiscard': {
      const i = G.discard.lastIndexOf(a.cardId);
      if (i < 0) return 'Такой карты нет в сбросе';
      G.discard.splice(i, 1);
      G.players[pid].hand.push(a.cardId);
      log(G, `${who}: берёт из сброса «${CARD_BY_ID[a.cardId]?.name ?? a.cardId}»`);
      return null;
    }
  }
}
